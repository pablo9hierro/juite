import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Heart, Loader2, Package } from 'lucide-react'
import SiteHeader from '../../components/layout/SiteHeader'
import PageTransition from '../../components/layout/PageTransition'
import { api } from '../../lib/api'
import type { Product } from '../../lib/types'
import { useCustomerAuth } from '../../store/customerAuth'

function currency(v: number) {
  return `R$ ${v.toFixed(2).replace('.', ',')}`
}

export default function FavoritosCliente() {
  const { token } = useCustomerAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    api.customerAuth
      .listFavorites(token)
      .then(setProducts)
      .finally(() => setLoading(false))
  }, [token])

  if (!token) return <Navigate to="/" replace />

  return (
    <main className="min-h-screen text-white">
      <SiteHeader showCart={false} showProfile={false} title="Favoritos" />
      <PageTransition className="max-w-6xl mx-auto px-5 sm:px-10 pt-6 pb-16">
        <div className="glass rounded-3xl p-4 sm:p-6">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 text-son-silver-dim">
              <Heart className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Você ainda não marcou nenhum produto como favorito.</p>
              <Link to="/catalogo" className="btn-primary inline-flex mt-4">
                Ver catálogo
              </Link>
            </div>
          ) : (
            <div className="catalogo-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((product) => (
                <Link
                  key={product.id}
                  to={`/produto/${product.id}`}
                  className="bg-son-surface border border-white/5 rounded-2xl overflow-hidden flex flex-col hover:border-son-pink/30 transition-colors"
                >
                  <div className="aspect-square bg-son-surface-light flex items-center justify-center overflow-hidden">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-10 h-10 text-son-silver-dim/40" />
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1">
                    <p className="text-sm font-semibold text-white leading-snug">{product.name}</p>
                    <p className="sunset-text font-bold">{currency(product.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </PageTransition>
    </main>
  )
}
