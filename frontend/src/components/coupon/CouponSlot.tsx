import type { CSSProperties, ReactNode } from 'react'
import TicketCardVisual from './TicketCardVisual'

// Uiverse.io by dexter-st — "papel" espiando pra fora de um corte na
// parede (3D real via perspective, não só sombra), em loop contínuo
// cobrindo os 3 estados que a referência só tinha via :hover/:focus/
// :active: espiando parado, revelado até a metade, e puxado pra fora
// por completo — depois volta e recomeça. Sem mouse (celular) isso
// substitui perfeitamente o :hover; quando `onClick` é passado, o botão
// continua 100% funcional (o clique dispara a ação normalmente,
// independente de qual quadro da animação está em tela). Sem `onClick`,
// vira decorativo (usado no card da landing).
export default function CouponSlot({
  header,
  bodyLines,
  footerLabel,
  footerValue,
  onClick,
  disabled,
  size = 'lg',
  ariaLabel,
}: {
  header: ReactNode
  bodyLines: ReactNode[]
  footerLabel: string
  footerValue: string
  onClick?: () => void
  disabled?: boolean
  size?: 'sm' | 'lg'
  ariaLabel?: string
}) {
  const vars = (
    size === 'sm'
      ? { '--cs-width': '110px', '--cs-paper-height': '190px' }
      : { '--cs-width': '190px', '--cs-paper-height': '320px' }
  ) as CSSProperties

  const interactive = !!onClick

  return (
    <div className="sunset-cs-wrapper" style={vars}>
      {interactive && (
        <div className="sunset-cs-bubble-wrap">
          <span className="sunset-cs-bubble sunset-cs-bubble-top" aria-hidden="true" />
          <span className="sunset-cs-bubble sunset-cs-bubble-bottom" aria-hidden="true" />
        </div>
      )}
      <div className="sunset-cs-cutout-wrapper">
        <div className="sunset-cs-cutout" />
      </div>
      <div className="sunset-cs-paper-wrapper">
        <div className={`sunset-cs-sec ${size === 'sm' ? 'sunset-cs-sec-sm' : ''}`}>
          <button
            type="button"
            className="sunset-cs-paper"
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            tabIndex={interactive ? 0 : -1}
            aria-hidden={!interactive}
            style={{ pointerEvents: interactive ? 'all' : 'none', cursor: interactive ? 'pointer' : 'default' }}
          >
            <TicketCardVisual header={header} bodyLines={bodyLines} footerLabel={footerLabel} footerValue={footerValue} />
          </button>
        </div>
      </div>
      <div className="sunset-cs-shadow-wrapper">
        <div className="sunset-cs-shadow" />
      </div>
      <div className="sunset-cs-cutter-wrapper">
        <div className="sunset-cs-cutter" />
      </div>
    </div>
  )
}
