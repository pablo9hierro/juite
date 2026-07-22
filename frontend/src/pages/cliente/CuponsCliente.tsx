import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Gift, Loader2, Tag } from 'lucide-react'
import SiteHeader from '../../components/layout/SiteHeader'
import PageTransition from '../../components/layout/PageTransition'
import CartFab from '../../components/CartFab'
import NoCouponToggle from '../../components/NoCouponToggle'
import CouponTicket from '../../components/CouponTicket'
import { api } from '../../lib/api'
import type { CustomerCoupons } from '../../lib/types'
import { useCustomerAuth } from '../../store/customerAuth'

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

type Tab = 'ativos' | 'inativos' | 'historico'

export default function CuponsCliente() {
  const { token } = useCustomerAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('ativos')
  const [data, setData] = useState<CustomerCoupons | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingClaim, setCheckingClaim] = useState(false)
  const [showNoCoupon, setShowNoCoupon] = useState(false)

  useEffect(() => {
    if (!token) return
    api.customerAuth
      .listCoupons(token)
      .then(setData)
      .finally(() => setLoading(false))
  }, [token])

  const handleResgatarCupom = () => {
    if (!token || checkingClaim) return
    setCheckingClaim(true)
    api.customerAuth
      .hasClaimableCoupon(token)
      .then((has) => {
        if (has) navigate('/cliente/resgatarcupom')
        else setShowNoCoupon(true)
      })
      .catch(() => setShowNoCoupon(true))
      .finally(() => setCheckingClaim(false))
  }

  if (!token) return <Navigate to="/" replace />

  return (
    <main className="min-h-screen text-white">
      <SiteHeader showCart={false} />
      <CartFab />
      <PageTransition className="max-w-2xl mx-auto px-5 sm:px-10 pt-6 pb-16">
        <div className="sunset-tabs overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setTab('ativos')}
            className={`sunset-tab flex-1 ${tab === 'ativos' ? 'sunset-tab-active text-white' : 'text-son-silver hover:text-white'}`}
          >
            Ativos
          </button>
          <button
            onClick={() => setTab('inativos')}
            className={`sunset-tab flex-1 ${tab === 'inativos' ? 'sunset-tab-active text-white' : 'text-son-silver hover:text-white'}`}
          >
            Inativos
          </button>
          <button
            onClick={() => setTab('historico')}
            className={`sunset-tab flex-1 ${tab === 'historico' ? 'sunset-tab-active text-white' : 'text-son-silver hover:text-white'}`}
          >
            Histórico
          </button>
        </div>

        <div className="glass rounded-b-3xl p-4 sm:p-6">
          {tab === 'ativos' && (
            <button
              type="button"
              onClick={handleResgatarCupom}
              disabled={checkingClaim}
              className="sunset-cta-btn w-full flex items-center justify-center gap-2 mb-4 disabled:opacity-60"
            >
              {checkingClaim ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
              Resgatar cupom
            </button>
          )}
          {loading || !data ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
            </div>
          ) : tab === 'historico' ? (
            data.history.length === 0 ? (
              <div className="text-center py-16 text-son-silver-dim">
                <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhum cupom usado ainda.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.history.map((h) => (
                  <li key={h.order_id} className="bg-son-surface border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold text-white">{h.coupon_code}</span>
                      <span className="text-xs text-son-silver-dim">{new Date(h.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-son-silver-dim">Pedido #{h.order_id.slice(0, 8)}</span>
                      <span className="sunset-text font-bold">{currency(h.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : (
            (tab === 'ativos' ? data.active : data.inactive).length === 0 ? (
              <div className="text-center py-16 text-son-silver-dim">
                <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>{tab === 'ativos' ? 'Nenhum cupom ativo no momento.' : 'Nenhum cupom inativo.'}</p>
              </div>
            ) : (
              <ul className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 sm:-mx-6 px-4 sm:px-6 py-1">
                {(tab === 'ativos' ? data.active : data.inactive).map((c) => (
                  <li key={c.grant_id} className={`flex-shrink-0 snap-center ${tab === 'inativos' ? 'opacity-50 grayscale' : ''}`}>
                    <CouponTicket coupon={c} />
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      </PageTransition>
      <AnimatePresence>{showNoCoupon && <NoCouponToggle onClose={() => setShowNoCoupon(false)} />}</AnimatePresence>
    </main>
  )
}
