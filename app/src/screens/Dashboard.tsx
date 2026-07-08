import { useEffect, useState } from 'react'
import { useApp } from '../lib/AppContext'
import { getAppointments, getClients, getServices, getStaff } from '../lib/data'
import { money, initials, fmtTime } from '../lib/util'

export default function Dashboard() {
  const { loc, current } = useApp()
  const [appts, setAppts] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])

  useEffect(() => {
    getAppointments().then(setAppts)
    getClients().then(setClients)
    getServices().then(setServices)
    getStaff().then(setStaff)
  }, [])

  const svc = (id: string) => services.find((s) => s.id === id)
  const client = (id: string) => clients.find((c) => c.id === id)
  const stf = (id: string) => staff.find((s) => s.id === id)
  const priceOf = (a: any) => { const s = svc(a.svcId); return s ? (s.price[a.locId] ?? Object.values(s.price)[0] ?? 0) : 0 }

  const A = loc === 'all' ? appts : appts.filter((a) => a.locId === loc)
  const rev = A.filter((a) => a.status === 'paid').reduce((s, a) => s + priceOf(a), 0)
  const proj = A.reduce((s, a) => s + priceOf(a), 0)
  const up = [...A].filter((a) => a.status !== 'paid').sort((x, y) => x.h * 60 + x.m - (y.h * 60 + y.m)).slice(0, 6)

  return (
    <div className="pad">
      <div className="view-head">
        <div>
          <div className="eyebrow">{current.name} · Today</div>
          <h1>Good morning, Caleb</h1>
          <div className="sub">Everything across the business, in one place.</div>
        </div>
      </div>
      <div className="kpi-grid">
        <div className="kpi kpi-mango"><div className="lab">Collected today</div><div className="val num">{money(rev)}</div><div className="delta">{money(proj)} projected</div></div>
        <div className="kpi"><div className="lab">Appointments</div><div className="val num">{A.length}</div><div className="delta">{A.filter((a) => a.status === 'paid').length} checked out</div></div>
        <div className="kpi"><div className="lab">New clients (mo)</div><div className="val num">18</div><div className="delta">▲ 22% vs last</div></div>
        <div className="kpi"><div className="lab">Membership MRR</div><div className="val num">$1,980</div><div className="delta">20 active</div></div>
      </div>
      <div className="panel">
        <div className="panel-h"><h3>Up next</h3><span className="tag green">live</span></div>
        <table className="tbl"><tbody>
          {up.map((a) => {
            const cl = client(a.clientId), s = stf(a.staffId), sv0 = svc(a.svcId)
            if (!cl || !sv0) return null
            return (
              <tr key={a.id}>
                <td><span className="chip" style={{ background: cl.color }}>{initials(cl.name)}</span>{cl.name}</td>
                <td style={{ color: 'var(--muted)' }}>{sv0.name}</td>
                <td style={{ color: 'var(--muted)' }}>{s?.name}</td>
                <td className="r num" style={{ fontWeight: 600 }}>{fmtTime(a.h, a.m)}</td>
              </tr>
            )
          })}
        </tbody></table>
      </div>
    </div>
  )
}
