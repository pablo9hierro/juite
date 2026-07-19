import { motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'

// Ícone do WhatsApp com um balãozinho apêndice no canto inferior direito —
// aparece/some em loop (bem devagar) mostrando o tipo de aviso que o
// cliente recebe.
export default function WhatsAppBubbleIcon() {
  return (
    <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#25D366' }}>
        <MessageCircle className="w-6 h-6 text-white" fill="white" strokeWidth={1.5} />
      </div>
      <motion.div
        animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 0.85], y: [6, 0, 0, -4] }}
        transition={{ duration: 11, repeat: Infinity, repeatDelay: 3, times: [0, 0.15, 0.85, 1] }}
        className="absolute bottom-0 right-0 bg-white text-son-black text-[9px] font-bold px-1.5 py-1 rounded-lg rounded-br-none shadow-lg whitespace-nowrap"
      >
        Saiu para entrega!
      </motion.div>
    </div>
  )
}
