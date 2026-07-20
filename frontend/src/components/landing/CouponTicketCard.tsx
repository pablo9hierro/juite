import './CouponTicketCard.css'

// Uiverse.io by dexter-st — papel de cupom espiando pra fora de um
// corte na parede, balançando em loop contínuo (ver CouponTicketCard.css
// pra explicação da adaptação de cores). Passar o mouse revela "Frete
// -10%"; clicar (foco do botão) revela "Copiado!" — exatamente como na
// referência.
export default function CouponTicketCard() {
  return (
    <div className="sunset-cp-wrapper">
      <div className="sunset-cp-cutout-wrapper">
        <div className="sunset-cp-cutout" />
      </div>
      <div className="sunset-cp-paper-wrapper">
        <div className="sunset-cp-sec">
          <button type="button" className="sunset-cp-paper">
            <span className="sunset-cp-txt sunset-cp-copied">Copiado!</span>
            <span className="sunset-cp-txt sunset-cp-coupon">Frete -10%</span>
            <span className="sunset-cp-txt sunset-cp-hov">Cupom exclusivo</span>
          </button>
        </div>
      </div>
      <div className="sunset-cp-shadow-wrapper">
        <div className="sunset-cp-shadow" />
      </div>
      <div className="sunset-cp-cutter-wrapper">
        <div className="sunset-cp-cutter" />
      </div>
    </div>
  )
}
