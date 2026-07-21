import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2, Package } from 'lucide-react'
import SiteHeader from '../../components/layout/SiteHeader'
import PageTransition from '../../components/layout/PageTransition'
import { StatusBadge } from '../../components/ui/Badge'
import { api } from '../../lib/api'
import type { Order } from '../../lib/types'
import { useCustomerAuth } from '../../store/customerAuth'

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

export default function HistoricoCliente() {
  const { token } = useCustomerAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    api.customerAuth
      .listOrders(token)
      .then(setOrders)
      .finally(() => setLoading(false))
  }, [token])

  if (!token) return <Navigate to="/" replace />

  return (
    <main className="min-h-screen text-white">
      <SiteHeader showCart={false} showProfile={false} title="Histórico de pedidos" />
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
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-son-silver-dim">
                      {order.delivery_type === 'retirada' ? 'Retirada no local' : `Entrega em ${order.neighborhood ?? '-'}`}
                    </span>
                    <span className="sunset-text font-bold">{currency(order.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PageTransition>
    </main>
  )
}
