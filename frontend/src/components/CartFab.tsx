import { Link } from 'react-router-dom'
import { useCart } from '../store/cart'
import SunsetCartIcon from './SunsetCartIcon'

// 9 baforadas (5 * 1.7 arredondado) — a fumaça que antes subia no botão
// de WhatsApp foi movida pra cá, em cima do #cart-icon. Fica dentro do
// próprio <Link> (que já é o positioning context, sendo `fixed`), mas
// com pointer-events:none (.sunset-smoke no index.css) — clicar na
// fumaça não aciona o link, só clicar em cima do ícone do carrinho.
const SMOKE_LEFT = [8, 19, 30, 41, 52, 63, 74, 85, 96]

export default function CartFab() {
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  return (
    <Link to="/checkout" className="fixed bottom-6 right-6 z-40 w-16 h-16 flex items-center justify-center" aria-label="Ir para o checkout">
      {SMOKE_LEFT.map((left, i) => (
        <span key={left} className="sunset-smoke" style={{ left: `${left}%`, animationDelay: `${i * 0.35}s` }} />
      ))}
      <SunsetCartIcon scale={0.42} />
      {count > 0 && (
        <span className="absolute top-2 right-0 z-10 w-6 h-6 flex items-center justify-center text-xs font-bold sunset-bg text-white rounded-full shadow-md shadow-black/40">
          {count}
        </span>
      )}
    </Link>
  )
}
