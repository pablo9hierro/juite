import { useState } from 'react'
import { TicketPercent } from 'lucide-react'

// "Cupom espiando pra fora de uma fenda" — balança sozinho em loop (leve),
// e puxa mais pra fora ao interagir: tap no celular (não tem :hover de
// verdade), ou mouse em cima no PC (@media hover:hover no CSS). O visual
// do cupom em si é um ticket/boarding-pass (grade animada + brilho
// diagonal), tudo na paleta sunset.
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
        <div className="sunset-ticket">
          <div className="sunset-ticket-num">
            <TicketPercent className="w-7 h-7" strokeWidth={1.5} />
          </div>
        </div>
      </div>
    </button>
  )
}
