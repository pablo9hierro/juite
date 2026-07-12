import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Megaphone, Plus, Trash2, X } from 'lucide-react'
import Card from '../../components/ui/Card'
import ExpiryInput from '../../components/admin/ExpiryInput'
import ProductMultiSelect from '../../components/admin/ProductMultiSelect'
import ProductDiscountList from '../../components/admin/ProductDiscountList'
import { api, ApiError } from '../../lib/api'
import type { Campaign, CampaignType, DiscountType, Product, ProductDiscount } from '../../lib/types'

const MAX_BANNER_MB = 10

type CampaignForm = {
  title: string
  image_url: string
  product_ids: string[]
  campaign_type: CampaignType
  discount_type: DiscountType | ''
  discount_value: string
  productDiscounts: ProductDiscount[]
  shipping_discount_type: DiscountType | ''
  shipping_discount_value: string
  starts_at: string
  expires_at: string
}
const EMPTY_CAMPAIGN_FORM: CampaignForm = {
  title: '',
  image_url: '',
  product_ids: [],
  campaign_type: 'kit',
  discount_type: '',
  discount_value: '',
  productDiscounts: [],
  shipping_discount_type: '',
  shipping_discount_value: '',
  starts_at: '',
  expires_at: '',
}

function discountLabel(discountType: DiscountType | null, value: number | null) {
  if (!discountType || value == null) return null
  return discountType === 'percent' ? `${value}% off` : `R$ ${value.toFixed(2).replace('.', ',')} off`
}

const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = {
  kit: 'Kit (pacote fechado)',
  selfie_service: 'Selfie service (cliente monta o carrinho)',
}

// Imagem inicial do carrossel da landing: sempre obrigatória, sempre a
// primeira a aparecer (mesmo com campanhas cadastradas) — o admin pode
// trocá-la aqui a qualquer momento.
function HeroImageCard() {
  const [heroUrl, setHeroUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.siteSettings.get().then((s) => setHeroUrl(s.hero_image_url))
  }, [])

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    if (file.size > MAX_BANNER_MB * 1024 * 1024) {
      setError(`O arquivo tem ${(file.size / (1024 * 1024)).toFixed(1)}MB — o máximo é ${MAX_BANNER_MB}MB.`)
      return
    }
    setUploading(true)
    try {
      const { url } = await api.admin.products.uploadImage(file)
      const result = await api.admin.siteSettings.updateHeroImage(url)
      setHeroUrl(result.hero_image_url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar a imagem.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="p-5 mb-6">
      <p className="font-bold text-white mb-1">Imagem inicial do carrossel</p>
      <p className="text-xs text-son-silver-dim mb-3">
        Sempre obrigatória — é a primeira coisa que aparece na landing, mesmo quando há campanhas cadastradas. Depois de 2s o
        carrossel desliza pras campanhas ativas, se houver.
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex items-center gap-3">
        <div className="w-28 h-14 rounded-xl bg-son-surface-light flex items-center justify-center overflow-hidden flex-shrink-0">
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-son-silver-dim" />
          ) : heroUrl ? (
            <img src={heroUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Megaphone className="w-6 h-6 text-son-silver-dim/40" />
          )}
        </div>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary text-sm py-2 px-3">
          <ImagePlus className="w-3.5 h-3.5" />
          {heroUrl ? 'Trocar imagem' : 'Enviar imagem'}
        </button>
      </div>
      {!heroUrl && <p className="text-xs text-amber-400 mt-2">Nenhuma imagem enviada ainda — a landing está usando o banner padrão.</p>}
      <p className="text-xs text-son-silver-dim mt-2">
        Dimensão recomendada: 1200×600px (proporção 2:1), formatos aceitos: JPG, PNG, WEBP, GIF, MP4 ou WEBM. Tamanho máximo por
        arquivo: {MAX_BANNER_MB}MB.
      </p>
      {error && <p className="error-msg mt-1">{error}</p>}
    </Card>
  )
}

export default function AdminCampanhas() {
  const [products, setProducts] = useState<Product[]>([])

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(EMPTY_CAMPAIGN_FORM)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [campaignError, setCampaignError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadCampaigns = () => {
    setCampaignsLoading(true)
    api.admin.campaigns.list().then(setCampaigns).finally(() => setCampaignsLoading(false))
  }
  useEffect(() => {
    api.admin.products.list().then(setProducts)
    loadCampaigns()
  }, [])

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCampaignError(null)
    if (file.size > MAX_BANNER_MB * 1024 * 1024) {
      setCampaignError(`O arquivo tem ${(file.size / (1024 * 1024)).toFixed(1)}MB — o máximo é ${MAX_BANNER_MB}MB.`)
      return
    }
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

  const saveCampaign = async () => {
    setCampaignError(null)
    if (campaignForm.campaign_type === 'selfie_service' && campaignForm.productDiscounts.length === 0) {
      setCampaignError('Busque e adicione ao menos um produto com desconto.')
      return
    }
    setSavingCampaign(true)
    try {
      await api.admin.campaigns.create({
        title: campaignForm.title,
        image_url: campaignForm.image_url,
        product_ids: campaignForm.product_ids,
        campaign_type: campaignForm.campaign_type,
        discount_type: campaignForm.campaign_type === 'kit' ? campaignForm.discount_type || undefined : undefined,
        discount_value:
          campaignForm.campaign_type === 'kit' && campaignForm.discount_value ? Number(campaignForm.discount_value) : undefined,
        product_discounts: campaignForm.campaign_type === 'selfie_service' ? campaignForm.productDiscounts : undefined,
        shipping_discount_type: campaignForm.shipping_discount_type || undefined,
        shipping_discount_value: campaignForm.shipping_discount_value ? Number(campaignForm.shipping_discount_value) : undefined,
        starts_at: campaignForm.starts_at || undefined,
        expires_at: campaignForm.expires_at || undefined,
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
      campaign_type: c.campaign_type,
      discount_type: c.discount_type ?? undefined,
      discount_value: c.discount_value ?? undefined,
      product_discounts: c.product_discounts,
      shipping_discount_type: c.shipping_discount_type ?? undefined,
      shipping_discount_value: c.shipping_discount_value ?? undefined,
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

  return (
    <div>
      <HeroImageCard />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black">Campanhas</h1>
        <button onClick={() => setShowCampaignForm(true)} className="btn-primary text-sm py-2 px-4">
          <Plus className="w-4 h-4" /> Nova campanha
        </button>
      </div>
      {campaignsLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-son-silver-dim">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma campanha cadastrada.</p>
          <p className="text-xs mt-1">Toda campanha precisa de imagem + desconto (produto e/ou frete).</p>
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
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-son-silver-dim text-xs">
                      {c.campaign_type === 'kit' ? 'Kit' : 'Selfie service'}
                    </span>
                    {c.campaign_type === 'selfie_service' ? (
                      <span className="px-2 py-0.5 rounded-full bg-son-pink/15 text-son-pink text-xs font-semibold">
                        {c.product_discounts?.length ?? 0} produto(s) c/ desconto
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
      )}

      {showCampaignForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setShowCampaignForm(false)}
        >
          <div className="glass rounded-2xl p-6 max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
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
                <label className="label">Banner (imagem, gif ou vídeo — obrigatório)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
                  className="hidden"
                  onChange={handleImageChange}
                />
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
                <p className="text-xs text-son-silver-dim mt-1.5">
                  Dimensão recomendada: 1200×600px (proporção 2:1), formatos aceitos: JPG, PNG, WEBP, GIF, MP4 ou WEBM. Tamanho
                  máximo por arquivo: {MAX_BANNER_MB}MB.
                </p>
                {campaignError && <p className="error-msg mt-1">{campaignError}</p>}
              </div>
              <div>
                <label className="label">Tipo de campanha</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['kit', 'selfie_service'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCampaignForm({ ...campaignForm, campaign_type: t })}
                      className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        campaignForm.campaign_type === t ? 'sunset-bg text-white border-transparent' : 'bg-son-surface border-white/10 text-son-silver'
                      }`}
                    >
                      {CAMPAIGN_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-son-silver-dim mt-1.5">
                  {campaignForm.campaign_type === 'kit'
                    ? 'O cliente só pode comprar o pacote inteiro (todos os produtos da campanha) ou não comprar nada — desconto único sobre o valor total.'
                    : 'O cliente monta o próprio carrinho em /banner escolhendo entre os produtos da campanha — cada produto tem seu próprio desconto.'}
                </p>
              </div>
              <div>
                <label className="label">Produtos da campanha</label>
                <ProductMultiSelect
                  products={products}
                  selectedIds={campaignForm.product_ids}
                  onChange={(product_ids) => setCampaignForm({ ...campaignForm, product_ids })}
                />
              </div>
              {campaignForm.campaign_type === 'selfie_service' ? (
                <div>
                  <label className="label">Desconto no produto (cada item tem o seu)</label>
                  <ProductDiscountList
                    products={products.filter((p) => campaignForm.product_ids.includes(p.id))}
                    discounts={campaignForm.productDiscounts}
                    onChange={(productDiscounts) => setCampaignForm({ ...campaignForm, productDiscounts })}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Desconto no valor total</label>
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
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Desconto no frete</label>
                  <select
                    className="input-field"
                    value={campaignForm.shipping_discount_type}
                    onChange={(e) =>
                      setCampaignForm({ ...campaignForm, shipping_discount_type: e.target.value as DiscountType | '' })
                    }
                  >
                    <option value="">Sem desconto de frete</option>
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
                    disabled={!campaignForm.shipping_discount_type}
                    value={campaignForm.shipping_discount_value}
                    onChange={(e) => setCampaignForm({ ...campaignForm, shipping_discount_value: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Início (opcional)</label>
                  <ExpiryInput
                    value={campaignForm.starts_at}
                    onChange={(starts_at) => setCampaignForm({ ...campaignForm, starts_at })}
                    allowDuration={false}
                  />
                </div>
                <div>
                  <label className="label">Termina em (opcional)</label>
                  <ExpiryInput
                    value={campaignForm.expires_at}
                    onChange={(expires_at) => setCampaignForm({ ...campaignForm, expires_at })}
                  />
                </div>
              </div>
              <button onClick={saveCampaign} disabled={savingCampaign} className="btn-primary w-full mt-2">
                {savingCampaign ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Salvar campanha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
