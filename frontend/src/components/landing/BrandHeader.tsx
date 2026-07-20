import { User } from 'lucide-react'
import './BrandHeader.css'

// Barra de topo só da landing — nome da marca no estilo Uiverse.io by
// Cornerstone-04 (cantos que "abrem" num contorno neon com glow),
// recolorido pra paleta sunset. Efeito era só no :hover; aqui roda em
// loop contínuo (celular não tem hover de verdade). Ícone de perfil ao
// lado, sem ação por enquanto.
export default function BrandHeader() {
  return (
    <header className="relative z-20 flex items-center justify-center gap-4 px-6 pt-6">
      <div className="sunset-brand-btn">
        <span>Sunset Tabas</span>
      </div>
      <button type="button" className="sunset-profile-btn w-11 h-11 flex items-center justify-center flex-shrink-0" aria-label="Perfil">
        <User className="w-4 h-4" />
      </button>
    </header>
  )
}
