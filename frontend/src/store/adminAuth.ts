import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// Sessão única compartilhada pelos 3 papéis que logam em /admin/login —
// admin, vendedor e motoboy — cada um com seu próprio dashboard depois
// (padrão que deve se repetir em qualquer site futuro criado a partir
// desse esqueleto).
export type AdminRole = 'admin' | 'vendedor' | 'motoboy'

interface AdminAuthState {
  token: string | null
  name: string | null
  // 'admin' por padrão pra sessões antigas já persistidas (criadas antes
  // do papel de vendedor existir) continuarem com acesso total.
  role: AdminRole
  login: (token: string, name: string, role: AdminRole) => void
  logout: () => void
}

export const useAdminAuth = create<AdminAuthState>()(
  persist(
    (set) => ({
      token: null,
      name: null,
      role: 'admin',
      login: (token, name, role) => set({ token, name, role }),
      logout: () => set({ token: null, name: null, role: 'admin' }),
    }),
    {
      name: 'sonset_admin_auth',
      // localStorage (não sessionStorage): motoboy usa o celular como
      // ferramenta de trabalho — o navegador/PWA é frequentemente
      // fechado/reaberto ao longo do dia, e sessionStorage some nesse
      // momento, forçando login de novo toda hora. localStorage
      // sobrevive a isso. O preço é o bug antigo (logar como admin numa
      // aba e vendedor noutra faz as duas virarem o último papel logado
      // ao recarregar, já que localStorage é compartilhado entre abas da
      // mesma origem) — aceitável porque isso só acontece em teste manual
      // multi-aba do próprio dev, não no uso real de motoboy em campo.
      storage: createJSONStorage(() => localStorage),
    }
  )
)
