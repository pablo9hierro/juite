import type { CustomerCouponHistoryEntry } from '../lib/types'

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

function headline(h: CustomerCouponHistoryEntry) {
  if (h.discount_amount) return `-${currency(h.discount_amount)}`
  if (h.shipping_discount) return `-${currency(h.shipping_discount)} frete`
  return 'Cupom usado'
}

function kindLabel(h: CustomerCouponHistoryEntry) {
  if (h.discount_amount) return 'Desconto'
  if (h.shipping_discount) return 'Frete grátis'
  return 'Cupom'
}

// Mesma "Dev Pass" (Uiverse.io by zeeshan_2112, ver CouponTicket.tsx) —
// histórico não tem kind/discount_type/validade/usos (o pedido só
// guarda o código e quanto foi descontado naquela compra, não o
// cadastro do cupom em si), então os campos viraram o que dá pra saber
// de verdade sobre um cupom JÁ USADO: quanto economizou, quando, em
// qual pedido. "Restam" fica fixo em 0 — é literalmente verdade, esse
// uso específico já foi consumido.
export default function CouponHistoryTicket({ entry }: { entry: CustomerCouponHistoryEntry }) {
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
                <div className="sunset-t-type">{kindLabel(entry)}</div>
              </div>
              <div className="sunset-t-title">{headline(entry)}</div>
              <div className="sunset-t-subtitle">Cupom Sunset Tabas</div>
              <div className="sunset-t-details">
                <div className="sunset-t-detail-item">
                  <span className="sunset-t-label">Código</span>
                  <span className="sunset-t-value font-mono">{entry.coupon_code}</span>
                </div>
                <div className="sunset-t-detail-item">
                  <span className="sunset-t-label">Usado em</span>
                  <span className="sunset-t-value">{new Date(entry.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="sunset-t-detail-item">
                  <span className="sunset-t-label">Tipo</span>
                  <span className="sunset-t-value">{kindLabel(entry)}</span>
                </div>
                <div className="sunset-t-detail-item">
                  <span className="sunset-t-label">Pedido</span>
                  <span className="sunset-t-value font-mono">#{entry.order_id.slice(0, 8)}</span>
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
              <div className="sunset-t-barcode-id">{entry.coupon_code}</div>
            </div>
            <div className="sunset-t-admit">
              <div className="sunset-t-admit-text">Restam</div>
              <div className="sunset-t-admit-num">0</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
