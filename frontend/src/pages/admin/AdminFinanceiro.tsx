import { useEffect, useState } from 'react'
import { Clock, Gift, Loader2, Package, Receipt, TrendingDown, TrendingUp, Truck, Wallet } from 'lucide-react'
import Card from '../../components/ui/Card'
import { StatusBadge } from '../../components/ui/Badge'
import { api } from '../../lib/api'
import { useAdminAuth } from '../../store/adminAuth'
import type { FinanceiroSummary, VendedorRelatorio } from '../../lib/types'

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function PdvSalesSection({ role }: { role: string }) {
  const [data, setData] = useState<VendedorRelatorio | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.pdv.relatorio().then(setData).finally(() => setLoading(false))
  }, [])

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 label mb-1">
        <Receipt className="w-3.5 h-3.5" /> Vendas de balcão (PDV)
      </div>
      <p className="text-xs text-son-silver-dim mb-3">
        {role === 'admin' ? 'Todas as vendas de balcão, de qualquer vendedor.' : 'Suas vendas no PDV.'}
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-son-pink" />
        </div>
      ) : !data || data.total_count === 0 ? (
        <p className="text-sm text-son-silver-dim">Nenhuma venda de balcão registrada ainda.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-son-surface-light rounded-xl p-3 text-center">
              <p className="text-xs text-son-silver-dim mb-1">Total vendido</p>
              <p className="sunset-text font-black text-xl">{currency(data.total_sales)}</p>
            </div>
            <div className="bg-son-surface-light rounded-xl p-3 text-center">
              <p className="text-xs text-son-silver-dim mb-1">Nº de vendas</p>
              <p className="font-black text-xl text-white">{data.total_count}</p>
            </div>
          </div>
          <ul className="divide-y divide-white/5">
            {data.sales.map((s) => (
              <li key={s.id} className="py-2.5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 text-xs text-son-silver-dim">
                    {formatDate(s.created_at)}
                    {role === 'admin' && (
                      <span className="px-1.5 py-0.5 rounded-full bg-white/10 capitalize">{s.sold_by_role}</span>
                    )}
                  </div>
                  <span className="sunset-text font-bold text-sm">{currency(s.total)}</span>
                </div>
                <p className="text-xs text-son-silver truncate">
                  {s.items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

export default function AdminFinanceiro() {
  const { role } = useAdminAuth()
  const [data, setData] = useState<FinanceiroSummary | null>(null)
  const [loading, setLoading] = useState(role === 'admin')

  useEffect(() => {
    if (role !== 'admin') return
    api.admin.financeiro.get().then(setData).finally(() => setLoading(false))
  }, [role])

  // Vendedor só enxerga as próprias vendas de balcão — o resto do
  // financeiro (receita geral, motoboys, desconto concedido) é admin-only.
  if (role !== 'admin') {
    return (
      <div>
        <h1 className="text-2xl font-black mb-6">Relatórios</h1>
        <PdvSalesSection role={role} />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div>
      <h1 className="text-2xl font-black mb-6">Financeiro &amp; relatórios</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-son-silver-dim text-xs mb-2">
            <Wallet className="w-3.5 h-3.5" /> Receita paga
          </div>
          <p className="sunset-text font-black text-2xl">{currency(data.total_revenue)}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-son-silver-dim text-xs mb-2">
            <Package className="w-3.5 h-3.5" /> Pedidos totais
          </div>
          <p className="font-black text-2xl text-white">{data.total_orders}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-son-silver-dim text-xs mb-2">
            <Clock className="w-3.5 h-3.5" /> Tempo médio de entrega
          </div>
          <p className="font-black text-2xl text-white">
            {data.avg_delivery_minutes > 0 ? `${data.avg_delivery_minutes.toFixed(1).replace('.', ',')} min` : '—'}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-son-silver-dim text-xs mb-2">
            <Gift className="w-3.5 h-3.5" /> Concedido em campanha/cupom
          </div>
          <p className={`font-black text-2xl ${data.total_discount_given > 0 ? 'text-amber-400' : 'text-white'}`}>
            {currency(data.total_discount_given)}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-son-silver-dim text-xs mb-2">
            <TrendingDown className="w-3.5 h-3.5" /> Faturaria sem desconto
          </div>
          <p className="font-black text-2xl text-white">{currency(data.total_revenue + data.total_discount_given)}</p>
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <p className="label mb-3">Pedidos por status</p>
        <div className="flex flex-wrap gap-2">
          {data.orders_by_status.map((s) => (
            <div key={s.status} className="flex items-center gap-2 bg-son-surface-light rounded-xl px-3 py-2">
              <StatusBadge status={s.status} />
              <span className="text-sm font-bold text-white">{s.count}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2 label mb-3">
          <TrendingUp className="w-3.5 h-3.5" /> Ranking de vendas
        </div>
        {data.top_products.length === 0 ? (
          <p className="text-sm text-son-silver-dim">Nenhuma venda paga ainda.</p>
        ) : (
          <ul className="space-y-2">
            {data.top_products.map((p, i) => (
              <li key={p.product_id} className="flex items-center gap-3">
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-son-surface-light text-xs font-bold text-son-gold flex-shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm text-white truncate">{p.product_name}</span>
                <span className="text-xs text-son-silver-dim">{p.quantity_sold}x</span>
                <span className="sunset-text font-bold text-sm">{currency(p.revenue)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2 label mb-3">
          <Truck className="w-3.5 h-3.5" /> Frete dos motoboys (100% é deles)
        </div>
        {data.motoboys.length === 0 ? (
          <p className="text-sm text-son-silver-dim">Nenhum motoboy cadastrado.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {data.motoboys.map((m) => (
              <li key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{m.name}</p>
                  <p className="text-xs text-son-silver-dim">
                    {m.total_deliveries} entrega{m.total_deliveries === 1 ? '' : 's'} · pago {currency(m.total_paid)}
                    {m.avg_delivery_minutes > 0 && ` · ${m.avg_delivery_minutes.toFixed(0)} min/entrega`}
                  </p>
                </div>
                <span className={`font-bold text-sm flex-shrink-0 ${m.pending_amount > 0 ? 'sunset-text' : 'text-son-silver-dim'}`}>
                  {m.pending_amount > 0 ? `a pagar: ${currency(m.pending_amount)}` : 'em dia'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mb-6">
        <PdvSalesSection role={role} />
      </div>

      <Card className="p-5">
        <p className="label mb-3">Histórico recente</p>
        <ul className="divide-y divide-white/5">
          {data.recent_orders.map((o) => (
            <li key={o.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{o.customer_name}</p>
                <p className="text-xs text-son-silver-dim">{o.created_at}</p>
              </div>
              <StatusBadge status={o.status} className="flex-shrink-0" />
              <span className="sunset-text font-bold text-sm flex-shrink-0">{currency(o.total)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
