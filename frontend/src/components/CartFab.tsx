import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../store/cart'
import SunsetCartIcon from './SunsetCartIcon'
import FireLoader from './FireLoader'

// 9 baforadas (5 * 1.7 arredondado) — a fumaça que antes subia no botão
// de WhatsApp foi movida pra cá, em cima do #cart-icon. Fica dentro do
// próprio <Link> (que já é o positioning context, sendo `fixed`), mas
// com pointer-events:none (.sunset-smoke no index.css) — clicar na
// fumaça não aciona o link, só clicar em cima do ícone do carrinho.
// Cada baforada tem um --drift diferente (px, positivo ou negativo) pra
// desviar pro lado de um jeito distinto enquanto sobe — sem isso todas
// subiam retas empilhadas, o que com várias baforadas próximas lia como
// um movimento "helicoidal"/espiral em vez de fumaça natural.
const SMOKE = [
  { left: 8, drift: -16 },
  { left: 19, drift: 12 },
  { left: 30, drift: -22 },
  { left: 41, drift: 8 },
  { left: 52, drift: -10 },
  { left: 63, drift: 20 },
  { left: 74, drift: -14 },
  { left: 85, drift: 16 },
  { left: 96, drift: -8 },
]

export default function CartFab() {
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  return (
    <Link to="/checkout" className="fixed bottom-6 right-6 z-40 w-16 h-16 flex items-center justify-center" aria-label="Ir para o checkout">
      <FireLoader />
      {SMOKE.map((s, i) => (
        <span
          key={s.left}
          className="sunset-smoke"
          style={{ left: `${s.left}%`, '--drift': `${s.drift}px`, animationDelay: `${i * 0.35}s` } as CSSProperties}
        />
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
