import { ApiError } from './apiError'
import { supabase } from './supabaseClient'
import type { Category, DeliveryPosition, Order, Product, ShippingEstimate, ShippingSettings } from './types'

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new ApiError(400, result.error.message)
  return result.data as T
}

// Fluxo público (catálogo, checkout, consulta de pedido) falando direto com
// o Supabase via RLS + RPCs (ver supabase/sunset_public_rls_and_rpc.sql),
// sem passar pelo backend Rust no Railway.
export const supabasePublicApi = {
  categories: {
    list: async () =>
      unwrap<Category[]>(await supabase.from('categories').select('id, name').order('name')),
  },
  products: {
    list: async (categoryId?: string) => {
      let query = supabase
        .from('products')
        .select('id, name, description, price, quantity, image_url, category_id, active, barcode, categories(name)')
        .order('name')
      if (categoryId) query = query.eq('category_id', categoryId)
      const { data, error } = await query
      if (error) throw new ApiError(400, error.message)
      return (data ?? []).map((p) => toProduct(p))
    },
    get: async (id: string) => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, price, quantity, image_url, category_id, active, barcode, categories(name)')
        .eq('id', id)
        .single()
      if (error || !data) throw new ApiError(404, 'product not found')
      return toProduct(data)
    },
  },
  shippingSettings: {
    get: async () =>
      unwrap<ShippingSettings>(
        await supabase.from('shipping_settings').select('price_per_km, max_km').single()
      ),
  },
  estimateShipping: async (lat: number, lng: number) => {
    const { data, error } = await supabase.rpc('estimate_shipping', { p_lat: lat, p_lng: lng })
    if (error) throw new ApiError(400, error.message)
    return data as ShippingEstimate
  },
  orders: {
    create: async (payload: {
      customer_name: string
      customer_whatsapp: string
      delivery_type: 'entrega' | 'retirada'
      neighborhood?: string
      address?: string
      reference_point?: string
      customer_lat?: number
      customer_lng?: number
      payment_method: 'pix' | 'cartao' | 'dinheiro'
      items: { product_id: string; quantity: number }[]
    }) => {
      const { data, error } = await supabase.rpc('create_order', {
        p_customer_name: payload.customer_name,
        p_customer_whatsapp: payload.customer_whatsapp,
        p_delivery_type: payload.delivery_type,
        p_payment_method: payload.payment_method,
        p_neighborhood: payload.neighborhood ?? null,
        p_address: payload.address ?? null,
        p_items: payload.items,
        p_customer_lat: payload.customer_lat ?? null,
        p_customer_lng: payload.customer_lng ?? null,
        p_reference_point: payload.reference_point ?? null,
      })
      if (error) throw new ApiError(400, error.message)
      return data as Order
    },
    get: async (id: string) => {
      const { data, error } = await supabase.rpc('get_order', { p_order_id: id })
      if (error || !data) throw new ApiError(404, error?.message ?? 'order not found')
      return data as Order
    },
    track: async (whatsapp: string) => {
      const { data, error } = await supabase.rpc('track_orders_by_phone', { p_whatsapp: whatsapp })
      if (error) throw new ApiError(400, error.message)
      return (data ?? []) as Order[]
    },
  },
  trackDeliveryPosition: async (orderId: string) => {
    const { data, error } = await supabase.rpc('track_delivery_position', { p_order_id: orderId })
    if (error) throw new ApiError(400, error.message)
    return (data ?? null) as DeliveryPosition | null
  },
}

function toProduct(row: {
  id: string
  name: string
  description: string | null
  price: number
  quantity: number
  image_url: string | null
  category_id: string | null
  active: number | boolean
  barcode?: string | null
  categories: { name: string } | { name: string }[] | null
}): Product {
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    quantity: row.quantity,
    image_url: row.image_url,
    category_id: row.category_id,
    category_name: category?.name ?? null,
    active: Boolean(row.active),
    barcode: row.barcode ?? null,
  }
}
