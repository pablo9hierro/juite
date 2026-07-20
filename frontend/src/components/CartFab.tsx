import { Link } from 'react-router-dom'
import { useCart } from '../store/cart'
import SunsetCartIcon from './SunsetCartIcon'

// Botão flutuante do carrinho — sem a moldura circular verde de antes,
// e com os 5 itens caindo (celular, notebook, tablet, headphone, mixer)
// de volta, levando pro checkout. w-16 h-16 no <Link> é só pra fixar a
// área de clique/posição (sem isso o box do <a> herdava o tamanho NÃO
// escalado do loader e o `fixed` brigava com `relative` no CSS gerado,
// tirando o botão da posição fixa). O ícone em si fica num wrapper
// SEM overflow:hidden e maior que o botão, senão os itens caindo — que
// saem por cima do carrinho — ficam cortados pelas bordas do botão.
export default function CartFab() {
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  return (
    <Link to="/checkout" className="fixed bottom-6 right-6 z-40 w-16 h-16" aria-label="Ir para o checkout">
      <SunsetCartIcon scale={0.42} withItems />
      {count > 0 && (
        <span className="absolute top-2 right-0 z-10 w-6 h-6 flex items-center justify-center text-xs font-bold sunset-bg text-white rounded-full shadow-md shadow-black/40">
          {count}
        </span>
      )}
    </Link>
  )
}
