import { motion } from 'framer-motion'

// Uiverse.io by preet_7613 — rostinho triste com olhos piscando e boca se
// mexendo, traços em dash-array "desenhando" em loop (era só :hover,
// virou looping contínuo — mobile não tem hover). Recolorido pro
// dourado/prata sunset, com uma lágrima caindo (referência pedia
// "sad/crying face"). Aparece quando o cliente clica em "Resgatar cupom"
// e não tem nenhum cupom pendente pra resgatar.
export default function NoCouponToggle({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="sunset-nocoupon-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} className="sunset-nocoupon-close" aria-label="Fechar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M4 4l16 16M20 4L4 20" />
          </svg>
        </button>
        <svg className="sunset-nocoupon-face" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="38" className="sunset-nocoupon-outline" />
          <ellipse cx="35" cy="42" rx="4.5" ry="6" className="sunset-nocoupon-eye sunset-nocoupon-eye-l" />
          <ellipse cx="65" cy="42" rx="4.5" ry="6" className="sunset-nocoupon-eye sunset-nocoupon-eye-r" />
          <path d="M33 66 Q50 54 67 66" className="sunset-nocoupon-mouth" />
          <path d="M65 50 C65 56 60 58 60 63 C60 67 63 70 66 70 C69 70 72 67 72 63 C72 58 65 56 65 50 Z" className="sunset-nocoupon-tear" />
        </svg>
        <p className="sunset-nocoupon-title">Nenhum cupom pra resgatar</p>
        <p className="sunset-nocoupon-message">Você ainda não tem nenhum cupom disponível pra resgatar no momento. Fique de olho, novidades chegam por aí!</p>
      </motion.div>
    </motion.div>
  )
}
