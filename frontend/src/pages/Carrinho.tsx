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

type SortBy = 'padrao' | 'menor_preco' | 'maior_preco' | 'mais_vendido' | 'alfabetica'

export default function Carrinho() {
  const navigate = useNavigate()
  const { items, changeQty, removeItem } = useCart()
  const [products, setProducts] = useState<Product[]>([])
  const [promoProducts, setPromoProducts] = useState<PromotionalProduct[]>([])
  const [salesCounts, setSalesCounts] = useState<{ product_id: string; sold_count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  // Estado 100% local desta página — mesmas opções do "Ordenar por..." de
  // /catalogo, mas cada página tem o seu próprio useState, sem nenhuma
  // ligação entre os dois: ordenar o carrinho aqui não muda a ordenação
  // do catálogo, e vice-versa.
  const [sortBy, setSortBy] = useState<SortBy>('padrao')

  useEffect(() => {
    Promise.all([api.products.list(), api.coupons.listPromotionalProducts().catch(() => []), api.products.salesCounts()])
      .then(([p, promo, sales]) => {
        setProducts(p)
        setPromoProducts(promo)
        setSalesCounts(sales)
      })
      .finally(() => setLoading(false))
  }, [])

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const promoByProduct = useMemo(() => {
    const map = new Map<string, PromotionalProduct>()
    for (const p of promoProducts) if (!map.has(p.product_id)) map.set(p.product_id, p)
    return map
  }, [promoProducts])
  const salesByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of salesCounts) map.set(s.product_id, s.sold_count)
    return map
  }, [salesCounts])

  const lines = items
    .map((item) => ({ item, product: productById.get(item.productId) }))
    .filter((l): l is { item: typeof items[number]; product: Product } => !!l.product)

  const sortedLines = useMemo(() => {
    if (sortBy === 'padrao') return lines
    const arr = [...lines]
    switch (sortBy) {
      case 'menor_preco':
        arr.sort((a, b) => a.product.price - b.product.price)
        break
      case 'maior_preco':
        arr.sort((a, b) => b.product.price - a.product.price)
        break
      case 'mais_vendido':
        arr.sort((a, b) => (salesByProduct.get(b.product.id) ?? 0) - (salesByProduct.get(a.product.id) ?? 0))
        break
      case 'alfabetica':
        arr.sort((a, b) => a.product.name.localeCompare(b.product.name))
        break
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, sortBy, salesByProduct])

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
            <div className="flex items-center justify-end mb-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="input-field w-auto py-2 text-xs appearance-none cursor-pointer pr-8"
                aria-label="Ordenar itens do carrinho"
              >
                <option value="padrao">Ordenar por...</option>
                <option value="menor_preco">Menor preço</option>
                <option value="maior_preco">Maior preço</option>
                <option value="mais_vendido">Mais vendido</option>
                <option value="alfabetica">Alfabética (A-Z)</option>
              </select>
            </div>
            <ul className="space-y-3 mb-6">
              {sortedLines.map(({ item, product }) => (
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
