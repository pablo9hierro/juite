import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Megaphone, Plus, Tag, Trash2, X } from 'lucide-react'
import Card from '../../components/ui/Card'
import { api, ApiError } from '../../lib/api'
import type { Campaign, Coupon, DiscountType, Product } from '../../lib/types'

type CampaignForm = {
  title: string
  image_url: string
  product_ids: string[]
  discount_type: DiscountType | ''
  discount_value: string
  free_shipping: boolean
  starts_at: string
  expires_at: string
}
const EMPTY_CAMPAIGN_FORM: CampaignForm = {
  title: '',
  image_url: '',
  product_ids: [],
  discount_type: '',
  discount_value: '',
  free_shipping: false,
  starts_at: '',
  expires_at: '',
}

type CouponForm = {
  code: string
  kind: 'desconto' | 'frete'
  discount_type: DiscountType | ''
  discount_value: string
  allow_campaign_checkout: boolean
  expires_at: string
  max_uses: string
}
const EMPTY_COUPON_FORM: CouponForm = {
  code: '',
  kind: 'desconto',
  discount_type: 'percent',
  discount_value: '',
  allow_campaign_checkout: false,
  expires_at: '',
  max_uses: '',
}

function discountLabel(discountType: DiscountType | null, value: number | null) {
  if (!discountType || value == null) return null
  return discountType === 'percent' ? `${value}% off` : `R$ ${value.toFixed(2).replace('.', ',')} off`
}

export default function AdminCampanhas() {
  const [tab, setTab] = useState<'campanhas' | 'cupons'>('campanhas')

  const [products, setProducts] = useState<Product[]>([])

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(EMPTY_CAMPAIGN_FORM)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [campaignError, setCampaignError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [couponsLoading, setCouponsLoading] = useState(true)
  const [showCouponForm, setShowCouponForm] = useState(false)
  const [couponForm, setCouponForm] = useState<CouponForm>(EMPTY_COUPON_FORM)
  const [savingCoupon, setSavingCoupon] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)

  const loadCampaigns = () => {
    setCampaignsLoading(true)
    api.admin.campaigns.list().then(setCampaigns).finally(() => setCampaignsLoading(false))
  }
  const loadCoupons = () => {
    setCouponsLoading(true)
    api.admin.coupons.list().then(setCoupons).finally(() => setCouponsLoading(false))
  }
  useEffect(() => {
    api.admin.products.list().then(setProducts)
    loadCampaigns()
    loadCoupons()
  }, [])

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCampaignError(null)
    setUploading(true)
    try {
      const { url } = await api.admin.products.uploadImage(file)
      setCampaignForm((f) => ({ ...f, image_url: url }))
    } catch (err) {
      setCampaignError(err instanceof ApiError ? err.message : 'Erro ao enviar a imagem.')
    } finally {
      setUploading(false)
    }
  }

  const toggleProduct = (id: string) => {
    setCampaignForm((f) => ({
      ...f,
      product_ids: f.product_ids.includes(id) ? f.product_ids.filter((p) => p !== id) : [...f.product_ids, id],
    }))
  }

  const saveCampaign = async () => {
    setCampaignError(null)
    setSavingCampaign(true)
    try {
      await api.admin.campaigns.create({
        title: campaignForm.title,
        image_url: campaignForm.image_url,
        product_ids: campaignForm.product_ids,
        discount_type: campaignForm.discount_type || undefined,
        discount_value: campaignForm.discount_value ? Number(campaignForm.discount_value) : undefined,
        free_shipping: campaignForm.free_shipping,
        starts_at: campaignForm.starts_at ? new Date(campaignForm.starts_at).toISOString() : undefined,
        expires_at: campaignForm.expires_at ? new Date(campaignForm.expires_at).toISOString() : undefined,
      })
      setShowCampaignForm(false)
      setCampaignForm(EMPTY_CAMPAIGN_FORM)
      loadCampaigns()
    } catch (err) {
      setCampaignError(err instanceof ApiError ? err.message : 'Não foi possível salvar a campanha.')
    } finally {
      setSavingCampaign(false)
    }
  }

  const toggleCampaignActive = async (c: Campaign) => {
    await api.admin.campaigns.update(c.id, {
      title: c.title,
      image_url: c.image_url,
      product_ids: c.product_ids,
      discount_type: c.discount_type ?? undefined,
      discount_value: c.discount_value ?? undefined,
      free_shipping: c.free_shipping,
      active: !c.active,
      starts_at: c.starts_at ?? undefined,
      expires_at: c.expires_at ?? undefined,
    })
    loadCampaigns()
  }

  const removeCampaign = async (id: string) => {
    if (!confirm('Remover esta campanha?')) return
    await api.admin.campaigns.delete(id)
    loadCampaigns()
  }

  const saveCoupon = async () => {
    setCouponError(null)
    setSavingCoupon(true)
    try {
      await api.admin.coupons.create({
        code: couponForm.code,
        kind: couponForm.kind,
        discount_type: couponForm.kind === 'desconto' ? (couponForm.discount_type || undefined) : undefined,
        discount_value:
          couponForm.kind === 'desconto' && couponForm.discount_value ? Number(couponForm.discount_value) : undefined,
        allow_campaign_checkout: couponForm.allow_campaign_checkout,
        expires_at: couponForm.expires_at ? new Date(couponForm.expires_at).toISOString() : undefined,
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">Campanhas &amp; cupons</h1>
        <button
          onClick={() => (tab === 'campanhas' ? setShowCampaignForm(true) : setShowCouponForm(true))}
          className="btn-primary text-sm py-2 px-4"
        >
          <Plus className="w-4 h-4" /> {tab === 'campanhas' ? 'Nova campanha' : 'Novo cupom'}
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('campanhas')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === 'campanhas' ? 'sunset-bg text-white' : 'bg-son-surface border border-white/5 text-son-silver-dim'
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" /> Campanhas
        </button>
        <button
          onClick={() => setTab('cupons')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === 'cupons' ? 'sunset-bg text-white' : 'bg-son-surface border border-white/5 text-son-silver-dim'
          }`}
        >
          <Tag className="w-3.5 h-3.5" /> Cupons
        </button>
      </div>

      {tab === 'campanhas' &&
        (campaignsLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16 text-son-silver-dim">
            <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhuma campanha cadastrada.</p>
            <p className="text-xs mt-1">Toda campanha precisa de imagem + desconto (produto e/ou frete grátis).</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {campaigns.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex gap-3">
                  <img src={c.image_url} alt={c.title} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white truncate">{c.title}</p>
                    <p className="text-xs text-son-silver-dim">{c.product_ids.length} produto(s)</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {discountLabel(c.discount_type, c.discount_value) && (
                        <span className="px-2 py-0.5 rounded-full bg-son-pink/15 text-son-pink text-xs font-semibold">
                          {discountLabel(c.discount_type, c.discount_value)}
                        </span>
                      )}
                      {c.free_shipping && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                          Frete grátis
                        </span>
                      )}
                    </div>
                    {c.expires_at && (
                      <p className="text-xs text-son-silver-dim mt-1">Até {new Date(c.expires_at).toLocaleString('pt-BR')}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => toggleCampaignActive(c)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      c.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-son-silver-dim'
                    }`}
                  >
                    {c.active ? 'Ativa' : 'Inativa'}
                  </button>
                  <button onClick={() => removeCampaign(c.id)} className="text-son-silver-dim hover:text-son-pink">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ))}

      {tab === 'cupons' &&
        (couponsLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-16 text-son-silver-dim">
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
                  {c.kind === 'frete' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
                      Frete grátis
                    </span>
                  ) : (
                    discountLabel(c.discount_type, c.discount_value) && (
                      <span className="px-2 py-0.5 rounded-full bg-son-pink/15 text-son-pink text-xs font-semibold">
                        {discountLabel(c.discount_type, c.discount_value)}
                      </span>
                    )
                  )}
                  {c.allow_campaign_checkout && (
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-son-silver-dim text-xs">+ campanha</span>
                  )}
                </div>
                <p className="text-xs text-son-silver-dim">
                  {c.max_uses ? `${c.used_count}/${c.max_uses} usos` : `${c.used_count} usos · sem limite`}
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
        ))}

      {showCampaignForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowCampaignForm(false)}
        >
          <div className="glass rounded-2xl p-6 max-w-md w-full my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Nova campanha</h3>
              <button onClick={() => setShowCampaignForm(false)} className="text-son-silver-dim hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Título</label>
                <input
                  className="input-field"
                  value={campaignForm.title}
                  onChange={(e) => setCampaignForm({ ...campaignForm, title: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Banner (imagem obrigatória)</label>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 rounded-xl bg-son-surface-light flex items-center justify-center overflow-hidden flex-shrink-0">
                    {uploading ? (
                      <Loader2 className="w-5 h-5 animate-spin text-son-silver-dim" />
                    ) : campaignForm.image_url ? (
                      <img src={campaignForm.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Megaphone className="w-6 h-6 text-son-silver-dim/40" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="btn-secondary text-sm py-2 px-3"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    {campaignForm.image_url ? 'Trocar imagem' : 'Enviar imagem'}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Produtos da campanha</label>
                <div className="max-h-32 overflow-y-auto border border-white/10 rounded-xl p-2 space-y-1">
                  {products.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm text-son-silver py-0.5">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-son-pink"
                        checked={campaignForm.product_ids.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Desconto</label>
                  <select
                    className="input-field"
                    value={campaignForm.discount_type}
                    onChange={(e) => setCampaignForm({ ...campaignForm, discount_type: e.target.value as DiscountType | '' })}
                  >
                    <option value="">Sem desconto de produto</option>
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
                    disabled={!campaignForm.discount_type}
                    value={campaignForm.discount_value}
                    onChange={(e) => setCampaignForm({ ...campaignForm, discount_value: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-son-silver">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-son-pink"
                  checked={campaignForm.free_shipping}
                  onChange={(e) => setCampaignForm({ ...campaignForm, free_shipping: e.target.checked })}
                />
                Frete grátis (loja absorve o custo, motoboy recebe o valor cheio)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Início (opcional)</label>
                  <input
                    className="input-field"
                    type="datetime-local"
                    value={campaignForm.starts_at}
                    onChange={(e) => setCampaignForm({ ...campaignForm, starts_at: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Termina em (opcional)</label>
                  <input
                    className="input-field"
                    type="datetime-local"
                    value={campaignForm.expires_at}
                    onChange={(e) => setCampaignForm({ ...campaignForm, expires_at: e.target.value })}
                  />
                </div>
              </div>
              {campaignError && <p className="error-msg">{campaignError}</p>}
              <button onClick={saveCampaign} disabled={savingCampaign} className="btn-primary w-full mt-2">
                {savingCampaign ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Salvar campanha
              </button>
            </div>
          </div>
        </div>
      )}

      {showCouponForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCouponForm(false)}>
          <div className="glass rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">Novo cupom</h3>
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
                <div className="grid grid-cols-2 gap-2">
                  {(['desconto', 'frete'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setCouponForm({ ...couponForm, kind: k })}
                      className={`py-2.5 rounded-xl border text-sm font-medium transition-all capitalize ${
                        couponForm.kind === k
                          ? 'sunset-bg text-white border-transparent'
                          : 'bg-son-surface border-white/10 text-son-silver'
                      }`}
                    >
                      {k === 'desconto' ? 'Desconto' : 'Cupom de frete'}
                    </button>
                  ))}
                </div>
              </div>
              {couponForm.kind === 'desconto' && (
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
              {couponForm.kind === 'frete' && (
                <p className="text-xs text-son-silver-dim">
                  Cliente não paga o frete; o motoboy recebe o valor cheio do mesmo jeito, a loja absorve a diferença.
                </p>
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Validade (opcional)</label>
                  <input
                    className="input-field"
                    type="datetime-local"
                    value={couponForm.expires_at}
                    onChange={(e) => setCouponForm({ ...couponForm, expires_at: e.target.value })}
                  />
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
    </div>
  )
}
