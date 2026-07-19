import { Link } from 'react-router-dom'
import { useCart } from '../store/cart'
import SunsetCartIcon from './SunsetCartIcon'

// Botão flutuante do carrinho — sem a moldura circular verde de antes,
// só o ícone #cart-icon (Uiverse by abhinav_7137) direto, levando pro
// checkout.
export default function CartFab() {
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  return (
    <Link to="/checkout" className="fixed bottom-6 right-6 z-40 relative" aria-label="Ir para o checkout">
      <SunsetCartIcon scale={0.5} />
      {count > 0 && (
        <span className="absolute top-2 right-0 z-10 w-6 h-6 flex items-center justify-center text-xs font-bold sunset-bg text-white rounded-full shadow-md shadow-black/40">
          {count}
        </span>
      )}
    </Link>
  )
}
