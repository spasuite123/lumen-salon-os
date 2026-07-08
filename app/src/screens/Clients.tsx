import { useEffect, useState } from 'react'
import { getAppointments, getClients, getServices, getStaff, createClientRow } from '../lib/data'
import { money, initials } from '../lib/util'
import { toast } from '../lib/toast'

export default function Clients() {
  const [clients, setClients] = useState<any[]>([])
  const [appts, setAppts] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [sel, setSel] = useState<string>('')
  const [reload, setReload] = useState(0)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    getClients().then((c) => { setClients(c); if (c[0] && !sel) setSel(c[0].id) })
    getAppointments().then(setAppts)
    getServices().then(setServices)
    getStaff().then(setStaff)
  }, [reload])

  const svc = (id: string) => services.find((s) => s.id === id)
  const stf = (id: string) => staff.find((s) => s.id === id)
  const priceOf = (a: any) => { const s = svc(a.svcId); return s ? (s.price[a.locId] ?? Object.values(s.price)[0] ?? 0) : 0 }
  const c = clients.find((x) => x.id === sel)
  const visits = appts.filter((a) => a.clientId === sel)
  const spend = visits.filter((a) => a.status === 'paid').reduce((s, a) => s + priceOf(a), 0)

  return (
    <div className="two-pane" style={{ gridTemplateColumns: '330px 1fr' }}>
      <div className="pane-list">
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: 19 }}>Clients</h1>
          <button className="btn" style={{ padding: '7px 12px' }} onClick={() => setAdding(true)}>+ New</button>
        </div>
        {clients.map((x) => {
          const v = appts.filter((a) => a.clientId === x.id).length
          return (
            <div key={x.id} className={'list-item' + (sel === x.id ? ' sel' : '')} onClick={() => setSel(x.id)}>
              <span className="ava" style={{ background: x.color }}>{initials(x.name)}</span>
              <div><div style={{ fontWeight: 600 }}>{x.name}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{v} visits</div></div>
            </div>
          )
        })}
      </div>
      <div className="pane-body">
        {c && (
          <div className="pad">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
              <span className="ava" style={{ width: 64, height: 64, fontSize: 22, background: c.color, fontFamily: 'Bricolage Grotesque', borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff' }}>{initials(c.name)}</span>
              <div style={{ flex: 1 }}><h1 style={{ fontSize: 24 }}>{c.name}</h1><div style={{ color: 'var(--muted)' }}>{c.phone} · since {c.since}</div></div>
            </div>
            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
              <div className="kpi"><div className="lab">Visits</div><div className="val num">{visits.length}</div></div>
              <div className="kpi"><div className="lab">Lifetime</div><div className="val num">{money(spend)}</div></div>
              <div className="kpi"><div className="lab">Member</div><div className="val num" style={{ fontSize: 20 }}>—</div></div>
            </div>
            <div className="panel">
              <div className="panel-h"><h3>Visit history</h3></div>
              <table className="tbl"><tbody>
                {visits.map((a) => {
                  const sv0 = svc(a.svcId)
                  return (
                    <tr key={a.id}>
                      <td>{sv0?.name}</td>
                      <td style={{ color: 'var(--muted)' }}>{stf(a.staffId)?.name}</td>
                      <td className="r">{money(priceOf(a))}</td>
                      <td className="r"><span className={'tag ' + (a.status === 'paid' ? 'green' : 'amber')}>{a.status === 'paid' ? 'Paid' : 'Upcoming'}</span></td>
                    </tr>
                  )
                })}
                {!visits.length && <tr><td style={{ color: 'var(--muted)' }}>No visits yet</td></tr>}
              </tbody></table>
            </div>
          </div>
        )}
      </div>
      {adding && <NewClientModal onClose={() => setAdding(false)} onDone={() => { setAdding(false); setReload((r) => r + 1) }} />}
    </div>
  )
}

function NewClientModal({ onClose, onDone }: any) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!name.trim()) { toast('Enter a name'); return }
    setBusy(true)
    const res = await createClientRow(name.trim(), phone.trim())
    setBusy(false)
    if (res.ok) { toast('Added ' + name); onDone() } else toast('Error: ' + res.error)
  }
  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <h2 style={{ fontSize: 19, marginBottom: 16 }}>New client</h2>
        <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" autoFocus /></div>
        <div className="field" style={{ marginBottom: 20 }}><label>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(801) 555-0100" /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</button>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Add client'}</button>
        </div>
      </div>
    </div>
  )
}
