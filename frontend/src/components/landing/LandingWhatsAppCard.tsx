import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import logoSrc from '../../assets/logo.png'

// Ícone que expande revelando texto ao interagir (Uiverse by Gaurang7717) +
// balão de notificação com avatar/nome (Uiverse by ZstarPanda0210, mesmo
// componente do WhatsAppFab) — tap no celular, hover no PC.
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
      <div className={`sunset-msg-btn absolute -top-3 left-1/2 -translate-x-1/2 ${open ? 'is-open' : ''}`}>
        <span className="sunset-msg-avatar-wrap">
          <span className="sunset-msg-avatar">
            <img src={logoSrc} alt="" />
          </span>
          <span className="sunset-msg-status" />
        </span>
        <span className="sunset-msg-content">
          <span className="sunset-msg-label">Saiu para entrega</span>
          <span className="sunset-msg-username">Sunset Tabas</span>
          <span className="sunset-msg-userid">@tabassunset</span>
        </span>
      </div>
    </div>
  )
}
