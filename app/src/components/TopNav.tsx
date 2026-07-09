import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Icon } from './Icon'
import { APPS, NAV, BADGES } from '../lib/config'
import { useApp } from '../lib/AppContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export default function TopNav({ onOpenLauncher, session }: { onOpenLauncher: () => void; session?: any }) {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const { stores, loc, setLoc, current } = useApp()
  const [storeOpen, setStoreOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const active = pathname.replace('/', '') || 'dashboard'

  const userMeta = session?.user?.user_metadata || {}
  const displayName = userMeta.name || session?.user?.email || 'Account'
  const initials = displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'SP'

  const signOut = async () => {
    setUserOpen(false)
    await supabase.auth.signOut()
  }

  return (
    <header className="topnav">
      <div className="logo" title="Home" onClick={() => nav('/dashboard')}>S</div>
      <div className="nav-row">
        {NAV.map((id) => {
          const a = APPS.find((x) => x.id === id)!
          const on = active === id
          return (
            <button key={id} className={'nav-item' + (on ? ' active' : '')} onClick={() => nav('/' + id)}>
              <Icon name={id} size={20} />
              <span>{a.name}</span>
              {BADGES[id] ? <span className="nav-badge">{BADGES[id]}</span> : null}
            </button>
          )
        })}
      </div>
      <div className="nav-sp" />
      <div className="navx">
        {/* Store picker */}
        <div style={{ position: 'relative' }}>
          <button className="store-btn" onClick={() => setStoreOpen((v) => !v)}>
            <span className="dot" style={{ background: current.color }} />
            {current.name}
            <Icon name="chevron" size={14} style={{ opacity: 0.8 }} />
          </button>
          {storeOpen && (
            <div className="store-menu" style={{ right: 0 }} onMouseLeave={() => setStoreOpen(false)}>
              <div className={'store-opt' + (loc === 'all' ? ' sel' : '')} onClick={() => { setLoc('all'); setStoreOpen(false) }}>
                <Icon name="apps" size={14} /> All stores
              </div>
              {stores.map((s) => (
                <div key={s.id} className={'store-opt' + (loc === s.id ? ' sel' : '')} onClick={() => { setLoc(s.id); setStoreOpen(false) }}>
                  <span className="dot" style={{ background: s.color }} />
                  {s.name}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--faint)' }}>{(s.city || '').split(',')[0]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="navx-btn" title="Search"><Icon name="search" size={19} /></button>
        <button className="navx-btn" title="Notifications"><Icon name="bell" size={19} /></button>
        <button className="apps-btn" onClick={onOpenLauncher}><Icon name="apps" size={16} />Apps <kbd>⌘K</kbd></button>

        {/* User menu */}
        <div style={{ position: 'relative' }}>
          <div className="avatar-me" title={displayName} onClick={() => setUserOpen((v) => !v)}
            style={{ cursor: 'pointer' }}>
            {initials}
          </div>
          {userOpen && (
            <div className="store-menu" style={{ right: 0, minWidth: 200 }} onMouseLeave={() => setUserOpen(false)}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-2)' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{displayName}</div>
                {session?.user?.email && displayName !== session.user.email && (
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{session.user.email}</div>
                )}
              </div>
              {isSupabaseConfigured && (
                <div className="store-opt" onClick={signOut}
                  style={{ color: 'var(--rose)', fontWeight: 500 }}>
                  Sign out
                </div>
              )}
              {!isSupabaseConfigured && (
                <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)' }}>Demo mode — no auth</div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
