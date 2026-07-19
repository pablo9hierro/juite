import { MessageCircle } from 'lucide-react'

const WHATSAPP_URL =
  'https://api.whatsapp.com/send/?phone=5583987059373&text&type=phone_number&app_absent=0'

// Mesmo botão exato do Uiverse by Gaurang7717 usado no WhatsAppFab
// (bottom-6 left-6) — reaproveita as mesmas classes .sunset-wa-btn pra
// garantir que é literalmente o mesmo componente/motion em todo canto que
// "o container do WhatsApp" aparece no site, não uma versão aproximada.
export default function LandingWhatsAppCard() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="sunset-wa-btn flex-shrink-0"
      aria-label="Falar no WhatsApp"
    >
      <span className="sunset-wa-btn-sign">
        <MessageCircle className="w-full h-full" fill="white" strokeWidth={0} />
      </span>
      <span className="sunset-wa-btn-text">Fale conosco</span>
    </a>
  )
}
