import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AdminRole = 'admin' | 'vendedor'

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
    { name: 'sonset_admin_auth' }
  )
)
