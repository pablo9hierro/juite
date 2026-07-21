import type { CouponKind, DiscountType } from '../lib/types'

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

const KIND_LABEL: Record<CouponKind, string> = {
  desconto: 'Desconto',
  frete: 'Frete grátis',
  aniversario: 'Aniversário',
  produto: 'Produto',
}

export interface CouponTicketData {
  code: string
  kind: CouponKind
  discount_type: DiscountType | null
  discount_value: number | null
  shipping_discount_type: DiscountType | null
  shipping_discount_value: number | null
  granted_uses: number
  used_count: number
  expires_at: string | null
}

function discountHeadline(c: CouponTicketData) {
  if (c.discount_type && c.discount_value != null) {
    return c.discount_type === 'percent' ? `-${c.discount_value}%` : `-${currency(c.discount_value)}`
  }
  if (c.shipping_discount_type && c.shipping_discount_value != null) {
    return c.shipping_discount_type === 'percent' ? `-${c.shipping_discount_value}% frete` : `-${currency(c.shipping_discount_value)} frete`
  }
  return 'Cupom'
}

// Uiverse.io by zeeshan_2112 — "Dev Pass" ticket com fundo em grade
// animada, brilho diagonal cruzando no hover, recorte perfurado e canhoto
// com código de barras + número em destaque. Clone integral, recolorido
// pro dourado/laranja sunset (era roxo). Campos do ingresso viraram campos
// do cupom: título = valor do desconto, detalhes = código/validade/tipo/
// usos, "assento" do canhoto = quantos usos ainda restam. Sem mouse
// (mobile), o tilt vira um loop suave contínuo; com mouse (desktop), o
// :hover assume o tilt dramático da referência.
export default function CouponTicket({ coupon }: { coupon: CouponTicketData }) {
  const remaining = Math.max(0, coupon.granted_uses - coupon.used_count)
  return (
    <div className="sunset-ticket-canvas">
      <div className="sunset-ticket-wrapper">
        <div className="sunset-ticket">
          <div className="sunset-t-main">
            <div className="sunset-t-content">
              <div className="sunset-t-header">
                <div className="sunset-t-logo">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  SUNSET
                </div>
                <div className="sunset-t-type">{KIND_LABEL[coupon.kind]}</div>
              </div>
              <div className="sunset-t-title">{discountHeadline(coupon)}</div>
              <div className="sunset-t-subtitle">Cupom Sunset Tabas</div>
              <div className="sunset-t-details">
                <div className="sunset-t-detail-item">
                  <span className="sunset-t-label">Código</span>
                  <span className="sunset-t-value font-mono">{coupon.code}</span>
                </div>
                <div className="sunset-t-detail-item">
                  <span className="sunset-t-label">Validade</span>
                  <span className="sunset-t-value">{coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString('pt-BR') : 'Sem validade'}</span>
                </div>
                <div className="sunset-t-detail-item">
                  <span className="sunset-t-label">Tipo</span>
                  <span className="sunset-t-value">{KIND_LABEL[coupon.kind]}</span>
                </div>
                <div className="sunset-t-detail-item">
                  <span className="sunset-t-label">Usos</span>
                  <span className="sunset-t-value">
                    {coupon.used_count}/{coupon.granted_uses}
                  </span>
                </div>
              </div>
            </div>
            <div className="sunset-t-perforation">
              <div className="sunset-t-perf-line" />
            </div>
          </div>
          <div className="sunset-t-stub">
            <div className="sunset-t-barcode-container">
              <div className="sunset-t-barcode" />
              <div className="sunset-t-barcode-id">{coupon.code}</div>
            </div>
            <div className="sunset-t-admit">
              <div className="sunset-t-admit-text">Restam</div>
              <div className="sunset-t-admit-num">{remaining}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
