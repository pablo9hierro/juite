import { useId } from 'react'

// Uiverse.io by barisdogansutcu — checkbox escondido + coração que
// pulsa (scale) ao marcar, recolorido pro rosa/vermelho sunset (era
// vermelho puro). Só o ícone+pulso foi reaproveitado — os rótulos de
// texto "option-1"/"option-2" da referência (que abrem espaço lateral
// pra caber a frase) saíram, aqui é sempre um botão de ícone compacto
// pra caber no canto de um card.
export default function FavoriteHeartButton({
  checked,
  onChange,
  className,
}: {
  checked: boolean
  onChange: () => void
  className?: string
}) {
  const id = useId()
  return (
    <span className={`sunset-fav-heart ${className ?? ''}`}>
      <input
        type="checkbox"
        id={id}
        className="sunset-fav-checkbox"
        checked={checked}
        onChange={onChange}
        onClick={(e) => e.stopPropagation()}
      />
      <label htmlFor={id} onClick={(e) => e.stopPropagation()} aria-label={checked ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </label>
    </span>
  )
}
