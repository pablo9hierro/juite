import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Loader2, Package, RotateCcw } from 'lucide-react'
import SiteHeader from '../../components/layout/SiteHeader'
import PageTransition from '../../components/layout/PageTransition'
import { StatusBadge } from '../../components/ui/Badge'
import { api } from '../../lib/api'
import type { Order } from '../../lib/types'
import { useCustomerAuth } from '../../store/customerAuth'
import { useCart } from '../../store/cart'

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

export default function HistoricoCliente() {
  const { token } = useCustomerAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [buyingAgainId, setBuyingAgainId] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    api.customerAuth
      .listOrders(token)
      .then(setOrders)
      .finally(() => setLoading(false))
  }, [token])

  // "Comprar novamente" monta o carrinho só com base em QUAIS produtos e
  // QUANTAS unidades vieram no pedido antigo -- o preço usado é sempre o
  // preço ATUAL do produto na loja (buscado agora, na hora do clique),
  // nunca o unit_price congelado no pedido histórico. Se uma promoção que
  // valia na época já acabou, o preço de agora (sem a promoção) é que
  // conta. Produto descontinuado/inativo é simplesmente pulado.
  const handleBuyAgain = async (order: Order) => {
    setBuyingAgainId(order.id)
    try {
      const products = await api.products.list()
      const productById = new Map(products.map((p) => [p.id, p]))
      const cart = useCart.getState()
      cart.clear()
      for (const item of order.items) {
        const product = productById.get(item.product_id)
        if (!product || product.active === false || product.quantity <= 0) continue
        for (let i = 0; i < item.quantity; i++) cart.addItem(product)
      }
      navigate('/carrinho')
    } finally {
      setBuyingAgainId(null)
    }
  }

  if (!token) return <Navigate to="/" replace />

  return (
    <main className="min-h-screen text-white">
      <SiteHeader showCart={false} title="Histórico" />
      <PageTransition className="max-w-2xl mx-auto px-5 sm:px-10 pt-6 pb-16">
        <div className="glass rounded-3xl p-4 sm:p-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-son-silver-dim">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum pedido ainda.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {orders.map((order) => (
                <li key={order.id} className="bg-son-surface border border-white/5 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-son-silver-dim">Pedido #{order.id.slice(0, 8)}</span>
                    <StatusBadge status={order.status} label={order.status === 'pendente' ? 'Pedido feito' : undefined} />
                  </div>
                  <ul className="text-sm text-son-silver space-y-0.5 mb-2">
                    {order.items.map((item) => (
                      <li key={item.product_id}>
                        {item.quantity}x {item.product_name}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-son-silver-dim">
                      {order.delivery_type === 'retirada' ? 'Retirada no local' : `Entrega em ${order.neighborhood ?? '-'}`}
                    </span>
                    <span className="sunset-text font-bold">{currency(order.total)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBuyAgain(order)}
                    disabled={buyingAgainId === order.id}
                    className="btn-secondary w-full flex items-center justify-center gap-2 text-sm py-2 disabled:opacity-60"
                  >
                    {buyingAgainId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    Comprar novamente
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PageTransition>
    </main>
  )
}
