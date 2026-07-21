import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ClipboardList,
  LogOut,
  Megaphone,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import Logo from '../ui/Logo'
import { useAdminAuth } from '../../store/adminAuth'
import { useVendedorAuth } from '../../store/vendedorAuth'

// Vendedor usa esse MESMO layout/sidebar (login separado, em
// /funcionarios/login, sessão própria em useVendedorAuth) só que
// enxergando um dashboard próprio: Pedidos + PDV + Financeiro (só a
// parte de vendas de balcão dele) — sem acesso a Produtos/Funcionários/
// Promoções/CRM/Configurações, que continuam exclusivos do admin. O
// resto do menu nem aparece pra ele, e a guarda de rota abaixo bloqueia
// acesso direto por URL também (defesa em profundidade: cada RPC
// admin-only já rejeita o token de vendedor sozinha, isso aqui é só pra
// não mostrar tela quebrada).
const NAV_ITEMS = [
  { href: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList, roles: ['admin', 'vendedor'] },
  { href: '/admin/pdv', label: 'PDV', icon: ShoppingCart, roles: ['admin', 'vendedor'] },
  { href: '/admin/produtos', label: 'Produtos', icon: Package, roles: ['admin'] },
  { href: '/admin/motoboys', label: 'Funcionários', icon: Truck, roles: ['admin'] },
  { href: '/admin/crm', label: 'CRM', icon: Users, roles: ['admin'] },
  { href: '/admin/promocoes', label: 'Promoções', icon: Megaphone, roles: ['admin'] },
  { href: '/admin/financeiro', label: 'Financeiro', icon: Wallet, roles: ['admin', 'vendedor'] },
  { href: '/admin/conta', label: 'Configurações', icon: Settings, roles: ['admin'] },
] as const

export default function AdminLayout() {
  const admin = useAdminAuth()
  const vendedor = useVendedorAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Admin e vendedor têm sessões 100% separadas (useAdminAuth/
  // useVendedorAuth, cada uma com sua chave de localStorage) — aqui só
  // resolve QUAL das duas está ativa pra decidir o que essa tela mostra.
  const isVendedor = !admin.token && !!vendedor.token
  const token = admin.token || vendedor.token
  const name = admin.token ? admin.name : vendedor.name
  const role: 'admin' | 'vendedor' = isVendedor ? 'vendedor' : 'admin'
  const logout = isVendedor ? vendedor.logout : admin.logout

  if (!token) return <Navigate to="/admin/login" state={{ from: location }} replace />

  const items = NAV_ITEMS.filter((item) => (item.roles as readonly string[]).includes(role))
  const allowedPaths: string[] = items.map((item) => item.href)
  if (!allowedPaths.includes(location.pathname)) {
    return <Navigate to={role === 'vendedor' ? '/admin/pdv' : '/admin/pedidos'} replace />
  }

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-son-black text-white flex">
      <aside className="hidden md:flex md:flex-col w-56 shrink-0 bg-son-surface border-r border-white/5 min-h-screen sticky top-0">
        <div className="px-5 py-5 border-b border-white/5">
          <Logo size="sm" />
          <p className="text-xs text-son-silver-dim mt-1">Olá, {name}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = location.pathname === href
            return (
              <Link
                key={href}
                to={href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'sunset-bg text-white' : 'text-son-silver-dim hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="px-3 py-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-son-silver-dim hover:text-son-pink transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="md:hidden bg-son-surface border-b border-white/5 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
          <Logo size="sm" />
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-son-silver-dim hover:text-son-pink text-sm">
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </header>
        <nav className="md:hidden flex gap-2 overflow-x-auto px-4 py-3 bg-son-black border-b border-white/5 scrollbar-hide sticky top-[65px] z-10">
          {items.map(({ href, label, icon: Icon }) => {
            const active = location.pathname === href
            return (
              <Link
                key={href}
                to={href}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  active ? 'sunset-bg text-white' : 'bg-son-surface border border-white/5 text-son-silver hover:bg-son-surface-light'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            )
          })}
        </nav>
        <main className="p-5 sm:p-8 max-w-6xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
