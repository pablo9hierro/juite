import { useState } from 'react'
import { Package, Search, Tag, X } from 'lucide-react'
import type { Category, DiscountType, Product, ProductDiscount } from '../../lib/types'

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

// Sempre mostra o valor nos dois formatos — se o admin digitou em R$, o %
// equivalente some entre parênteses do lado, e vice-versa.
function equivalentLabel(price: number, type: DiscountType, value: number) {
  if (!price || !value) return ''
  if (type === 'percent') return `(${currency((price * value) / 100)})`
  return `(${Math.min((value / price) * 100, 100).toFixed(1).replace('.', ',')}%)`
}

export default function ProductDiscountList({
  products,
  categories,
  discounts,
  onChange,
}: {
  products: Product[]
  // Opcional — quando passado, mostra uma busca separada pra adicionar
  // uma categoria inteira de uma vez (expande em uma linha por produto,
  // cada uma editável depois, já que ProductDiscount não tem noção de
  // categoria — é só um atalho de cadastro em lote).
  categories?: Category[]
  discounts: ProductDiscount[]
  onChange: (discounts: ProductDiscount[]) => void
}) {
  const [query, setQuery] = useState('')
  const [categoryQuery, setCategoryQuery] = useState('')
  const [infoProduct, setInfoProduct] = useState<Product | null>(null)

  const productById = new Map(products.map((p) => [p.id, p]))
  const selected = discounts.map((d) => ({ discount: d, product: productById.get(d.product_id) })).filter((x) => x.product)
  const matches =
    query.trim().length > 0
      ? products
          .filter(
            (p) =>
              !discounts.some((d) => d.product_id === p.id) &&
              (p.name.toLowerCase().includes(query.trim().toLowerCase()) || (p.barcode && p.barcode.includes(query.trim())))
          )
          .slice(0, 8)
      : []
  const categoryMatches =
    categories && categoryQuery.trim().length > 0
      ? categories.filter((c) => c.name.toLowerCase().includes(categoryQuery.trim().toLowerCase())).slice(0, 8)
      : []

  const addProduct = (id: string) => {
    onChange([...discounts, { product_id: id, discount_type: 'percent', discount_value: 0 }])
    setQuery('')
  }
  const addCategory = (categoryId: string) => {
    const newOnes = products
      .filter((p) => p.category_id === categoryId && !discounts.some((d) => d.product_id === p.id))
      .map((p) => ({ product_id: p.id, discount_type: 'percent' as DiscountType, discount_value: 0 }))
    if (newOnes.length > 0) onChange([...discounts, ...newOnes])
    setCategoryQuery('')
  }
  const removeProduct = (id: string) => onChange(discounts.filter((d) => d.product_id !== id))
  const updateDiscount = (id: string, patch: Partial<ProductDiscount>) =>
    onChange(discounts.map((d) => (d.product_id === id ? { ...d, ...patch } : d)))

  return (
    <div>
      {selected.length > 0 && (
        <div className="space-y-2 mb-2">
          {selected.map(({ discount, product }) => {
            const p = product!
            const finalPrice =
              discount.discount_type === 'percent'
                ? Math.max(p.price - (p.price * discount.discount_value) / 100, 0)
                : Math.max(p.price - discount.discount_value, 0)
            return (
              <div key={p.id} className="flex items-center gap-2 bg-son-surface-light rounded-xl p-2">
                <button
                  type="button"
                  onClick={() => setInfoProduct(p)}
                  className="w-10 h-10 rounded-lg bg-son-surface flex items-center justify-center overflow-hidden flex-shrink-0"
                >
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <Package className="w-4 h-4 text-son-silver-dim" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white truncate">{p.name}</p>
                  <p className="text-xs text-son-silver-dim">{currency(p.price)}</p>
                </div>
                <select
                  className="input-field w-20 py-1.5 text-xs appearance-none cursor-pointer flex-shrink-0"
                  value={discount.discount_type}
                  onChange={(e) => updateDiscount(p.id, { discount_type: e.target.value as DiscountType })}
                >
                  <option value="percent">%</option>
                  <option value="fixed">R$</option>
                </select>
                <input
                  className="input-field w-20 py-1.5 text-xs flex-shrink-0"
                  type="number"
                  min="0"
                  value={discount.discount_value || ''}
                  onChange={(e) => updateDiscount(p.id, { discount_value: Number(e.target.value) })}
                />
                <div className="text-right flex-shrink-0 w-24">
                  <p className="text-xs text-son-silver-dim">{equivalentLabel(p.price, discount.discount_type, discount.discount_value)}</p>
                  <p className="text-xs sunset-text font-bold">{currency(finalPrice)}</p>
                </div>
                <button type="button" onClick={() => removeProduct(p.id)} className="flex-shrink-0">
                  <X className="w-3.5 h-3.5 text-son-silver-dim hover:text-son-pink" />
                </button>
              </div>
            )
          })}
        </div>
      )}
      <div className="relative">
        <Search className="w-4 h-4 text-son-silver-dim absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          className="input-field pl-9"
          placeholder="Buscar produto por nome ou código de barras..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matches.length > 0 && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-son-surface border border-white/10 rounded-xl overflow-hidden shadow-lg max-h-48 overflow-y-auto">
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-son-silver hover:bg-son-surface-light text-left"
              >
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-son-silver-dim flex-shrink-0">{currency(p.price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {categories && (
        <div className="relative mt-2">
          <Tag className="w-4 h-4 text-son-silver-dim absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input-field pl-9"
            placeholder="...ou adicionar uma categoria inteira"
            value={categoryQuery}
            onChange={(e) => setCategoryQuery(e.target.value)}
          />
          {categoryMatches.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-son-surface border border-white/10 rounded-xl overflow-hidden shadow-lg max-h-48 overflow-y-auto">
              {categoryMatches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addCategory(c.id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-son-silver hover:bg-son-surface-light text-left"
                >
                  <span className="truncate">{c.name}</span>
                  <span className="text-xs text-son-silver-dim flex-shrink-0">
                    {products.filter((p) => p.category_id === c.id).length} produto(s)
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {infoProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setInfoProduct(null)}>
          <div className="glass rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">{infoProduct.name}</h3>
              <button onClick={() => setInfoProduct(null)} className="text-son-silver-dim hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {infoProduct.image_url && (
              <img src={infoProduct.image_url} alt={infoProduct.name} className="w-full h-40 object-cover rounded-xl mb-3" />
            )}
            <p className="text-sm text-son-silver-dim mb-2">{infoProduct.description}</p>
            <div className="flex justify-between text-sm">
              <span className="text-son-silver-dim">Preço</span>
              <span className="sunset-text font-bold">{currency(infoProduct.price)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-son-silver-dim">Estoque</span>
              <span className="text-white">{infoProduct.quantity}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
