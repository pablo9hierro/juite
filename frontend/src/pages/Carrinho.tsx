import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Minus, Package, Plus, Trash2 } from 'lucide-react'
import SiteHeader from '../components/layout/SiteHeader'
import PageTransition from '../components/layout/PageTransition'
import ProductDetailModal from '../components/ProductDetailModal'
import { api } from '../lib/api'
import type { Product } from '../lib/types'
import type { PromotionalProduct } from '../lib/supabasePublicApi'
import { useCart } from '../store/cart'

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

export default function Carrinho() {
  const navigate = useNavigate()
  const { items, changeQty, removeItem } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [promoProducts, setPromoProducts] = useState<PromotionalProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)

  useEffect(() => {
    Promise.all([api.products.list(), api.coupons.listPromotionalProducts().catch(() => [])])
      .then(([p, promo]) => {
        setProducts(p)
        setPromoProducts(promo)
      })
      .finally(() => setLoading(false))
  }, [])

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const promoByProduct = useMemo(() => {
    const map = new Map<string, PromotionalProduct>()
    for (const p of promoProducts) if (!map.has(p.product_id)) map.set(p.product_id, p)
    return map
  }, [promoProducts])

  const lines = items
    .map((item) => ({ item, product: productById.get(item.productId) }))
    .filter((l): l is { item: typeof items[number]; product: Product } => !!l.product)

  const qtyInCart = (id: string) => items.find((i) => i.productId === id)?.quantity ?? 0

  const total = lines.reduce((sum, l) => sum + l.product.price * l.item.quantity, 0)

  return (
    <main className="min-h-screen text-white">
      <SiteHeader showCart={false} title="Meu carrinho" />
      <PageTransition className="max-w-2xl mx-auto px-5 sm:px-10 pt-6 pb-20">
        {loading ? null : lines.length === 0 ? (
          <div className="text-center py-20 text-son-silver-dim">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="mb-6">Sua sacola está vazia.</p>
            <Link to="/catalogo" className="btn-primary inline-flex">
              Ver catálogo
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-3 mb-6">
              {lines.map(({ item, product }) => (
                <li key={product.id} className="flex items-center gap-3 bg-son-surface border border-white/5 rounded-2xl p-3">
                  {/* Igual em /catalogo — clicar no card (imagem+nome) abre
                      o mesmo toggle de detalhes do produto; os controles de
                      quantidade/remover ficam FORA desse botão, senão um
                      clique neles também abriria o modal por engano. */}
                  <button
                    type="button"
                    onClick={() => setDetailProduct(product)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="w-14 h-14 flex-shrink-0 rounded-xl bg-son-surface-light overflow-hidden flex items-center justify-center">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-son-silver-dim/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{product.name}</p>
                      <p className="text-xs text-son-silver-dim">{currency(product.price)} cada</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => changeQty(product.id, -1, product.quantity)}
                      className="w-7 h-7 flex items-center justify-center text-son-silver-dim hover:text-son-pink"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => changeQty(product.id, 1, product.quantity)}
                      disabled={item.quantity >= product.quantity}
                      className="w-7 h-7 flex items-center justify-center text-son-silver-dim hover:text-son-pink disabled:opacity-30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeItem(product.id)} className="text-son-silver-dim hover:text-son-pink ml-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="bg-son-surface border border-white/5 rounded-2xl p-4 flex items-center justify-between mb-6">
              <span className="font-bold">Total</span>
              <span className="sunset-text font-black text-lg">{currency(total)}</span>
            </div>

            <button onClick={() => navigate('/checkout')} className="btn-primary w-full text-base py-4">
              Continuar para o checkout
            </button>
          </>
        )}
      </PageTransition>
      <AnimatePresence>
        {detailProduct && (
          <ProductDetailModal
            product={detailProduct}
            promo={promoByProduct.get(detailProduct.id)}
            inCart={qtyInCart(detailProduct.id)}
            outOfStock={detailProduct.quantity <= 0}
            isFavorite={false}
            onToggleFavorite={null}
            onAdd={() => changeQty(detailProduct.id, 1, detailProduct.quantity)}
            onRemove={() => changeQty(detailProduct.id, -1, detailProduct.quantity)}
            onClose={() => setDetailProduct(null)}
          />
        )}
      </AnimatePresence>
    </main>
  )
}
