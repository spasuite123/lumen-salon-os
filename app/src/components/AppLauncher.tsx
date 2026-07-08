import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { APPS } from '../lib/config'

export default function AppLauncher({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const match = (n: string) => n.toLowerCase().includes(q.toLowerCase())
  const tile = (a: any) => (
    <button key={a.id} className="app-tile" onClick={() => { onClose(); nav('/' + a.id) }}>
      <span className={'app-ico' + (a.group === 'mkt' ? ' mkt' : '')}><Icon name={a.id} size={21} /></span>
      <span className="nm">{a.name}</span>
    </button>
  )
  const core = APPS.filter((a) => a.group === 'core' && match(a.name))
  const mkt = APPS.filter((a) => a.group === 'mkt' && match(a.name))
  const setup = APPS.filter((a) => a.group === 'setup' && match(a.name))
  return (
    <div className="launcher-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="launcher">
        <div className="launcher-search">
          <Icon name="search" size={20} />
          <input autoFocus placeholder="Search apps" value={q} onChange={(e) => setQ(e.target.value)} />
          <span style={{ fontSize: 11, color: 'var(--faint)', border: '1px solid var(--line)', borderRadius: 5, padding: '1px 6px' }}>⌘K</span>
        </div>
        <div className="launcher-grid">
          <div className="lg-col"><h4>Core Apps</h4><div className="core-sub">{core.length ? core.map(tile) : <div style={{ color: 'var(--faint)' }}>No matches</div>}</div></div>
          <div className="lg-col"><h4>Marketing &amp; Automation</h4>{mkt.map(tile)}</div>
          <div className="lg-col"><h4>Setup &amp; Management</h4>{setup.map(tile)}</div>
        </div>
      </div>
    </div>
  )
}
