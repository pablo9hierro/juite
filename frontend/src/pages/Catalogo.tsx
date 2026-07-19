import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, List, Loader2, Minus, Package, Plus, Search, X } from 'lucide-react'
import { motion } from 'framer-motion'
import SiteHeader from '../components/layout/SiteHeader'
import PageTransition from '../components/layout/PageTransition'
import { api } from '../lib/api'
import type { Category, Product } from '../lib/types'
import type { PromotionalProduct } from '../lib/supabasePublicApi'
import { useCart } from '../store/cart'

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

function discountLabel(promo: PromotionalProduct) {
  return promo.discount_type === 'percent' ? `-${promo.discount_value}%` : `-${currency(promo.discount_value)}`
}

function finalPrice(price: number, promo: PromotionalProduct) {
  const raw = promo.discount_type === 'percent' ? price - (price * promo.discount_value) / 100 : price - promo.discount_value
  return Math.max(raw, 0)
}

// Preço original riscado (X vermelho) + valor do desconto + preço final —
// usado tanto no card do catálogo quanto (versão orange) no checkout.
function PromoPriceBlock({ price, promo }: { price: number; promo: PromotionalProduct }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-auto">
      <span className="text-xs text-red-500 line-through decoration-2">{currency(price)}</span>
      <span className="text-xs font-semibold text-orange-400">{discountLabel(promo)}</span>
      <span className="sunset-text font-bold">{currency(finalPrice(price, promo))}</span>
    </div>
  )
}

export default function Catalogo() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [promos, setPromos] = useState<PromotionalProduct[]>([])
  const [salesCounts, setSalesCounts] = useState<{ product_id: string; sold_count: number }[]>([])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'padrao' | 'menor_preco' | 'maior_preco' | 'mais_vendido' | 'alfabetica'>('padrao')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const { items, addItem, changeQty } = useCart()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([api.products.list(), api.categories.list(), api.coupons.listPromotionalProducts(), api.products.salesCounts()])
      .then(([p, c, promo, sales]) => {
        setProducts(p)
        setCategories(c)
        setPromos(promo)
        setSalesCounts(sales)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const promoByProduct = useMemo(() => {
    const map = new Map<string, PromotionalProduct>()
    for (const promo of promos) if (!map.has(promo.product_id)) map.set(promo.product_id, promo)
    return map
  }, [promos])

  // Categorias que têm pelo menos um produto em promoção — ganham o ícone
  // de fogo na própria aba, além da aba "Promoção" dedicada.
  const categoriesWithPromo = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) if (p.category_id && promoByProduct.has(p.id)) set.add(p.category_id)
    return set
  }, [products, promoByProduct])

  const isPromo = categoryFilter === 'promo'

  const filtered = useMemo(() => {
    if (isPromo) return products.filter((p) => promoByProduct.has(p.id))
    if (categoryFilter === 'all') return products
    return products.filter((p) => p.category_id === categoryFilter)
  }, [products, categoryFilter, isPromo, promoByProduct])

  const salesByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of salesCounts) map.set(s.product_id, s.sold_count)
    return map
  }, [salesCounts])

  const sortedFiltered = useMemo(() => {
    if (sortBy === 'padrao') return filtered
    const arr = [...filtered]
    switch (sortBy) {
      case 'menor_preco':
        arr.sort((a, b) => a.price - b.price)
        break
      case 'maior_preco':
        arr.sort((a, b) => b.price - a.price)
        break
      case 'mais_vendido':
        arr.sort((a, b) => (salesByProduct.get(b.id) ?? 0) - (salesByProduct.get(a.id) ?? 0))
        break
      case 'alfabetica':
        arr.sort((a, b) => a.name.localeCompare(b.name))
        break
    }
    return arr
  }, [filtered, sortBy, salesByProduct])

  // Na categoria "Promoção" os itens continuam separados por categoria
  // original (Lanches, Bebidas...), só a lista de exibição é filtrada.
  const promoGroups = useMemo(() => {
    if (!isPromo) return []
    const byId = new Map(categories.map((c) => [c.id, c.name]))
    const groups = new Map<string, Product[]>()
    for (const p of sortedFiltered) {
      const label = (p.category_id && byId.get(p.category_id)) || 'Sem categoria'
      if (!groups.has(label)) groups.set(label, [])
      groups.get(label)!.push(p)
    }
    return [...groups.entries()]
  }, [isPromo, sortedFiltered, categories])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8)
  }, [search, products])

  const clearSearch = () => {
    setSearch('')
    searchInputRef.current?.blur()
  }

  const qtyInCart = (id: string) => items.find((i) => i.productId === id)?.quantity ?? 0

  function GridCard({ product, i }: { product: Product; i: number }) {
    const inCart = qtyInCart(product.id)
    const outOfStock = product.quantity <= 0
    const promo = promoByProduct.get(product.id)
    return (
      <motion.div
        key={product.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.3) }}
        className="bg-son-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col hover:border-son-pink/30 transition-colors"
      >
        <Link to={`/produto/${product.id}`} className="flex flex-col flex-1">
          <div className="sunset-card-open-img aspect-square bg-son-surface-light flex items-center justify-center overflow-hidden">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-10 h-10 text-son-silver-dim/40" />
            )}
          </div>
          <div className="p-3 flex flex-col gap-2 flex-1">
            <div>
              <p className="text-sm font-semibold text-white leading-snug">{product.name}</p>
              {product.category_name && <p className="text-xs text-son-silver-dim">{product.category_name}</p>}
            </div>
            {promo ? <PromoPriceBlock price={product.price} promo={promo} /> : <p className="sunset-text font-bold mt-auto">{currency(product.price)}</p>}
          </div>
        </Link>
        <div className="px-3 pb-3">
          {outOfStock ? (
            <span className="block text-xs font-semibold text-son-silver-dim text-center py-2">Esgotado</span>
          ) : inCart > 0 ? (
            <div className="flex items-center justify-between bg-son-surface-light rounded-xl px-2 py-1">
              <button onClick={() => changeQty(product.id, -1)} className="w-7 h-7 flex items-center justify-center text-son-pink">
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-sm font-semibold text-white">{inCart}</span>
              <button
                onClick={() => addItem(product)}
                disabled={inCart >= product.quantity}
                className="w-7 h-7 flex items-center justify-center text-son-pink disabled:opacity-30"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => addItem(product)}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold sunset-bg text-white rounded-xl py-2 hover:brightness-110 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          )}
        </div>
      </motion.div>
    )
  }

  function ListCard({ product, i }: { product: Product; i: number }) {
    const inCart = qtyInCart(product.id)
    const outOfStock = product.quantity <= 0
    const promo = promoByProduct.get(product.id)
    return (
      <motion.div
        key={product.id}
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
        className="bg-son-surface border border-white/5 rounded-2xl overflow-hidden flex items-center gap-4 p-3 hover:border-son-pink/30 transition-colors"
      >
        <Link to={`/produto/${product.id}`} className="w-16 h-16 flex-shrink-0 rounded-xl bg-son-surface-light flex items-center justify-center overflow-hidden">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <Package className="w-6 h-6 text-son-silver-dim/40" />
          )}
        </Link>
        <Link to={`/produto/${product.id}`} className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{product.name}</p>
          {product.category_name && <p className="text-xs text-son-silver-dim">{product.category_name}</p>}
          {promo ? <PromoPriceBlock price={product.price} promo={promo} /> : <p className="sunset-text font-bold mt-0.5">{currency(product.price)}</p>}
        </Link>
        {outOfStock ? (
          <span className="text-xs font-semibold text-son-silver-dim px-3">Esgotado</span>
        ) : inCart > 0 ? (
          <div className="flex items-center gap-1.5 bg-son-surface-light rounded-xl px-2 py-1.5">
            <button onClick={() => changeQty(product.id, -1)} className="w-6 h-6 flex items-center justify-center text-son-pink">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm w-4 text-center">{inCart}</span>
            <button
              onClick={() => addItem(product)}
              disabled={inCart >= product.quantity}
              className="w-6 h-6 flex items-center justify-center text-son-pink disabled:opacity-30"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => addItem(product)}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold sunset-bg text-white rounded-xl px-3 py-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        )}
      </motion.div>
    )
  }

  return (
    <main className="min-h-screen bg-son-black text-white">
      <SiteHeader />
      <PageTransition className="max-w-6xl mx-auto px-5 sm:px-10 pb-16">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl sm:text-3xl font-black">Catálogo</h1>
          <div className="flex items-center gap-1 bg-son-surface border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-lg ${view === 'grid' ? 'sunset-bg text-white' : 'text-son-silver-dim'}`}
              aria-label="Ver em grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-lg ${view === 'list' ? 'sunset-bg text-white' : 'text-son-silver-dim'}`}
              aria-label="Ver em lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-son-silver-dim text-sm mb-4">Escolha os produtos e finalize seu pedido.</p>

        {/* From Uiverse.io by devkatyall — cores trocadas pra paleta sunset.
            O fundo opaco do input some (!bg-transparent) pra deixar o
            gradiente/feixe preto do .sunset-search-trigger aparecer atrás
            do texto; a faixa "abre" no hover (PC) ou ao focar a busca no
            celular (reaproveita o searchOpen que já existia). */}
        <div className={`sunset-search-trigger relative mb-6 rounded-2xl ${searchOpen ? 'is-open' : ''}`} ref={searchBoxRef}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-son-silver-dim pointer-events-none" />
          <input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            placeholder="Buscar produto..."
            className="input-field pl-10 pr-10 !bg-transparent"
          />
          {search && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-son-silver-dim hover:text-white"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {searchOpen && search.trim().length > 0 && (
            <div className="absolute z-20 mt-2 w-full max-h-80 overflow-y-auto glass rounded-2xl py-1 shadow-xl">
              {searchResults.length === 0 ? (
                <p className="text-sm text-son-silver-dim px-4 py-3">Nenhum produto encontrado.</p>
              ) : (
                searchResults.map((p) => (
                  <Link
                    key={p.id}
                    to={`/produto/${p.id}`}
                    onClick={() => {
                      setSearch('')
                      setSearchOpen(false)
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors"
                  >
                    <div className="w-11 h-11 flex-shrink-0 rounded-lg bg-son-surface-light flex items-center justify-center overflow-hidden">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-4 h-4 text-son-silver-dim/40" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                      {p.description && <p className="text-xs text-son-silver-dim truncate">{p.description}</p>}
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              categoryFilter === 'all' ? 'sunset-bg text-white' : 'bg-son-surface border border-white/5 text-son-silver hover:bg-son-surface-light'
            }`}
          >
            Todos
          </button>
          {promoByProduct.size > 0 && (
            <button
              onClick={() => setCategoryFilter('promo')}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                isPromo ? 'bg-orange-500 text-white' : 'bg-orange-500/10 border border-orange-500/40 text-orange-400 hover:bg-orange-500/20'
              }`}
            >
              🔥 Promoção
            </button>
          )}
          {categories.map((c) => {
            const hasPromo = categoriesWithPromo.has(c.id)
            const active = categoryFilter === c.id
            return (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  hasPromo
                    ? active
                      ? 'bg-orange-500 text-white font-bold'
                      : 'bg-orange-500/10 border border-orange-500/40 text-orange-400 hover:bg-orange-500/20 font-bold'
                    : active
                      ? 'sunset-bg text-white'
                      : 'bg-son-surface border border-white/5 text-son-silver hover:bg-son-surface-light'
                }`}
              >
                {hasPromo && '🔥 '}
                {c.name}
              </button>
            )
          })}
        </div>

        {!loading && filtered.length > 0 && (
          <div className="flex justify-end mb-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="input-field w-auto py-2 text-xs appearance-none cursor-pointer pr-8"
              aria-label="Ordenar produtos"
            >
              <option value="padrao">Ordenar por...</option>
              <option value="menor_preco">Menor preço</option>
              <option value="maior_preco">Maior preço</option>
              <option value="mais_vendido">Mais vendido</option>
              <option value="alfabetica">Alfabética (A-Z)</option>
            </select>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-son-silver-dim">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum produto disponível no momento.</p>
          </div>
        ) : isPromo ? (
          <div className="flex flex-col gap-8">
            {promoGroups.map(([label, groupProducts]) => (
              <div key={label}>
                <h2 className="text-sm font-bold text-son-silver-dim uppercase tracking-wide mb-3">{label}</h2>
                {view === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {groupProducts.map((product, i) => (
                      <GridCard key={product.id} product={product} i={i} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {groupProducts.map((product, i) => (
                      <ListCard key={product.id} product={product} i={i} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : view === 'grid' ? (
          <div className="catalogo-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {sortedFiltered.map((product, i) => (
              <GridCard key={product.id} product={product} i={i} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedFiltered.map((product, i) => (
              <ListCard key={product.id} product={product} i={i} />
            ))}
          </div>
        )}
      </PageTransition>
    </main>
  )
}
