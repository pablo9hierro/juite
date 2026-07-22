import { Link } from 'react-router-dom'
import { useCart } from '../store/cart'
import SunsetCartIcon from './SunsetCartIcon'

export default function CartFab() {
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  return (
    <Link to="/carrinho" className="fixed bottom-6 right-6 z-40 w-16 h-16 flex items-center justify-center" aria-label="Ir para o carrinho">
      <SunsetCartIcon scale={0.42} />
      {count > 0 && (
        <span className="absolute top-2 right-0 z-10 w-6 h-6 flex items-center justify-center text-xs font-bold sunset-bg text-white rounded-full shadow-md shadow-black/40">
          {count}
        </span>
      )}
    </Link>
  )
}
