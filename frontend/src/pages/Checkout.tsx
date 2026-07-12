import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Home, Loader2, MapPin, QrCode, Wallet } from 'lucide-react'
import SiteHeader from '../components/layout/SiteHeader'
import LocationPicker from '../components/checkout/LocationPicker'
import { api, ApiError } from '../lib/api'
import type { PaymentMethod, Product, ShippingEstimate } from '../lib/types'
import { useCart } from '../store/cart'
import { useCustomer } from '../store/customer'

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
}

export default function Checkout() {
  const navigate = useNavigate()
  const { items, clear } = useCart()
  const customer = useCustomer()

  const [products, setProducts] = useState<Product[]>([])
  const [pickupAtStore, setPickupAtStore] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [shippingEstimate, setShippingEstimate] = useState<ShippingEstimate | null>(null)

  useEffect(() => {
    api.products.list().then(setProducts)
  }, [])

  // Se o cliente já tinha escolhido um local numa visita anterior, revalida
  // o frete (o preço por km do admin pode ter mudado desde então).
  useEffect(() => {
    if (customer.lat == null || customer.lng == null) return
    api.estimateShipping(customer.lat, customer.lng).then(setShippingEstimate).catch(() => setShippingEstimate(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const lines = items
    .map((item) => ({ item, product: productById.get(item.productId) }))
    .filter((l): l is { item: typeof items[number]; product: Product } => !!l.product)
  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.item.quantity, 0)

  const shippingPrice = pickupAtStore ? 0 : shippingEstimate?.price ?? 0
  const total = subtotal + shippingPrice

  const handleSubmit = async () => {
    setError(null)
    if (lines.length === 0) {
      setError('Sua sacola está vazia.')
      return
    }
    if (!customer.name.trim()) {
      setError('Informe seu nome.')
      return
    }
    const digits = customer.whatsapp.replace(/\D/g, '')
    if (digits.length < 10) {
      setError('Informe um WhatsApp válido.')
      return
    }
    if (!customer.birthdate) {
      setError('Informe sua data de nascimento.')
      return
    }
    const age = (Date.now() - new Date(customer.birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    if (age < 18) {
      setError('Você precisa ser maior de idade para comprar produtos de tabacaria.')
      return
    }
    if (!pickupAtStore && (customer.lat == null || customer.lng == null)) {
      setError('Escolha sua localização no mapa ou marque retirada no local.')
      return
    }

    setSubmitting(true)
    try {
      const order = await api.orders.create({
        customer_name: customer.name.trim(),
        customer_whatsapp: `55${digits}`,
        customer_birthdate: customer.birthdate,
        delivery_type: pickupAtStore ? 'retirada' : 'entrega',
        neighborhood: pickupAtStore ? undefined : customer.neighborhood,
        address: pickupAtStore ? undefined : customer.address,
        reference_point: pickupAtStore ? undefined : customer.referencePoint || undefined,
        customer_lat: pickupAtStore ? undefined : customer.lat ?? undefined,
        customer_lng: pickupAtStore ? undefined : customer.lng ?? undefined,
        payment_method: paymentMethod,
        items: lines.map((l) => ({ product_id: l.product.id, quantity: l.item.quantity })),
      })
      clear()
      api.orders.notifyCreated(order.id).catch(() => {})
      if (paymentMethod === 'pix') {
        navigate(`/pagamento/${order.id}`)
      } else {
        navigate(`/consultar?order=${order.id}`)
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível enviar seu pedido. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-son-black text-white">
      <SiteHeader />
      <div className="max-w-xl mx-auto px-5 sm:px-10 pb-24">
        <h1 className="text-2xl sm:text-3xl font-black mb-6">Checkout</h1>

        <div className="space-y-5">
          <div>
            <label className="label">Seu nome *</label>
            <input
              className="input-field"
              value={customer.name}
              onChange={(e) => customer.set({ name: e.target.value })}
              placeholder="Nome completo"
            />
          </div>

          <div>
            <label className="label">WhatsApp *</label>
            <input
              className="input-field"
              value={customer.whatsapp}
              onChange={(e) => customer.set({ whatsapp: formatPhone(e.target.value) })}
              type="tel"
              inputMode="numeric"
              placeholder="(83) 99999-9999"
              maxLength={15}
            />
          </div>

          <div>
            <label className="label">Data de nascimento *</label>
            <input
              className="input-field"
              value={customer.birthdate}
              onChange={(e) => customer.set({ birthdate: e.target.value })}
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              required
            />
            <p className="text-xs text-son-silver-dim mt-1">Exigido por lei — venda de produtos de tabacaria só para maiores de 18 anos.</p>
          </div>

          <label className="flex items-center gap-2 text-sm text-son-silver">
            <input
              type="checkbox"
              checked={pickupAtStore}
              onChange={(e) => setPickupAtStore(e.target.checked)}
              className="w-4 h-4 accent-son-pink"
            />
            <Home className="w-3.5 h-3.5" />
            Quero retirar no local
          </label>

          {!pickupAtStore && (
            <div>
              <label className="label">Endereço de entrega *</label>
              {customer.lat != null && customer.lng != null ? (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="w-full flex items-center gap-3 bg-son-surface border border-white/10 rounded-2xl px-4 py-3 text-left hover:border-son-pink/40 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-son-pink flex-none" />
                  <span className="flex-1 text-sm text-white truncate">{customer.address || 'Endereço selecionado'}</span>
                  <span className="text-xs text-son-silver-dim flex-none">Editar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="w-full flex items-center justify-center gap-2 border border-dashed border-white/15 rounded-2xl px-4 py-4 text-sm text-son-silver-dim hover:border-son-pink/40 hover:text-son-pink transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  Escolher localização no mapa
                </button>
              )}
              {shippingEstimate && customer.lat != null && (
                <p className="text-xs text-son-silver-dim mt-1">
                  {shippingEstimate.km.toFixed(1).replace('.', ',')} km da loja · Frete: {currency(shippingPrice)}
                </p>
              )}
            </div>
          )}

          {!pickupAtStore && (
            <div>
              <label className="label">Ponto de referência</label>
              <input
                className="input-field"
                value={customer.referencePoint}
                onChange={(e) => customer.set({ referencePoint: e.target.value })}
                placeholder="Número da casa/Condomínio, observações de entrega..."
              />
            </div>
          )}

          {pickerOpen && (
            <LocationPicker
              initial={
                customer.lat != null && customer.lng != null
                  ? { lat: customer.lat, lng: customer.lng, label: customer.address, bairro: customer.neighborhood || undefined }
                  : null
              }
              onClose={() => setPickerOpen(false)}
              onConfirm={(result) => {
                customer.set({
                  address: result.label,
                  neighborhood: result.bairro ?? '',
                  lat: result.lat,
                  lng: result.lng,
                })
                setShippingEstimate(result.estimate ?? null)
                setPickerOpen(false)
              }}
            />
          )}

          <div>
            <label className="label">Forma de pagamento *</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: 'pix', label: 'Pix', icon: QrCode },
                  { value: 'cartao', label: 'Cartão', icon: CreditCard },
                  { value: 'dinheiro', label: 'Dinheiro', icon: Wallet },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentMethod(value)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border text-sm font-medium transition-all ${
                    paymentMethod === value
                      ? 'sunset-bg text-white border-transparent'
                      : 'bg-son-surface border-white/10 text-son-silver hover:border-son-pink/30'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
            {paymentMethod !== 'pix' && (
              <p className="text-xs text-son-silver-dim mt-2">
                Pagamento em {paymentMethod === 'cartao' ? 'cartão' : 'dinheiro'} na entrega/retirada.
              </p>
            )}
          </div>

          <div className="border-t border-white/10 pt-4 space-y-1 text-sm">
            <div className="flex justify-between text-son-silver-dim">
              <span>Subtotal</span>
              <span>{currency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-son-silver-dim">
              <span>Frete</span>
              <span>{pickupAtStore ? 'Retirada no local' : currency(shippingPrice)}</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="font-bold text-white">Total</span>
              <span className="sunset-text font-black text-lg">{currency(total)}</span>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full text-base py-4">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Finalizar pedido
          </button>
        </div>
      </div>
    </main>
  )
}
