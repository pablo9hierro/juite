import { Link, useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import SunsetCartIcon from '../SunsetCartIcon'
import { useCart } from '../../store/cart'

// O logo clicável (header > div > a > img) foi retirado de todas as
// páginas de cliente a pedido — só sobra o "Voltar" do lado esquerdo.
export default function SiteHeader({
  showBack = true,
  showCart = true,
  showProfile = true,
  title,
}: {
  showBack?: boolean
  showCart?: boolean
  showProfile?: boolean
  title?: string
}) {
  const navigate = useNavigate()
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  return (
    <header className="px-5 sm:px-10 pt-5 max-w-6xl mx-auto">
      {/* Uiverse.io by Zain-Muhammad — moldura de 3 abas virou a moldura
          do navbar (voltar / nome da página / favoritos). */}
      <div className="sunset-nav-bar">
        <div className="sunset-nav-slot sunset-nav-slot-start">
          {showBack && (
            <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2">
              {/* Uiverse.io by karthik092726122003 — botão de setas
                  deslizantes, era :hover, virou loop automático. */}
              <span className="sunset-back-wrap">
                <span className="sunset-back-btn2">
                  <span className="sunset-back-box">
                    <span className="sunset-back-elem">
                      <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
                        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                      </svg>
                    </span>
                    <span className="sunset-back-elem">
                      <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
                        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                      </svg>
                    </span>
                  </span>
                </span>
              </span>
              <span className="sunset-nav-label">Voltar</span>
            </button>
          )}
        </div>
        <div className="sunset-nav-slot sunset-nav-slot-center">{title && <div className="sunset-nav-tab">{title}</div>}</div>
        <div className="sunset-nav-slot sunset-nav-slot-end">
          {/* Sem ação por enquanto — destino dos favoritos ainda não foi
              definido. */}
          {showProfile && (
            <button type="button" className="sunset-profile-btn w-11 h-11 flex items-center justify-center flex-shrink-0" aria-label="Favoritos">
              <Heart className="w-4 h-4" />
            </button>
          )}
          {/* Igual ao botão flutuante — só o #cart-icon puro, sem pílula/
              texto "Sacola" ao redor. overflow-hidden + flex centering é
              necessário: o #cart-icon tem 140x120 nativos, e sem conter isso
              ele "vaza" pra fora da área pequena do header (ficava enorme e
              desalinhado, como reportado). */}
          {showCart && (
            <Link
              to="/carrinho"
              className="relative w-11 h-11 flex items-center justify-center overflow-hidden flex-shrink-0"
              aria-label="Ver carrinho"
            >
              <SunsetCartIcon scale={0.32} />
              {count > 0 && (
                <span className="absolute top-0 right-0 z-10 w-5 h-5 flex items-center justify-center text-xs font-bold sunset-bg text-white rounded-full">
                  {count}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
