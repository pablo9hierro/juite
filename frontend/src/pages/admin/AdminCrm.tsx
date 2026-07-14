import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Cake, Gift, Layers, Loader2, Plus, Search, Sparkles, Tag, Trash2, Users, X, Zap } from 'lucide-react'
import Card from '../../components/ui/Card'
import WhatsAppLink from '../../components/ui/WhatsAppLink'
import ExpiryInput from '../../components/admin/ExpiryInput'
import ProductCategoryMultiSelect from '../../components/admin/ProductCategoryMultiSelect'
import ProductDiscountList from '../../components/admin/ProductDiscountList'
import { api, ApiError } from '../../lib/api'
import type {
  CampanhaOrientation,
  Category,
  Coupon,
  CouponKind,
  CouponGrant,
  CrmCampanhaCoupon,
  CrmCustomer,
  CrmFilterCriteria,
  CrmSegment,
  DiscountType,
  Product,
  ProductDiscount,
} from '../../lib/types'

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

// "Dias" é sempre opcional nesses pares — sem preencher, o filtro vale pro
// histórico inteiro do cliente, então o resumo troca "em X dias" por
// "em todo o período" em vez de simplesmente omitir a informação.
function withPeriod(days: string): string {
  return days ? `em ${days} dia${Number(days) === 1 ? '' : 's'}` : 'em todo o período'
}

// Traduz o filtro aplicado numa lista de frases curtas — mostrado como
// resumo compacto antes de salvar a segmentação, pra confirmar o que foi
// realmente preenchido sem precisar rolar o formulário inteiro de novo.
function describeFilter(f: FilterState, products: Product[], categories: Category[]): string[] {
  const out: string[] = []
  if (f.minOrders) out.push(`Clientes que compraram ${f.minOrders} vez${Number(f.minOrders) === 1 ? '' : 'es'} ${withPeriod(f.minOrdersDays)}`)
  if (f.minItems) out.push(`Clientes que compraram ${f.minItems} produto${Number(f.minItems) === 1 ? '' : 's'} ${withPeriod(f.minItemsDays)}`)
  if (f.spentBelowAmount) out.push(`Clientes que consumiram abaixo de R$${f.spentBelowAmount} ${withPeriod(f.spentBelowDays)}`)
  if (f.spentAboveAmount) out.push(`Clientes que consumiram acima de R$${f.spentAboveAmount} ${withPeriod(f.spentAboveDays)}`)
  if (f.frequencyDropPercent) out.push(`Clientes que reduziram a frequência de compra em ${f.frequencyDropPercent}%`)
  if (f.newCustomerDays) out.push(`Clientes novos em até ${f.newCustomerDays} dias`)
  if (f.maxDistanceKm) out.push(`Clientes de até no máximo ${f.maxDistanceKm} Km de distância`)
  if (f.neighborhoods.length > 0) out.push(`Clientes do(s) bairro(s): ${f.neighborhoods.join(', ')}`)
  if (f.birthdayMonth) out.push(`Clientes que aniversariam em ${MONTH_NAMES[Number(f.birthdayMonth)] ?? f.birthdayMonth}`)
  if (f.recurringProductIds.length > 0 || f.recurringCategoryIds.length > 0) {
    const names = [
      ...f.recurringProductIds.map((id) => products.find((p) => p.id === id)?.name).filter((n): n is string => !!n),
      ...f.recurringCategoryIds.map((id) => categories.find((c) => c.id === id)?.name).filter((n): n is string => !!n),
    ]
    out.push(`Clientes com recorrência de compra de ${names.join(', ')} a cada ${f.recurringDays} dias`)
  }
  return out
}

// Um "campo" de filtro = um grupo de chaves de FilterState que descreve a
// mesma condição (ex: minOrders+minOrdersDays). Usado pra achar quais
// campos o segmento usa que a campanha 'evento' ainda não cobre — não pra
// descrever texto (isso é describeFilter).
type FieldGroupKey = 'minOrders' | 'minItems' | 'spentBelow' | 'spentAbove' | 'frequencyDrop' | 'newCustomer' | 'maxDistance' | 'neighborhoods' | 'birthday' | 'recurring'
const FIELD_GROUPS: { key: FieldGroupKey; isFilled: (f: FilterState) => boolean }[] = [
  { key: 'minOrders', isFilled: (f) => !!f.minOrders },
  { key: 'minItems', isFilled: (f) => !!f.minItems },
  { key: 'spentBelow', isFilled: (f) => !!f.spentBelowAmount },
  { key: 'spentAbove', isFilled: (f) => !!f.spentAboveAmount },
  { key: 'frequencyDrop', isFilled: (f) => !!f.frequencyDropPercent },
  { key: 'newCustomer', isFilled: (f) => !!f.newCustomerDays },
  { key: 'maxDistance', isFilled: (f) => !!f.maxDistanceKm },
  { key: 'neighborhoods', isFilled: (f) => f.neighborhoods.length > 0 },
  { key: 'birthday', isFilled: (f) => !!f.birthdayMonth },
  { key: 'recurring', isFilled: (f) => f.recurringProductIds.length > 0 || f.recurringCategoryIds.length > 0 },
]

// Campo "novo" = o segmento usa, mas o trigger_criteria da campanha
// 'evento' (calibrado antes da última edição do segmento) ainda não tem
// valor-alvo pra ele. Campo removido do segmento não conta pra nada aqui
// (fica ignorado de propósito — não precisa de ação do admin).
function getNewTriggerFieldKeys(segmentCriteria: FilterState, triggerCriteria: FilterState | null): Set<FieldGroupKey> {
  const trigger = triggerCriteria ?? EMPTY_FILTER
  return new Set(FIELD_GROUPS.filter((g) => g.isFilled(segmentCriteria) && !g.isFilled(trigger)).map((g) => g.key))
}

function isCampanhaStale(cc: CrmCampanhaCoupon, segment: CrmSegment | undefined): boolean {
  if (cc.orientation !== 'evento' || !segment) return false
  return getNewTriggerFieldKeys(segment.filter_criteria as unknown as FilterState, cc.trigger_criteria as unknown as FilterState).size > 0
}

// Chave-mestra de on/off do app — pill com bolinha deslizante, igual ao
// modelo que o admin desenhou (ON: texto + bolinha à direita; OFF:
// bolinha + texto à esquerda), em vez de um badge de texto "Ativo/Inativo".
function ToggleSwitch({ checked, onClick }: { checked: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center w-[4.5rem] h-7 px-1 rounded-full border transition-colors duration-200 flex-shrink-0 ${
        checked ? 'justify-end bg-emerald-500/15 border-emerald-400/60' : 'justify-start bg-white/5 border-white/20'
      }`}
    >
      <span className={`flex items-center gap-1.5 ${checked ? 'flex-row-reverse' : ''}`}>
        <span className={`w-5 h-5 rounded-full flex-shrink-0 ${checked ? 'bg-emerald-400' : 'bg-son-silver-dim'}`} />
        <span className={`text-[10px] font-bold ${checked ? 'text-emerald-300' : 'text-son-silver-dim'}`}>{checked ? 'ON' : 'OFF'}</span>
      </span>
    </button>
  )
}

type CouponForm = {
  code: string
  kind: 'desconto' | 'frete' | 'aniversario' | 'produto'
  discount_type: DiscountType
  discount_value: string
  productDiscounts: ProductDiscount[]
  allow_promotion_checkout: boolean
  expires_at: string
  max_uses: string
}
const EMPTY_COUPON_FORM: CouponForm = {
  code: '',
  kind: 'desconto',
  discount_type: 'percent',
  discount_value: '',
  productDiscounts: [],
  allow_promotion_checkout: false,
  expires_at: '',
  max_uses: '',
}

type ProductDiscountMode = 'nenhum' | 'flat' | 'produto'

// "Campanha": um cupom exclusivo vinculado a um segmento. 'segmento'
// dispara uma vez, na hora, pros clientes que casam com o critério do
// segmento agora. 'evento' fica de olho num critério DIFERENTE
// (triggerCriteria, capturado do painel de filtro no momento em que o
// admin monta o evento) e dispara (por cliente, uma vez) quando esse
// critério passar a valer — nunca dispara nada sozinho, sempre precisa
// que o front recheque (ver checkEventCampanhas).
type CampanhaForm = {
  segmentId: string
  orientation: CampanhaOrientation
  triggerCriteria: FilterState | null
  messageTemplate: string
  code: string
  productMode: ProductDiscountMode
  discount_type: DiscountType
  discount_value: string
  productDiscounts: ProductDiscount[]
  shippingEnabled: boolean
  shipping_discount_type: DiscountType
  shipping_discount_value: string
  uses_per_customer: string
  combinable_with_public: boolean
  allow_promotion_checkout: boolean
  expires_at: string
  max_uses: string
}
const EMPTY_CAMPANHA_FORM: CampanhaForm = {
  segmentId: '',
  orientation: 'segmento',
  triggerCriteria: null,
  messageTemplate: '',
  code: '',
  productMode: 'flat',
  discount_type: 'percent',
  discount_value: '',
  productDiscounts: [],
  shippingEnabled: false,
  shipping_discount_type: 'percent',
  shipping_discount_value: '',
  uses_per_customer: '1',
  combinable_with_public: false,
  allow_promotion_checkout: false,
  expires_at: '',
  max_uses: '',
}

export default function AdminCrm() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [query, setQuery] = useState('')

  // Diálogo de confirmação (substitui window.confirm nativo) — mesmo
  // padrão de popup usado no resto da página.
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const askConfirm = (message: string, onConfirm: () => void) => setConfirmDialog({ message, onConfirm })

  // Popup com a lista de clientes de um segmento (clicando em "N cliente(s)").
  const [customerListSegment, setCustomerListSegment] = useState<CrmSegment | null>(null)
  const [customerListQuery, setCustomerListQuery] = useState('')

  // Explica que uma campanha 'evento' desatualizada (segmento mudou)
  // precisa ser editada antes de poder ligar de novo.
  const [staleDialogCampanha, setStaleDialogCampanha] = useState<CrmCampanhaCoupon | null>(null)

  // Histórico de disparos (concessões) de uma campanha, mostrado ao
  // clicar em "Verificar".
  const [historyDialogCampanha, setHistoryDialogCampanha] = useState<CrmCampanhaCoupon | null>(null)
  const [historyGrants, setHistoryGrants] = useState<CouponGrant[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

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
  const [savingSegment, setSavingSegment] = useState(false)
  const [segmentError, setSegmentError] = useState<string | null>(null)

  // "Campanha": cupom(s) exclusivo(s) vinculado(s) a um segmento — cada
  // segmento pode ter várias. Mapa por segmento (não só o que está sendo
  // editado) pra poder desenhar a cadeia Segmento->Campanha->Cupom na
  // lista principal, igual ao wireframe.
  const [campanhaCouponsBySegment, setCampanhaCouponsBySegment] = useState<Record<string, CrmCampanhaCoupon[]>>({})
  const [showCampanhaForm, setShowCampanhaForm] = useState(false)
  const [campanhaForm, setCampanhaForm] = useState<CampanhaForm>(EMPTY_CAMPANHA_FORM)
  const [savingCampanha, setSavingCampanha] = useState(false)
  const [campanhaError, setCampanhaError] = useState<string | null>(null)

  // Edição inline de uma campanha já criada — o card em si morfa num
  // formulário (motion), não navega pra outro lugar.
  const [editingCampanhaId, setEditingCampanhaId] = useState<string | null>(null)
  const [campanhaEditForm, setCampanhaEditForm] = useState<CampanhaForm>(EMPTY_CAMPANHA_FORM)
  const [savingCampanhaEdit, setSavingCampanhaEdit] = useState(false)
  const [campanhaEditError, setCampanhaEditError] = useState<string | null>(null)

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [couponsLoading, setCouponsLoading] = useState(true)
  const [showCouponForm, setShowCouponForm] = useState(false)
  const [couponForm, setCouponForm] = useState<CouponForm>(EMPTY_COUPON_FORM)
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null)
  const [savingCoupon, setSavingCoupon] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)

  const loadCustomers = () => {
    setLoading(true)
    api.admin.crm.customers().then(setCustomers).finally(() => setLoading(false))
  }
  const loadCoupons = () => {
    setCouponsLoading(true)
    api.admin.coupons.list().then(setCoupons).finally(() => setCouponsLoading(false))
  }
  const loadCampanhaCoupons = (segmentId: string) => {
    api.admin.campanhaCoupons.list(segmentId).then((rows) => setCampanhaCouponsBySegment((prev) => ({ ...prev, [segmentId]: rows })))
  }
  const loadSegments = () => {
    setSegmentsLoading(true)
    api.admin.segments
      .list()
      .then((rows) => {
        setSegments(rows)
        rows.forEach((s) => loadCampanhaCoupons(s.id))
      })
      .finally(() => setSegmentsLoading(false))
  }
  useEffect(() => {
    loadCustomers()
    loadCoupons()
    loadSegments()
    api.admin.products.list().then(setProducts)
    api.admin.categories.list().then(setCategories)
  }, [])

  // Não existe job em background pra campanhas 'evento' — a única forma de
  // reavaliar o critério é rodando applyFilters de novo, e isso só acontece
  // quando alguém abre o CRM (aqui) ou clica em "Verificar" manualmente
  // (fireCampanha). fireEvent é idempotente, então rodar de novo a cada
  // load não duplica concessão nem reenvia WhatsApp pra quem já recebeu.
  const autoCheckedEventos = useRef(false)
  useEffect(() => {
    if (autoCheckedEventos.current) return
    if (segments.length === 0 || customers.length === 0 || products.length === 0) return
    autoCheckedEventos.current = true
    ;(async () => {
      for (const seg of segments) {
        const rows = await api.admin.campanhaCoupons.list(seg.id).catch(() => [])
        let changed = false
        for (const row of rows) {
          if (row.orientation !== 'evento' || !row.trigger_criteria || !row.active) continue
          const matching = applyFilters(customers, row.trigger_criteria as unknown as FilterState, products).map((c) => c.whatsapp)
          if (matching.length === 0) continue
          const result = await api.admin.campanhaCoupons.fireEvent(row.id, matching).catch(() => null)
          if (result && result.newly_granted.length > 0) {
            api.admin.whatsapp.notifyCouponGrant(row.coupon_id, row.message_template).catch(() => {})
            changed = true
          }
        }
        if (changed) loadCampanhaCoupons(seg.id)
      }
    })()
  }, [segments, customers, products])

  const neighborhoods = useMemo(
    () => Array.from(new Set(customers.flatMap((c) => c.neighborhoods))).sort(),
    [customers]
  )

  // "Cupons avulsos" só mostra cupom público de verdade — cupom de
  // campanha (mesmo um 'evento' que ainda não disparou nenhuma concessão)
  // já aparece encadeado dentro do card da própria campanha, lá em cima.
  const campanhaCouponIds = useMemo(
    () => new Set(Object.values(campanhaCouponsBySegment).flat().map((cc) => cc.coupon_id)),
    [campanhaCouponsBySegment]
  )
  const avulsoCoupons = useMemo(
    () => coupons.filter((c) => (c.grant_count ?? 0) === 0 && !campanhaCouponIds.has(c.id)),
    [coupons, campanhaCouponIds]
  )
  const editingCampanhaRow = editingCampanhaId
    ? Object.values(campanhaCouponsBySegment)
        .flat()
        .find((cc) => cc.id === editingCampanhaId)
    : null
  const campanhaFormSegment = segments.find((s) => s.id === campanhaForm.segmentId)
  const editingCampanhaSegment = editingCampanhaRow ? segments.find((s) => s.id === editingCampanhaRow.segment_id) : null

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
    setSegmentError(null)
    loadCampanhaCoupons(segment.id)
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
  const removeSegment = (id: string) =>
    askConfirm('Remover esta segmentação?', async () => {
      await api.admin.segments.delete(id)
      if (editingSegmentId === id) {
        resetSegmentForm()
        setAppliedFilter(null)
        setFilter(EMPTY_FILTER)
        setFilterOpen(false)
      }
      loadSegments()
    })

  // Um segmento só pode ter UMA campanha 'segmento' (dispara uma vez, não
  // faz sentido duplicar), mas pode ter várias 'evento'. O botão "+
  // Campanha" já abre no modo que ainda cabe pro segmento; a escolha de
  // orientação dentro do popup (switchCampanhaOrientation) respeita o
  // mesmo limite.
  const hasSegmentoCampanha = (segmentId: string) => (campanhaCouponsBySegment[segmentId] ?? []).some((cc) => cc.orientation === 'segmento')

  const openNewCampanha = (segment: CrmSegment) => {
    setCampanhaError(null)
    const orientation: CampanhaOrientation = hasSegmentoCampanha(segment.id) ? 'evento' : 'segmento'
    setCampanhaForm({
      ...EMPTY_CAMPANHA_FORM,
      segmentId: segment.id,
      orientation,
      triggerCriteria: orientation === 'evento' ? (segment.filter_criteria as unknown as FilterState) : null,
    })
    setShowCampanhaForm(true)
  }

  // Só renderiza os campos que o segmento realmente usa no filtro dele —
  // ao lado de cada um, a pill dourada mostra o valor ATUAL (do
  // segmento) e o campo ao lado é o valor-ALVO editável que, quando
  // atingido por um cliente, dispara a campanha 'evento'.
  const renderTriggerFields = (
    segmentCriteria: FilterState,
    value: FilterState,
    onChange: (patch: Partial<FilterState>) => void,
    staleKeys?: Set<FieldGroupKey>
  ) => {
    const gold = (partial: Partial<FilterState>) => (
      <span className="px-2.5 py-1 rounded-full bg-son-gold/15 text-son-gold text-[11px] font-medium w-fit">
        {describeFilter({ ...EMPTY_FILTER, ...partial }, products, categories)[0]}
      </span>
    )
    // Campo novo (staleKeys) fica com borda vermelha até o admin editar —
    // sinaliza que esse valor-alvo ainda não foi definido pra esse campo
    // que passou a existir no segmento depois que a campanha foi criada.
    const fieldBorder = (key: FieldGroupKey) =>
      staleKeys?.has(key) ? 'border-2 border-red-500 rounded-xl p-3 space-y-2 bg-red-500/5' : 'border border-white/10 rounded-xl p-3 space-y-2'
    const blocks: React.ReactNode[] = []
    if (segmentCriteria.minOrders) {
      blocks.push(
        <div key="minOrders" className={fieldBorder('minOrders')}>
          {gold({ minOrders: segmentCriteria.minOrders, minOrdersDays: segmentCriteria.minOrdersDays })}
          <div className="flex items-center gap-2">
            <input className={`input-field w-24 ${NO_SPINNER}`} type="number" min="1" placeholder="N° Vezes" value={value.minOrders} onChange={(e) => onChange({ minOrders: e.target.value })} />
            <span className="text-son-silver-dim text-xs whitespace-nowrap">no período de</span>
            <input className={`input-field w-20 ${NO_SPINNER}`} type="number" min="1" placeholder="Opcional" value={value.minOrdersDays} onChange={(e) => onChange({ minOrdersDays: e.target.value })} />
            <span className="text-son-silver-dim text-xs whitespace-nowrap">Dias</span>
          </div>
        </div>
      )
    }
    if (segmentCriteria.minItems) {
      blocks.push(
        <div key="minItems" className={fieldBorder('minItems')}>
          {gold({ minItems: segmentCriteria.minItems, minItemsDays: segmentCriteria.minItemsDays })}
          <div className="flex items-center gap-2">
            <input className={`input-field w-24 ${NO_SPINNER}`} type="number" min="1" placeholder="N° Produtos" value={value.minItems} onChange={(e) => onChange({ minItems: e.target.value })} />
            <span className="text-son-silver-dim text-xs whitespace-nowrap">no período de</span>
            <input className={`input-field w-20 ${NO_SPINNER}`} type="number" min="1" placeholder="Opcional" value={value.minItemsDays} onChange={(e) => onChange({ minItemsDays: e.target.value })} />
            <span className="text-son-silver-dim text-xs whitespace-nowrap">Dias</span>
          </div>
        </div>
      )
    }
    if (segmentCriteria.spentBelowAmount) {
      blocks.push(
        <div key="spentBelow" className={fieldBorder('spentBelow')}>
          {gold({ spentBelowAmount: segmentCriteria.spentBelowAmount, spentBelowDays: segmentCriteria.spentBelowDays })}
          <div className="flex items-center gap-2">
            <span className="text-son-silver-dim text-xs">R$</span>
            <input className={`input-field w-24 ${NO_SPINNER}`} type="number" min="0" value={value.spentBelowAmount} onChange={(e) => onChange({ spentBelowAmount: e.target.value })} />
            <span className="text-son-silver-dim text-xs whitespace-nowrap">em</span>
            <input className={`input-field w-20 ${NO_SPINNER}`} type="number" min="1" placeholder="Opcional" value={value.spentBelowDays} onChange={(e) => onChange({ spentBelowDays: e.target.value })} />
            <span className="text-son-silver-dim text-xs whitespace-nowrap">dias</span>
          </div>
        </div>
      )
    }
    if (segmentCriteria.spentAboveAmount) {
      blocks.push(
        <div key="spentAbove" className={fieldBorder('spentAbove')}>
          {gold({ spentAboveAmount: segmentCriteria.spentAboveAmount, spentAboveDays: segmentCriteria.spentAboveDays })}
          <div className="flex items-center gap-2">
            <span className="text-son-silver-dim text-xs">R$</span>
            <input className={`input-field w-24 ${NO_SPINNER}`} type="number" min="0" value={value.spentAboveAmount} onChange={(e) => onChange({ spentAboveAmount: e.target.value })} />
            <span className="text-son-silver-dim text-xs whitespace-nowrap">em</span>
            <input className={`input-field w-20 ${NO_SPINNER}`} type="number" min="1" placeholder="Opcional" value={value.spentAboveDays} onChange={(e) => onChange({ spentAboveDays: e.target.value })} />
            <span className="text-son-silver-dim text-xs whitespace-nowrap">dias</span>
          </div>
        </div>
      )
    }
    if (segmentCriteria.frequencyDropPercent) {
      blocks.push(
        <div key="frequencyDrop" className={fieldBorder('frequencyDrop')}>
          {gold({ frequencyDropPercent: segmentCriteria.frequencyDropPercent })}
          <input
            className={`input-field w-24 ${NO_SPINNER}`}
            type="number"
            min="1"
            max="100"
            value={value.frequencyDropPercent}
            onChange={(e) => onChange({ frequencyDropPercent: e.target.value })}
          />
        </div>
      )
    }
    if (segmentCriteria.newCustomerDays) {
      blocks.push(
        <div key="newCustomer" className={fieldBorder('newCustomer')}>
          {gold({ newCustomerDays: segmentCriteria.newCustomerDays })}
          <input className={`input-field w-24 ${NO_SPINNER}`} type="number" min="1" value={value.newCustomerDays} onChange={(e) => onChange({ newCustomerDays: e.target.value })} />
        </div>
      )
    }
    if (segmentCriteria.maxDistanceKm) {
      blocks.push(
        <div key="maxDistance" className={fieldBorder('maxDistance')}>
          {gold({ maxDistanceKm: segmentCriteria.maxDistanceKm })}
          <input className={`input-field w-24 ${NO_SPINNER}`} type="number" min="0" value={value.maxDistanceKm} onChange={(e) => onChange({ maxDistanceKm: e.target.value })} />
        </div>
      )
    }
    if (segmentCriteria.neighborhoods.length > 0) {
      blocks.push(
        <div key="neighborhoods" className={fieldBorder('neighborhoods')}>
          {gold({ neighborhoods: segmentCriteria.neighborhoods })}
          <select
            className="input-field appearance-none cursor-pointer"
            value=""
            onChange={(e) => {
              if (!e.target.value || value.neighborhoods.includes(e.target.value)) return
              onChange({ neighborhoods: [...value.neighborhoods, e.target.value] })
            }}
          >
            <option value="">Adicionar bairro...</option>
            {neighborhoods
              .filter((n) => !value.neighborhoods.includes(n))
              .map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
          </select>
          {value.neighborhoods.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value.neighborhoods.map((n) => (
                <span key={n} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-son-pink/15 text-son-pink text-xs font-medium">
                  {n}
                  <button type="button" onClick={() => onChange({ neighborhoods: value.neighborhoods.filter((x) => x !== n) })}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )
    }
    if (segmentCriteria.birthdayMonth) {
      blocks.push(
        <div key="birthday" className={fieldBorder('birthday')}>
          {gold({ birthdayMonth: segmentCriteria.birthdayMonth })}
          <select className="input-field appearance-none cursor-pointer" value={value.birthdayMonth} onChange={(e) => onChange({ birthdayMonth: e.target.value })}>
            <option value="">Qualquer mês</option>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )
    }
    if (segmentCriteria.recurringProductIds.length > 0 || segmentCriteria.recurringCategoryIds.length > 0) {
      blocks.push(
        <div key="recurring" className={fieldBorder('recurring')}>
          {gold({
            recurringProductIds: segmentCriteria.recurringProductIds,
            recurringCategoryIds: segmentCriteria.recurringCategoryIds,
            recurringDays: segmentCriteria.recurringDays,
          })}
          <ProductCategoryMultiSelect
            products={products}
            categories={categories}
            selectedProductIds={value.recurringProductIds}
            selectedCategoryIds={value.recurringCategoryIds}
            onChangeProducts={(recurringProductIds) => onChange({ recurringProductIds })}
            onChangeCategories={(recurringCategoryIds) => onChange({ recurringCategoryIds })}
          />
          <input
            className={`input-field w-44 ${NO_SPINNER}`}
            type="number"
            min="1"
            placeholder="N° Dias (Opcional)"
            value={value.recurringDays}
            onChange={(e) => onChange({ recurringDays: e.target.value })}
          />
        </div>
      )
    }
    return blocks
  }

  const switchCampanhaOrientation = (orientation: CampanhaOrientation) => {
    const segment = segments.find((s) => s.id === campanhaForm.segmentId)
    setCampanhaForm({
      ...campanhaForm,
      orientation,
      triggerCriteria: orientation === 'evento' ? ((segment?.filter_criteria as unknown as FilterState) ?? EMPTY_FILTER) : null,
    })
  }

  const campanhaMessageValid = campanhaForm.messageTemplate.includes('/nome') && campanhaForm.messageTemplate.includes('/cupom')

  const saveCampanha = async () => {
    setCampanhaError(null)
    if (!campanhaMessageValid) {
      setCampanhaError('A mensagem precisa citar /nome e /cupom.')
      return
    }
    const segment = segments.find((s) => s.id === campanhaForm.segmentId)
    if (campanhaForm.orientation === 'evento' && segment && JSON.stringify(segment.filter_criteria) === JSON.stringify(campanhaForm.triggerCriteria)) {
      setCampanhaError(
        'O critério do evento precisa ser diferente do critério atual do segmento — altere pelo menos 1 valor abaixo antes de criar a campanha orientada a evento.'
      )
      return
    }
    setSavingCampanha(true)
    try {
      const criteria = campanhaForm.orientation === 'segmento' ? segment?.filter_criteria ?? EMPTY_FILTER : campanhaForm.triggerCriteria!
      const matchingWhatsapps =
        campanhaForm.orientation === 'segmento'
          ? applyFilters(customers, criteria as unknown as FilterState, products).map((c) => c.whatsapp)
          : []
      const created = await api.admin.campanhaCoupons.create({
        segment_id: campanhaForm.segmentId,
        orientation: campanhaForm.orientation,
        trigger_criteria: campanhaForm.orientation === 'evento' ? (campanhaForm.triggerCriteria as unknown as CrmFilterCriteria) : undefined,
        message_template: campanhaForm.messageTemplate,
        code: campanhaForm.code,
        uses_per_customer: Number(campanhaForm.uses_per_customer) || 1,
        combinable_with_public: campanhaForm.combinable_with_public,
        allow_promotion_checkout: campanhaForm.allow_promotion_checkout,
        expires_at: campanhaForm.expires_at || undefined,
        max_uses: campanhaForm.max_uses ? Number(campanhaForm.max_uses) : undefined,
        discount_type: campanhaForm.productMode === 'flat' ? campanhaForm.discount_type : undefined,
        discount_value: campanhaForm.productMode === 'flat' ? Number(campanhaForm.discount_value) : undefined,
        shipping_discount_type: campanhaForm.shippingEnabled ? campanhaForm.shipping_discount_type : undefined,
        shipping_discount_value: campanhaForm.shippingEnabled ? Number(campanhaForm.shipping_discount_value) : undefined,
        product_discounts: campanhaForm.productMode === 'produto' ? campanhaForm.productDiscounts : undefined,
        customer_whatsapps: matchingWhatsapps,
      })
      if (campanhaForm.orientation === 'segmento' && matchingWhatsapps.length > 0) {
        api.admin.whatsapp.notifyCouponGrant(created.coupon_id, campanhaForm.messageTemplate).catch(() => {})
      }
      setShowCampanhaForm(false)
      setCampanhaForm(EMPTY_CAMPANHA_FORM)
      loadCampanhaCoupons(campanhaForm.segmentId)
      loadCoupons()
    } catch (err) {
      setCampanhaError(err instanceof ApiError ? err.message : 'Não foi possível criar a campanha.')
    } finally {
      setSavingCampanha(false)
    }
  }

  // Reavalia uma campanha 'evento': recalcula quem casa com o critério
  // agora e concede+notifica só quem ainda não tinha o cupom.
  // Reavalia o evento (concede pra quem bateu o critério agora) e ABRE o
  // histórico de disparos — a lista completa de quem já recebeu o cupom
  // dessa campanha, não só os novos desta checagem.
  const openHistoryDialog = async (row: CrmCampanhaCoupon) => {
    setHistoryDialogCampanha(row)
    setHistoryLoading(true)
    try {
      const matching = applyFilters(customers, row.trigger_criteria as unknown as FilterState, products).map((c) => c.whatsapp)
      const result = await api.admin.campanhaCoupons.fireEvent(row.id, matching)
      if (result.newly_granted.length > 0) {
        api.admin.whatsapp.notifyCouponGrant(row.coupon_id, row.message_template).catch(() => {})
      }
      loadCampanhaCoupons(row.segment_id)
      const grants = await api.admin.coupons.listGrants(row.coupon_id)
      setHistoryGrants(grants)
    } finally {
      setHistoryLoading(false)
    }
  }

  const removeCampanha = (row: CrmCampanhaCoupon) =>
    askConfirm('Remover esta campanha?', async () => {
      await api.admin.campanhaCoupons.delete(row.id)
      loadCampanhaCoupons(row.segment_id)
    })

  const toggleCampanhaActive = async (row: CrmCampanhaCoupon) => {
    try {
      await api.admin.campanhaCoupons.toggleActive(row.id, !row.active)
      loadCampanhaCoupons(row.segment_id)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Não foi possível atualizar o status da campanha.')
    }
  }

  // Não dá pra editar orientation/trigger_criteria/código de uma campanha
  // já criada (identidade fixa) — só mensagem, desconto e prazo.
  const openEditCampanha = (cc: CrmCampanhaCoupon) => {
    const coupon = coupons.find((c) => c.id === cc.coupon_id)
    setCampanhaEditError(null)
    setCampanhaEditForm({
      ...EMPTY_CAMPANHA_FORM,
      orientation: cc.orientation,
      triggerCriteria: cc.orientation === 'evento' ? (cc.trigger_criteria as unknown as FilterState) : null,
      messageTemplate: cc.message_template,
      productMode: coupon?.kind === 'produto' ? 'produto' : coupon?.discount_type ? 'flat' : 'nenhum',
      discount_type: coupon?.discount_type ?? 'percent',
      discount_value: coupon?.kind !== 'produto' && coupon?.discount_value != null ? String(coupon.discount_value) : '',
      productDiscounts: coupon?.product_discounts ?? [],
      shippingEnabled: !!coupon?.shipping_discount_type,
      shipping_discount_type: coupon?.shipping_discount_type ?? 'percent',
      shipping_discount_value: coupon?.shipping_discount_value != null ? String(coupon.shipping_discount_value) : '',
      uses_per_customer: String(cc.uses_per_customer),
      combinable_with_public: coupon?.combinable_with_public ?? false,
      allow_promotion_checkout: coupon?.allow_promotion_checkout ?? false,
      expires_at: coupon?.expires_at ?? '',
      max_uses: coupon?.max_uses != null ? String(coupon.max_uses) : '',
    })
    setEditingCampanhaId(cc.id)
  }

  const campanhaEditMessageValid = campanhaEditForm.messageTemplate.includes('/nome') && campanhaEditForm.messageTemplate.includes('/cupom')

  const saveCampanhaEdit = async () => {
    if (!editingCampanhaId) return
    setCampanhaEditError(null)
    if (!campanhaEditMessageValid) {
      setCampanhaEditError('A mensagem precisa citar /nome e /cupom.')
      return
    }
    setSavingCampanhaEdit(true)
    try {
      const row = await api.admin.campanhaCoupons.update(editingCampanhaId, {
        message_template: campanhaEditForm.messageTemplate,
        uses_per_customer: Number(campanhaEditForm.uses_per_customer) || 1,
        combinable_with_public: campanhaEditForm.combinable_with_public,
        allow_promotion_checkout: campanhaEditForm.allow_promotion_checkout,
        expires_at: campanhaEditForm.expires_at || undefined,
        max_uses: campanhaEditForm.max_uses ? Number(campanhaEditForm.max_uses) : undefined,
        discount_type: campanhaEditForm.productMode === 'flat' ? campanhaEditForm.discount_type : undefined,
        discount_value: campanhaEditForm.productMode === 'flat' ? Number(campanhaEditForm.discount_value) : undefined,
        shipping_discount_type: campanhaEditForm.shippingEnabled ? campanhaEditForm.shipping_discount_type : undefined,
        shipping_discount_value: campanhaEditForm.shippingEnabled ? Number(campanhaEditForm.shipping_discount_value) : undefined,
        product_discounts: campanhaEditForm.productMode === 'produto' ? campanhaEditForm.productDiscounts : undefined,
        trigger_criteria: campanhaEditForm.orientation === 'evento' ? (campanhaEditForm.triggerCriteria as unknown as CrmFilterCriteria) : undefined,
      })
      setEditingCampanhaId(null)
      loadCampanhaCoupons(row.segment_id)
      loadCoupons()
    } catch (err) {
      setCampanhaEditError(err instanceof ApiError ? err.message : 'Não foi possível salvar as alterações.')
    } finally {
      setSavingCampanhaEdit(false)
    }
  }

  const clearFilters = () => {
    resetSegmentForm()
    setFilter(EMPTY_FILTER)
    setAppliedFilter(null)
    setFilterFormError(null)
    setPairErrors({})
  }

  const openEditCoupon = (c: Coupon) => {
    setEditingCouponId(c.id)
    setCouponForm({
      code: c.code,
      kind: c.kind,
      discount_type: c.discount_type ?? 'percent',
      discount_value: c.discount_value != null ? String(c.discount_value) : '',
      productDiscounts: c.product_discounts ?? [],
      allow_promotion_checkout: c.allow_promotion_checkout,
      expires_at: c.expires_at ?? '',
      max_uses: c.max_uses != null ? String(c.max_uses) : '',
    })
    setCouponError(null)
    setShowCouponForm(true)
  }

  const saveCoupon = async () => {
    setCouponError(null)
    if (couponForm.kind === 'produto' && couponForm.productDiscounts.length === 0) {
      setCouponError('Busque e adicione ao menos um produto.')
      return
    }
    setSavingCoupon(true)
    try {
      const payload = {
        discount_type: couponForm.kind === 'produto' ? undefined : couponForm.discount_type,
        discount_value: couponForm.kind === 'produto' ? undefined : Number(couponForm.discount_value),
        product_discounts: couponForm.kind === 'produto' ? couponForm.productDiscounts : undefined,
        allow_promotion_checkout: couponForm.allow_promotion_checkout,
        expires_at: couponForm.expires_at || undefined,
        max_uses: couponForm.max_uses ? Number(couponForm.max_uses) : undefined,
      }
      if (editingCouponId) {
        const active = coupons.find((c) => c.id === editingCouponId)?.active ?? true
        await api.admin.coupons.update(editingCouponId, { active, ...payload })
      } else {
        await api.admin.coupons.create({ code: couponForm.code, kind: couponForm.kind, ...payload })
      }
      setShowCouponForm(false)
      setEditingCouponId(null)
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
      allow_promotion_checkout: c.allow_promotion_checkout,
      expires_at: c.expires_at ?? undefined,
      max_uses: c.max_uses ?? undefined,
    })
    loadCoupons()
  }

  const removeCoupon = (id: string) =>
    askConfirm('Remover este cupom?', async () => {
      await api.admin.coupons.delete(id)
      loadCoupons()
    })

  const closeCouponForm = () => {
    setShowCouponForm(false)
    setEditingCouponId(null)
  }

  // Compartilhado entre o slot de criação (acima da lista) e o morph de
  // edição de cada card — mesmos campos, só o cabeçalho/botão mudam.
  const couponFormFields = (isEdit: boolean) => (
    <>
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white">{isEdit ? 'Editar cupom' : 'Novo cupom avulso'}</h3>
        <button type="button" onClick={closeCouponForm} className="text-son-silver-dim hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div>
        <label className="label">Código</label>
        <input
          className="input-field font-mono uppercase disabled:opacity-50"
          value={couponForm.code}
          onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })}
          placeholder="SUNSET10"
          disabled={isEdit}
        />
      </div>
      <div>
        <label className="label">Tipo</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(['desconto', 'frete', 'produto', 'aniversario'] as const).map((k) => (
            <button
              key={k}
              type="button"
              disabled={isEdit}
              onClick={() => setCouponForm({ ...couponForm, kind: k })}
              className={`py-2.5 rounded-xl border text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
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
            Os produtos escolhidos aparecem destacados em /catalogo na categoria "Promoção" com o desconto já visível, e o desconto se
            aplica sozinho assim que o produto entra no carrinho — sem precisar digitar código.
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
          checked={couponForm.allow_promotion_checkout}
          onChange={(e) => setCouponForm({ ...couponForm, allow_promotion_checkout: e.target.checked })}
        />
        Pode ser usado também num checkout de promoção
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
        {isEdit ? 'Salvar alterações' : 'Salvar cupom'}
      </button>
    </>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">CRM &amp; cupons</h1>
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

      <div className="mb-3">
        <div className="relative">
          <Search className="w-4 h-4 text-son-silver-dim absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input-field pl-9"
            placeholder="Buscar por nome ou WhatsApp..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <AnimatePresence>
        {filterOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"
            onClick={() => setFilterOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="glass rounded-2xl p-5 max-w-lg w-full my-8 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-lg">{editingSegmentId ? 'Editar segmentação' : 'Nova segmentação'}</h3>
                <button type="button" onClick={() => setFilterOpen(false)} className="text-son-silver-dim hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
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
              <div className="flex flex-col gap-1">
                {describeFilter(appliedFilter, products, categories).map((line, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-full bg-son-gold/15 text-son-gold text-xs font-medium w-fit">
                    {line}
                  </span>
                ))}
              </div>
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
              {segmentError && <p className="error-msg">{segmentError}</p>}
              <button onClick={saveSegment} disabled={savingSegment} className="btn-primary w-full">
                {savingSegment ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingSegmentId ? 'Atualizar segmentação' : 'Salvar segmentação'}
              </button>
              {editingSegmentId && (
                <p className="text-xs text-son-silver-dim text-center">
                  Campanhas se criam pelo botão "+ Campanha" no card desta segmentação, na lista abaixo.
                </p>
              )}
            </div>
          )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-son-silver-dim">
          {visible.length} cliente(s){isSegmented ? ' nessa segmentação/filtro' : ''}
        </p>
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

      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-son-gold" />
          <h2 className="text-xl font-black">Segmentações salvas</h2>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!filterOpen) resetSegmentForm()
            setFilterOpen(true)
          }}
          className="btn-primary text-sm py-2.5 px-5"
        >
          <Sparkles className="w-4 h-4" /> Nova segmentação
        </button>
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
        <div className="space-y-4 mb-10">
          {segments.map((s) => {
            const count = applyFilters(customers, s.filter_criteria as unknown as FilterState, products).length
            const campanhas = campanhaCouponsBySegment[s.id] ?? []
            return (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="text-left min-w-[160px]">
                    <p className="font-semibold text-white">{s.name}</p>
                    {s.description && <p className="text-xs text-son-silver-dim mt-0.5">{s.description}</p>}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerListSegment(s)
                        setCustomerListQuery('')
                      }}
                      className="text-xs font-bold sunset-text mt-1 mb-1.5 hover:underline"
                    >
                      {count} cliente(s)
                    </button>
                    <div className="flex flex-wrap gap-1">
                      {describeFilter(s.filter_criteria as unknown as FilterState, products, categories).map((line, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-full bg-son-gold/15 text-son-gold text-[10px] font-medium">
                          {line}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button type="button" onClick={() => openSegment(s)} className="text-xs font-semibold text-son-silver-dim hover:text-white">
                      Editar segmentação
                    </button>
                    <button onClick={() => removeSegment(s.id)} className="text-son-silver-dim hover:text-son-pink">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                  {campanhas.length === 0 ? (
                    <button type="button" onClick={() => openNewCampanha(s)} className="btn-primary text-sm py-2.5 px-5">
                      <Plus className="w-4 h-4" /> Campanha
                    </button>
                  ) : (
                    <>
                      <button type="button" onClick={() => openNewCampanha(s)} className="btn-primary text-sm py-2.5 px-5">
                        <Plus className="w-4 h-4" /> Campanha
                      </button>
                      {campanhas.map((cc) => {
                        const cCoupon = coupons.find((c) => c.id === cc.coupon_id)
                        const stale = isCampanhaStale(cc, s)
                      return (
                        <div key={cc.id} className="flex items-center gap-2 flex-wrap">
                          {/* subcard: orientada a segmento/evento */}
                          <div
                            title={stale ? 'Clique em "Editar" e atualize os campos dos eventos alvos desta campanha, pois você editou a segmentação original.' : undefined}
                            className={`flex-shrink-0 w-56 rounded-xl px-3 py-2 ${
                              stale
                                ? 'border-2 border-red-500 bg-red-500/5 shadow-[0_0_10px_2px_rgba(239,68,68,0.5)]'
                                : 'border border-purple-400/30 bg-purple-500/5'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {stale ? (
                                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                              ) : cc.orientation === 'evento' ? (
                                <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                              ) : (
                                <Gift className="w-4 h-4 text-purple-300 flex-shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-white">
                                  {cc.orientation === 'evento' ? 'Orientada a evento' : 'Orientada a segmento'}
                                </p>
                                <p className="text-[10px] text-son-silver-dim">
                                  {cc.orientation === 'evento'
                                    ? cc.fired_at
                                      ? `Disparado em ${formatDate(cc.fired_at)}`
                                      : 'Aguardando evento'
                                    : `Disparada em ${formatDate(cc.fired_at ?? cc.created_at)}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              {cc.orientation === 'evento' && (
                                <button
                                  type="button"
                                  onClick={() => openHistoryDialog(cc)}
                                  className="text-[10px] font-semibold text-son-gold hover:text-white"
                                >
                                  Verificar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditCampanha(cc)}
                                className="text-[10px] font-semibold text-son-silver-dim hover:text-white"
                              >
                                Editar
                              </button>
                              <button type="button" onClick={() => removeCampanha(cc)} className="text-son-silver-dim hover:text-son-pink">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {cCoupon && (
                            <>
                              <div className="w-5 border-t-2 border-dashed border-purple-400/40 flex-shrink-0" />
                              {/* subcard: cupom exclusivo — mesmo desenho de bilhete do cupom avulso, só que pequeno e ligado */}
                              <div className="flex-shrink-0 w-40 rounded-xl border border-purple-400/30 bg-purple-500/5 overflow-hidden flex items-stretch">
                                <div className="min-w-0 flex-1 p-2.5">
                                  <p className="font-mono text-xs font-bold text-white truncate">{cCoupon.code}</p>
                                  <span className="inline-block px-1.5 py-0.5 rounded-full bg-white/10 text-son-silver-dim text-[9px] mt-1">
                                    {COUPON_KIND_LABEL[cCoupon.kind]}
                                  </span>
                                </div>
                                <div className="border-l-2 border-dashed border-purple-400/30 my-2" />
                                <div className="flex-shrink-0 p-2.5 flex items-center justify-center">
                                  <span className="text-xs font-black text-purple-300 text-center">
                                    {discountLabel(cCoupon.discount_type, cCoupon.discount_value) ??
                                      discountLabel(cCoupon.shipping_discount_type, cCoupon.shipping_discount_value) ??
                                      `${cCoupon.product_discounts?.length ?? 0} prod.`}
                                  </span>
                                </div>
                              </div>
                            </>
                          )}

                          <ToggleSwitch checked={cc.active} onClick={() => (stale ? setStaleDialogCampanha(cc) : toggleCampanhaActive(cc))} />
                        </div>
                        )
                      })}
                    </>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <h2 className="text-xl font-black mb-4">Cupons avulsos</h2>

      <div className="mb-6">
        <button
          type="button"
          onClick={() => {
            setEditingCouponId(null)
            setCouponForm(EMPTY_COUPON_FORM)
            setCouponError(null)
            setShowCouponForm(true)
          }}
          className="btn-primary text-sm py-2.5 px-5"
        >
          <Plus className="w-4 h-4" /> Novo cupom
        </button>
      </div>

      {couponsLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
        </div>
      ) : avulsoCoupons.length === 0 ? (
        <div className="text-center py-10 text-son-silver-dim">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum cupom avulso cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {avulsoCoupons.map((c) => (
            <div key={c.id} className="rounded-2xl border border-blue-400/30 bg-blue-500/5 overflow-hidden">
              <div className="flex items-stretch">
                <div className="flex-1 min-w-0 p-3">
                  <p className="font-mono font-bold text-white">{c.code}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-son-silver-dim text-[10px]">{COUPON_KIND_LABEL[c.kind]}</span>
                    {discountLabel(c.shipping_discount_type, c.shipping_discount_value) && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold">
                        Frete: {discountLabel(c.shipping_discount_type, c.shipping_discount_value)}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-son-silver-dim mt-1">
                    {c.max_uses ? `${c.used_count}/${c.max_uses} usos` : `${c.used_count} usos · sem limite`}
                    {c.expires_at ? ` · até ${new Date(c.expires_at).toLocaleDateString('pt-BR')}` : ' · sem validade'}
                  </p>
                </div>
                <div className="border-l-2 border-dashed border-blue-400/30 my-2" />
                <div className="flex-shrink-0 p-3 flex flex-col items-center justify-center min-w-[6.5rem]">
                  <span className="text-sm font-black text-blue-300 text-center">
                    {c.kind === 'produto' ? `${c.product_discounts?.length ?? 0} produto(s)` : discountLabel(c.discount_type, c.discount_value) ?? '—'}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-blue-400/20">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => openEditCoupon(c)} className="text-[10px] font-semibold text-son-silver-dim hover:text-white">
                    Editar
                  </button>
                  <button type="button" onClick={() => removeCoupon(c.id)} className="text-son-silver-dim hover:text-son-pink">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <ToggleSwitch checked={c.active} onClick={() => toggleCouponActive(c)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCouponForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"
            onClick={closeCouponForm}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="glass rounded-2xl p-6 max-w-lg w-full my-8 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              {couponFormFields(!!editingCouponId)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingCampanhaId && editingCampanhaRow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"
            onClick={() => setEditingCampanhaId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="glass rounded-2xl p-6 max-w-lg w-full my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  {editingCampanhaRow.orientation === 'evento' ? (
                    <Zap className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Gift className="w-4 h-4 text-purple-300" />
                  )}
                  Editar campanha
                </h3>
                <button type="button" onClick={() => setEditingCampanhaId(null)} className="text-son-silver-dim hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editingCampanhaRow.orientation === 'evento' && editingCampanhaSegment && (
                <div className="space-y-2 mb-4">
                  <label className="label">
                    Critério do evento{' '}
                    {getNewTriggerFieldKeys(
                      editingCampanhaSegment.filter_criteria as unknown as FilterState,
                      campanhaEditForm.triggerCriteria
                    ).size > 0 && (
                      <span className="text-red-400 font-normal">
                        (o segmento ganhou campo(s) novo(s) — preencha o(s) destacado(s) em vermelho abaixo)
                      </span>
                    )}
                  </label>
                  {renderTriggerFields(
                    editingCampanhaSegment.filter_criteria as unknown as FilterState,
                    campanhaEditForm.triggerCriteria ?? EMPTY_FILTER,
                    (patch) =>
                      setCampanhaEditForm({ ...campanhaEditForm, triggerCriteria: { ...(campanhaEditForm.triggerCriteria ?? EMPTY_FILTER), ...patch } }),
                    getNewTriggerFieldKeys(editingCampanhaSegment.filter_criteria as unknown as FilterState, campanhaEditForm.triggerCriteria)
                  )}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="label">Mensagem pro cliente (WhatsApp)</label>
                  <textarea
                    className="input-field"
                    rows={4}
                    value={campanhaEditForm.messageTemplate}
                    onChange={(e) => setCampanhaEditForm({ ...campanhaEditForm, messageTemplate: e.target.value })}
                  />
                  <p className="text-xs text-son-silver-dim mt-1">
                    Precisa citar <code>/nome</code> e <code>/cupom</code>.
                  </p>
                </div>
                <div>
                  <label className="label">Desconto no produto</label>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    {(
                      [
                        { value: 'nenhum', label: 'Nenhum' },
                        { value: 'flat', label: 'Valor total' },
                        { value: 'produto', label: 'Produto/Categoria' },
                      ] as const
                    ).map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCampanhaEditForm({ ...campanhaEditForm, productMode: value })}
                        className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                          campanhaEditForm.productMode === value
                            ? 'bg-purple-500 text-white border-transparent'
                            : 'bg-son-surface border-white/10 text-son-silver'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {campanhaEditForm.productMode === 'flat' && (
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="input-field"
                        value={campanhaEditForm.discount_type}
                        onChange={(e) => setCampanhaEditForm({ ...campanhaEditForm, discount_type: e.target.value as DiscountType })}
                      >
                        <option value="percent">Percentual</option>
                        <option value="fixed">Valor fixo (R$)</option>
                      </select>
                      <input
                        className="input-field"
                        type="number"
                        min="0"
                        placeholder="Valor"
                        value={campanhaEditForm.discount_value}
                        onChange={(e) => setCampanhaEditForm({ ...campanhaEditForm, discount_value: e.target.value })}
                      />
                    </div>
                  )}
                  {campanhaEditForm.productMode === 'produto' && (
                    <ProductDiscountList
                      products={products}
                      categories={categories}
                      discounts={campanhaEditForm.productDiscounts}
                      onChange={(productDiscounts) => setCampanhaEditForm({ ...campanhaEditForm, productDiscounts })}
                    />
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-son-silver">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-purple-400"
                    checked={campanhaEditForm.shippingEnabled}
                    onChange={(e) => setCampanhaEditForm({ ...campanhaEditForm, shippingEnabled: e.target.checked })}
                  />
                  Também dar desconto no frete
                </label>
                {campanhaEditForm.shippingEnabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="input-field"
                      value={campanhaEditForm.shipping_discount_type}
                      onChange={(e) => setCampanhaEditForm({ ...campanhaEditForm, shipping_discount_type: e.target.value as DiscountType })}
                    >
                      <option value="percent">Percentual</option>
                      <option value="fixed">Valor fixo (R$)</option>
                    </select>
                    <input
                      className="input-field"
                      type="number"
                      min="0"
                      placeholder="Valor"
                      value={campanhaEditForm.shipping_discount_value}
                      onChange={(e) => setCampanhaEditForm({ ...campanhaEditForm, shipping_discount_value: e.target.value })}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Usos por cliente</label>
                    <input
                      className="input-field"
                      type="number"
                      min="1"
                      value={campanhaEditForm.uses_per_customer}
                      onChange={(e) => setCampanhaEditForm({ ...campanhaEditForm, uses_per_customer: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Limite global (opcional)</label>
                    <input
                      className="input-field"
                      type="number"
                      min="1"
                      value={campanhaEditForm.max_uses}
                      onChange={(e) => setCampanhaEditForm({ ...campanhaEditForm, max_uses: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Validade (opcional)</label>
                  <ExpiryInput value={campanhaEditForm.expires_at} onChange={(expires_at) => setCampanhaEditForm({ ...campanhaEditForm, expires_at })} />
                </div>
                {campanhaEditError && <p className="error-msg">{campanhaEditError}</p>}
                <button onClick={saveCampanhaEdit} disabled={savingCampanhaEdit || !campanhaEditMessageValid} className="btn-primary w-full mt-2">
                  {savingCampanhaEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Salvar alterações
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showCampanhaForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setShowCampanhaForm(false)}
        >
          <div className="glass rounded-2xl p-6 max-w-lg w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                {campanhaForm.orientation === 'evento' ? <Zap className="w-4 h-4 text-amber-400" /> : <Gift className="w-4 h-4 text-son-pink" />}
                {campanhaForm.orientation === 'evento' ? 'Cupom orientado a evento' : 'Cupom exclusivo do segmento'}
              </h3>
              <button onClick={() => setShowCampanhaForm(false)} className="text-son-silver-dim hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-3">
              <button
                type="button"
                disabled={campanhaForm.orientation !== 'segmento' && hasSegmentoCampanha(campanhaForm.segmentId)}
                onClick={() => switchCampanhaOrientation('segmento')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  campanhaForm.orientation === 'segmento' ? 'bg-son-pink text-white border-transparent' : 'bg-son-surface border-white/10 text-son-silver'
                }`}
              >
                <Gift className="w-3.5 h-3.5" /> Orientada a segmento
              </button>
              <button
                type="button"
                onClick={() => switchCampanhaOrientation('evento')}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  campanhaForm.orientation === 'evento' ? 'bg-amber-500 text-white border-transparent' : 'bg-son-surface border-white/10 text-son-silver'
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> Orientada a evento
              </button>
            </div>
            {campanhaForm.orientation === 'segmento' && hasSegmentoCampanha(campanhaForm.segmentId) && (
              <p className="text-xs text-amber-400 mb-3">Este segmento já tem uma campanha orientada a segmento — só uma é permitida.</p>
            )}

            {campanhaForm.orientation === 'segmento' ? (
              <p className="text-xs text-son-silver-dim mb-3">
                Dispara agora pra{' '}
                <strong className="text-white">
                  {campanhaFormSegment ? applyFilters(customers, campanhaFormSegment.filter_criteria as unknown as FilterState, products).length : 0}{' '}
                  cliente(s)
                </strong>{' '}
                que casam com o critério salvo do segmento — cupom exclusivo, intransferível.
              </p>
            ) : (
              <p className="text-xs text-son-silver-dim mb-3">
                Não dispara agora. Fica "armado" com o critério que você definir abaixo — quando algum cliente passar a bater esse
                critério (checado ao abrir o CRM, ou no botão <strong className="text-white">Verificar</strong>), ele recebe o cupom via
                WhatsApp automaticamente. Só concede pra quem ainda não recebeu.
              </p>
            )}

            {campanhaForm.orientation === 'evento' && campanhaFormSegment && (
              <div className="space-y-2 mb-3">
                <label className="label">
                  Critério do evento <span className="text-son-silver-dim font-normal">(altere pelo menos 1 valor abaixo)</span>
                </label>
                {renderTriggerFields(
                  campanhaFormSegment.filter_criteria as unknown as FilterState,
                  campanhaForm.triggerCriteria ?? EMPTY_FILTER,
                  (patch) => setCampanhaForm({ ...campanhaForm, triggerCriteria: { ...(campanhaForm.triggerCriteria ?? EMPTY_FILTER), ...patch } })
                )}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="label">Código</label>
                <input
                  className="input-field font-mono uppercase"
                  value={campanhaForm.code}
                  onChange={(e) => setCampanhaForm({ ...campanhaForm, code: e.target.value })}
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
                      { value: 'produto', label: 'Produto/Categoria' },
                    ] as const
                  ).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCampanhaForm({ ...campanhaForm, productMode: value })}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        campanhaForm.productMode === value
                          ? 'sunset-bg text-white border-transparent'
                          : 'bg-son-surface border-white/10 text-son-silver'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {campanhaForm.productMode === 'flat' && (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      className="input-field"
                      value={campanhaForm.discount_type}
                      onChange={(e) => setCampanhaForm({ ...campanhaForm, discount_type: e.target.value as DiscountType })}
                    >
                      <option value="percent">Percentual</option>
                      <option value="fixed">Valor fixo (R$)</option>
                    </select>
                    <input
                      className="input-field"
                      type="number"
                      min="0"
                      placeholder="Valor"
                      value={campanhaForm.discount_value}
                      onChange={(e) => setCampanhaForm({ ...campanhaForm, discount_value: e.target.value })}
                    />
                  </div>
                )}
                {campanhaForm.productMode === 'produto' && (
                  <ProductDiscountList
                    products={products}
                    categories={categories}
                    discounts={campanhaForm.productDiscounts}
                    onChange={(productDiscounts) => setCampanhaForm({ ...campanhaForm, productDiscounts })}
                  />
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-son-silver">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-son-pink"
                  checked={campanhaForm.shippingEnabled}
                  onChange={(e) => setCampanhaForm({ ...campanhaForm, shippingEnabled: e.target.checked })}
                />
                Também dar desconto no frete
              </label>
              {campanhaForm.shippingEnabled && (
                <div className="grid grid-cols-2 gap-2">
                  <select
                    className="input-field"
                    value={campanhaForm.shipping_discount_type}
                    onChange={(e) => setCampanhaForm({ ...campanhaForm, shipping_discount_type: e.target.value as DiscountType })}
                  >
                    <option value="percent">Percentual</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                  <input
                    className="input-field"
                    type="number"
                    min="0"
                    placeholder="Valor"
                    value={campanhaForm.shipping_discount_value}
                    onChange={(e) => setCampanhaForm({ ...campanhaForm, shipping_discount_value: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="label">Quantas vezes cada cliente pode usar</label>
                <input
                  className="input-field"
                  type="number"
                  min="1"
                  value={campanhaForm.uses_per_customer}
                  onChange={(e) => setCampanhaForm({ ...campanhaForm, uses_per_customer: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Mensagem pro cliente (WhatsApp)</label>
                <textarea
                  className="input-field"
                  rows={5}
                  placeholder={'Olá, /nome! Você ganhou o cupom /cupom, exclusivo pra você 🎁\n\nBenefícios:\n- ...'}
                  value={campanhaForm.messageTemplate}
                  onChange={(e) => setCampanhaForm({ ...campanhaForm, messageTemplate: e.target.value })}
                />
                <p className="text-xs text-son-silver-dim mt-1">
                  Precisa citar <code>/nome</code> e <code>/cupom</code>. O link do site é adicionado automaticamente no fim.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-son-silver">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-son-pink"
                  checked={campanhaForm.combinable_with_public}
                  onChange={(e) => setCampanhaForm({ ...campanhaForm, combinable_with_public: e.target.checked })}
                />
                Pode ser combinado com um cupom avulso no checkout de catálogo
              </label>
              <label className="flex items-center gap-2 text-sm text-son-silver">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-son-pink"
                  checked={campanhaForm.allow_promotion_checkout}
                  onChange={(e) => setCampanhaForm({ ...campanhaForm, allow_promotion_checkout: e.target.checked })}
                />
                Pode ser usado também num checkout de promoção
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Validade (opcional)</label>
                  <ExpiryInput value={campanhaForm.expires_at} onChange={(expires_at) => setCampanhaForm({ ...campanhaForm, expires_at })} />
                </div>
                <div>
                  <label className="label">Limite global de usos (opcional)</label>
                  <input
                    className="input-field"
                    type="number"
                    min="1"
                    value={campanhaForm.max_uses}
                    onChange={(e) => setCampanhaForm({ ...campanhaForm, max_uses: e.target.value })}
                  />
                </div>
              </div>
              {campanhaError && <p className="error-msg">{campanhaError}</p>}
              <button onClick={saveCampanha} disabled={savingCampanha || !campanhaMessageValid} className="btn-primary w-full mt-2">
                {savingCampanha ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Criar campanha
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setConfirmDialog(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="glass rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-white font-semibold mb-5">{confirmDialog.message}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDialog(null)} className="btn-secondary flex-1">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmDialog.onConfirm()
                    setConfirmDialog(null)
                  }}
                  className="flex-1 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 transition-all"
                >
                  Remover
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {customerListSegment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-start justify-center p-4 overflow-y-auto"
            onClick={() => setCustomerListSegment(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="glass rounded-2xl p-6 max-w-lg w-full my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white">Clientes de "{customerListSegment.name}"</h3>
                <button type="button" onClick={() => setCustomerListSegment(null)} className="text-son-silver-dim hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-son-silver-dim absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="input-field pl-9"
                  placeholder="Buscar por nome ou WhatsApp..."
                  value={customerListQuery}
                  onChange={(e) => setCustomerListQuery(e.target.value)}
                  autoFocus
                />
              </div>
              {(() => {
                const matched = applyFilters(customers, customerListSegment.filter_criteria as unknown as FilterState, products)
                const q = customerListQuery.trim().toLowerCase()
                const shown = q ? matched.filter((c) => c.name.toLowerCase().includes(q) || c.whatsapp.includes(q)) : matched
                return shown.length === 0 ? (
                  <p className="text-center text-son-silver-dim py-8 text-sm">Nenhum cliente encontrado.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {shown.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 bg-son-surface border border-white/10 rounded-xl px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                          <WhatsAppLink phone={c.whatsapp} />
                        </div>
                        <span className="text-xs font-bold sunset-text flex-shrink-0">{currency(c.total_spent)}</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {staleDialogCampanha && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setStaleDialogCampanha(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="glass rounded-2xl p-6 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <h3 className="font-bold text-white">Campanha desatualizada</h3>
              </div>
              <p className="text-sm text-son-silver-dim mb-5">
                Você editou a segmentação original desta campanha. Clique em "Editar" e atualize os campos-alvo do evento antes de
                ligar essa campanha de novo.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStaleDialogCampanha(null)} className="btn-secondary flex-1">
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cc = staleDialogCampanha
                    setStaleDialogCampanha(null)
                    openEditCampanha(cc)
                  }}
                  className="btn-primary flex-1"
                >
                  Editar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyDialogCampanha && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-start justify-center p-4 overflow-y-auto"
            onClick={() => setHistoryDialogCampanha(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="glass rounded-2xl p-6 max-w-lg w-full my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white">Histórico de disparos</h3>
                <button type="button" onClick={() => setHistoryDialogCampanha(null)} className="text-son-silver-dim hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
                </div>
              ) : historyGrants.length === 0 ? (
                <p className="text-center text-son-silver-dim py-8 text-sm">Nenhum cliente atingiu o evento ainda.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {historyGrants.map((g) => (
                    <div key={g.id} className="flex items-center justify-between gap-3 bg-son-surface border border-white/10 rounded-xl px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{g.customer_name ?? 'Sem nome'}</p>
                        <WhatsAppLink phone={g.customer_whatsapp} />
                      </div>
                      <span className="text-xs font-bold sunset-text flex-shrink-0">
                        {g.used_count}/{g.granted_uses} usos
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
