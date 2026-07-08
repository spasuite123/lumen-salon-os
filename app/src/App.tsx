import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import TopNav from './components/TopNav'
import AppLauncher from './components/AppLauncher'
import Login from './components/Login'
import Dashboard from './screens/Dashboard'
import Calendar from './screens/Calendar'
import Clients from './screens/Clients'
import ListScreen from './screens/ListScreen'
import { Sales, Reports, Inbox, Settings, Scaffold } from './screens/Misc'
import { PublicBooking, Integrations } from './screens/Integrations'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const LIST = ['products', 'giftcards', 'packages', 'memberships', 'offers', 'services', 'staff', 'resources', 'campaigns', 'timeclock', 'cashdrawer']
const SCAFFOLDS: Record<string, [string, string]> = {
  payroll: ['Payroll', 'Pay periods, commissions and tips'],
  flows: ['Flows', 'Automations that run on a trigger'],
  forms: ['Forms', 'Intake, consent and history forms'],
}

export default function App() {
  const [launcher, setLauncher] = useState(false)
  const [session, setSession] = useState<any>(undefined) // undefined = loading

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setLauncher((v) => !v) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }: any) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e: any, s: any) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Public, login-free online booking page (embeddable on the salon's website)
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/book/')) {
    return <Routes><Route path="/book/:slug" element={<PublicBooking />} /></Routes>
  }

  // Live mode: require a signed-in user (RLS grants access by role).
  if (isSupabaseConfigured) {
    if (session === undefined) return <div className="login-wrap"><div style={{ color: 'var(--muted)' }}>Loading…</div></div>
    if (!session) return <Login />
  }

  return (
    <div className="app">
      {!isSupabaseConfigured && (
        <div className="demo-banner">
          <b>Demo mode</b> — running on local sample data. Add your Supabase keys in <b>.env</b> to go live.
        </div>
      )}
      <TopNav onOpenLauncher={() => setLauncher(true)} />
      <div className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/integrations" element={<Integrations />} />
          {LIST.map((id) => <Route key={id} path={'/' + id} element={<ListScreen kind={id} />} />)}
          {Object.entries(SCAFFOLDS).map(([id, [t, s]]) => <Route key={id} path={'/' + id} element={<Scaffold id={id} title={t} sub={s} />} />)}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
      {launcher && <AppLauncher onClose={() => setLauncher(false)} />}
    </div>
  )
}
