import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Loader2, Tag } from 'lucide-react'
import SiteHeader from '../../components/layout/SiteHeader'
import PageTransition from '../../components/layout/PageTransition'
import CartFab from '../../components/CartFab'
import NoCouponToggle from '../../components/NoCouponToggle'
import CouponTicket from '../../components/CouponTicket'
import CouponHistoryTicket from '../../components/CouponHistoryTicket'
import CouponSlot from '../../components/coupon/CouponSlot'
import { api } from '../../lib/api'
import type { CustomerCoupons } from '../../lib/types'
import { useCustomerAuth } from '../../store/customerAuth'

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

  // Uiverse.io by dovatgabriel — na referência era o card sob :hover que
  // crescia (flex:2); celular não tem hover, e o CouponTicket tem
  // largura própria (não é um flex item sem conteúdo), então em vez de
  // flex-grow o card mais perto do centro do scroll vira o "principal"
  // via transform:scale + opacity, recalculado a cada scroll.
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  const cardRefs = useRef<(HTMLLIElement | null)[]>([])
  const scrollRaf = useRef<number | null>(null)

  const updateActiveCard = () => {
    const list = listRef.current
    if (!list) return
    const center = list.scrollLeft + list.clientWidth / 2
    let closest = 0
    let closestDist = Infinity
    cardRefs.current.forEach((el, i) => {
      if (!el) return
      const itemCenter = el.offsetLeft + el.offsetWidth / 2
      const dist = Math.abs(itemCenter - center)
      if (dist < closestDist) {
        closestDist = dist
        closest = i
      }
    })
    setActiveCardIndex(closest)
  }

  const handleCarouselScroll = () => {
    if (scrollRaf.current != null) return
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = null
      updateActiveCard()
    })
  }

  useEffect(() => {
    updateActiveCard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, data])

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

  // Os 3 tabs (ativos/inativos/histórico) agora compartilham o mesmo
  // carrossel horizontal com card central em destaque — só troca a
  // fonte dos dados e o componente de ticket usado por item (histórico
  // não tem kind/discount_type/validade/usos, só o que o pedido guardou
  // na hora da compra, ver CouponHistoryTicket.tsx).
  const items = data
    ? tab === 'historico'
      ? data.history.map((h) => ({ key: h.order_id, node: <CouponHistoryTicket entry={h} /> }))
      : (tab === 'ativos' ? data.active : data.inactive).map((c) => ({ key: c.grant_id, node: <CouponTicket coupon={c} /> }))
    : []
  const emptyMessage =
    tab === 'historico' ? 'Nenhum cupom usado ainda.' : tab === 'ativos' ? 'Nenhum cupom ativo no momento.' : 'Nenhum cupom inativo.'

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
            // pb reserva espaço pro "papel" da referência, que estica bem
            // além da caixinha de 60px do slot (--cs-paper-height:320px) —
            // sem isso ele sobrepõe o carrossel de cupons logo abaixo.
            <div className="pb-[240px]">
              <CouponSlot
                size="lg"
                onClick={handleResgatarCupom}
                disabled={checkingClaim}
                ariaLabel="Resgatar cupom"
                header={checkingClaim ? '...' : 'CUPOM'}
                bodyLines={['Cupom Exclusivo', 'Toque pra resgatar', checkingClaim ? 'Verificando…' : 'Disponível agora']}
                footerLabel="Ação"
                footerValue="Resgatar"
              />
            </div>
          )}
          {loading || !data ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-son-silver-dim">
              <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>{emptyMessage}</p>
            </div>
          ) : (
            <ul
              ref={listRef}
              onScroll={handleCarouselScroll}
              className="flex gap-10 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 sm:-mx-6 px-12 sm:px-16 py-1"
            >
              {items.map((item, i) => (
                <li
                  key={item.key}
                  ref={(el) => {
                    cardRefs.current[i] = el
                  }}
                  className={`flex-shrink-0 snap-center sunset-coupon-card ${i === activeCardIndex ? 'sunset-coupon-card-active' : ''} ${tab === 'inativos' ? 'grayscale' : ''}`}
                >
                  {item.node}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PageTransition>
      <AnimatePresence>{showNoCoupon && <NoCouponToggle onClose={() => setShowNoCoupon(false)} />}</AnimatePresence>
    </main>
  )
}
