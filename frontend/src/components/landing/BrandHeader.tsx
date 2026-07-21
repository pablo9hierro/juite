import { useState } from 'react'
import { Heart, History, Menu, Tag } from 'lucide-react'
import WhatsAppFab from '../WhatsAppFab'

// Mesmo navbar de /catalogo (moldura sunset-nav-bar), só que com
// conteúdo próprio da landing: menu / nome da marca no estilo
// Uiverse.io by Cornerstone-04 (glow em loop contínuo, como já era) /
// WhatsApp (movido do FAB fixo pra dentro do navbar).
export default function BrandHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="px-5 sm:px-10 pt-5 max-w-6xl mx-auto">
      <div className="sunset-nav-bar">
        <div className="sunset-nav-slot sunset-nav-slot-start">
          <div className="relative">
            {/* Uiverse.io by Na3ar-17 — cartão de menu com grupos
                separados. Abre ao clicar, fecha clicando fora. Itens
                sem ação por enquanto. */}
            {menuOpen && <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="sunset-profile-btn w-11 h-11 flex items-center justify-center flex-shrink-0 relative z-30"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              <Menu className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="sunset-menu-card">
                <ul className="sunset-menu-list">
                  <li className="sunset-menu-item">
                    <Heart />
                    <p className="sunset-menu-label">Favoritos</p>
                  </li>
                </ul>
                <div className="sunset-menu-separator" />
                <ul className="sunset-menu-list">
                  <li className="sunset-menu-item">
                    <Tag />
                    <p className="sunset-menu-label">Cupons</p>
                  </li>
                </ul>
                <div className="sunset-menu-separator" />
                <ul className="sunset-menu-list">
                  <li className="sunset-menu-item sunset-menu-item-accent">
                    <History />
                    <p className="sunset-menu-label">Histórico</p>
                  </li>
                </ul>
              </div>
            )}
          </div>
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
