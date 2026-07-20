import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import WhatsAppFab from '../components/WhatsAppFab'
import CartFab from '../components/CartFab'
import LiveTrackingMapMock from '../components/landing/LiveTrackingMapMock'
import CouponTicketCard from '../components/landing/CouponTicketCard'
import LandingWhatsAppCard from '../components/landing/LandingWhatsAppCard'
import { api } from '../lib/api'
import type { Promotion, StoreStatus } from '../lib/types'
import { getStoreOpenState } from '../lib/storeHours'

function BannerCarousel() {
  const navigate = useNavigate()
  const [heroUrl, setHeroUrl] = useState<string | null>(null)
  const [promotions, setPromotions] = useState<Promotion[]>([])

  useEffect(() => {
    api.siteSettings.get().then((s) => setHeroUrl(s.hero_image_url)).catch(() => setHeroUrl(null))
    api.promotions.listActive().then(setPromotions).catch(() => setPromotions([]))
  }, [])

  const firstPromo = promotions[0]
  const bannerImage = firstPromo?.image_url ?? heroUrl
  const restPromos = firstPromo ? promotions.slice(1) : promotions

  const items = [
    { key: 'hero', image: bannerImage, label: firstPromo ? firstPromo.title : 'Sunset Tabas', onClick: firstPromo ? () => navigate(`/banner?promocao=${firstPromo.id}`) : undefined },
    ...restPromos.map((p) => ({ key: p.id, image: p.image_url, label: p.title, onClick: () => navigate(`/banner?promocao=${p.id}`) })),
  ].filter((it) => it.image)

  // Um card só que AGRUPA todos os banners/promoções — não um card por
  // item lado a lado (isso lia como "duplicado" com só 2 itens ativos).
  // Troca o conteúdo (imagem/título) sozinho a cada 4.5s quando há mais
  // de um item; clique sempre leva pro item que está em tela no momento.
  const [activeIndex, setActiveIndex] = useState(0)
  useEffect(() => {
    if (items.length < 2) return
    const timer = setInterval(() => setActiveIndex((i) => (i + 1) % items.length), 4500)
    return () => clearInterval(timer)
  }, [items.length])
  const active = items[activeIndex] ?? items[0]

  if (!active) return null

  return (
    <div className="sunset-book-row">
      {/* Uiverse.io by Javierrocadev — card com halo borrado atrás, tela
          branca com brilho passando de raspão (era só no :hover; aqui
          é loop contínuo) e rodapé título+seta. O carrossel continua
          sendo UM card só que troca de conteúdo sozinho (activeIndex
          acima) — clique leva pro item que está em tela no momento. */}
      <div
        key={active.key}
        className="sunset-jcard"
        role={active.onClick ? 'button' : undefined}
        tabIndex={active.onClick ? 0 : undefined}
        onClick={active.onClick}
        aria-label={active.label}
      >
        <div className="sunset-jcard-glow" />
        <div className="sunset-jcard-inner">
          <div className="sunset-jcard-screen" style={{ backgroundImage: `url(${active.image})` }} />
          <div className="sunset-jcard-footer">
            <div className="sunset-jcard-footer-text">
              <p>{active.label}</p>
              <p>Toque para ver</p>
            </div>
            <svg
              className="sunset-jcard-arrow"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5 12l14 0" />
              <path d="M13 18l6 -6" />
              <path d="M13 6l6 6" />
            </svg>
          </div>
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
          {/* "Continue" button — reproduzido fiel à referência (mesmo
              pill + círculo com seta), recolorido pro dourado do site
              (era branco/preto). Só na referência a seta desliza no
              :hover; aqui virou loop automático e contínuo (pedido
              explícito). */}
          <Link to="/catalogo" className="sunset-continue-btn w-full sm:w-auto">
            <span>Ver catálogo</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 74 74" height={34} width={34}>
              <circle strokeWidth={3} stroke="#081912" r="35.5" cy={37} cx={37} />
              <path
                fill="#081912"
                d="M25 35.5C24.1716 35.5 23.5 36.1716 23.5 37C23.5 37.8284 24.1716 38.5 25 38.5V35.5ZM49.0607 38.0607C49.6464 37.4749 49.6464 36.5251 49.0607 35.9393L39.5147 26.3934C38.9289 25.8076 37.9792 25.8076 37.3934 26.3934C36.8076 26.9792 36.8076 27.9289 37.3934 28.5147L45.8787 37L37.3934 45.4853C36.8076 46.0711 36.8076 47.0208 37.3934 47.6066C37.9792 48.1924 38.9289 48.1924 39.5147 47.6066L49.0607 38.0607ZM25 38.5L48 38.5V35.5L25 35.5V38.5Z"
              />
            </svg>
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
