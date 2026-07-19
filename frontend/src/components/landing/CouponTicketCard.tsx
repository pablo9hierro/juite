import { useState } from 'react'

// "Cupom espiando pra fora de uma fenda" (Uiverse by dexter-st) — balança
// sozinho em loop (leve), e puxa mais pra fora ao interagir: tap no
// celular (não tem :hover de verdade), ou mouse em cima no PC (@media
// hover:hover no CSS). O ticket em si é o card holográfico com bordas
// perforadas do mesmo autor, reproduzido fiel à referência — o filtro
// #sunsetTicketBump (textura de papel em relevo usada na máscara de
// picote) vive aqui, embutido como SVG de 0x0 (não precisa aparecer,
// só ser referenciável via CSS `filter: url(#sunsetTicketBump)`).
export default function CouponTicketCard() {
  const [open, setOpen] = useState(false)

  return (
    <button
      type="button"
      onClick={() => setOpen((o) => !o)}
      className={`sunset-coupon-slot ${open ? 'is-open' : ''}`}
      aria-label="Ver cupom de fidelidade"
    >
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="sunsetTicketBump">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} result="noise" />
          <feDiffuseLighting in="noise" lightingColor="#fff" surfaceScale="1" result="light">
            <feDistantLight azimuth={45} elevation={60} />
          </feDiffuseLighting>
          <feComposite in="light" in2="SourceGraphic" operator="in" />
        </filter>
      </svg>
      <div className="sunset-coupon-ticket">
        <div className="sunset-holo-ticket">
          <div className="sunset-holo-ticket-bg" />
          <div className="sunset-holo-ticket-bg sunset-holo-ticket-holo" />
          <span className="sunset-holo-ticket-notes">SUNSET</span>
          <span className="sunset-holo-ticket-notes">SUNSET</span>
          <span className="sunset-holo-ticket-notes">SUNSET</span>
          <div className="sunset-holo-ticket-header">CUPOM</div>
          <div className="sunset-holo-ticket-body">Fidelidade Sunset Tabas</div>
          <div className="sunset-holo-ticket-footer">
            <div className="sunset-holo-ticket-number">
              Nº <b>SNS-2026</b>
            </div>
            <div className="sunset-holo-ticket-barcode" />
          </div>
        </div>
      </div>
    </button>
  )
}
