import { useState } from 'react'
import { TicketPercent } from 'lucide-react'

// "Cupom espiando pra fora de uma fenda" (Uiverse by dexter-st) — balança
// sozinho em loop (leve), e puxa mais pra fora ao interagir: tap no
// celular (não tem :hover de verdade), ou mouse em cima no PC (@media
// hover:hover no CSS). O card em si é o design de brilho do Uiverse by
// Tiagoadag (moldura em gradiente + card interno que encolhe revelando
// a borda), recolorido pra paleta sunset.
export default function CouponTicketCard() {
  const [open, setOpen] = useState(false)

  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className={`sunset-coupon-slot ${open ? 'is-open' : ''}`}
      aria-label="Ver cupom de fidelidade"
    >
      <div className="sunset-coupon-ticket">
        <div className="sunset-glow-card">
          <div className="sunset-glow-card-inner">
            <TicketPercent className="w-6 h-6 text-son-gold" strokeWidth={1.5} />
            <span className="sunset-glow-card-title">Fidelidade</span>
            <span className="sunset-glow-card-sub">Sunset Tabas</span>
          </div>
        </div>
      </div>
    </button>
  )
}
