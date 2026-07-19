import { motion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'

// Ícone do WhatsApp com um balãozinho apêndice no canto inferior direito —
// aparece/some em loop mostrando o tipo de aviso que o cliente recebe.
export default function WhatsAppBubbleIcon() {
  return (
    <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: '#25D366' }}>
        <MessageCircle className="w-8 h-8 text-white" fill="white" strokeWidth={1.5} />
      </div>
      <motion.div
        animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 0.85], y: [6, 0, 0, -4] }}
        transition={{ duration: 3, repeat: Infinity, repeatDelay: 1, times: [0, 0.2, 0.8, 1] }}
        className="absolute bottom-1 right-0 bg-white text-son-black text-[10px] font-bold px-2 py-1.5 rounded-lg rounded-br-none shadow-lg whitespace-nowrap"
      >
        Saiu para entrega!
      </motion.div>
    </div>
  )
}
