import { Link } from 'react-router-dom'
import { useCart } from '../store/cart'

// Uiverse.io by abhinav_7137 — ícone exato (carrinho + 5 itens caindo:
// celular, notebook, tablet, headphone, mixer), sem o texto "Loading...".
// Só o traço do carrinho foi recolorido (era #334155 escuro, ilegível
// sobre o fundo escuro do botão) — o resto (SVGs, posições, timings da
// animação) é o mesmo da referência. --loader-scale fixo (não usa mais os
// breakpoints de página da referência original — aqui é sempre um ícone
// de botão de tamanho fixo, não um loader responsivo de tela inteira).
export default function CartFab() {
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  return (
    <Link
      to="/carrinho"
      className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full flex items-center justify-center overflow-hidden bg-son-surface border border-white/10 glow hover:scale-105 transition-transform"
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
