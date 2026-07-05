import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '../store/cart'

// Floating cart button — mirrors WhatsAppFab (fixed, follows scroll), on the
// opposite corner so the two never overlap.
export default function CartFab() {
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  return (
    <Link
      to="/carrinho"
      className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full flex items-center justify-center bg-son-surface border border-white/10 glow hover:scale-105 transition-transform"
      aria-label="Ver sacola"
    >
      <ShoppingBag className="w-6 h-6 text-son-pink" />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-6 h-6 flex items-center justify-center text-xs font-bold sunset-bg text-white rounded-full shadow-md shadow-black/40">
          {count}
        </span>
      )}
    </Link>
  )
}
