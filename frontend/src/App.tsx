import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Landing from './pages/Landing'
import Catalogo from './pages/Catalogo'
import ProdutoDetalhe from './pages/ProdutoDetalhe'
import Carrinho from './pages/Carrinho'
import Checkout from './pages/Checkout'
import Banner from './pages/Banner'
import BannerCheckout from './pages/BannerCheckout'
import Pagamento from './pages/Pagamento'
import Consultar from './pages/Consultar'
import AdminLogin from './pages/admin/AdminLogin'
import AdminPedidos from './pages/admin/AdminPedidos'
import AdminProdutos from './pages/admin/AdminProdutos'
import AdminMotoboys from './pages/admin/AdminMotoboys'
import AdminFinanceiro from './pages/admin/AdminFinanceiro'
import AdminSenha from './pages/admin/AdminSenha'
import AdminPromocoes from './pages/admin/AdminPromocoes'
import AdminCrm from './pages/admin/AdminCrm'
import MotoboyFila from './pages/motoboy/MotoboyFila'
import MotoboyCorrida from './pages/motoboy/MotoboyCorrida'
import MotoboyFinanceiro from './pages/motoboy/MotoboyFinanceiro'
import MotoboyConta from './pages/motoboy/MotoboyConta'
import AdminLayout from './components/layout/AdminLayout'
import MotoboyLayout from './components/layout/MotoboyLayout'

// Só essa página puxa a lib de leitura de código de barras (~500KB) — carrega
// sob demanda, pra quem visita a loja como cliente nunca baixar esse peso
// (só admin/vendedor, logados, acessam PDV).
const AdminPdv = lazy(() => import('./pages/admin/AdminPdv'))

function PdvFallback() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-son-pink" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/produto/:id" element={<ProdutoDetalhe />} />
        <Route path="/carrinho" element={<Carrinho />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/banner" element={<Banner />} />
        <Route path="/banner/checkout" element={<BannerCheckout />} />
        <Route path="/pagamento/:orderId" element={<Pagamento />} />
        <Route path="/consultar" element={<Consultar />} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/pedidos" replace />} />
          <Route path="pedidos" element={<AdminPedidos />} />
          <Route
            path="pdv"
            element={
              <Suspense fallback={<PdvFallback />}>
                <AdminPdv />
              </Suspense>
            }
          />
          <Route path="produtos" element={<AdminProdutos />} />
          <Route path="motoboys" element={<AdminMotoboys />} />
          <Route path="crm" element={<AdminCrm />} />
          <Route path="promocoes" element={<AdminPromocoes />} />
          <Route path="campanhas" element={<Navigate to="/admin/promocoes" replace />} />
          <Route path="financeiro" element={<AdminFinanceiro />} />
          <Route path="conta" element={<AdminSenha />} />
        </Route>

        {/* Motoboy loga na MESMA tela de admin/vendedor (/admin/login) e cai
            no próprio dashboard em /admin/motoboy — padrão que deve se
            repetir em qualquer site futuro criado a partir desse esqueleto.
            Redirects abaixo cobrem quem ainda tem o link antigo salvo. */}
        <Route path="/motoboy/login" element={<Navigate to="/admin/login" replace />} />
        <Route path="/motoboy/*" element={<Navigate to="/admin/motoboy" replace />} />
        <Route path="/admin/motoboy" element={<MotoboyLayout />}>
          <Route index element={<MotoboyFila />} />
          <Route path="corrida" element={<MotoboyCorrida />} />
          <Route path="financeiro" element={<MotoboyFinanceiro />} />
          <Route path="conta" element={<MotoboyConta />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
