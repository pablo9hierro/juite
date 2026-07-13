import { useEffect, useMemo, useState } from 'react'
import { Cake, Gift, Layers, Loader2, Plus, Search, Sparkles, Tag, Trash2, Users, X } from 'lucide-react'
import Card from '../../components/ui/Card'
import WhatsAppLink from '../../components/ui/WhatsAppLink'
import ExpiryInput from '../../components/admin/ExpiryInput'
import ProductCategoryMultiSelect from '../../components/admin/ProductCategoryMultiSelect'
import ProductDiscountList from '../../components/admin/ProductDiscountList'
import { api, ApiError } from '../../lib/api'
import type { Campaign, Category, Coupon, CouponKind, CrmCustomer, CrmSegment, DiscountType, Product, ProductDiscount } from '../../lib/types'

// Some browsers only show the native number spinner on hover/focus, which
// looks broken in these narrow filter inputs — hidden consistently here.
const NO_SPINNER = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}
function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}
function isBirthdayMonth(birthdate: string | null) {
  if (!birthdate) return false
  return new Date(birthdate).getMonth() === new Date().getMonth()
}
function daysSince(iso: string | null): number {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000)
}
function discountLabel(discountType: DiscountType | null, value: number | null) {
  if (!discountType || value == null) return null
  return discountType === 'percent' ? `${value}% off` : `R$ ${value.toFixed(2).replace('.', ',')} off`
}

const COUPON_KIND_LABEL: Record<CouponKind, string> = {
  desconto: 'Desconto',
  frete: 'Desconto no frete',
  aniversario: 'Aniversário',
  produto: 'Desconto por produto',
}

type FilterState = {
  minOrders: string
  minOrdersDays: string
  minItems: string
  minItemsDays: string
  spentBelowAmount: string
  spentBelowDays: string
  spentAboveAmount: string
  spentAboveDays: string
  frequencyDropPercent: string
  newCustomerDays: string
  maxDistanceKm: string
  neighborhoods: string[]
  birthdayMonth: string
  recurringProductIds: string[]
  recurringCategoryIds: string[]
  recurringDays: string
}
const EMPTY_FILTER: FilterState = {
  minOrders: '',
  minOrdersDays: '',
  minItems: '',
  minItemsDays: '',
  spentBelowAmount: '',
  spentBelowDays: '',
  spentAboveAmount: '',
  spentAboveDays: '',
  frequencyDropPercent: '',
  newCustomerDays: '',
  maxDistanceKm: '',
  neighborhoods: [],
  birthdayMonth: '',
  recurringProductIds: [],
  recurringCategoryIds: [],
  recurringDays: '',
}
function filterIsEmpty(f: FilterState) {
  return (
    !f.minOrders &&
    !f.minItems &&
    !f.spentBelowAmount &&
    !f.spentAboveAmount &&
    !f.frequencyDropPercent &&
    !f.newCustomerDays &&
    !f.maxDistanceKm &&
    !f.birthdayMonth &&
    f.neighborhoods.length === 0 &&
    f.recurringProductIds.length === 0 &&
    f.recurringCategoryIds.length === 0
  )
}

// Toda combinação valor+dias segue a mesma regra: dias é só um refinamento
// opcional — sem preencher, generaliza pro histórico completo do cliente
// em vez de travar a busca. Mas se dias for preenchido sem o campo
// principal, isso é inválido (ver validatePairErrors), não silenciosamente
// ignorado.
function spentInWindow(c: CrmCustomer, days: number | null): number {
  if (days == null) return c.total_spent
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return c.orders.filter((o) => new Date(o.created_at).getTime() >= cutoff).reduce((sum, o) => sum + o.total, 0)
}

function ordersInWindow(c: CrmCustomer, days: number | null): number {
  if (days == null) return c.order_count
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return c.orders.filter((o) => new Date(o.created_at).getTime() >= cutoff).length
}

function itemsInWindow(c: CrmCustomer, days: number | null): number {
  if (days == null) return c.total_items
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return c.purchases
    .filter((p) => new Date(p.created_at).getTime() >= cutoff)
    .reduce((sum, p) => sum + (p.quantity ?? 1), 0)
}

const PAIR_ERROR_MESSAGE = 'Se você preencher o campo "Dias" precisa preencher este campo também ou deixe ambos em branco.'

type PairErrors = Partial<Record<'minOrders' | 'minItems' | 'spentBelow' | 'spentAbove' | 'recurring', string>>

function validatePairErrors(f: FilterState): PairErrors {
  const errors: PairErrors = {}
  if (f.minOrdersDays && !f.minOrders) errors.minOrders = PAIR_ERROR_MESSAGE
  if (f.minItemsDays && !f.minItems) errors.minItems = PAIR_ERROR_MESSAGE
  if (f.spentBelowDays && !f.spentBelowAmount) errors.spentBelow = PAIR_ERROR_MESSAGE
  if (f.spentAboveDays && !f.spentAboveAmount) errors.spentAbove = PAIR_ERROR_MESSAGE
  const hasRecurringSelection = f.recurringProductIds.length > 0 || f.recurringCategoryIds.length > 0
  if (hasRecurringSelection !== !!f.recurringDays) errors.recurring = PAIR_ERROR_MESSAGE
  return errors
}

// Reincidência: pega os timestamps de compra dos produtos selecionados
// (direto ou via categoria) e vê se o intervalo médio entre compras bate
// com o "a cada N dias" pedido — precisa de pelo menos 2 compras
// qualificadas pra falar em intervalo.
function matchesRecurring(c: CrmCustomer, productIds: string[], categoryIds: string[], days: number, products: Product[]): boolean {
  const categoryProductIds = new Set(products.filter((p) => p.category_id && categoryIds.includes(p.category_id)).map((p) => p.id))
  const targetIds = new Set([...productIds, ...categoryProductIds])
  if (targetIds.size === 0) return false
  const timestamps = c.purchases
    .filter((p) => targetIds.has(p.product_id))
    .map((p) => new Date(p.created_at).getTime())
    .sort((a, b) => a - b)
  if (timestamps.length < 2) return false
  let totalGap = 0
  for (let i = 1; i < timestamps.length; i++) totalGap += timestamps[i] - timestamps[i - 1]
  const avgGapDays = totalGap / (timestamps.length - 1) / (24 * 60 * 60 * 1000)
  return avgGapDays <= days
}

// Compara pedidos dos últimos 30 dias com os 30 dias anteriores — sem
// pedido nenhum no período anterior, não dá pra falar em "redução".
function frequencyDropPercent(c: CrmCustomer): number {
  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const recent = c.orders.filter((o) => now - new Date(o.created_at).getTime() <= 30 * day).length
  const prior = c.orders.filter((o) => {
    const age = now - new Date(o.created_at).getTime()
    return age > 30 * day && age <= 60 * day
  }).length
  if (prior === 0) return 0
  return Math.max(0, ((prior - recent) / prior) * 100)
}

function applyFilters(customers: CrmCustomer[], f: FilterState, products: Product[]): CrmCustomer[] {
  return customers.filter((c) => {
    if (f.minOrders && ordersInWindow(c, f.minOrdersDays ? Number(f.minOrdersDays) : null) < Number(f.minOrders)) return false
    if (f.minItems && itemsInWindow(c, f.minItemsDays ? Number(f.minItemsDays) : null) < Number(f.minItems)) return false
    if (f.spentBelowAmount && spentInWindow(c, f.spentBelowDays ? Number(f.spentBelowDays) : null) >= Number(f.spentBelowAmount)) return false
    if (f.spentAboveAmount && spentInWindow(c, f.spentAboveDays ? Number(f.spentAboveDays) : null) <= Number(f.spentAboveAmount)) return false
    if (f.frequencyDropPercent && frequencyDropPercent(c) < Number(f.frequencyDropPercent)) return false
    if (f.newCustomerDays) {
      if (!c.first_order_at || daysSince(c.first_order_at) > Number(f.newCustomerDays)) return false
    }
    if (f.maxDistanceKm) {
      if (c.distance_km == null || c.distance_km > Number(f.maxDistanceKm)) return false
    }
    if (f.neighborhoods.length > 0 && !c.neighborhoods.some((n) => f.neighborhoods.includes(n))) return false
    if (f.birthdayMonth) {
      if (!c.birthdate || new Date(c.birthdate).getMonth() !== Number(f.birthdayMonth)) return false
    }
    if ((f.recurringProductIds.length > 0 || f.recurringCategoryIds.length > 0) && f.recurringDays) {
      if (!matchesRecurring(c, f.recurringProductIds, f.recurringCategoryIds, Number(f.recurringDays), products)) return false
    }
    return true
  })
}

type CouponForm = {
  code: string
  kind: 'desconto' | 'frete' | 'aniversario' | 'produto'
  discount_type: DiscountType
  discount_value: string
  productDiscounts: ProductDiscount[]
  allow_campaign_checkout: boolean
  expires_at: string
  max_uses: string
}
const EMPTY_COUPON_FORM: CouponForm = {
  code: '',
  kind: 'desconto',
  discount_type: 'percent',
  discount_value: '',
  productDiscounts: [],
  allow_campaign_checkout: false,
  expires_at: '',
  max_uses: '',
}

type ProductDiscountMode = 'nenhum' | 'flat' | 'produto'

type TargetedForm = {
  code: string
  productMode: ProductDiscountMode
  discount_type: DiscountType
  discount_value: string
  productDiscounts: ProductDiscount[]
  shippingEnabled: boolean
  shipping_discount_type: DiscountType
  shipping_discount_value: string
  uses_per_customer: string
  dontNotify: boolean
  customMessage: string
  combinable_with_public: boolean
  allow_campaign_checkout: boolean
  expires_at: string
  max_uses: string
}
const EMPTY_TARGETED_FORM: TargetedForm = {
  code: '',
  productMode: 'flat',
  discount_type: 'percent',
  discount_value: '',
  productDiscounts: [],
  shippingEnabled: false,
  shipping_discount_type: 'percent',
  shipping_discount_value: '',
  uses_per_customer: '1',
  dontNotify: false,
  customMessage: '',
  combinable_with_public: false,
  allow_campaign_checkout: false,
  expires_at: '',
  max_uses: '',
}

export default function AdminCrm() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [query, setQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER)
  const [appliedFilter, setAppliedFilter] = useState<FilterState | null>(null)
  const [filterFormError, setFilterFormError] = useState<string | null>(null)
  const [pairErrors, setPairErrors] = useState<PairErrors>({})

  const [segments, setSegments] = useState<CrmSegment[]>([])
  const [segmentsLoading, setSegmentsLoading] = useState(true)
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [segmentName, setSegmentName] = useState('')
  const [segmentDescription, setSegmentDescription] = useState('')
  const [segmentCampaignId, setSegmentCampaignId] = useState('')
  const [segmentCouponId, setSegmentCouponId] = useState<string | null>(null)
  const [savingSegment, setSavingSegment] = useState(false)
  const [segmentError, setSegmentError] = useState<string | null>(null)
  const [targetedFormSegmentId, setTargetedFormSegmentId] = useState<string | null>(null)

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [couponsLoading, setCouponsLoading] = useState(true)
  const [showCouponForm, setShowCouponForm] = useState(false)
  const [couponForm, setCouponForm] = useState<CouponForm>(EMPTY_COUPON_FORM)
  const [savingCoupon, setSavingCoupon] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)

  const [showTargetedForm, setShowTargetedForm] = useState(false)
  const [targetedForm, setTargetedForm] = useState<TargetedForm>(EMPTY_TARGETED_FORM)
  const [savingTargeted, setSavingTargeted] = useState(false)
  const [targetedError, setTargetedError] = useState<string | null>(null)

  const loadCustomers = () => {
    setLoading(true)
    api.admin.crm.customers().then(setCustomers).finally(() => setLoading(false))
  }
  const loadCoupons = () => {
    setCouponsLoading(true)
    api.admin.coupons.list().then(setCoupons).finally(() => setCouponsLoading(false))
  }
  const loadSegments = () => {
    setSegmentsLoading(true)
    api.admin.segments.list().then(setSegments).finally(() => setSegmentsLoading(false))
  }
  useEffect(() => {
    loadCustomers()
    loadCoupons()
    loadSegments()
    api.admin.products.list().then(setProducts)
    api.admin.categories.list().then(setCategories)
    api.admin.campaigns.list().then(setCampaigns)
  }, [])

  const neighborhoods = useMemo(
    () => Array.from(new Set(customers.flatMap((c) => c.neighborhoods))).sort(),
    [customers]
  )

  const filteredBase = appliedFilter ? applyFilters(customers, appliedFilter, products) : customers
  const searched = query.trim()
    ? filteredBase.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()) || c.whatsapp.includes(query.trim()))
    : filteredBase
  const visible = [...searched].sort((a, b) => a.name.localeCompare(b.name))

  const isSegmented = !!appliedFilter

  const totalCustomers = customers.length
  const totalRevenue = customers.reduce((sum, c) => sum + c.total_spent, 0)
  const birthdayCount = customers.filter((c) => isBirthdayMonth(c.birthdate)).length

  const resetSegmentForm = () => {
    setEditingSegmentId(null)
    setSegmentName('')
    setSegmentDescription('')
    setSegmentCampaignId('')
    setSegmentCouponId(null)
    setSegmentError(null)
  }

  const applyFilterPanel = () => {
    const errors = validatePairErrors(filter)
    if (Object.keys(errors).length > 0) {
      setPairErrors(errors)
      setFilterFormError(null)
      return
    }
    setPairErrors({})
    if (filterIsEmpty(filter)) {
      setFilterFormError('Preencha pelo menos um campo de filtro.')
      return
    }
    setFilterFormError(null)
    setAppliedFilter(filter)
  }
  const openSegment = (segment: CrmSegment) => {
    const criteria = segment.filter_criteria as unknown as FilterState
    setFilter(criteria)
    setAppliedFilter(criteria)
    setFilterOpen(true)
    setEditingSegmentId(segment.id)
    setSegmentName(segment.name)
    setSegmentDescription(segment.description ?? '')
    setSegmentCampaignId(segment.campaign_id ?? '')
    setSegmentCouponId(segment.coupon_id ?? null)
    setSegmentError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const saveSegment = async () => {
    setSegmentError(null)
    if (!segmentName.trim()) {
      setSegmentError('Dê um nome pra essa segmentação.')
      return
    }
    if (!appliedFilter) {
      setSegmentError('Rode o filtro antes de salvar a segmentação.')
      return
    }
    setSavingSegment(true)
    try {
      const payload = {
        name: segmentName,
        description: segmentDescription || undefined,
        filter_criteria: appliedFilter,
        coupon_id: segmentCouponId || undefined,
        campaign_id: segmentCampaignId || undefined,
      }
      if (editingSegmentId) {
        await api.admin.segments.update(editingSegmentId, payload)
      } else {
        await api.admin.segments.create(payload)
      }
      loadSegments()
      resetSegmentForm()
      setFilter(EMPTY_FILTER)
      setAppliedFilter(null)
      setFilterOpen(false)
    } catch (err) {
      setSegmentError(err instanceof ApiError ? err.message : 'Não foi possível salvar a segmentação.')
    } finally {
      setSavingSegment(false)
    }
  }
  const removeSegment = async (id: string) => {
    if (!confirm('Remover esta segmentação?')) return
    await api.admin.segments.delete(id)
    if (editingSegmentId === id) {
      resetSegmentForm()
      setAppliedFilter(null)
      setFilter(EMPTY_FILTER)
      setFilterOpen(false)
    }
    loadSegments()
  }
  const clearFilters = () => {
    resetSegmentForm()
    setFilter(EMPTY_FILTER)
    setAppliedFilter(null)
    setFilterFormError(null)
    setPairErrors({})
  }

  const saveCoupon = async () => {
    setCouponError(null)
    if (couponForm.kind === 'produto' && couponForm.productDiscounts.length === 0) {
      setCouponError('Busque e adicione ao menos um produto.')
      return
    }
    setSavingCoupon(true)
    try {
      await api.admin.coupons.create({
        code: couponForm.code,
        kind: couponForm.kind,
        discount_type: couponForm.kind === 'produto' ? undefined : couponForm.discount_type,
        discount_value: couponForm.kind === 'produto' ? undefined : Number(couponForm.discount_value),
        product_discounts: couponForm.kind === 'produto' ? couponForm.productDiscounts : undefined,
        allow_campaign_checkout: couponForm.allow_campaign_checkout,
        expires_at: couponForm.expires_at || undefined,
        max_uses: couponForm.max_uses ? Number(couponForm.max_uses) : undefined,
      })
      setShowCouponForm(false)
      setCouponForm(EMPTY_COUPON_FORM)
      loadCoupons()
    } catch (err) {
      setCouponError(err instanceof ApiError ? err.message : 'Não foi possível salvar o cupom.')
    } finally {
      setSavingCoupon(false)
    }
  }

  const toggleCouponActive = async (c: Coupon) => {
    await api.admin.coupons.update(c.id, {
      active: !c.active,
      allow_campaign_checkout: c.allow_campaign_checkout,
      expires_at: c.expires_at ?? undefined,
      max_uses: c.max_uses ?? undefined,
    })
    loadCoupons()
  }

  const removeCoupon = async (id: string) => {
    if (!confirm('Remover este cupom?')) return
    await api.admin.coupons.delete(id)
    loadCoupons()
  }

  const targetedMessageValid =
    targetedForm.dontNotify || (targetedForm.customMessage.includes('/nome') && targetedForm.customMessage.includes('/cupom'))

  const saveTargetedCoupon = async () => {
    setTargetedError(null)
    if (!targetedMessageValid) {
      setTargetedError('A mensagem precisa citar /nome e /cupom.')
      return
    }
    setSavingTargeted(true)
    try {
      const created = await api.admin.coupons.createTargeted({
        code: targetedForm.code,
        customer_whatsapps: visible.map((c) => c.whatsapp),
        uses_per_customer: Number(targetedForm.uses_per_customer) || 1,
        notify_customers: !targetedForm.dontNotify,
        custom_message: targetedForm.dontNotify ? undefined : targetedForm.customMessage,
        combinable_with_public: targetedForm.combinable_with_public,
        allow_campaign_checkout: targetedForm.allow_campaign_checkout,
        expires_at: targetedForm.expires_at || undefined,
        max_uses: targetedForm.max_uses ? Number(targetedForm.max_uses) : undefined,
        discount_type: targetedForm.productMode === 'flat' ? targetedForm.discount_type : undefined,
        discount_value: targetedForm.productMode === 'flat' ? Number(targetedForm.discount_value) : undefined,
        shipping_discount_type: targetedForm.shippingEnabled ? targetedForm.shipping_discount_type : undefined,
        shipping_discount_value: targetedForm.shippingEnabled ? Number(targetedForm.shipping_discount_value) : undefined,
        product_discounts: targetedForm.productMode === 'produto' ? targetedForm.productDiscounts : undefined,
      })
      if (!targetedForm.dontNotify) {
        api.admin.whatsapp.notifyCouponGrant(created.id, targetedForm.customMessage).catch(() => {})
      }
      // Se essa lista veio de uma segmentação salva (aberta ou recém-criada),
      // o cupom exclusivo fica vinculado a ela também.
      if (targetedFormSegmentId) {
        setSegmentCouponId(created.id)
        const segment = segments.find((s) => s.id === targetedFormSegmentId)
        if (segment) {
          api.admin.segments
            .update(targetedFormSegmentId, {
              name: segment.name,
              description: segment.description ?? undefined,
              filter_criteria: segment.filter_criteria,
              coupon_id: created.id,
              campaign_id: segment.campaign_id ?? undefined,
            })
            .then(loadSegments)
            .catch(() => {})
        }
      }
      setShowTargetedForm(false)
      setTargetedForm(EMPTY_TARGETED_FORM)
      loadCoupons()
    } catch (err) {
      setTargetedError(err instanceof ApiError ? err.message : 'Não foi possível criar o cupom.')
    } finally {
      setSavingTargeted(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">CRM &amp; cupons</h1>
        <button onClick={() => setShowCouponForm(true)} className="btn-primary text-sm py-2 px-4">
          <Plus className="w-4 h-4" /> Novo cupom
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4 text-center">
          <p className="text-xs text-son-silver-dim mb-1">Clientes</p>
          <p className="font-black text-2xl text-white">{totalCustomers}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-son-silver-dim mb-1">Faturado</p>
          <p className="sunset-text font-black text-xl">{currency(totalRevenue)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-son-silver-dim mb-1">Aniversariantes</p>
          <p className="font-black text-2xl text-white">{birthdayCount}</p>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-son-silver-dim absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input-field pl-9"
            placeholder="Buscar por nome ou WhatsApp..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => {
            if (!filterOpen) resetSegmentForm()
            setFilterOpen((v) => !v)
          }}
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all flex-shrink-0 ${
            appliedFilter || filterOpen ? 'sunset-bg text-white shadow-lg shadow-son-pink/20' : 'sunset-bg text-white hover:brightness-110 hover:scale-[1.02]'
          }`}
          title="Nova segmentação"
        >
          <Sparkles className="w-4 h-4" /> Nova segmentação
        </button>
      </div>

      {filterOpen && (
        <Card className="p-5 mb-4 space-y-3">
          <div className="border border-white/10 rounded-xl p-3">
            <label className="label">Volume de Compras no Período</label>
            <div className="flex items-center gap-2">
              <input
                className={`input-field w-32 ${NO_SPINNER}`}
                type="number"
                min="1"
                placeholder="N° Vezes"
                value={filter.minOrders}
                onChange={(e) => setFilter({ ...filter, minOrders: e.target.value })}
              />
              <span className="text-son-silver-dim text-sm whitespace-nowrap">no período de</span>
              <input
                className={`input-field w-24 ${NO_SPINNER}`}
                type="number"
                min="1"
                placeholder="Opcional"
                value={filter.minOrdersDays}
                onChange={(e) => setFilter({ ...filter, minOrdersDays: e.target.value })}
              />
              <span className="text-son-silver-dim text-sm whitespace-nowrap">Dias</span>
            </div>
            {pairErrors.minOrders && <p className="error-msg mt-1">{pairErrors.minOrders}</p>}
          </div>

          <div className="border border-white/10 rounded-xl p-3">
            <label className="label">Quantidade de Produtos no Período</label>
            <div className="flex items-center gap-2">
              <input
                className={`input-field w-32 ${NO_SPINNER}`}
                type="number"
                min="1"
                placeholder="N° Produtos"
                value={filter.minItems}
                onChange={(e) => setFilter({ ...filter, minItems: e.target.value })}
              />
              <span className="text-son-silver-dim text-sm whitespace-nowrap">no período de</span>
              <input
                className={`input-field w-24 ${NO_SPINNER}`}
                type="number"
                min="1"
                placeholder="Opcional"
                value={filter.minItemsDays}
                onChange={(e) => setFilter({ ...filter, minItemsDays: e.target.value })}
              />
              <span className="text-son-silver-dim text-sm whitespace-nowrap">Dias</span>
            </div>
            {pairErrors.minItems && <p className="error-msg mt-1">{pairErrors.minItems}</p>}
          </div>

          <div className="border border-white/10 rounded-xl p-3">
            <label className="label">Distância de no máximo (km)</label>
            <input
              className={`input-field w-28 ${NO_SPINNER}`}
              type="number"
              min="0"
              placeholder="Opcional"
              value={filter.maxDistanceKm}
              onChange={(e) => setFilter({ ...filter, maxDistanceKm: e.target.value })}
            />
          </div>

          <div className="border border-white/10 rounded-xl p-3">
            <label className="label">Gastou abaixo de</label>
            <div className="flex items-center gap-2">
              <span className="text-son-silver-dim text-sm">R$</span>
              <input
                className={`input-field w-32 ${NO_SPINNER}`}
                type="number"
                min="0"
                value={filter.spentBelowAmount}
                onChange={(e) => setFilter({ ...filter, spentBelowAmount: e.target.value })}
              />
              <span className="text-son-silver-dim text-sm whitespace-nowrap">em</span>
              <input
                className={`input-field w-24 ${NO_SPINNER}`}
                type="number"
                min="1"
                placeholder="Opcional"
                value={filter.spentBelowDays}
                onChange={(e) => setFilter({ ...filter, spentBelowDays: e.target.value })}
              />
              <span className="text-son-silver-dim text-sm whitespace-nowrap">dias</span>
            </div>
            {pairErrors.spentBelow && <p className="error-msg mt-1">{pairErrors.spentBelow}</p>}
          </div>

          <div className="border border-white/10 rounded-xl p-3">
            <label className="label">Gastou acima de</label>
            <div className="flex items-center gap-2">
              <span className="text-son-silver-dim text-sm">R$</span>
              <input
                className={`input-field w-32 ${NO_SPINNER}`}
                type="number"
                min="0"
                value={filter.spentAboveAmount}
                onChange={(e) => setFilter({ ...filter, spentAboveAmount: e.target.value })}
              />
              <span className="text-son-silver-dim text-sm whitespace-nowrap">em</span>
              <input
                className={`input-field w-24 ${NO_SPINNER}`}
                type="number"
                min="1"
                placeholder="Opcional"
                value={filter.spentAboveDays}
                onChange={(e) => setFilter({ ...filter, spentAboveDays: e.target.value })}
              />
              <span className="text-son-silver-dim text-sm whitespace-nowrap">dias</span>
            </div>
            {pairErrors.spentAbove && <p className="error-msg mt-1">{pairErrors.spentAbove}</p>}
          </div>

          <div className="border border-white/10 rounded-xl p-3">
            <label className="label">Reduziu a frequência de compra em (%)</label>
            <input
              className={`input-field w-24 ${NO_SPINNER}`}
              type="number"
              min="1"
              max="100"
              placeholder="Opcional"
              value={filter.frequencyDropPercent}
              onChange={(e) => setFilter({ ...filter, frequencyDropPercent: e.target.value })}
            />
          </div>

          <div className="border border-white/10 rounded-xl p-3">
            <label className="label">Cliente novo em (dias)</label>
            <input
              className={`input-field w-28 ${NO_SPINNER}`}
              type="number"
              min="1"
              placeholder="Opcional"
              value={filter.newCustomerDays}
              onChange={(e) => setFilter({ ...filter, newCustomerDays: e.target.value })}
            />
          </div>

          <div className="border border-white/10 rounded-xl p-3">
            <label className="label">Clientes que aniversariam em</label>
            <select
              className="input-field max-w-xs appearance-none cursor-pointer"
              value={filter.birthdayMonth}
              onChange={(e) => setFilter({ ...filter, birthdayMonth: e.target.value })}
            >
              <option value="">Qualquer mês</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="border border-white/10 rounded-xl p-3">
            <label className="label">Bairro</label>
            <select
              className="input-field max-w-xs appearance-none cursor-pointer"
              value=""
              onChange={(e) => {
                if (!e.target.value || filter.neighborhoods.includes(e.target.value)) return
                setFilter({ ...filter, neighborhoods: [...filter.neighborhoods, e.target.value] })
              }}
            >
              <option value="">Adicionar bairro...</option>
              {neighborhoods
                .filter((n) => !filter.neighborhoods.includes(n))
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
            </select>
            {filter.neighborhoods.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {filter.neighborhoods.map((n) => (
                  <span key={n} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-son-pink/15 text-son-pink text-xs font-medium">
                    {n}
                    <button
                      type="button"
                      onClick={() => setFilter({ ...filter, neighborhoods: filter.neighborhoods.filter((x) => x !== n) })}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="border border-white/10 rounded-xl p-3">
            <label className="label">Recorrência Média de Consumo</label>
            <ProductCategoryMultiSelect
              products={products}
              categories={categories}
              selectedProductIds={filter.recurringProductIds}
              selectedCategoryIds={filter.recurringCategoryIds}
              onChangeProducts={(recurringProductIds) => setFilter({ ...filter, recurringProductIds })}
              onChangeCategories={(recurringCategoryIds) => setFilter({ ...filter, recurringCategoryIds })}
            />
            <input
              className={`input-field mt-2 w-44 ${NO_SPINNER}`}
              type="number"
              min="1"
              placeholder="N° Dias (Opcional)"
              value={filter.recurringDays}
              onChange={(e) => setFilter({ ...filter, recurringDays: e.target.value })}
            />
            {pairErrors.recurring && <p className="error-msg mt-1">{pairErrors.recurring}</p>}
          </div>

          {filterFormError && <p className="error-msg">{filterFormError}</p>}
          <div className="flex gap-2">
            <button onClick={applyFilterPanel} className="btn-primary flex-1">
              Filtrar
            </button>
            <button onClick={clearFilters} className="btn-secondary flex-1">
              Limpar filtros
            </button>
          </div>

          {appliedFilter && (
            <div className="border border-son-pink/30 rounded-xl p-3 space-y-3 bg-son-pink/5">
              <p className="text-xs text-son-silver-dim">
                {visible.length} cliente(s) nessa segmentação — dê um nome e salve pra reabrir/reutilizar depois.
              </p>
              <div>
                <label className="label">Nome da segmentação</label>
                <input
                  className="input-field"
                  placeholder="Ex: Clientes VIP João Pessoa"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Descrição</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="O que caracteriza esse grupo de clientes..."
                  value={segmentDescription}
                  onChange={(e) => setSegmentDescription(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Campanha vinculada (opcional)</label>
                <select
                  className="input-field appearance-none cursor-pointer"
                  value={segmentCampaignId}
                  onChange={(e) => setSegmentCampaignId(e.target.value)}
                >
                  <option value="">Nenhuma</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Cupom exclusivo vinculado (opcional)</label>
                {segmentCouponId ? (
                  <div className="flex items-center justify-between bg-son-surface border border-white/10 rounded-2xl px-4 py-3">
                    <span className="flex items-center gap-2 text-sm font-medium text-white">
                      <Gift className="w-4 h-4 text-son-pink" /> {coupons.find((c) => c.id === segmentCouponId)?.code ?? segmentCouponId}
                    </span>
                    <button type="button" onClick={() => setSegmentCouponId(null)} className="text-xs text-son-silver-dim hover:text-son-pink">
                      Desvincular
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetedFormSegmentId(editingSegmentId)
                      setShowTargetedForm(true)
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-son-pink/15 text-son-pink text-xs font-semibold hover:bg-son-pink/25"
                  >
                    <Gift className="w-3.5 h-3.5" /> Criar cupom exclusivo pra este segmento
                  </button>
                )}
              </div>
              {segmentError && <p className="error-msg">{segmentError}</p>}
              <button onClick={saveSegment} disabled={savingSegment} className="btn-primary w-full">
                {savingSegment ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingSegmentId ? 'Atualizar segmentação' : 'Salvar segmentação'}
              </button>
            </div>
          )}
        </Card>
      )}

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-son-silver-dim">
          {visible.length} cliente(s){isSegmented ? ' nessa segmentação/filtro' : ''}
        </p>
        {isSegmented && visible.length > 0 && !filterOpen && (
          <button
            onClick={() => {
              setTargetedFormSegmentId(editingSegmentId)
              setShowTargetedForm(true)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-son-pink/15 text-son-pink text-xs font-semibold hover:bg-son-pink/25"
          >
            <Gift className="w-3.5 h-3.5" /> Criar cupom pra esses clientes
          </button>
        )}
      </div>

      {query.trim() &&
        (loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-son-silver-dim">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhum cliente encontrado.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-10">
            {visible.map((c) => (
              <Card key={c.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-white">{c.name}</p>
                    {isBirthdayMonth(c.birthdate) && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-son-pink/15 text-son-pink text-xs font-semibold">
                        <Cake className="w-3 h-3" /> Aniversário
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <WhatsAppLink phone={c.whatsapp} />
                  </div>
                  <p className="text-xs text-son-silver-dim mt-1">
                    {c.birthdate ? `Nascimento: ${formatDate(c.birthdate)}` : 'Sem data de nascimento'} · Último pedido:{' '}
                    {formatDate(c.last_order_at)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="sunset-text font-black text-lg">{currency(c.total_spent)}</p>
                  <p className="text-xs text-son-silver-dim">{c.order_count} pedido(s)</p>
                </div>
              </Card>
            ))}
          </div>
        ))}

      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-5 h-5 text-son-gold" />
        <h2 className="text-xl font-black">Segmentações salvas</h2>
      </div>
      {segmentsLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
        </div>
      ) : segments.length === 0 ? (
        <div className="text-center py-10 text-son-silver-dim mb-10">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma segmentação salva ainda.</p>
          <p className="text-xs mt-1">Clique em "Nova segmentação", monte o filtro e salve com um nome.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {segments.map((s) => {
            const count = applyFilters(customers, s.filter_criteria as unknown as FilterState, products).length
            const campaign = campaigns.find((c) => c.id === s.campaign_id)
            const coupon = coupons.find((c) => c.id === s.coupon_id)
            return (
              <Card key={s.id} className="p-4">
                <button type="button" onClick={() => openSegment(s)} className="w-full text-left">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-white">{s.name}</p>
                    <span className="text-xs font-bold sunset-text flex-shrink-0">{count} cliente(s)</span>
                  </div>
                  {s.description && <p className="text-xs text-son-silver-dim mb-2">{s.description}</p>}
                  <div className="flex flex-wrap gap-1">
                    {coupon && (
                      <span className="px-2 py-0.5 rounded-full bg-son-pink/15 text-son-pink text-xs font-semibold">Cupom: {coupon.code}</span>
                    )}
                    {campaign && (
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-son-silver-dim text-xs">Campanha: {campaign.title}</span>
                    )}
                  </div>
                </button>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeSegment(s.id)
                    }}
                    className="text-son-silver-dim hover:text-son-pink"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <h2 className="text-xl font-black mb-4">Cupons</h2>
      {couponsLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="text-center py-10 text-son-silver-dim">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum cupom cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {coupons.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="font-mono font-bold text-white">{c.code}</p>
                <button
                  onClick={() => toggleCouponActive(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    c.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-son-silver-dim'
                  }`}
                >
                  {c.active ? 'Ativo' : 'Inativo'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-son-silver-dim text-xs">{COUPON_KIND_LABEL[c.kind]}</span>
                {c.kind === 'produto' ? (
                  <span className="px-2 py-0.5 rounded-full bg-son-pink/15 text-son-pink text-xs font-semibold">
                    {c.product_discounts?.length ?? 0} produto(s)
                  </span>
                ) : (
                  discountLabel(c.discount_type, c.discount_value) && (
                    <span className="px-2 py-0.5 rounded-full bg-son-pink/15 text-son-pink text-xs font-semibold">
                      {discountLabel(c.discount_type, c.discount_value)}
                    </span>
                  )
                )}
                {discountLabel(c.shipping_discount_type, c.shipping_discount_value) && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                    Frete: {discountLabel(c.shipping_discount_type, c.shipping_discount_value)}
                  </span>
                )}
                {(c.grant_count ?? 0) > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-semibold">
                    Alvo · {c.grant_count} cliente(s)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-son-silver-dim text-xs">Público</span>
                )}
                {c.allow_campaign_checkout && (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-son-silver-dim text-xs">+ campanha</span>
                )}
              </div>
              <p className="text-xs text-son-silver-dim">
                {c.max_uses ? `${c.used_count}/${c.max_uses} usos` : `${c.used_count} usos · sem limite global`}
                {c.expires_at ? ` · até ${new Date(c.expires_at).toLocaleDateString('pt-BR')}` : ' · sem validade'}
              </p>
              <div className="flex justify-end mt-2">
                <button onClick={() => removeCoupon(c.id)} className="text-son-silver-dim hover:text-son-pink">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCouponForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowCouponForm(false)}
        >
          <div className="glass rounded-2xl p-6 max-w-lg w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Novo cupom (público)</h3>
              <button onClick={() => setShowCouponForm(false)} className="text-son-silver-dim hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Código</label>
                <input
                  className="input-field font-mono uppercase"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })}
                  placeholder="SUNSET10"
                />
              </div>
              <div>
                <label className="label">Tipo</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['desconto', 'frete', 'produto', 'aniversario'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setCouponForm({ ...couponForm, kind: k })}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        couponForm.kind === k ? 'sunset-bg text-white border-transparent' : 'bg-son-surface border-white/10 text-son-silver'
                      }`}
                    >
                      {COUPON_KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
                {couponForm.kind === 'frete' && (
                  <p className="text-xs text-son-silver-dim mt-1.5">
                    Desconta do frete que o cliente paga — o motoboy recebe o valor cheio do mesmo jeito, a loja absorve a diferença.
                  </p>
                )}
                {couponForm.kind === 'aniversario' && (
                  <p className="text-xs text-son-silver-dim mt-1.5">Só é aceito durante o mês de aniversário do cliente.</p>
                )}
                {couponForm.kind === 'produto' && (
                  <p className="text-xs text-son-silver-dim mt-1.5">
                    Os produtos escolhidos aparecem destacados em /catalogo na categoria "Promoção" com o desconto já visível, e o
                    desconto se aplica sozinho assim que o produto entra no carrinho — sem precisar digitar código.
                  </p>
                )}
              </div>
              {couponForm.kind === 'produto' ? (
                <div>
                  <label className="label">Produtos em promoção</label>
                  <ProductDiscountList
                    products={products}
                    discounts={couponForm.productDiscounts}
                    onChange={(productDiscounts) => setCouponForm({ ...couponForm, productDiscounts })}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Tipo de desconto</label>
                    <select
                      className="input-field"
                      value={couponForm.discount_type}
                      onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value as DiscountType })}
                    >
                      <option value="percent">Percentual</option>
                      <option value="fixed">Valor fixo (R$)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Valor</label>
                    <input
                      className="input-field"
                      type="number"
                      min="0"
                      value={couponForm.discount_value}
                      onChange={(e) => setCouponForm({ ...couponForm, discount_value: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-son-silver">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-son-pink"
                  checked={couponForm.allow_campaign_checkout}
                  onChange={(e) => setCouponForm({ ...couponForm, allow_campaign_checkout: e.target.checked })}
                />
                Pode ser usado também num checkout de campanha
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Validade (opcional)</label>
                  <ExpiryInput value={couponForm.expires_at} onChange={(expires_at) => setCouponForm({ ...couponForm, expires_at })} />
                </div>
                <div>
                  <label className="label">Limite de usos (opcional)</label>
                  <input
                    className="input-field"
                    type="number"
                    min="1"
                    value={couponForm.max_uses}
                    onChange={(e) => setCouponForm({ ...couponForm, max_uses: e.target.value })}
                  />
                </div>
              </div>
              {couponError && <p className="error-msg">{couponError}</p>}
              <button onClick={saveCoupon} disabled={savingCoupon} className="btn-primary w-full mt-2">
                {savingCoupon ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Salvar cupom
              </button>
            </div>
          </div>
        </div>
      )}

      {showTargetedForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowTargetedForm(false)}
        >
          <div className="glass rounded-2xl p-6 max-w-lg w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Cupom exclusivo</h3>
              <button onClick={() => setShowTargetedForm(false)} className="text-son-silver-dim hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-son-silver-dim mb-3">
              Vai valer só pra <strong className="text-white">{visible.length} cliente(s)</strong> da lista filtrada — intransferível,
              nenhum outro cliente consegue usar mesmo digitando o código.
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Código</label>
                <input
                  className="input-field font-mono uppercase"
                  value={targetedForm.code}
                  onChange={(e) => setTargetedForm({ ...targetedForm, code: e.target.value })}
                  placeholder="SUNSET15"
                />
              </div>
              <div>
                <label className="label">Desconto no produto</label>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {(
                    [
                      { value: 'nenhum', label: 'Nenhum' },
                      { value: 'flat', label: 'Valor total' },
                      { value: 'produto', label: 'Por produto' },
                    ] as const
                  ).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTargetedForm({ ...targetedForm, productMode: value })}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        targetedForm.productMode === value
                          ? 'sunset-bg text-white border-transparent'
                          : 'bg-son-surface border-white/10 text-son-silver'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {targetedForm.productMode === 'flat' && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="input-field"
                      value={targetedForm.discount_type}
                      onChange={(e) => setTargetedForm({ ...targetedForm, discount_type: e.target.value as DiscountType })}
                    >
                      <option value="percent">Percentual</option>
                      <option value="fixed">Valor fixo (R$)</option>
                    </select>
                    <input
                      className="input-field"
                      type="number"
                      min="0"
                      placeholder="Valor"
                      value={targetedForm.discount_value}
                      onChange={(e) => setTargetedForm({ ...targetedForm, discount_value: e.target.value })}
                    />
                  </div>
                )}
                {targetedForm.productMode === 'produto' && (
                  <ProductDiscountList
                    products={products}
                    discounts={targetedForm.productDiscounts}
                    onChange={(productDiscounts) => setTargetedForm({ ...targetedForm, productDiscounts })}
                  />
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-son-silver">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-son-pink"
                  checked={targetedForm.shippingEnabled}
                  onChange={(e) => setTargetedForm({ ...targetedForm, shippingEnabled: e.target.checked })}
                />
                Também dar desconto no frete
              </label>
              {targetedForm.shippingEnabled && (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="input-field"
                    value={targetedForm.shipping_discount_type}
                    onChange={(e) => setTargetedForm({ ...targetedForm, shipping_discount_type: e.target.value as DiscountType })}
                  >
                    <option value="percent">Percentual</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                  <input
                    className="input-field"
                    type="number"
                    min="0"
                    placeholder="Valor"
                    value={targetedForm.shipping_discount_value}
                    onChange={(e) => setTargetedForm({ ...targetedForm, shipping_discount_value: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="label">Quantas vezes cada cliente pode usar</label>
                <input
                  className="input-field"
                  type="number"
                  min="1"
                  value={targetedForm.uses_per_customer}
                  onChange={(e) => setTargetedForm({ ...targetedForm, uses_per_customer: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-son-silver">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-son-pink"
                  checked={targetedForm.dontNotify}
                  onChange={(e) => setTargetedForm({ ...targetedForm, dontNotify: e.target.checked })}
                />
                Não notificar via WhatsApp
              </label>
              {!targetedForm.dontNotify && (
                <div>
                  <label className="label">Mensagem pro cliente</label>
                  <textarea
                    className="input-field"
                    rows={5}
                    placeholder={
                      'Olá, /nome! Você ganhou o cupom /cupom, exclusivo pra você 🎁\n\nBenefícios:\n- ...'
                    }
                    value={targetedForm.customMessage}
                    onChange={(e) => setTargetedForm({ ...targetedForm, customMessage: e.target.value })}
                  />
                  <p className="text-xs text-son-silver-dim mt-1">
                    Precisa citar <code>/nome</code> (vira o nome do cliente) e <code>/cupom</code> (vira o código do cupom). O link do
                    site é adicionado automaticamente no fim.
                  </p>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-son-silver">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-son-pink"
                  checked={targetedForm.combinable_with_public}
                  onChange={(e) => setTargetedForm({ ...targetedForm, combinable_with_public: e.target.checked })}
                />
                Pode ser combinado com um cupom avulso no checkout de catálogo
              </label>
              <label className="flex items-center gap-2 text-sm text-son-silver">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-son-pink"
                  checked={targetedForm.allow_campaign_checkout}
                  onChange={(e) => setTargetedForm({ ...targetedForm, allow_campaign_checkout: e.target.checked })}
                />
                Pode ser usado também num checkout de campanha
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Validade (opcional)</label>
                  <ExpiryInput
                    value={targetedForm.expires_at}
                    onChange={(expires_at) => setTargetedForm({ ...targetedForm, expires_at })}
                  />
                </div>
                <div>
                  <label className="label">Limite global de usos (opcional)</label>
                  <input
                    className="input-field"
                    type="number"
                    min="1"
                    value={targetedForm.max_uses}
                    onChange={(e) => setTargetedForm({ ...targetedForm, max_uses: e.target.value })}
                  />
                </div>
              </div>
              {targetedError && <p className="error-msg">{targetedError}</p>}
              <button onClick={saveTargetedCoupon} disabled={savingTargeted} className="btn-primary w-full mt-2">
                {savingTargeted ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Criar cupom exclusivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
