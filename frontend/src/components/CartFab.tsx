import { Link } from 'react-router-dom'
import { useCart } from '../store/cart'

// Uiverse.io by abhinav_7137 — cópia 100% fiel (mesmos SVGs, mesmas
// cores, mesmos timings de animação, incl. o traço #334155 original do
// carrinho), só sem o texto "Loading..." (não faz sentido num botão fixo
// que não representa um estado de carregamento). --loader-scale fixo
// pra caber no botão de 64px (a referência original é uma tela cheia).
export default function CartFab() {
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  return (
    <Link
      to="/carrinho"
      className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full flex items-center justify-center bg-son-surface border border-white/10 glow hover:scale-105 transition-transform"
      aria-label="Ver sacola"
    >
      <div className="cart-loader">
        <div className="items-container">
          <div id="item-mobile" className="item" />
          <div id="item-laptop" className="item" />
          <div id="item-tab" className="item" />
          <div id="item-headphone" className="item" />
          <div id="item-mixer" className="item" />
        </div>
        <div id="cart-icon" />
      </div>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 z-10 w-6 h-6 flex items-center justify-center text-xs font-bold sunset-bg text-white rounded-full shadow-md shadow-black/40">
          {count}
        </span>
      )}
    </Link>
  )
}
