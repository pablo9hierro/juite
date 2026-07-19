import { useState } from 'react'
import { MessageCircle } from 'lucide-react'

// Ícone que expande revelando texto ao interagir (Uiverse by Gaurang7717) —
// tap no celular, hover no PC.
export default function LandingWhatsAppCard() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex-shrink-0" style={{ width: 44, height: 44 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`sunset-whatsapp-pill ${open ? 'is-open' : ''}`}
        aria-label="Chamar no WhatsApp"
      >
        <span className="sunset-whatsapp-pill-icon">
          <MessageCircle className="w-5 h-5 text-white" fill="white" strokeWidth={1.5} />
        </span>
        <span className="sunset-whatsapp-pill-text">Chamar no WhatsApp</span>
      </button>
    </div>
  )
}
