import { useAdminAuth } from '../store/adminAuth'
import { ApiError } from './apiError'
import { localApi } from './localApi'
import { supabasePublicApi } from './supabasePublicApi'
import { supabase } from './supabaseClient'
import type {
  CampanhaOrientation,
  Category,
  Coupon,
  CouponGrant,
  CrmCampanhaCoupon,
  CrmCustomer,
  CrmFilterCriteria,
  CrmSegment,
  EvolutionConnect,
  EvolutionStatus,
  FinanceiroSummary,
  FinanceiroTimeseriesPoint,
  Motoboy,
  MotoboyFinanceiro,
  MotoboyPending,
  MotoboyRun,
  MotoboySettlement,
  Order,
  PaymentMethod,
  PdvSaleItemInput,
  Product,
  ProductDiscount,
  Promotion,
  PromotionType,
  ShippingSettings,
  Vendedor,
  VendedorRelatorio,
} from './types'

// Ainda usado só pro login admin/motoboy e Pix, que continuam no backend
// Rust (Railway) até a migração de auth/Pix pra Supabase Auth/Edge Functions.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'

// Catálogo/checkout/consulta falam direto com o Supabase (ver
// supabasePublicApi.ts) — sem isso configurado, cai em modo demonstração
// (localStorage) pra não quebrar a build. Force com VITE_USE_LOCAL_DB=true;
// local dev continua batendo no Supabase real por padrão.
export const USE_LOCAL_DB =
  import.meta.env.VITE_USE_LOCAL_DB === 'true' ||
  (import.meta.env.PROD && !import.meta.env.VITE_SUPABASE_URL)

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, headers, ...rest } = options
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    })
  } catch {
    // fetch() falhou antes de chegar a ter uma resposta HTTP (servidor
    // fora do ar, CORS, sem internet) — sem isso virar um ApiError de
    // verdade, esse erro passa batido em todo `catch (e) { e instanceof
    // ApiError ? e.message : '<mensagem genérica>' }` espalhado pelo app,
    // sempre caindo na mensagem genérica em vez de dizer que o servidor
    // tá inacessível.
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique sua internet ou tente novamente em instantes.')
  }
  if (!res.ok) {
    let message = `Erro ${res.status}`
    try {
      const body = await res.json()
      message = body.error || body.message || message
    } catch {
      // resposta sem corpo JSON
    }
    throw new ApiError(res.status, message)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function adminToken() {
  return useAdminAuth.getState().token ?? undefined
}
// admin, vendedor e motoboy compartilham a mesma sessão (useAdminAuth) desde
// que motoboy passou a logar em /admin/login também — motoboyToken() existe
// só pra deixar claro, nos call sites abaixo, que o token está indo pra uma
// rota de motoboy.
function motoboyToken() {
  return useAdminAuth.getState().token ?? undefined
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new ApiError(error.message === 'unauthorized' ? 401 : 400, error.message)
  return data as T
}

const remoteApi = {
  // Catálogo, checkout e consulta de pedido falam direto com o Supabase
  // (RLS + RPCs) — ver frontend/src/lib/supabasePublicApi.ts e
  // supabase/sunset_public_rls_and_rpc.sql. Não dependem do Railway.
  categories: supabasePublicApi.categories,
  products: supabasePublicApi.products,
  shippingSettings: supabasePublicApi.shippingSettings,
  siteSettings: supabasePublicApi.siteSettings,
  estimateShipping: supabasePublicApi.estimateShipping,
  trackDeliveryPosition: supabasePublicApi.trackDeliveryPosition,
  // Carrossel da landing (promoções ativas) + cupom digitado no checkout.
  promotions: supabasePublicApi.promotions,
  coupons: supabasePublicApi.coupons,
  orders: {
    create: supabasePublicApi.orders.create,
    get: supabasePublicApi.orders.get,
    track: supabasePublicApi.orders.track,
    // Pix ainda depende do backend Rust (precisa da chave secreta da
    // AbacatePay) até virar uma Supabase Edge Function.
    createPixPayment: (id: string) =>
      request<Order>(`/api/orders/${id}/create-pix-payment`, { method: 'POST' }),
    refreshPayment: (id: string) =>
      request<Order>(`/api/orders/${id}/refresh-payment`, { method: 'POST' }),
    simulatePixPaid: (id: string) =>
      request<Order>(`/api/orders/${id}/simulate-pix-paid`, { method: 'POST' }),
    // Público — dispara logo após o checkout, avisando que o pedido chegou.
    notifyCreated: (orderId: string) =>
      request<void>('/api/orders/notify-created', {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId }),
      }),
  },
  // Login fala direto com o Supabase (RPC sunset.admin_login/motoboy_login —
  // ver supabase/sunset_admin_auth.sql), sem passar pelo Railway. O token
  // retornado é uma sessão opaca guardada em sunset.sessions, não um JWT.
  auth: {
    adminLogin: async (email: string, password: string) => {
      const { data, error } = await supabase.rpc('admin_login', { p_email: email, p_password: password })
      if (error) throw new ApiError(401, 'Credenciais inválidas.')
      return data as { token: string; name: string }
    },
    motoboyLogin: async (email: string, password: string) => {
      const { data, error } = await supabase.rpc('motoboy_login', { p_email: email, p_password: password })
      if (error) throw new ApiError(401, 'Credenciais inválidas.')
      return data as { token: string; name: string }
    },
    vendedorLogin: async (email: string, password: string) => {
      const { data, error } = await supabase.rpc('vendedor_login', { p_email: email, p_password: password })
      if (error) throw new ApiError(401, 'Credenciais inválidas.')
      return data as { token: string; name: string }
    },
    setAdminPassword: async (newPassword: string) => {
      const { error } = await supabase.rpc('admin_set_password', {
        p_token: adminToken(),
        p_new_password: newPassword,
      })
      if (error) throw new ApiError(400, error.message)
    },
  },
  // CRUD do admin e fila do motoboy falam direto com o Supabase via RPC
  // (ver supabase/sunset_admin_crud.sql), passando o token de
  // sunset.sessions como primeiro parâmetro em vez de header Authorization.
  admin: {
    categories: {
      list: () => rpc<Category[]>('admin_list_categories', { p_token: adminToken() }),
      create: (name: string) => rpc<Category>('admin_create_category', { p_token: adminToken(), p_name: name }),
      delete: (id: string) => rpc<void>('admin_delete_category', { p_token: adminToken(), p_id: id }),
    },
    products: {
      list: () => rpc<Product[]>('admin_list_products', { p_token: adminToken() }),
      create: (payload: Partial<Product>) =>
        rpc<Product>('admin_create_product', {
          p_token: adminToken(),
          p_name: payload.name,
          p_description: payload.description ?? null,
          p_price: payload.price,
          p_quantity: payload.quantity,
          p_image_url: payload.image_url ?? null,
          p_category_id: payload.category_id ?? null,
          p_active: payload.active ?? true,
          p_barcode: payload.barcode ?? null,
        }),
      update: (id: string, payload: Partial<Product>) =>
        rpc<Product>('admin_update_product', {
          p_token: adminToken(),
          p_id: id,
          p_name: payload.name,
          p_description: payload.description ?? null,
          p_price: payload.price,
          p_quantity: payload.quantity,
          p_image_url: payload.image_url ?? null,
          p_category_id: payload.category_id ?? null,
          p_active: payload.active ?? true,
          p_barcode: payload.barcode ?? null,
        }),
      delete: (id: string) => rpc<void>('admin_delete_product', { p_token: adminToken(), p_id: id }),
      // Upload de imagem passa pelo Rust (não pelo Supabase RPC): precisa da
      // service_role key pra escrever no Storage, que não pode ir pro navegador.
      uploadImage: async (file: File) => {
        const url = `${API_BASE}/api/admin/products/upload-image`
        const body = new FormData()
        body.append('file', file)
        let res: Response
        try {
          res = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${adminToken()}` },
            body,
          })
        } catch (networkErr) {
          // fetch() falhou ANTES de virar resposta HTTP (backend fora do ar,
          // CORS bloqueado, ou VITE_API_BASE_URL apontando pra localhost em
          // produção) — sem isso virar ApiError, some como "Erro ao enviar
          // a imagem." genérico em todo call site.
          console.error('[uploadImage] falha de rede ao chamar', url, networkErr)
          const hint = url.includes('localhost')
            ? 'O backend está configurado como localhost — isso nunca funciona em produção. Configure VITE_API_BASE_URL na Vercel com a URL pública do backend (Railway).'
            : 'Não foi possível conectar ao backend. Verifique se ele está no ar (Railway) e se CORS libera este domínio.'
          throw new ApiError(0, `Erro de conexão ao enviar a imagem: ${hint}`)
        }
        if (!res.ok) {
          const rawText = await res.text().catch(() => '')
          console.error('[uploadImage] resposta de erro do backend', res.status, rawText)
          let serverMsg: string | undefined
          try {
            serverMsg = JSON.parse(rawText)?.error
          } catch {
            // corpo não é JSON
          }
          const message =
            serverMsg ||
            (res.status === 413
              ? 'Arquivo grande demais — o servidor recusou o envio (limite de tamanho excedido).'
              : res.status === 401 || res.status === 403
                ? 'Sessão de admin expirada ou sem permissão — faça login novamente.'
                : rawText
                  ? `Erro ${res.status}: ${rawText.slice(0, 200)}`
                  : `Erro ${res.status} ao enviar a imagem.`)
          throw new ApiError(res.status, message)
        }
        return (await res.json()) as { url: string }
      },
    },
    motoboys: {
      list: () => rpc<Motoboy[]>('admin_list_motoboys', { p_token: adminToken() }),
      create: (payload: { name: string; phone: string; email: string; password: string; whatsapp?: string }) =>
        rpc<Motoboy>('admin_create_motoboy', {
          p_token: adminToken(),
          p_name: payload.name,
          p_phone: payload.phone,
          p_email: payload.email,
          p_password: payload.password,
          p_whatsapp: payload.whatsapp || null,
        }),
      update: (id: string, payload: Partial<Motoboy> & { password?: string }) =>
        rpc<Motoboy>('admin_update_motoboy', {
          p_token: adminToken(),
          p_id: id,
          p_name: payload.name,
          p_phone: payload.phone,
          p_email: payload.email,
          p_password: payload.password || null,
          p_active: payload.active ?? true,
          p_whatsapp: payload.whatsapp ?? null,
        }),
      delete: (id: string) => rpc<void>('admin_delete_motoboy', { p_token: adminToken(), p_id: id }),
      pending: (id: string) => rpc<MotoboyPending>('admin_motoboy_pending', { p_token: adminToken(), p_id: id }),
      pay: (id: string, paymentMethod: PaymentMethod) =>
        rpc<MotoboySettlement>('admin_pay_motoboy', {
          p_token: adminToken(),
          p_motoboy_id: id,
          p_payment_method: paymentMethod,
        }),
    },
    vendedores: {
      list: () => rpc<Vendedor[]>('admin_list_vendedores', { p_token: adminToken() }),
      create: (payload: {
        name: string
        email: string
        password: string
        commission_active?: boolean
        commission_percent?: number
      }) =>
        rpc<Vendedor>('admin_create_vendedor', {
          p_token: adminToken(),
          p_name: payload.name,
          p_email: payload.email,
          p_password: payload.password,
          p_commission_active: payload.commission_active ?? false,
          p_commission_percent: payload.commission_percent ?? null,
        }),
      update: (
        id: string,
        payload: {
          name: string
          email: string
          active: boolean
          password?: string
          commission_active?: boolean
          commission_percent?: number
        }
      ) =>
        rpc<Vendedor>('admin_update_vendedor', {
          p_token: adminToken(),
          p_id: id,
          p_name: payload.name,
          p_email: payload.email,
          p_active: payload.active,
          p_password: payload.password || null,
          p_commission_active: payload.commission_active ?? false,
          p_commission_percent: payload.commission_percent ?? null,
        }),
      delete: (id: string) => rpc<void>('admin_delete_vendedor', { p_token: adminToken(), p_id: id }),
    },
    coupons: {
      list: () => rpc<Coupon[]>('admin_list_coupons', { p_token: adminToken() }),
      create: (payload: {
        code: string
        kind: 'desconto' | 'frete' | 'aniversario' | 'produto'
        discount_type?: 'percent' | 'fixed'
        discount_value?: number
        allow_promotion_checkout?: boolean
        expires_at?: string
        max_uses?: number
        product_discounts?: ProductDiscount[]
      }) =>
        rpc<Coupon>('admin_create_coupon', {
          p_token: adminToken(),
          p_code: payload.code,
          p_kind: payload.kind,
          p_discount_type: payload.discount_type ?? null,
          p_discount_value: payload.discount_value ?? null,
          p_allow_promotion_checkout: payload.allow_promotion_checkout ?? false,
          p_expires_at: payload.expires_at || null,
          p_max_uses: payload.max_uses ?? null,
          p_product_discounts: payload.product_discounts && payload.product_discounts.length > 0 ? payload.product_discounts : null,
        }),
      update: (
        id: string,
        payload: {
          active: boolean
          allow_promotion_checkout: boolean
          expires_at?: string
          max_uses?: number
          discount_type?: 'percent' | 'fixed'
          discount_value?: number
          product_discounts?: ProductDiscount[]
        }
      ) =>
        rpc<Coupon>('admin_update_coupon', {
          p_token: adminToken(),
          p_id: id,
          p_active: payload.active,
          p_allow_promotion_checkout: payload.allow_promotion_checkout,
          p_expires_at: payload.expires_at || null,
          p_max_uses: payload.max_uses ?? null,
          p_discount_type: payload.discount_type ?? null,
          p_discount_value: payload.discount_value ?? null,
          p_product_discounts: payload.product_discounts && payload.product_discounts.length > 0 ? payload.product_discounts : null,
        }),
      delete: (id: string) => rpc<void>('admin_delete_coupon', { p_token: adminToken(), p_id: id }),
      // Cupom alvo: nasce de um filtro no CRM, amarrado a clientes
      // específicos (por whatsapp) em vez de um código público qualquer um
      // pode usar. Intransferível — cada concessão só vale pro whatsapp dela.
      createTargeted: (payload: {
        code: string
        customer_whatsapps: string[]
        uses_per_customer?: number
        notify_customers?: boolean
        custom_message?: string
        combinable_with_public?: boolean
        allow_promotion_checkout?: boolean
        expires_at?: string
        max_uses?: number
        discount_type?: 'percent' | 'fixed'
        discount_value?: number
        shipping_discount_type?: 'percent' | 'fixed'
        shipping_discount_value?: number
        product_discounts?: ProductDiscount[]
      }) =>
        rpc<Coupon>('admin_create_targeted_coupon', {
          p_token: adminToken(),
          p_code: payload.code,
          p_customer_whatsapps: payload.customer_whatsapps,
          p_uses_per_customer: payload.uses_per_customer ?? 1,
          p_notify_customers: payload.notify_customers ?? true,
          p_custom_message: payload.custom_message || null,
          p_combinable_with_public: payload.combinable_with_public ?? false,
          p_allow_promotion_checkout: payload.allow_promotion_checkout ?? false,
          p_expires_at: payload.expires_at || null,
          p_max_uses: payload.max_uses ?? null,
          p_discount_type: payload.discount_type ?? null,
          p_discount_value: payload.discount_value ?? null,
          p_shipping_discount_type: payload.shipping_discount_type ?? null,
          p_shipping_discount_value: payload.shipping_discount_value ?? null,
          p_product_discounts: payload.product_discounts && payload.product_discounts.length > 0 ? payload.product_discounts : null,
        }),
      updateTargeted: (
        id: string,
        payload: {
          active: boolean
          uses_per_customer?: number
          combinable_with_public?: boolean
          allow_promotion_checkout?: boolean
          expires_at?: string
          max_uses?: number
          discount_type?: 'percent' | 'fixed'
          discount_value?: number
          shipping_discount_type?: 'percent' | 'fixed'
          shipping_discount_value?: number
          product_discounts?: ProductDiscount[]
        }
      ) =>
        rpc<Coupon>('admin_update_targeted_coupon', {
          p_token: adminToken(),
          p_id: id,
          p_active: payload.active,
          p_uses_per_customer: payload.uses_per_customer ?? 1,
          p_combinable_with_public: payload.combinable_with_public ?? false,
          p_allow_promotion_checkout: payload.allow_promotion_checkout ?? false,
          p_expires_at: payload.expires_at || null,
          p_max_uses: payload.max_uses ?? null,
          p_discount_type: payload.discount_type ?? null,
          p_discount_value: payload.discount_value ?? null,
          p_shipping_discount_type: payload.shipping_discount_type ?? null,
          p_shipping_discount_value: payload.shipping_discount_value ?? null,
          p_product_discounts: payload.product_discounts && payload.product_discounts.length > 0 ? payload.product_discounts : null,
        }),
      listGrants: (couponId: string) =>
        rpc<CouponGrant[]>('admin_list_coupon_grants', { p_token: adminToken(), p_coupon_id: couponId }),
    },
    promotions: {
      list: () => rpc<Promotion[]>('admin_list_promotions', { p_token: adminToken() }),
      create: (payload: {
        title: string
        image_url: string
        product_ids: string[]
        promotion_type: PromotionType
        discount_type?: 'percent' | 'fixed'
        discount_value?: number
        shipping_discount_type?: 'percent' | 'fixed'
        shipping_discount_value?: number
        starts_at?: string
        expires_at?: string
        product_discounts?: ProductDiscount[]
      }) =>
        rpc<Promotion>('admin_create_promotion', {
          p_token: adminToken(),
          p_title: payload.title,
          p_image_url: payload.image_url,
          p_product_ids: payload.product_ids,
          p_promotion_type: payload.promotion_type,
          p_discount_type: payload.discount_type ?? null,
          p_discount_value: payload.discount_value ?? null,
          p_shipping_discount_type: payload.shipping_discount_type ?? null,
          p_shipping_discount_value: payload.shipping_discount_value ?? null,
          p_starts_at: payload.starts_at || null,
          p_expires_at: payload.expires_at || null,
          p_product_discounts: payload.product_discounts && payload.product_discounts.length > 0 ? payload.product_discounts : null,
        }),
      update: (
        id: string,
        payload: {
          title: string
          image_url: string
          product_ids: string[]
          promotion_type: PromotionType
          discount_type?: 'percent' | 'fixed'
          discount_value?: number
          shipping_discount_type?: 'percent' | 'fixed'
          shipping_discount_value?: number
          active: boolean
          starts_at?: string
          expires_at?: string
          product_discounts?: ProductDiscount[]
        }
      ) =>
        rpc<Promotion>('admin_update_promotion', {
          p_token: adminToken(),
          p_id: id,
          p_title: payload.title,
          p_image_url: payload.image_url,
          p_product_ids: payload.product_ids,
          p_promotion_type: payload.promotion_type,
          p_discount_type: payload.discount_type ?? null,
          p_discount_value: payload.discount_value ?? null,
          p_shipping_discount_type: payload.shipping_discount_type ?? null,
          p_shipping_discount_value: payload.shipping_discount_value ?? null,
          p_active: payload.active,
          p_starts_at: payload.starts_at || null,
          p_expires_at: payload.expires_at || null,
          p_product_discounts: payload.product_discounts && payload.product_discounts.length > 0 ? payload.product_discounts : null,
        }),
      delete: (id: string) => rpc<void>('admin_delete_promotion', { p_token: adminToken(), p_id: id }),
    },
    orders: {
      list: (status?: string) => rpc<Order[]>('admin_list_orders', { p_token: adminToken(), p_status: status ?? null }),
      updateStatus: (id: string, status: string, paymentConfirmed?: boolean) =>
        rpc<Order>('admin_update_order_status', {
          p_token: adminToken(),
          p_order_id: id,
          p_status: status,
          p_payment_confirmed: paymentConfirmed ?? null,
        }),
      // Backend Rust monta o texto (varia por entrega/retirada) e manda pelo
      // WhatsApp da loja.
      notifyReady: (orderId: string) =>
        request<void>('/api/admin/whatsapp/notify-order-ready', {
          method: 'POST',
          body: JSON.stringify({ order_id: orderId }),
          token: adminToken(),
        }),
    },
    shippingSettings: {
      get: () => supabasePublicApi.shippingSettings.get(),
      update: (pricePerKm: number, maxKm: number | null) =>
        rpc<ShippingSettings>('admin_update_shipping_settings', {
          p_token: adminToken(),
          p_price_per_km: pricePerKm,
          p_max_km: maxKm,
        }),
    },
    financeiro: {
      get: () => rpc<FinanceiroSummary>('admin_financeiro', { p_token: adminToken() }),
      timeseries: (days?: number) =>
        rpc<FinanceiroTimeseriesPoint[]>('admin_financeiro_timeseries', { p_token: adminToken(), p_days: days ?? 30 }),
    },
    siteSettings: {
      updateHeroImage: (imageUrl: string) =>
        rpc<{ hero_image_url: string }>('admin_update_hero_image', { p_token: adminToken(), p_image_url: imageUrl }),
    },
    crm: {
      customers: () => rpc<CrmCustomer[]>('admin_crm_customers', { p_token: adminToken() }),
    },
    segments: {
      list: () => rpc<CrmSegment[]>('admin_list_segments', { p_token: adminToken() }),
      create: (payload: { name: string; description?: string; filter_criteria: CrmFilterCriteria }) =>
        rpc<CrmSegment>('admin_create_segment', {
          p_token: adminToken(),
          p_name: payload.name,
          p_description: payload.description || null,
          p_filter_criteria: payload.filter_criteria,
        }),
      update: (id: string, payload: { name: string; description?: string; filter_criteria: CrmFilterCriteria }) =>
        rpc<CrmSegment>('admin_update_segment', {
          p_token: adminToken(),
          p_id: id,
          p_name: payload.name,
          p_description: payload.description || null,
          p_filter_criteria: payload.filter_criteria,
        }),
      delete: (id: string) => rpc<void>('admin_delete_segment', { p_token: adminToken(), p_id: id }),
    },
    // "Campanha": notifica os clientes de um segmento via WhatsApp com um
    // cupom exclusivo — 'segmento' dispara uma vez pros clientes que casam
    // com o critério do segmento agora; 'evento' guarda um critério
    // diferente (trigger_criteria) e dispara (uma vez por cliente) quando
    // esse critério passar a valer pra ele.
    campanhaCoupons: {
      list: (segmentId: string) =>
        rpc<CrmCampanhaCoupon[]>('admin_list_campanha_coupons', { p_token: adminToken(), p_segment_id: segmentId }),
      create: (payload: {
        segment_id: string
        orientation: CampanhaOrientation
        trigger_criteria?: CrmFilterCriteria
        message_template: string
        code: string
        uses_per_customer?: number
        combinable_with_public?: boolean
        allow_promotion_checkout?: boolean
        expires_at?: string
        max_uses?: number
        discount_type?: 'percent' | 'fixed'
        discount_value?: number
        shipping_discount_type?: 'percent' | 'fixed'
        shipping_discount_value?: number
        product_discounts?: ProductDiscount[]
        customer_whatsapps: string[]
      }) =>
        rpc<CrmCampanhaCoupon>('admin_create_campanha_coupon', {
          p_token: adminToken(),
          p_segment_id: payload.segment_id,
          p_orientation: payload.orientation,
          p_trigger_criteria: payload.trigger_criteria ?? null,
          p_message_template: payload.message_template,
          p_code: payload.code,
          p_uses_per_customer: payload.uses_per_customer ?? 1,
          p_combinable_with_public: payload.combinable_with_public ?? false,
          p_allow_promotion_checkout: payload.allow_promotion_checkout ?? false,
          p_expires_at: payload.expires_at || null,
          p_max_uses: payload.max_uses ?? null,
          p_discount_type: payload.discount_type ?? null,
          p_discount_value: payload.discount_value ?? null,
          p_shipping_discount_type: payload.shipping_discount_type ?? null,
          p_shipping_discount_value: payload.shipping_discount_value ?? null,
          p_product_discounts: payload.product_discounts && payload.product_discounts.length > 0 ? payload.product_discounts : null,
          p_customer_whatsapps: payload.customer_whatsapps,
        }),
      // Reavalia o trigger_criteria de uma campanha 'evento' contra a lista
      // atual de whatsapps que casam com ele (calculada no front) — grants
      // pra quem ainda não tinha, idempotente (não duplica).
      fireEvent: (id: string, customerWhatsapps: string[]) =>
        rpc<{ newly_granted: string[] }>('admin_fire_campanha_event', {
          p_token: adminToken(),
          p_id: id,
          p_customer_whatsapps: customerWhatsapps,
        }),
      delete: (id: string) => rpc<void>('admin_delete_campanha_coupon', { p_token: adminToken(), p_id: id }),
      // Liga/desliga a campanha inteira — junto com ela o cupom exclusivo
      // por trás (não existe on/off separado só do cupom de uma campanha).
      toggleActive: (id: string, active: boolean) =>
        rpc<CrmCampanhaCoupon>('admin_toggle_campanha_coupon', { p_token: adminToken(), p_id: id, p_active: active }),
      // orientation/código continuam imutáveis depois de criada, mas
      // trigger_criteria (só pra 'evento') pode ser reajustado — é
      // exatamente isso que o admin faz quando o segmento muda e a
      // campanha fica desatualizada.
      update: (
        id: string,
        payload: {
          message_template: string
          uses_per_customer?: number
          combinable_with_public?: boolean
          allow_promotion_checkout?: boolean
          expires_at?: string
          max_uses?: number
          discount_type?: 'percent' | 'fixed'
          discount_value?: number
          shipping_discount_type?: 'percent' | 'fixed'
          shipping_discount_value?: number
          product_discounts?: ProductDiscount[]
          trigger_criteria?: CrmFilterCriteria
        }
      ) =>
        rpc<CrmCampanhaCoupon>('admin_update_campanha_coupon', {
          p_token: adminToken(),
          p_id: id,
          p_message_template: payload.message_template,
          p_uses_per_customer: payload.uses_per_customer ?? 1,
          p_combinable_with_public: payload.combinable_with_public ?? false,
          p_allow_promotion_checkout: payload.allow_promotion_checkout ?? false,
          p_expires_at: payload.expires_at || null,
          p_max_uses: payload.max_uses ?? null,
          p_discount_type: payload.discount_type ?? null,
          p_discount_value: payload.discount_value ?? null,
          p_shipping_discount_type: payload.shipping_discount_type ?? null,
          p_shipping_discount_value: payload.shipping_discount_value ?? null,
          p_product_discounts: payload.product_discounts && payload.product_discounts.length > 0 ? payload.product_discounts : null,
          p_trigger_criteria: payload.trigger_criteria ?? null,
        }),
    },
    // Único pedaço do admin que ainda fala com o backend Rust (Railway) em
    // vez do Supabase — a chave da Evolution API precisa ficar fora do
    // navegador.
    whatsapp: {
      status: () => request<EvolutionStatus>('/api/admin/whatsapp/status', { token: adminToken() }),
      connect: () => request<EvolutionConnect>('/api/admin/whatsapp/connect', { token: adminToken() }),
      logout: () => request<void>('/api/admin/whatsapp/logout', { method: 'POST', token: adminToken() }),
      // Dispara pelo WhatsApp da loja pra cada cliente contemplado num
      // cupom alvo — a não ser que "não notificar clientes" tenha sido
      // marcado na criação (checado nos dois lados, front e Rust).
      notifyCouponGrant: (couponId: string, customMessage?: string) =>
        request<void>('/api/admin/whatsapp/notify-coupon-grant', {
          method: 'POST',
          body: JSON.stringify({ coupon_id: couponId, custom_message: customMessage || null }),
          token: adminToken(),
        }),
    },
  },
  // PDV — acessível por admin OU vendedor, os dois autenticados no mesmo
  // useAdminAuth (com role diferente) — adminToken() vale pros dois, a RPC
  // que decide o que cada papel pode ver.
  pdv: {
    createSale: (payload: {
      items: PdvSaleItemInput[]
      payment_method: PaymentMethod
      customer_name?: string
      customer_whatsapp?: string
    }) =>
      rpc<Order>('pdv_create_sale', {
        p_token: adminToken(),
        p_items: payload.items,
        p_payment_method: payload.payment_method,
        p_customer_name: payload.customer_name || null,
        p_customer_whatsapp: payload.customer_whatsapp || null,
      }),
    // Único disparo de WhatsApp da venda de balcão (o "obrigado pela
    // compra") — nunca passa pelo passo a passo de pedido online, e sai
    // sempre do número da loja (vendedor não tem instância própria).
    notifySale: (orderId: string) =>
      request<void>('/api/pdv/notify-sale', { method: 'POST', body: JSON.stringify({ order_id: orderId }) }),
    relatorio: () => rpc<VendedorRelatorio>('vendedor_relatorio', { p_token: adminToken() }),
  },
  motoboy: {
    orders: {
      list: (status: string) => rpc<Order[]>('motoboy_list_orders', { p_token: motoboyToken(), p_status: status }),
      counts: () => rpc<Record<string, number>>('motoboy_order_counts', { p_token: motoboyToken() }),
    },
    // Corrida ativa: sobrevive a troca de página/reload porque o estado
    // mora no banco (sunset.motoboy_runs), não no componente React — ver
    // supabase/sunset_motoboy_runs.sql.
    runs: {
      active: () => rpc<MotoboyRun | null>('motoboy_active_run', { p_token: motoboyToken() }),
      // Passa pelo backend Rust (não a RPC direto) — ele decide a ordem de
      // entrega com distância real de rua via Google Routes quando
      // configurada, e só então chama a RPC já com a ordem pronta. Sem a
      // chave configurada ainda, o backend chama a mesma RPC sem essa
      // etapa extra e o resultado é idêntico a antes.
      start: (orderIds: string[]) =>
        request<MotoboyRun>('/api/motoboy/runs/start', {
          method: 'POST',
          body: JSON.stringify({ order_ids: orderIds }),
          token: motoboyToken(),
        }),
      updatePosition: (lat: number, lng: number, heading?: number | null) =>
        rpc<void>('motoboy_update_run_position', {
          p_token: motoboyToken(),
          p_lat: lat,
          p_lng: lng,
          p_heading: heading ?? null,
        }),
      completeCurrent: (paymentConfirmed?: boolean) =>
        rpc<MotoboyRun>('motoboy_complete_current_delivery', {
          p_token: motoboyToken(),
          p_payment_confirmed: paymentConfirmed ?? null,
        }),
    },
    financeiro: {
      get: () => rpc<MotoboyFinanceiro>('motoboy_financeiro', { p_token: motoboyToken() }),
    },
    // Igual admin.whatsapp, mas na instância própria do motoboy
    // (backend Rust monta o nome "motoboy-<id>" sozinho).
    whatsapp: {
      status: () => request<EvolutionStatus>('/api/motoboy/whatsapp/status', { token: motoboyToken() }),
      connect: () => request<EvolutionConnect>('/api/motoboy/whatsapp/connect', { token: motoboyToken() }),
      logout: () => request<void>('/api/motoboy/whatsapp/logout', { method: 'POST', token: motoboyToken() }),
      // Chamado depois de motoboy_start_run (que só mexe no banco) — manda
      // a mensagem de verdade a partir do WhatsApp do próprio motoboy,
      // avisando que saiu pra entrega + link de acompanhamento.
      notifyEnRoute: (orderId: string) =>
        request<void>('/api/motoboy/whatsapp/notify-en-route', {
          method: 'POST',
          body: JSON.stringify({ order_id: orderId }),
          token: motoboyToken(),
        }),
    },
  },
}

export const api = USE_LOCAL_DB ? localApi : remoteApi

export { ApiError }
