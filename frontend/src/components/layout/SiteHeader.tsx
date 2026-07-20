import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import SunsetCartIcon from '../SunsetCartIcon'
import { useCart } from '../../store/cart'

// O logo clicável (header > div > a > img) foi retirado de todas as
// páginas de cliente a pedido — só sobra o "Voltar" do lado esquerdo.
export default function SiteHeader({ showBack = true }: { showBack?: boolean }) {
  const navigate = useNavigate()
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  return (
    <header className="px-5 sm:px-10 py-5 flex items-center justify-between max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-medium text-son-silver-dim hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>
        )}
      </div>
      {/* Igual ao botão flutuante — só o #cart-icon puro, sem pílula/
          texto "Sacola" ao redor. */}
      <Link to="/checkout" className="relative w-11 h-11" aria-label="Ver sacola">
        <SunsetCartIcon scale={0.32} />
        {count > 0 && (
          <span className="absolute top-0 right-0 z-10 w-5 h-5 flex items-center justify-center text-xs font-bold sunset-bg text-white rounded-full">
            {count}
          </span>
        )}
      </Link>
    </header>
  )
}
