import logoSrc from '../assets/logo.png'

const WHATSAPP_URL =
  'https://api.whatsapp.com/send/?phone=5583987059373&text&type=phone_number&app_absent=0'

// Floating WhatsApp button — fixed to the viewport (follows scroll).
// Ícone balança sozinho (Uiverse by esraaabdel-kareem, só o "shake"),
// fumaça sobe atrás dele em loop (mesma referência, mais densa/opaca).
// O brilho de fogo foi retirado por pedido explícito.
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
        <span className="sunset-smoke" style={{ left: '22%', animationDelay: '0s' }} />
        <span className="sunset-smoke" style={{ left: '38%', animationDelay: '0.6s' }} />
        <span className="sunset-smoke" style={{ left: '50%', animationDelay: '1.2s' }} />
        <span className="sunset-smoke" style={{ left: '62%', animationDelay: '1.8s' }} />
        <span className="sunset-smoke" style={{ left: '78%', animationDelay: '2.4s' }} />
        <div className="relative z-10 w-16 h-16 rounded-full overflow-hidden bg-son-black glow group-hover:scale-105 transition-transform">
          <img src={logoSrc} alt="" className="sunset-shake w-full h-full object-cover" />
        </div>
      </div>
    </a>
  )
}
