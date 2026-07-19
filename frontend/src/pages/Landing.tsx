import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Bike, MapPin, MessageCircle, Ticket, Zap } from 'lucide-react'
import heroBanner from '../assets/hero-banner.png'
import WhatsAppFab from '../components/WhatsAppFab'
import CartFab from '../components/CartFab'
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

  const containerClass = 'relative z-10 mx-6 sm:mx-10 mt-3 sm:mt-4 rounded-2xl overflow-hidden shadow-lg shadow-black/40'
  const safeIndex = index % slides.length
  const current = slides[safeIndex]

  return (
    <div className={`${containerClass} aspect-[2/1]`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.button
          key={current.kind === 'hero' ? 'hero' : current.promotion.id}
          type="button"
          onClick={() => {
            if (current.kind === 'promotion') navigate(`/banner?promocao=${current.promotion.id}`)
          }}
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 w-full h-full text-left"
          aria-label={current.kind === 'promotion' ? current.promotion.title : 'Sunset Tabas'}
        >
          <img
            src={current.kind === 'hero' ? heroUrl ?? heroBanner : current.promotion.image_url}
            alt=""
            className="w-full h-full object-cover block"
          />
        </motion.button>
      </AnimatePresence>
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

// Mock ilustrativo (não é mapa de verdade) — um motoboy deslizando por uma
// rua estilizada até um pin de destino, em loop, só pra dar vida ao card de
// rastreio ao vivo.
function MotoboyMapMock() {
  return (
    <div className="relative h-20 rounded-xl bg-black/20 border border-white/5 overflow-hidden mt-4">
      <svg viewBox="0 0 200 80" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <path
          d="M 8 62 C 40 62, 50 30, 85 30 C 115 30, 125 15, 185 15"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="6 6"
          strokeLinecap="round"
          className="text-white/15"
        />
      </svg>
      <MapPin className="w-4 h-4 text-son-pink absolute -translate-x-1/2 -translate-y-full" style={{ left: '93%', top: '19%' }} />
      <motion.div
        className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full sunset-bg flex items-center justify-center shadow-[0_0_10px_rgba(224,138,58,0.7)]"
        animate={{ left: ['4%', '25%', '42%', '62%', '92%'], top: ['77%', '44%', '37%', '21%', '19%'] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }}
      >
        <Bike className="w-3 h-3 text-white" />
      </motion.div>
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
      <main className={`min-h-screen bg-son-black text-white overflow-hidden relative ${closed ? 'grayscale' : ''}`}>
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
          <span className="px-4 py-2 rounded-full glass text-xs sm:text-sm font-bold text-son-gold">
            SUNSET • Desde 2023
          </span>
          <span className="px-4 py-2 rounded-full glass text-xs sm:text-sm font-medium text-son-silver">
            🔥 Experiência, vibe e essência
          </span>
          <span className="px-4 py-2 rounded-full glass text-xs sm:text-sm font-medium text-son-silver">
            📍 R. Rosa de Paula Barbosa, 16 - José Américo de Almeida. João Pessoa - PB
          </span>
          <span className="px-4 py-2 rounded-full glass text-xs sm:text-sm font-semibold text-son-gold">
            👇 A vibe começa aqui
          </span>
        </motion.div>
      </section>

      <section className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 pb-24 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            icon: Zap,
            title: 'Pix na hora, entrega com agilidade',
            desc: 'Pague no Pix e receba na sua casa rapidinho — confirmação automática, sem enrolação.',
          },
          {
            icon: MessageCircle,
            title: 'Atualizações direto no seu WhatsApp',
            desc: 'Confirmado, pronto, saiu pra entrega — você acompanha cada etapa sem precisar ficar recarregando a tela.',
          },
          {
            icon: MapPin,
            title: 'Acompanhe a entrega em tempo real',
            desc: 'Assim que seu pedido sai, você vê o trajeto do motoboy no mapa, ao vivo, até chegar na sua porta.',
            mock: true,
          },
          {
            icon: Ticket,
            title: 'Cupons exclusivos de fidelidade',
            desc: 'Participe das campanhas e ganhe cupons de desconto e de frete grátis só pra quem já é nosso cliente.',
          },
        ].map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="glass rounded-2xl p-6 text-left"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-8 h-8 rounded-lg sunset-bg flex items-center justify-center flex-shrink-0">
                <f.icon className="w-4 h-4 text-white" />
              </span>
              <h3 className="font-bold text-white">{f.title}</h3>
            </div>
            <p className="text-sm text-son-silver-dim">{f.desc}</p>
            {f.mock && <MotoboyMapMock />}
          </motion.div>
        ))}
      </section>
      </main>
    </>
  )
}
