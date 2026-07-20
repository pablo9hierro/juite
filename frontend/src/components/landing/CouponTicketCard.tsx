// Uiverse.io by dexter-st — clone exato do "ticket" perfurado (mesmo
// filtro de bump-map SVG, mesmas máscaras radiais de perfuração +
// entalhe lateral + linha pontilhada de corte, mesmo efeito holográfico
// com blend modes), só deitado na horizontal (era vertical 180x320) e
// recolorido pro dourado/laranja do site (era um holográfico
// magenta/ciano). "TICKET" virou "CUPOM FIDELIDADE" e o conteúdo é o
// programa de fidelidade da Sunset Tabas.
export default function CouponTicketCard() {
  return (
    <div className="sunset-ticket-card">
      <div className="sunset-ticket-notes">🔥🔥🔥🔥🔥</div>
      <div className="sunset-ticket-notes">🔥🔥🔥🔥</div>
      <div className="sunset-ticket-notes">🔥🔥🔥🔥🔥</div>

      <div className="sunset-ticket-header">
        CUPOM FIDELIDADE
        <div className="sunset-ticket-symbol">✁</div>
      </div>
      <div className="sunset-ticket-body">
        <em>10% de desconto</em>
        <br />
        Sunset Tabas, João Pessoa
      </div>
      <div className="sunset-ticket-footer">
        <div className="sunset-ticket-number">
          Código <span className="sunset-ticket-bold">FIEL10</span>
        </div>
        <div className="sunset-ticket-barcode" />
      </div>

      <div className="sunset-ticket-bg sunset-ticket-holographic" />
      <svg className="sunset-ticket-filter">
        <filter id="sunsetTicketBump">
          <feTurbulence result="noise" numOctaves={3} baseFrequency={0.7} type="fractalNoise" />
          <feSpecularLighting in="noise" result="specular" lightingColor="#fffffc" specularExponent={25} specularConstant={0.8} surfaceScale={0.15}>
            <fePointLight z={210} y={100} x={100} />
          </feSpecularLighting>
          <feComposite result="noise2" operator="in" in="specular" in2="SourceGraphic" />
          <feBlend mode="screen" in2="noise2" in="SourceGraphic" />
        </filter>
      </svg>
    </div>
  )
}
