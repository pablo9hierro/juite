export type OrderStatus =
  | 'pendente'
  | 'montando_pedido'
  | 'pedido_pronto'
  | 'aguardando_localizacao'
  | 'em_rota_de_entrega'
  | 'entregue'
  | 'retiradas'
  | 'concluido'

export type DeliveryType = 'entrega' | 'retirada' | 'balcao'
export type PaymentMethod = 'pix' | 'cartao' | 'dinheiro'
export type PaymentStatus = 'pendente' | 'pago'

export interface Category {
  id: string
  name: string
}

export interface Product {
  id: string
  name: string
  description: string | null
  price: number
  quantity: number
  image_url: string | null
  category_id: string | null
  category_name?: string | null
  active?: boolean
  barcode?: string | null
}

export type CouponKind = 'desconto' | 'frete' | 'aniversario'
export type DiscountType = 'percent' | 'fixed'

export interface Coupon {
  id: string
  code: string
  kind: CouponKind
  // Vale pro desconto de produto (kind desconto/aniversario) OU pro
  // desconto de frete (kind frete) — nunca ambos no mesmo cupom.
  discount_type: DiscountType | null
  discount_value: number | null
  allow_campaign_checkout: boolean
  // Só relevante pra cupom alvo (com concessões) — se pode ser combinado
  // com um cupom avulso digitado manualmente no checkout.
  combinable_with_public?: boolean
  active: boolean
  expires_at: string | null
  max_uses: number | null
  used_count: number
  created_at: string
}

export interface CouponGrant {
  id: string
  customer_whatsapp: string
  customer_name: string | null
  granted_uses: number
  used_count: number
}

export interface Campaign {
  id: string
  title: string
  image_url: string
  product_ids: string[]
  discount_type: DiscountType | null
  discount_value: number | null
  shipping_discount_type: DiscountType | null
  shipping_discount_value: number | null
  active?: boolean
  starts_at: string | null
  expires_at: string | null
  created_at?: string
}

export interface OrderItem {
  id?: string
  product_id: string
  product_name: string
  unit_price: number
  quantity: number
}

export interface CrmPurchaseEvent {
  product_id: string
  created_at: string
}

export interface CrmCustomer {
  id: string
  name: string
  whatsapp: string
  birthdate: string | null
  total_spent: number
  order_count: number
  first_order_at: string | null
  last_order_at: string | null
  neighborhoods: string[]
  purchases: CrmPurchaseEvent[]
}

export interface Order {
  id: string
  customer_name: string
  customer_whatsapp: string
  delivery_type: DeliveryType
  neighborhood: string | null
  address: string | null
  reference_point?: string | null
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  status: OrderStatus
  shipping_price: number
  total: number
  discount_amount?: number
  shipping_discount?: number
  coupon_code?: string | null
  campaign_id?: string | null
  motoboy_id: string | null
  motoboy_name?: string | null
  motoboy_whatsapp?: string | null
  sold_by_role?: 'admin' | 'vendedor' | null
  sold_by_id?: string | null
  pix_payment_id?: string | null
  pix_qr_base64?: string | null
  pix_copia_cola?: string | null
  customer_lat?: number | null
  customer_lng?: number | null
  motoboy_paid_at?: string | null
  delivery_started_at?: string | null
  delivered_at?: string | null
  items: OrderItem[]
  created_at: string
  updated_at?: string
}

export interface Motoboy {
  id: string
  name: string
  phone: string
  email: string
  whatsapp: string | null
  active: boolean
}

export interface Vendedor {
  id: string
  name: string
  email: string
  active: boolean
}

export interface PdvSaleItemInput {
  product_id: string
  quantity: number
}

export interface PdvSale {
  id: string
  total: number
  payment_method: PaymentMethod
  customer_name: string
  created_at: string
  sold_by_role: 'admin' | 'vendedor'
  items: { product_name: string; quantity: number; unit_price: number }[]
}

export interface VendedorRelatorio {
  total_sales: number
  total_count: number
  sales: PdvSale[]
}

export interface MotoboyDelivery {
  id: string
  customer_name: string
  neighborhood: string | null
  shipping_price: number
  earned: number
  paid: boolean
  duration_minutes: number | null
  updated_at: string
}

export interface MotoboySettlement {
  id: string
  amount: number
  payment_method: PaymentMethod
  paid_at: string
}

export interface MotoboyFinanceiro {
  pending_amount: number
  total_paid: number
  total_deliveries: number
  total_shipping: number
  avg_delivery_minutes: number
  deliveries: MotoboyDelivery[]
  settlements: MotoboySettlement[]
}

export interface AdminMotoboyFinanceiro {
  id: string
  name: string
  total_deliveries: number
  total_shipping: number
  pending_amount: number
  total_paid: number
  avg_delivery_minutes: number
}

export interface MotoboyPending {
  pending_amount: number
  pending_deliveries: number | null
}

export interface MotoboyRun {
  id: string
  status: 'ativo' | 'concluido'
  current_index: number
  order_ids: string[]
  motoboy_lat: number | null
  motoboy_lng: number | null
  motoboy_heading: number | null
  started_at: string
  finished_at: string | null
  orders: Order[]
}

export interface DeliveryPosition {
  is_next_stop: boolean
  // Só vêm preenchidos quando is_next_stop é true — enquanto o motoboy
  // ainda está terminando outra entrega do lote, a posição dele fica
  // oculta pra esse pedido (mesma lógica do Uber/99: só mostra o
  // entregador quando ele já está a caminho de você).
  lat?: number
  lng?: number
  heading?: number | null
  updated_at?: string
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pendente: 'Pendente',
  montando_pedido: 'Montando pedido',
  pedido_pronto: 'Pedido pronto',
  aguardando_localizacao: 'Aguardando localização',
  em_rota_de_entrega: 'Em rota de entrega',
  entregue: 'Entregue',
  retiradas: 'Aguardando retirada',
  concluido: 'Concluído',
}

export interface ShippingSettings {
  price_per_km: number
  max_km: number | null
}

export interface ShippingEstimate {
  km: number
  price: number
  max_km: number | null
  within_range: boolean
}

// Formato exato varia entre versões da Evolution API — os campos abaixo
// cobrem as variações mais comuns; o componente que consome isso tenta
// vários caminhos possíveis em vez de confiar em um só.
export interface EvolutionStatus {
  instance?: { instanceName?: string; state?: string }
  state?: string
  [key: string]: unknown
}

export interface EvolutionConnect {
  base64?: string
  code?: string
  pairingCode?: string
  qrcode?: { base64?: string; code?: string; pairingCode?: string }
  [key: string]: unknown
}

export interface StatusCount {
  status: OrderStatus
  count: number
}

export interface TopProduct {
  product_id: string
  product_name: string
  quantity_sold: number
  revenue: number
}

export interface FinanceiroSummary {
  total_revenue: number
  total_orders: number
  orders_by_status: StatusCount[]
  top_products: TopProduct[]
  recent_orders: Order[]
  motoboys: AdminMotoboyFinanceiro[]
  avg_delivery_minutes: number
}
