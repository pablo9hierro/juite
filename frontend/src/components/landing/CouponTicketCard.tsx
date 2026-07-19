import { useState } from 'react'

// "Cupom espiando pra fora de uma fenda" (Uiverse by dexter-st) — balança
// sozinho em loop (leve), e puxa mais pra fora ao interagir: tap no
// celular (não tem :hover de verdade), ou mouse em cima no PC (@media
// hover:hover no CSS). O ticket é o card holográfico com bordas
// perforadas do mesmo autor, reproduzido fiel à referência (mesmo
// filtro SVG #bump, mesmos elementos "notes"/"symbol") — só recolorido
// pra paleta sunset e populado com o conteúdo do cupom de fidelidade.
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
        <div className="sunset-holo-ticket">
          <span className="sunset-holo-ticket-notes">SUNSET</span>
          <span className="sunset-holo-ticket-notes">TABAS</span>
          <span className="sunset-holo-ticket-notes">SUNSET</span>

          <div className="sunset-holo-ticket-header">
            CUPOM
            <div className="sunset-holo-ticket-symbol">✁</div>
          </div>
          <div className="sunset-holo-ticket-body">
            <em>Fidelidade</em>
            <br />
            Sunset Tabas
            <br />
            João Pessoa, PB
          </div>
          <div className="sunset-holo-ticket-footer">
            <div className="sunset-holo-ticket-number">
              Nº <b>SNS-2026</b>
            </div>
            <div className="sunset-holo-ticket-barcode" />
          </div>

          <div className="sunset-holo-ticket-bg sunset-holo-ticket-holographic" />
          <svg className="sunset-holo-ticket-filter" width="0" height="0" aria-hidden="true">
            <filter id="sunsetTicketBump">
              <feTurbulence result="noise" numOctaves={3} baseFrequency={0.7} type="fractalNoise" />
              <feSpecularLighting
                in="noise"
                result="specular"
                lightingColor="#fffffc"
                specularExponent={25}
                specularConstant={0.8}
                surfaceScale={0.15}
              >
                <fePointLight z={210} y={100} x={100} />
              </feSpecularLighting>
              <feComposite result="noise2" operator="in" in="specular" in2="SourceGraphic" />
              <feBlend mode="screen" in2="noise2" in="SourceGraphic" />
            </filter>
          </svg>
        </div>
      </div>
    </button>
  )
}
