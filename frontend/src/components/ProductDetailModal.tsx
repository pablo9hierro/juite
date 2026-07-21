import { Minus, Package, Plus, X } from 'lucide-react'
import { motion } from 'framer-motion'
import FavoriteHeartButton from './FavoriteHeartButton'
import type { Product } from '../lib/types'
import type { PromotionalProduct } from '../lib/supabasePublicApi'

export function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

export function discountLabel(promo: PromotionalProduct) {
  return promo.discount_type === 'percent' ? `-${promo.discount_value}%` : `-${currency(promo.discount_value)}`
}

export function finalPrice(price: number, promo: PromotionalProduct) {
  const raw = promo.discount_type === 'percent' ? price - (price * promo.discount_value) / 100 : price - promo.discount_value
  return Math.max(raw, 0)
}

// Preço original riscado (X vermelho) + valor do desconto + preço final —
// usado no card do catálogo, no toggle de detalhes e (versão orange) no checkout.
export function PromoPriceBlock({ price, promo }: { price: number; promo: PromotionalProduct }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-auto">
      <span className="text-xs text-red-500 line-through decoration-2">{currency(price)}</span>
      <span className="text-xs font-semibold text-orange-400">{discountLabel(promo)}</span>
      <span className="sunset-text font-bold">{currency(finalPrice(price, promo))}</span>
    </div>
  )
}

// Uiverse.io by SachinKumar666 — card com brilho/glow/badge, reaproveitado
// como toggle de detalhes do produto. Abre ao clicar num card de produto
// (catálogo normal, promoção ou favoritos — mesmo componente em todo
// lugar), fecha no X ou clicando fora.
export default function ProductDetailModal({
  product,
  promo,
  inCart,
  outOfStock,
  isFavorite,
  onToggleFavorite,
  onAdd,
  onRemove,
  onClose,
}: {
  product: Product
  promo: PromotionalProduct | undefined
  inCart: number
  outOfStock: boolean
  isFavorite: boolean
  onToggleFavorite: (() => void) | null
  onAdd: () => void
  onRemove: () => void
  onClose: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="sunset-pd-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sunset-pd-shine" />
        <div className="sunset-pd-glow" />
        <button type="button" onClick={onClose} className="sunset-pd-close" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
        {onToggleFavorite && (
          <div className="absolute top-2" style={{ right: promo ? '3rem' : '0.5rem' }}>
            <FavoriteHeartButton checked={isFavorite} onChange={onToggleFavorite} />
          </div>
        )}
        {promo && <div className="sunset-pd-badge">{discountLabel(promo)}</div>}
        <div className="sunset-pd-content">
          <div className="sunset-pd-image">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} />
            ) : (
              <Package className="w-10 h-10 text-white/50" />
            )}
          </div>
          <div>
            <p className="sunset-pd-title">{product.name}</p>
            {product.category_name && <p className="sunset-pd-category">{product.category_name}</p>}
          </div>
          {product.description && <p className="sunset-pd-description">{product.description}</p>}
          <div className="sunset-pd-footer">
            {promo ? <PromoPriceBlock price={product.price} promo={promo} /> : <span className="sunset-pd-price">{currency(product.price)}</span>}
            {outOfStock ? (
              <span className="text-xs font-semibold text-son-silver-dim">Esgotado</span>
            ) : inCart > 0 ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={onRemove} className="sunset-pd-button">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-semibold text-white w-4 text-center">{inCart}</span>
                <button type="button" onClick={onAdd} disabled={inCart >= product.quantity} className="sunset-pd-button">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={onAdd} className="sunset-pd-button" aria-label="Adicionar ao carrinho">
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
