import { Menu } from 'lucide-react'
import WhatsAppFab from '../WhatsAppFab'
import './BrandHeader.css'

// Mesmo navbar de /catalogo (moldura sunset-nav-bar), só que com
// conteúdo próprio da landing: menu (sem ação por enquanto) / nome da
// marca no estilo Uiverse.io by Cornerstone-04 (glow em loop contínuo,
// como já era) / WhatsApp (movido do FAB fixo pra dentro do navbar).
export default function BrandHeader() {
  return (
    <header className="px-5 sm:px-10 pt-5 max-w-6xl mx-auto">
      <div className="sunset-nav-bar">
        <div className="sunset-nav-slot sunset-nav-slot-start">
          <button type="button" className="sunset-profile-btn w-11 h-11 flex items-center justify-center flex-shrink-0" aria-label="Menu">
            <Menu className="w-4 h-4" />
          </button>
        </div>
        <div className="sunset-nav-slot sunset-nav-slot-center">
          <div className="sunset-brand-btn">
            <span>Sunset Tabas</span>
          </div>
        </div>
        <div className="sunset-nav-slot sunset-nav-slot-end">
          <WhatsAppFab inline />
        </div>
      </div>
    </header>
  )
}
