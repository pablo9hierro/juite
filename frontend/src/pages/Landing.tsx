import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import WhatsAppFab from '../components/WhatsAppFab'
import CartFab from '../components/CartFab'
import LiveTrackingMapMock from '../components/landing/LiveTrackingMapMock'
import CouponTicketCard from '../components/landing/CouponTicketCard'
import LandingWhatsAppCard from '../components/landing/LandingWhatsAppCard'
import { api } from '../lib/api'
import type { Promotion, StoreStatus } from '../lib/types'
import { getStoreOpenState } from '../lib/storeHours'

// Um giro completo em 20s parado (igual a referência) quando ninguém
// mexe — arrastando, a velocidade/direção passa a seguir o dedo 1:1.
const AUTO_DEG_PER_MS = 360 / 20000
const DRAG_DEG_PER_PX = 0.6

function BannerCarousel() {
  const navigate = useNavigate()
  const [heroUrl, setHeroUrl] = useState<string | null>(null)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const ringRef = useRef<HTMLDivElement>(null)
  const centerRef = useRef<HTMLDivElement>(null)
  const rotationRef = useRef(0)
  const draggingRef = useRef(false)
  const lastXRef = useRef(0)

  useEffect(() => {
    api.siteSettings.get().then((s) => setHeroUrl(s.hero_image_url)).catch(() => setHeroUrl(null))
    api.promotions.listActive().then(setPromotions).catch(() => setPromotions([]))
  }, [])

  // Gira sozinho pra sempre (rAF, não CSS animation — precisa poder ser
  // "assumido" pelo arrasto a qualquer momento sem travar/reiniciar).
  // Arrastar NUNCA para o carrossel: enquanto o dedo está em cima, a
  // rotação segue o movimento 1:1; ao soltar, volta a girar sozinho de
  // onde parou, na mesma direção de sempre.
  useEffect(() => {
    let raf: number
    let last = performance.now()
    function tick(now: number) {
      const dt = now - last
      last = now
      if (!draggingRef.current) {
        rotationRef.current += AUTO_DEG_PER_MS * dt
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `perspective(800px) rotateY(${rotationRef.current}deg)`
      }
      // O texto do centro é filho do anel (participa do mesmo espaço 3D,
      // fica "dentro do cilindro"), mas gira na direção CONTRÁRIA do
      // anel — cancela a rotação do pai, então ele fica sempre de frente
      // pra câmera, suspenso no meio, com os cards passando ao redor.
      if (centerRef.current) {
        centerRef.current.style.transform = `translate(-50%, -50%) rotateY(${-rotationRef.current}deg)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = true
    lastXRef.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const dx = e.clientX - lastXRef.current
    lastXRef.current = e.clientX
    rotationRef.current += dx * DRAG_DEG_PER_PX
  }
  function endDrag() {
    draggingRef.current = false
  }

  const firstPromo = promotions[0]
  const bannerImage = firstPromo?.image_url ?? heroUrl
  const restPromos = firstPromo ? promotions.slice(1) : promotions

  const items = [
    { key: 'hero', image: bannerImage, label: firstPromo ? firstPromo.title : 'Sunset Tabas', onClick: firstPromo ? () => navigate(`/banner?promocao=${firstPromo.id}`) : undefined },
    ...restPromos.map((p) => ({ key: p.id, image: p.image_url, label: p.title, onClick: () => navigate(`/banner?promocao=${p.id}`) })),
  ].filter((it) => it.image)
  const n = Math.max(items.length, 1)

  return (
    <div className="sunset-3d-carousel-wrap">
      {/* Uiverse.io by musashi-13 — anel 3D giratório (mesmo perspective/
          rotateY/translateZ, mesma pulsação de brilho por card), mas a
          rotação é 100% controlada via JS (rAF) em vez de @keyframes CSS,
          pra poder responder ao arrasto do dedo sem nunca "travar" o
          carrossel — ele sempre volta a girar sozinho ao soltar. */}
      <div
        ref={ringRef}
        className="sunset-3d-carousel"
        style={{ '--quantity': n } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        {items.map((it, i) => (
          <div
            key={it.key}
            className="sunset-3d-carousel-item"
            role={it.onClick ? 'button' : undefined}
            tabIndex={it.onClick ? 0 : undefined}
            onClick={it.onClick}
            style={
              {
                transform: `translate(-50%, -50%) rotateY(${(360 / n) * i}deg) translateZ(85px)`,
                '--delay': `${-(i * (20 / n))}s`,
                backgroundImage: `url(${it.image})`,
              } as CSSProperties
            }
            aria-label={it.label}
          >
            <span className="sunset-3d-carousel-item-label">{it.label}</span>
          </div>
        ))}
        {/* Testando: fica DENTRO do espaço 3D do anel (translateZ(0), no
            eixo exato em que os cards giram ao redor), mas com rotação
            própria cancelando a do anel a cada frame — sempre de frente
            pra câmera, "suspenso" no meio do cilindro em vez de colado
            na tela por cima de tudo. */}
        <div ref={centerRef} className="sunset-3d-carousel-center">
          TEXTO
        </div>
      </div>
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
      <main className={`min-h-screen text-white overflow-hidden relative ${closed ? 'grayscale' : ''}`}>
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
          ].map((b) => (
            <span key={b.text} className="sunset-shine-badge">
              <span
                className={`sunset-shine-badge-inner px-4 py-2 text-xs sm:text-sm ${b.bold ? 'font-bold' : 'font-medium'} text-son-gold`}
              >
                {b.text}
              </span>
            </span>
          ))}
          {/* Vira botão de verdade (não só decorativo como os outros
              badges) — abre o endereço no Google Maps. Efeito de clique
              exato da referência (seta entrando/saindo + círculo
              expandindo + texto deslizando), recolorido pro dourado do
              site (era azul #1f387e). */}
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              'Rua Rosa de Paula Barbosa, 16 - José Américo de Almeida, João Pessoa - PB'
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="sunset-maps-btn text-xs sm:text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="arr-2" viewBox="0 0 24 24">
              <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
            </svg>
            <span className="text">📍 R. Rosa de Paula Barbosa, 16 - José Américo de Almeida. João Pessoa - PB</span>
            <span className="circle" />
            <svg xmlns="http://www.w3.org/2000/svg" className="arr-1" viewBox="0 0 24 24">
              <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
            </svg>
          </a>
          {[{ text: '👇 A vibe começa aqui' }].map((b) => (
            <span key={b.text} className="sunset-shine-badge">
              <span className="sunset-shine-badge-inner px-4 py-2 text-xs sm:text-sm font-medium text-son-gold">
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
