import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Icon } from './Icon'
import { APPS, NAV, BADGES } from '../lib/config'
import { useApp } from '../lib/AppContext'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export default function TopNav({ onOpenLauncher }: { onOpenLauncher: () => void }) {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const { stores, loc, setLoc, current } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const active = pathname.replace('/', '') || 'dashboard'

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
        <div style={{ position: 'relative' }}>
          <button className="store-btn" onClick={() => setMenuOpen((v) => !v)}>
            <span className="dot" style={{ background: current.color }} />
            {current.name}
            <Icon name="chevron" size={14} style={{ opacity: 0.8 }} />
          </button>
          {menuOpen && (
            <div className="store-menu" style={{ right: 0 }} onMouseLeave={() => setMenuOpen(false)}>
              <div className={'store-opt' + (loc === 'all' ? ' sel' : '')} onClick={() => { setLoc('all'); setMenuOpen(false) }}>
                <Icon name="apps" size={14} /> All stores
              </div>
              {stores.map((s) => (
                <div key={s.id} className={'store-opt' + (loc === s.id ? ' sel' : '')} onClick={() => { setLoc(s.id); setMenuOpen(false) }}>
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
        <div className="avatar-me" title={isSupabaseConfigured ? 'Sign out' : 'Caleb W.'}
          onClick={() => { if (isSupabaseConfigured && confirm('Sign out?')) supabase.auth.signOut() }}>CW</div>
      </div>
    </header>
  )
}
