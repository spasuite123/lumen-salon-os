import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { getStores } from './data'

type Store = { id: string; name: string; city: string; color: string }
type Ctx = {
  stores: Store[]
  loc: string // 'all' or a store id
  setLoc: (v: string) => void
  current: { id: string; name: string; city?: string; color: string }
}

const AppCtx = createContext<Ctx>(null as any)
export const useApp = () => useContext(AppCtx)

export function AppProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<Store[]>([])
  const [loc, setLoc] = useState('lay')

  useEffect(() => {
    getStores().then((s) => {
      setStores(s)
      if (s.length && !s.find((x) => x.id === loc)) setLoc(s[0].id)
    })
  }, [])

  const current =
    loc === 'all'
      ? { id: 'all', name: 'All stores', color: '#AAB2CC' }
      : stores.find((s) => s.id === loc) || { id: loc, name: '—', color: '#AAB2CC' }

  return <AppCtx.Provider value={{ stores, loc, setLoc, current }}>{children}</AppCtx.Provider>
}
