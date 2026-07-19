import { motion } from 'framer-motion'
import { TicketPercent } from 'lucide-react'

// Badge do cupom com uma faixa dourada "laminada" varrendo na diagonal, de
// cima-esquerda pra baixo-direita, em loop — efeito de brilho/reflexo de
// luz passando por cima, não é um ícone de outro tipo.
export default function CouponShineIcon() {
  return (
    <div className="relative w-16 h-16 flex-shrink-0 rounded-xl bg-son-gold/10 border border-son-gold/30 flex items-center justify-center overflow-hidden">
      <TicketPercent className="w-7 h-7 text-son-gold" strokeWidth={1.5} />
      <motion.div
        className="absolute top-0 bottom-0 w-6 -skew-x-[20deg]"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)' }}
        animate={{ left: ['-30%', '130%'] }}
        transition={{ duration: 3.2, repeat: Infinity, repeatDelay: 2.4, ease: 'easeInOut' }}
      />
    </div>
  )
}
