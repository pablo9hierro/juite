import logoSrc from '../assets/logo.png'

const WHATSAPP_URL =
  'https://api.whatsapp.com/send/?phone=5583987059373&text&type=phone_number&app_absent=0'

// Floating WhatsApp button — fixed to the viewport (follows scroll).
// Ícone balança sozinho (Uiverse by esraaabdel-kareem, só o "shake"),
// fumaça sobe atrás dele em loop (mesma referência, adaptada — mais
// opaca/quente) e um brilho de fogo pulsa por trás, um pouco maior que o
// botão (Uiverse by SelfMadeSystem, simplificado pra um glow em vez da
// física de partícula original). O balão que aparece por cima é o
// componente completo de "mensagem" (Uiverse by ZstarPanda0210) com o
// logo da loja como avatar.
export default function WhatsAppFab() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 left-6 z-40 group"
      aria-label="Falar no WhatsApp"
    >
      <div className="relative w-16 h-16">
        <div className="sunset-fire-glow" />
        <span className="sunset-smoke" style={{ left: '32%', animationDelay: '0s' }} />
        <span className="sunset-smoke" style={{ left: '50%', animationDelay: '1s' }} />
        <span className="sunset-smoke" style={{ left: '68%', animationDelay: '2s' }} />
        <div className="relative z-10 w-16 h-16 rounded-full overflow-hidden bg-son-black glow group-hover:scale-105 transition-transform">
          <img src={logoSrc} alt="" className="sunset-shake w-full h-full object-cover" />
        </div>
      </div>
      <div className="sunset-msg-btn absolute -top-3 -right-4 z-20">
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
    </a>
  )
}
