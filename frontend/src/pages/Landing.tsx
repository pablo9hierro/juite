import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import heroBanner from '../assets/hero-banner.png'
import WhatsAppFab from '../components/WhatsAppFab'
import CartFab from '../components/CartFab'
import LiveTrackingMapMock from '../components/landing/LiveTrackingMapMock'
import CouponTicketCard from '../components/landing/CouponTicketCard'
import LandingWhatsAppCard from '../components/landing/LandingWhatsAppCard'
import { api } from '../lib/api'
import type { Promotion, StoreStatus } from '../lib/types'
import { getStoreOpenState } from '../lib/storeHours'

const CAROUSEL_INTERVAL_MS = 2000

type Slide = { kind: 'hero' } | { kind: 'promotion'; promotion: Promotion }

function BannerCarousel() {
  const navigate = useNavigate()
  const [heroUrl, setHeroUrl] = useState<string | null>(null)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    api.siteSettings.get().then((s) => setHeroUrl(s.hero_image_url)).catch(() => setHeroUrl(null))
    api.promotions.listActive().then(setPromotions).catch(() => setPromotions([]))
  }, [])

  // Imagem inicial é sempre a primeira do carrossel — mesmo com promoções
  // cadastradas — só depois ele desliza pras promoções, em loop.
  const slides: Slide[] = [{ kind: 'hero' }, ...promotions.map((p) => ({ kind: 'promotion' as const, promotion: p }))]

  useEffect(() => {
    if (slides.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), CAROUSEL_INTERVAL_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides.length])

  const containerClass =
    'relative z-10 mx-6 sm:mx-10 mt-3 sm:mt-4 rounded-2xl overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/5'
  const safeIndex = index % slides.length

  return (
    <div className={`${containerClass} aspect-[2/1]`}>
      {/* Trilho clássico de carrossel: TODOS os slides ficam lado a lado
          num flex row, e o que anima é só o deslocamento horizontal do
          trilho inteiro (translateX de -N*100%) — um empurra o outro pra
          fora enquanto o próximo entra, sempre na mesma direção (esquerda).
          Trocar de slide via key/AnimatePresence (mount/unmount) tinha essa
          armadilha: se o slide de saída não tivesse terminado de desmontar
          antes do novo montar, o corte ficava seco em vez de deslizar — o
          trilho não tem esse problema porque nada desmonta, só translada. */}
      <motion.div
        className="flex h-full"
        animate={{ x: `-${safeIndex * 100}%` }}
        transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
      >
        {slides.map((s) => (
          <motion.button
            key={s.kind === 'hero' ? 'hero' : s.promotion.id}
            type="button"
            onClick={() => {
              if (s.kind === 'promotion') navigate(`/banner?promocao=${s.promotion.id}`)
            }}
            // Pulsação leve e contínua — sinaliza "isso é clicável" sem
            // depender de hover (a maioria de quem visita está no celular).
            animate={{ scale: [1, 1.015, 1] }}
            transition={{ scale: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } }}
            className="relative h-full text-left flex-shrink-0"
            style={{ width: '100%' }}
            aria-label={s.kind === 'promotion' ? s.promotion.title : 'Sunset Tabas'}
          >
            <img
              src={s.kind === 'hero' ? heroUrl ?? heroBanner : s.promotion.image_url}
              alt=""
              className="w-full h-full object-cover block"
            />
          </motion.button>
        ))}
      </motion.div>
      <div className="sunset-banner-sweep" />
      {slides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
          {slides.map((s, i) => (
            <span
              key={s.kind === 'hero' ? 'hero' : s.promotion.id}
              className={`w-1.5 h-1.5 rounded-full ${i === safeIndex ? 'bg-white' : 'bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Landing() {
  const [storeStatus, setStoreStatus] = useState<StoreStatus | null>(null)

  useEffect(() => {
    api.storeStatus.get().then(setStoreStatus).catch(() => setStoreStatus(null))
  }, [])

  const openState = storeStatus ? getStoreOpenState(storeStatus) : null
  const closed = !!openState && !openState.open

  return (
    <>
      {closed && (
        <div className="relative z-20 bg-red-500/15 border-b border-red-500/40 text-red-200 text-sm text-center px-4 py-3">
          <span className="font-semibold">Loja fechada no momento.</span>{' '}
          {openState?.reason || 'Fora do nosso horário de funcionamento — volte mais tarde!'}
        </div>
      )}
      <main className={`min-h-screen bg-son-black/85 text-white overflow-hidden relative ${closed ? 'grayscale' : ''}`}>
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-son-orange/20 blur-[120px]" />
      <div className="absolute top-20 -right-40 w-96 h-96 rounded-full bg-son-purple/25 blur-[120px]" />
      <div className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full bg-son-pink/15 blur-[120px]" />

      {/* Banner scrolls with the page (not fixed) — only the WhatsApp button stays put.
          Sem promoção ativa cadastrada, cai no banner estático de sempre; com
          promoção(ões), vira um carrossel que troca a cada 2s e leva direto pro
          checkout com o desconto já aplicado. */}
      <BannerCarousel />

      <WhatsAppFab />
      <CartFab />

      <section className="relative z-10 max-w-4xl mx-auto px-6 sm:px-10 pt-8 sm:pt-10 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/catalogo" className="btn-primary text-base px-8 py-4 w-full sm:w-auto">
            Ver catálogo
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/consultar" className="btn-secondary text-base px-8 py-4 w-full sm:w-auto">
            Acompanhar meu pedido
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-wrap justify-center gap-2 mt-10"
        >
          {[
            { text: 'SUNSET • Desde 2023', bold: true },
            { text: '🔥 Experiência, vibe e essência' },
            { text: '📍 R. Rosa de Paula Barbosa, 16 - José Américo de Almeida. João Pessoa - PB' },
            { text: '👇 A vibe começa aqui' },
          ].map((b) => (
            <span key={b.text} className="sunset-shine-badge">
              <span
                className={`sunset-shine-badge-inner px-4 py-2 text-xs sm:text-sm ${b.bold ? 'font-bold' : 'font-medium'} text-son-gold`}
              >
                {b.text}
              </span>
            </span>
          ))}
        </motion.div>
      </section>

      <section className="relative z-10 max-w-2xl mx-auto px-6 sm:px-10 pb-16 flex flex-col gap-2">
        {[
          {
            title: 'Acompanhe a entrega em tempo real',
            desc: 'Assim que seu pedido sai, você vê o trajeto do motoboy no mapa, ao vivo, até chegar na sua porta.',
            graphic: <LiveTrackingMapMock />,
          },
          {
            title: 'Atualizações direto no seu WhatsApp',
            desc: 'Confirmado, pronto, saiu pra entrega — você acompanha cada etapa sem precisar ficar recarregando a tela.',
            graphic: <LandingWhatsAppCard />,
          },
          {
            title: 'Cupons exclusivos de fidelidade',
            desc: 'Participe das campanhas e ganhe cupons de desconto e de frete grátis só pra quem já é nosso cliente.',
            graphic: <CouponTicketCard />,
          },
        ].map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="glass rounded-2xl p-3 text-left flex items-center gap-3 shadow-[8px_10px_20px_-6px_rgba(0,0,0,0.6)]"
          >
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-white mb-0.5">{f.title}</h3>
              <p className="text-xs text-son-silver-dim leading-snug">{f.desc}</p>
            </div>
            {f.graphic}
          </motion.div>
        ))}
      </section>
      </main>
    </>
  )
}
