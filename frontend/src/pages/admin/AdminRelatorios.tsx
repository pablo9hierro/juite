import { useEffect, useState } from 'react'
import { BarChart3, Loader2, Receipt } from 'lucide-react'
import Card from '../../components/ui/Card'
import { api } from '../../lib/api'
import { useAdminAuth } from '../../store/adminAuth'
import type { VendedorRelatorio } from '../../lib/types'

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function AdminRelatorios() {
  const { role } = useAdminAuth()
  const [data, setData] = useState<VendedorRelatorio | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.pdv.relatorio().then(setData).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-black mb-1">Relatórios de venda</h1>
      <p className="text-sm text-son-silver-dim mb-6">
        {role === 'admin' ? 'Todas as vendas de balcão (PDV), de qualquer vendedor.' : 'Suas vendas no PDV.'}
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
        </div>
      ) : !data || data.total_count === 0 ? (
        <div className="text-center py-16 text-son-silver-dim">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma venda de balcão registrada ainda.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="p-4 text-center">
              <p className="text-xs text-son-silver-dim mb-1">Total vendido</p>
              <p className="sunset-text font-black text-2xl">{currency(data.total_sales)}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-son-silver-dim mb-1">Nº de vendas</p>
              <p className="font-black text-2xl text-white">{data.total_count}</p>
            </Card>
          </div>

          <div className="space-y-3">
            {data.sales.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs text-son-silver-dim">
                    <Receipt className="w-3.5 h-3.5" />
                    {formatDate(s.created_at)}
                    {role === 'admin' && (
                      <span className="px-1.5 py-0.5 rounded-full bg-white/10 capitalize">{s.sold_by_role}</span>
                    )}
                  </div>
                  <span className="sunset-text font-bold text-sm">{currency(s.total)}</span>
                </div>
                <ul className="text-sm text-son-silver space-y-0.5 mb-1">
                  {s.items.map((item, i) => (
                    <li key={i}>
                      {item.quantity}x {item.product_name}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-son-silver-dim capitalize">{s.customer_name} · {s.payment_method}</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
