import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import heroBanner from '../assets/hero-banner.png'
import WhatsAppFab from '../components/WhatsAppFab'
import CartFab from '../components/CartFab'
import { api } from '../lib/api'
import type { Campaign } from '../lib/types'

const CAROUSEL_INTERVAL_MS = 2000

function BannerCarousel() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    api.campaigns.listActive().then(setCampaigns).catch(() => setCampaigns([]))
  }, [])

  useEffect(() => {
    if (campaigns.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % campaigns.length), CAROUSEL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [campaigns.length])

  const containerClass = 'relative z-10 block mx-6 sm:mx-10 mt-3 sm:mt-4 rounded-2xl overflow-hidden shadow-lg shadow-black/40'

  // Sem campanha registrada -> banner estático de sempre, só decorativo.
  if (campaigns.length === 0) {
    return (
      <div className={containerClass}>
        <img src={heroBanner} alt="Sunset Tabas" className="w-full h-auto block" />
      </div>
    )
  }

  const current = campaigns[index]
  return (
    <button
      type="button"
      onClick={() => navigate(`/checkout?campanha=${current.id}`)}
      className={`${containerClass} w-full text-left`}
      aria-label={current.title}
    >
      <img src={current.image_url} alt={current.title} className="w-full h-auto block" />
      {campaigns.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
          {campaigns.map((c, i) => (
            <span key={c.id} className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`} />
          ))}
        </div>
      )}
    </button>
  )
}

export default function Landing() {
  return (
    <main className="min-h-screen bg-son-black text-white overflow-hidden relative">
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-son-orange/20 blur-[120px]" />
      <div className="absolute top-20 -right-40 w-96 h-96 rounded-full bg-son-purple/25 blur-[120px]" />
      <div className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full bg-son-pink/15 blur-[120px]" />

      {/* Banner scrolls with the page (not fixed) — only the WhatsApp button stays put.
          Sem campanha ativa cadastrada, cai no banner estático de sempre; com
          campanha(s), vira um carrossel que troca a cada 2s e leva direto pro
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

      <section className="relative z-10 max-w-5xl mx-auto px-6 sm:px-10 pb-24 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { title: 'Catálogo completo', desc: 'Grade ou lista, do seu jeito, com estoque em tempo real.' },
          { title: 'Pix instantâneo', desc: 'QR code na hora, sem precisar sair da conversa.' },
          { title: 'Rastreio pelo WhatsApp', desc: 'Saiba exatamente quando seu pedido sai para entrega.' },
        ].map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="glass rounded-2xl p-6 text-left"
          >
            <h3 className="font-bold text-white mb-1.5">{f.title}</h3>
            <p className="text-sm text-son-silver-dim">{f.desc}</p>
          </motion.div>
        ))}
      </section>
    </main>
  )
}
