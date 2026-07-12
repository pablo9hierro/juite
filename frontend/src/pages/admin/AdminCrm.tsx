import { useEffect, useState } from 'react'
import { Cake, Loader2, Search, Users } from 'lucide-react'
import Card from '../../components/ui/Card'
import WhatsAppLink from '../../components/ui/WhatsAppLink'
import { api } from '../../lib/api'
import type { CrmCustomer } from '../../lib/types'

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function isBirthdayMonth(birthdate: string | null) {
  if (!birthdate) return false
  return new Date(birthdate).getMonth() === new Date().getMonth()
}

export default function AdminCrm() {
  const [customers, setCustomers] = useState<CrmCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [onlyBirthday, setOnlyBirthday] = useState(false)

  useEffect(() => {
    api.admin.crm.customers().then(setCustomers).finally(() => setLoading(false))
  }, [])

  const filtered = customers.filter((c) => {
    if (onlyBirthday && !isBirthdayMonth(c.birthdate)) return false
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return c.name.toLowerCase().includes(q) || c.whatsapp.includes(q)
  })

  const totalCustomers = customers.length
  const totalRevenue = customers.reduce((sum, c) => sum + c.total_spent, 0)
  const birthdayCount = customers.filter((c) => isBirthdayMonth(c.birthdate)).length

  return (
    <div>
      <h1 className="text-2xl font-black mb-1">CRM</h1>
      <p className="text-sm text-son-silver-dim mb-6">Clientes que já compraram, com histórico e aniversário.</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4 text-center">
          <p className="text-xs text-son-silver-dim mb-1">Clientes</p>
          <p className="font-black text-2xl text-white">{totalCustomers}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-son-silver-dim mb-1">Faturado</p>
          <p className="sunset-text font-black text-xl">{currency(totalRevenue)}</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-xs text-son-silver-dim mb-1">Aniversariantes</p>
          <p className="font-black text-2xl text-white">{birthdayCount}</p>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-son-silver-dim absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input-field pl-9"
            placeholder="Buscar por nome ou WhatsApp..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => setOnlyBirthday((v) => !v)}
          className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex-shrink-0 ${
            onlyBirthday ? 'sunset-bg text-white' : 'bg-son-surface border border-white/5 text-son-silver-dim'
          }`}
        >
          <Cake className="w-3.5 h-3.5" /> Aniversariantes do mês
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-son-silver-dim">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Card key={c.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-white">{c.name}</p>
                  {isBirthdayMonth(c.birthdate) && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-son-pink/15 text-son-pink text-xs font-semibold">
                      <Cake className="w-3 h-3" /> Aniversário
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  <WhatsAppLink phone={c.whatsapp} />
                </div>
                <p className="text-xs text-son-silver-dim mt-1">
                  {c.birthdate ? `Nascimento: ${formatDate(c.birthdate)}` : 'Sem data de nascimento'} · Último pedido:{' '}
                  {formatDate(c.last_order_at)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="sunset-text font-black text-lg">{currency(c.total_spent)}</p>
                <p className="text-xs text-son-silver-dim">{c.order_count} pedido(s)</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
