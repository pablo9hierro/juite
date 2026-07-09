import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CustomerState {
  name: string
  whatsapp: string
  neighborhood: string
  address: string
  lat: number | null
  lng: number | null
  set: (data: Partial<Pick<CustomerState, 'name' | 'whatsapp' | 'neighborhood' | 'address' | 'lat' | 'lng'>>) => void
}

export const useCustomer = create<CustomerState>()(
  persist(
    (set) => ({
      name: '',
      whatsapp: '',
      neighborhood: '',
      address: '',
      lat: null,
      lng: null,
      set: (data) => set(data),
    }),
    { name: 'sonset_customer' }
  )
)
