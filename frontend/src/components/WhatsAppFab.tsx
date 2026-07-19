import { MessageCircle } from 'lucide-react'

const WHATSAPP_URL =
  'https://api.whatsapp.com/send/?phone=5583987059373&text&type=phone_number&app_absent=0'

// Uiverse.io by Gaurang7717 — botão verde que expande no hover revelando
// texto. Renderizado exatamente como veio na referência (mesma estrutura,
// mesmas classes/motion), só recolorido com o verde oficial do WhatsApp
// (que já era a cor da referência) e com o ícone trocado pro que já é
// usado no resto do site.
export default function WhatsAppFab() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 left-6 z-40 sunset-wa-btn"
      aria-label="Falar no WhatsApp"
    >
      <span className="sunset-wa-btn-sign">
        <MessageCircle className="w-full h-full" fill="white" strokeWidth={0} />
      </span>
      <span className="sunset-wa-btn-text">Fale conosco</span>
    </a>
  )
}
