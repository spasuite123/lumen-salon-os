import { useEffect, useState } from 'react'
import { useApp } from '../lib/AppContext'
import { getAppointments, getClients, getServices, getStaff, createAppointment, checkoutAppointment, refundAppointment, getOffers } from '../lib/data'
import { money, initials, fmtTime, isoDate } from '../lib/util'
import { toast } from '../lib/toast'
import { createPaymentIntent } from '../lib/integrations'

// Business hours: Mon–Sat, 10am–10pm, booked in 15-minute increments.
const DS = 10, DE = 22, STEP = 15
const SLOTS_PER_HOUR = 60 / STEP
const SH = 26 // px per slot row

const isBizDay = (d: Date) => d.getDay() !== 0 // closed Sundays
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
/** Step to the next/prev day, skipping Sundays automatically. */
const shiftBizDay = (d: Date, dir: 1 | -1) => {
  let n = addDays(d, dir)
  while (!isBizDay(n)) n = addDays(n, dir)
  return n
}

export default function Calendar() {
  const { loc, current } = useApp()
  const [date, setDate] = useState<Date>(new Date())
  const [appts, setAppts] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [reload, setReload] = useState(0)
  const [drawer, setDrawer] = useState<any>(null)

  useEffect(() => { getClients().then(setClients); getServices().then(setServices); getStaff().then(setStaff) }, [])
  useEffect(() => { getAppointments(isoDate(date)).then(setAppts) }, [reload, date])

  if (loc === 'all') {
    return (
      <div className="empty">
        <div className="ec">📅</div>
        <h3>The calendar runs per store</h3>
        <p>Pick a single store up top. Each location has its own chairs, staff and pricing.</p>
      </div>
    )
  }

  const svc = (id: string) => services.find((s) => s.id === id)
  const client = (id: string) => clients.find((c) => c.id === id)
  const priceAt = (s: any) => (s ? (s.price[loc] ?? Object.values(s.price)[0] ?? 0) : 0)
  const priceOf = (a: any) => priceAt(svc(a.svcId))
  const cols = staff.filter((s) => (s.locs || []).includes(loc))
  const A = appts.filter((a) => a.locId === loc)
  const closed = !isBizDay(date)
  const slots = (DE - DS) * SLOTS_PER_HOUR
  const dstr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const isToday = isoDate(date) === isoDate(new Date())
  const gridCols = `60px repeat(${cols.length || 1}, minmax(170px, 1fr))`

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 22px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn ghost" style={{ padding: '7px 10px' }} onClick={() => setDate((d) => shiftBizDay(d, -1))}>‹</button>
          <button className="btn ghost" style={{ padding: '7px 10px' }} onClick={() => setDate((d) => shiftBizDay(d, 1))}>›</button>
          <input
            type="date"
            value={isoDate(date)}
            onChange={(e) => e.target.value && setDate(new Date(e.target.value + 'T00:00:00'))}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: 12.5, color: 'var(--muted)', marginLeft: 4 }}
          />
        </div>
        <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 600, fontSize: 17 }}>
          {dstr.split(',')[0]}{isToday && <span className="tag green" style={{ marginLeft: 8, verticalAlign: 2 }}>Today</span>}
          <div style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 12, color: 'var(--muted)' }}>{dstr.split(', ').slice(1).join(', ')} · {current.name}</div>
        </div>
        <div style={{ flex: 1 }} />
        <span className="tag gray">{cols.length} chairs</span>
        <button className="btn" disabled={closed} onClick={() => setDrawer({ mode: 'book', staffId: cols[0]?.id, h: DS, m: 0 })}>+ New booking</button>
      </div>

      {closed ? (
        <div className="empty" style={{ padding: '60px 20px' }}>
          <div className="ec">🌙</div>
          <h3>Closed Sundays</h3>
          <p>Business hours are Monday–Saturday, 10am–10pm. Use the arrows above to jump to the next open day.</p>
        </div>
      ) : (
        <div style={{ overflow: 'auto', height: 'calc(100vh - 60px - 60px)' }}>
          <div style={{ minWidth: 'max-content' }}>
            <div className="cal-head" style={{ gridTemplateColumns: gridCols }}>
              <div />
              {cols.map((s) => (
                <div className="cal-staff" key={s.id}>
                  <span className="chip" style={{ background: s.color, margin: 0 }}>{initials(s.name)}</span>
                  <div><b style={{ fontSize: 13 }}>{s.name}</b><div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.role}</div></div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: gridCols }}>
              <div>
                {Array.from({ length: slots }).map((_, i) => {
                  const h = DS + Math.floor(i / SLOTS_PER_HOUR), m = (i % SLOTS_PER_HOUR) * STEP
                  return <div key={i} style={{ height: SH, position: 'relative', borderBottom: '1px solid var(--line-2)' }}>{m === 0 && <span style={{ position: 'absolute', top: -7, right: 8, fontSize: 11, color: 'var(--faint)' }}>{fmtTime(h, 0)}</span>}</div>
                })}
              </div>
              {cols.map((s) => (
                <div key={s.id} style={{ position: 'relative', borderLeft: '1px solid var(--line-2)' }}>
                  {Array.from({ length: slots }).map((_, i) => {
                    const h = DS + Math.floor(i / SLOTS_PER_HOUR), m = (i % SLOTS_PER_HOUR) * STEP
                    return <div key={i} className="cal-slot" style={{ height: SH, cursor: 'pointer' }}
                      onClick={() => setDrawer({ mode: 'book', staffId: s.id, h, m })}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--mint-soft)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '')} />
                  })}
                  {A.filter((a) => a.staffId === s.id).map((a) => {
                    const sv0 = svc(a.svcId), cl = client(a.clientId)
                    if (!sv0 || !cl) return null
                    const top = ((a.h - DS) * 60 + a.m) / STEP * SH
                    const hgt = (sv0.dur / STEP) * SH - 4
                    const paid = a.status === 'paid'
                    return (
                      <div key={a.id} className="appt" style={{ top, height: hgt, background: s.color + '1a', borderLeftColor: s.color }}
                        onClick={() => setDrawer({ mode: 'checkout', appt: a, sv: sv0, cl, st: s })}>
                        {paid && <span style={{ position: 'absolute', top: 5, right: 6, fontSize: 9, fontWeight: 700, color: 'var(--mint-700)' }}>PAID</span>}
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: s.color }}>{cl.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sv0.name}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 1 }}>{fmtTime(a.h, a.m)} · {money(priceOf(a))}</div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {drawer?.mode === 'book' && (
        <BookingDrawer loc={loc} clients={clients} services={services} staff={cols} pre={drawer} dateISO={isoDate(date)} dateLabel={dstr}
          onClose={() => setDrawer(null)} onDone={() => { setDrawer(null); setReload((r) => r + 1) }} />
      )}
      {drawer?.mode === 'checkout' && (
        <CheckoutDrawer d={drawer} priceCents={priceOf(drawer.appt)}
          onClose={() => setDrawer(null)} onDone={() => { setDrawer(null); setReload((r) => r + 1) }} />
      )}
    </div>
  )
}

function timeOptions() {
  const out: { v: string; label: string }[] = []
  for (let i = 0; i < (DE - DS) * SLOTS_PER_HOUR; i++) { const h = DS + Math.floor(i / SLOTS_PER_HOUR), m = (i % SLOTS_PER_HOUR) * STEP; out.push({ v: h + ':' + m, label: fmtTime(h, m) }) }
  return out
}

function BookingDrawer({ loc, clients, services, staff, pre, dateISO, dateLabel, onClose, onDone }: any) {
  const [clientId, setClientId] = useState(pre.clientId || clients[0]?.id || '')
  const [serviceId, setServiceId] = useState(services[0]?.id || '')
  const [staffId, setStaffId] = useState(pre.staffId || staff[0]?.id || '')
  const [time, setTime] = useState((pre.h ?? DS) + ':' + (pre.m ?? 0))
  const [busy, setBusy] = useState(false)
  const priceAt = (s: any) => (s ? (s.price[loc] ?? Object.values(s.price)[0] ?? 0) : 0)

  const confirm = async () => {
    setBusy(true)
    const s = services.find((x: any) => x.id === serviceId)
    const [h, m] = time.split(':').map(Number)
    const res = await createAppointment({ storeId: loc, clientId, staffId, serviceId, h, m, priceCents: priceAt(s), durMin: s?.dur || 60, dateISO })
    setBusy(false)
    if (res.ok) { toast('Booked ' + (clients.find((c: any) => c.id === clientId)?.name || '')); onDone() }
    else toast('Error: ' + res.error)
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="dr-head"><h2 style={{ fontSize: 19 }}>New booking</h2><button className="x-btn" onClick={onClose}>✕</button></div>
        <div className="dr-body">
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>{dateLabel}</div>
          <div className="field"><label>Client</label><select value={clientId} onChange={(e) => setClientId(e.target.value)}>{clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field"><label>Service</label><select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>{services.map((s: any) => <option key={s.id} value={s.id}>{s.name} · {money(priceAt(s))} · {s.dur}min</option>)}</select></div>
          <div className="field"><label>Team member</label><select value={staffId} onChange={(e) => setStaffId(e.target.value)}>{staff.map((s: any) => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}</select></div>
          <div className="field"><label>Start time</label><select value={time} onChange={(e) => setTime(e.target.value)}>{timeOptions().map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></div>
        </div>
        <div className="dr-foot"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={confirm} disabled={busy}>{busy ? 'Booking…' : 'Confirm booking'}</button></div>
      </aside>
    </>
  )
}

function CheckoutDrawer({ d, priceCents, onClose, onDone }: any) {
  const { appt, sv, cl, st } = d
  const [tip, setTip] = useState(0)
  const [busy, setBusy] = useState(false)
  const [offers, setOffers] = useState<any[]>([])
  const [offerId, setOfferId] = useState('')
  const [method, setMethod] = useState('card')
  const paid = appt.status === 'paid'
  useEffect(() => { if (!paid) getOffers().then((o) => setOffers(o.filter((x: any) => x.id && x.active !== false))) }, [])

  const offer = offers.find((o) => o.id === offerId) || null
  const discount = offer ? (offer.kind === 'percent' ? Math.round(priceCents * offer.value / 100) : Math.round(offer.value)) : 0
  const net = Math.max(0, priceCents - discount)
  const tipCents = Math.round(net * tip / 100)
  const total = net + tipCents

  const charge = async () => {
    setBusy(true)
    if (method === 'reader') await createPaymentIntent(total, 'terminal') // no-op in simulate; collects on reader when Stripe is live
    const res = await checkoutAppointment(
      { id: appt.id, storeId: appt.locId, clientId: appt.clientId, staffId: appt.staffId, serviceId: appt.svcId, serviceName: sv.name, priceCents },
      tipCents, offer ? { id: offer.id, kind: offer.kind, value: offer.value } : null, method,
    )
    setBusy(false)
    if (res.ok) { toast('Charged ' + money(total) + ' to ' + cl.name); onDone() }
    else toast('Error: ' + res.error)
  }

  const refund = async () => {
    if (!confirm('Refund ' + money(priceCents) + ' to ' + cl.name + '?')) return
    setBusy(true)
    const res = await refundAppointment({ id: appt.id })
    setBusy(false)
    if (res.ok) { toast('Refunded ' + money(priceCents) + ' to ' + cl.name); onDone() }
    else toast('Error: ' + res.error)
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="dr-head">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="chip" style={{ background: cl.color, width: 44, height: 44, borderRadius: '50%', fontSize: 15, margin: 0 }}>{initials(cl.name)}</span>
            <div><div style={{ fontWeight: 600, fontSize: 16, fontFamily: 'Bricolage Grotesque' }}>{cl.name}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{cl.phone}</div></div>
          </div>
          <button className="x-btn" onClick={onClose}>✕</button>
        </div>
        <div className="dr-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <span className="tag gray">{fmtTime(appt.h, appt.m)}</span>
            <span className={'tag ' + (paid ? 'green' : 'amber')}>{paid ? 'Paid' : 'Open ticket'}</span>
          </div>
          <div className="line-item"><div><div style={{ fontWeight: 600 }}>{sv.name}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{sv.dur} min · {st.name}</div></div><div style={{ fontWeight: 600 }}>{money(priceCents)}</div></div>
          {!paid && <>
            <div className="field" style={{ marginTop: 16, marginBottom: 6 }}><label>Apply offer</label>
              <select value={offerId} onChange={(e) => setOfferId(e.target.value)}>
                <option value="">No offer</option>
                {offers.map((o) => <option key={o.id} value={o.id}>{o.name}{o.code ? ' (' + o.code + ')' : ''} · {o.type}</option>)}
              </select>
            </div>
            {discount > 0 && <div className="line-item" style={{ color: 'var(--mint-700)' }}><div>Discount{offer?.code ? ' · ' + offer.code : ''}</div><div>-{money(discount)}</div></div>}
            <div style={{ marginTop: 16, fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>ADD TIP</div>
            <div className="tip-row">{[0, 18, 20, 25].map((p) => <button key={p} className={'tip-btn' + (tip === p ? ' on' : '')} onClick={() => setTip(p)}>{p === 0 ? 'None' : p + '%'}</button>)}</div>
            <div className="total-row"><span style={{ fontWeight: 600 }}>Total due</span><span className="tv num">{money(total)}</span></div>
            <div className="field" style={{ marginTop: 14, marginBottom: 0 }}><label>Payment method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="card">Card (manual)</option>
                <option value="cash">Cash</option>
                <option value="reader">Card on reader (Stripe Terminal)</option>
              </select>
            </div>
          </>}
        </div>
        <div className="dr-foot">
          {paid
            ? <><button className="btn ghost" onClick={refund} disabled={busy} style={{ color: 'var(--rose)' }}>{busy ? '…' : 'Refund'}</button><button className="btn ghost" onClick={onClose}>Close</button></>
            : <><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={charge} disabled={busy}>{busy ? 'Charging…' : 'Charge ' + money(total)}</button></>}
        </div>
      </aside>
    </>
  )
}
