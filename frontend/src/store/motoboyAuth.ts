import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface MotoboyAuthState {
  token: string | null
  name: string | null
  login: (token: string, name: string) => void
  logout: () => void
}

export const useMotoboyAuth = create<MotoboyAuthState>()(
  persist(
    (set) => ({
      token: null,
      name: null,
      login: (token, name) => set({ token, name }),
      logout: () => set({ token: null, name: null }),
    }),
    {
      name: 'sonset_motoboy_auth',
      // sessionStorage: mesma razão do adminAuth — sessão isolada por aba,
      // não some/ vaza quando outra aba loga com outra conta.
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
