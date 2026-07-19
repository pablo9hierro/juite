import { Link } from 'react-router-dom'
import { useCart } from '../store/cart'
import SunsetCartIcon from './SunsetCartIcon'

// Botão flutuante do carrinho — sem a moldura circular verde de antes,
// só o ícone #cart-icon (Uiverse by abhinav_7137) direto, levando pro
// checkout. w-16 h-16 aqui não é "moldura visual" (sem bg/border/glow),
// é só pra dar um tamanho fixo pro link — sem isso o box do <a> herdava
// o tamanho NÃO escalado do #cart-icon (140x120) e o `fixed` brigava
// com a classe `relative` que tinha ficado junto (as duas mexem em
// `position`, e a que "ganhava" no CSS gerado tirava o botão da posição
// fixa, fazendo ele renderizar no meio do fluxo normal da página).
export default function CartFab() {
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  return (
    <Link
      to="/checkout"
      className="fixed bottom-6 right-6 z-40 w-16 h-16 flex items-center justify-center overflow-hidden"
      aria-label="Ir para o checkout"
    >
      <SunsetCartIcon scale={0.5} />
      {count > 0 && (
        <span className="absolute top-2 right-0 z-10 w-6 h-6 flex items-center justify-center text-xs font-bold sunset-bg text-white rounded-full shadow-md shadow-black/40">
          {count}
        </span>
      )}
    </Link>
  )
}
