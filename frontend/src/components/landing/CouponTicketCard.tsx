// Uiverse.io by (dashboard "Income" card) — reproduzido fiel à
// referência (mesma estrutura: borda em gradiente animado, valor com
// efeito de "digitando", badge de variação, gráfico de 7 barras com
// bounce contínuo, tags, botão), só recolorido pro dourado/laranja do
// site (era um arco-íris magenta/roxo/ciano) e com o conteúdo adaptado
// pro programa de fidelidade em vez de um dashboard financeiro genérico.
export default function CouponTicketCard() {
  const days = [
    { label: 'D', height: 30, delay: '0.2s', pct: '5%', white: true },
    { label: 'S', height: 80, delay: '0.4s', pct: '-1,7%', white: false },
    { label: 'T', height: 50, delay: '0.6s', pct: '2,3%', white: true },
    { label: 'Q', height: 85, delay: '0.8s', pct: '-3,8%', white: false },
    { label: 'Q', height: 70, delay: '1s', pct: '6,3%', white: true },
    { label: 'S', height: 80, delay: '1.2s', pct: '-2,3%', white: false },
    { label: 'S', height: 60, delay: '1.4s', pct: '2,0%', white: true },
  ]

  return (
    <div className="sunset-income-card">
      <div className="sunset-income-bg-custom">
        <div className="sunset-income-flex">
          <p className="sunset-income-heading">Fidelidade</p>
          <span className="sunset-income-tag">
            <svg viewBox="0 0 925.1 925.1" xmlns="http://www.w3.org/2000/svg">
              <g>
                <g>
                  <path d="M453.5,26.514l-345.6,187.3l15.2-3.8l412.9-104.7l-35-64.6C491.8,23.614,470.5,17.313,453.5,26.514z" />
                  <path d="M780.9,222.313l-26.2-103.4c-4-15.9-18.3-26.4-33.9-26.4c-2.8,0-5.7,0.3-8.6,1.1l-160.5,40.7l-347.4,88.1H599.4h181.5V222.313z" />
                  <path d="M546.7,665.513v-176c0-36.699,29.8-66.5,66.5-66.5h218.6h16.5h16.5H878v-135.7c0-19.3-15.7-35-35-35h-21.5H805h-16.5H615.7H133.8h-16.5h-16.5h-64H35c-12.9,0-24.1,7-30.2,17.3c-3,5.2-4.8,11.2-4.8,17.7v5.6v574.9c0,19.301,15.7,35,35,35h807.9c19.3,0,35-15.699,35-35V732.114H613.2C576.5,732.114,546.7,702.214,546.7,665.513z" />
                  <path d="M908,459.513c-4.5-2.699-9.6-4.3-15-4.8c-1-0.1-1.9-0.1-2.9-0.1H878h-5.2h-16.5h-39.6H613.2c-19.3,0-35,15.7-35,35v176c0,19.299,15.7,35,35,35H878h12.1c1,0,1.9-0.102,2.9-0.102c5.4-0.398,10.5-2.1,15-4.799c10.2-6.1,17.1-17.301,17.1-30.1v-176C925.1,476.813,918.2,465.614,908,459.513z M700.5,634.313c-31.3,0-56.8-25.4-56.8-56.801c0-31.299,25.399-56.799,56.8-56.799c31.3,0,56.8,25.4,56.8,56.799C757.3,608.913,731.9,634.313,700.5,634.313z" />
                </g>
              </g>
            </svg>
          </span>
        </div>
        <div className="sunset-income-amount">
          <span className="sunset-income-typing">R$ 1.240</span>
          <span className="sunset-income-main-pr">↓ 26,5%</span>
        </div>
        <div className="sunset-income-compare">Comparado a R$ 1.687 gastos no mês passado</div>
      </div>
      <div className="sunset-income-tags">
        <span>Ver histórico</span>
        <span>Detalhes</span>
      </div>
      <div className="sunset-income-chart">
        {days.map((d, i) => (
          <div
            key={i}
            className={`sunset-income-bar ${d.white ? 'is-white' : ''}`}
            style={{ height: `${d.height}px`, animationDelay: d.delay }}
          >
            <div className={`sunset-income-pr-day ${!d.white ? 'is-red' : ''}`}>{d.pct}</div>
            <div className="sunset-income-bar-label">{d.label}</div>
          </div>
        ))}
      </div>
      <button type="button" className="sunset-income-more-button">
        Ver mais cupons
      </button>
    </div>
  )
}
