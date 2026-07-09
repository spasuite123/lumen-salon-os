import { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useApp } from '../lib/AppContext'
import { getAppointments, getClients, getServices, getStaff, getProducts, getGiftCards, createAppointment, checkoutAppointment, refundAppointment, getOffers } from '../lib/data'
import { money, initials, fmtTime, isoDate } from '../lib/util'
import { toast } from '../lib/toast'
import { createPaymentIntent } from '../lib/integrations'

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null

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
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <Elements stripe={stripePromise}>
        <CheckoutInner d={d} priceCents={priceCents} onClose={onClose} onDone={onDone} />
      </Elements>
    </>
  )
}

function CheckoutInner({ d, priceCents, onClose, onDone }: any) {
  const stripe = useStripe()
  const elements = useElements()
  const { appt, sv, cl, st } = d

  // Retail add-ons
  const [products, setProducts] = useState<any[]>([])
  const [cart, setCart] = useState<{ id: string; name: string; price: number; qty: number }[]>([])
  const [showPicker, setShowPicker] = useState(false)

  // Tip — tipPct=null means custom dollar amount
  const [tipPct, setTipPct] = useState<number | null>(0)
  const [tipDollar, setTipDollar] = useState('')

  // Offer
  const [offers, setOffers] = useState<any[]>([])
  const [offerId, setOfferId] = useState('')

  // Gift card
  const [gcCards, setGcCards] = useState<any[]>([])
  const [gcCode, setGcCode] = useState('')
  const [gcApplied, setGcApplied] = useState<{ code: string; balance: number } | null>(null)

  // Payment
  const [method, setMethod] = useState('card')
  const [cardError, setCardError] = useState('')
  const [busy, setBusy] = useState(false)

  const paid = appt.status === 'paid'

  useEffect(() => {
    if (!paid) {
      getOffers().then((o) => setOffers(o.filter((x: any) => x.id && x.active !== false)))
      getProducts().then(setProducts)
      getGiftCards().then(setGcCards)
    }
  }, [])

  // ── Price math ──────────────────────────────────────────
  const productTotal = cart.reduce((s, p) => s + p.price * p.qty, 0)
  const subtotal = priceCents + productTotal

  const offer = offers.find((o) => o.id === offerId) || null
  const offerDiscount = offer
    ? (offer.kind === 'percent' ? Math.round(subtotal * offer.value / 100) : Math.round(offer.value))
    : 0

  const afterOffer = Math.max(0, subtotal - offerDiscount)
  const gcMax = gcApplied ? Math.min(gcApplied.balance, afterOffer) : 0
  const afterGc = Math.max(0, afterOffer - gcMax)

  const tipCents = tipPct !== null
    ? Math.round(afterGc * tipPct / 100)
    : Math.round((parseFloat(tipDollar || '0') || 0) * 100)

  const total = afterGc + tipCents

  // ── Actions ─────────────────────────────────────────────
  const addToCart = (p: any) => {
    setCart((prev) => {
      const ex = prev.find((x) => x.id === p.sku)
      if (ex) return prev.map((x) => x.id === p.sku ? { ...x, qty: x.qty + 1 } : x)
      return [...prev, { id: p.sku, name: p.name, price: p.price, qty: 1 }]
    })
    setShowPicker(false)
  }

  const applyGc = () => {
    const card = gcCards.find((c) => c.code.toLowerCase() === gcCode.toLowerCase())
    if (!card) { toast('Gift card not found'); return }
    if (card.balance <= 0) { toast('This gift card has no remaining balance'); return }
    setGcApplied({ code: card.code, balance: card.balance })
    setGcCode('')
  }

  const charge = async () => {
    setBusy(true)
    setCardError('')

    if (method === 'card' && stripe && elements) {
      const piRes = await createPaymentIntent(total, 'online')
      if (piRes.ok && !piRes.simulated) {
        const card = elements.getElement(CardElement) as any
        if (!card) { setBusy(false); return }
        const { error } = await stripe.confirmCardPayment(piRes.client_secret, { payment_method: { card } })
        if (error) { setCardError(error.message || 'Card declined'); setBusy(false); return }
      }
    } else if (method === 'reader') {
      await createPaymentIntent(total, 'terminal')
    }

    const res = await checkoutAppointment(
      { id: appt.id, storeId: appt.locId, clientId: appt.clientId, staffId: appt.staffId,
        serviceId: appt.svcId, serviceName: sv.name, priceCents },
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
    <aside className="drawer">
      <div className="dr-head">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="chip" style={{ background: cl.color, width: 44, height: 44, borderRadius: '50%', fontSize: 15, margin: 0 }}>{initials(cl.name)}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, fontFamily: 'Bricolage Grotesque' }}>{cl.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{cl.phone}</div>
          </div>
        </div>
        <button className="x-btn" onClick={onClose}>✕</button>
      </div>

      <div className="dr-body">
        {/* Status */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <span className="tag gray">{fmtTime(appt.h, appt.m)}</span>
          <span className={'tag ' + (paid ? 'green' : 'amber')}>{paid ? 'Paid' : 'Open ticket'}</span>
        </div>

        {/* Service */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.06em', marginBottom: 4 }}>TICKET</div>
        <div className="line-item">
          <div>
            <div style={{ fontWeight: 600 }}>{sv.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{sv.dur} min · {st.name}</div>
          </div>
          <div style={{ fontWeight: 600 }}>{money(priceCents)}</div>
        </div>

        {!paid && <>
          {/* Retail cart */}
          {cart.map((p) => (
            <div key={p.id} className="line-item" style={{ alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{p.name}</div>
                {p.qty > 1 && <div style={{ fontSize: 11, color: 'var(--muted)' }}>× {p.qty}</div>}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{money(p.price * p.qty)}</span>
                <button onClick={() => setCart((c) => c.filter((x) => x.id !== p.id))}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
              </div>
            </div>
          ))}

          {/* Product picker */}
          {showPicker ? (
            <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden', marginTop: 6 }}>
              {products.map((p) => (
                <div key={p.sku} onClick={() => addToCart(p)}
                  style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--line-2)', fontSize: 13 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--mint-soft)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}>
                  <span>{p.name}</span>
                  <span style={{ fontWeight: 600 }}>{money(p.price)}</span>
                </div>
              ))}
              <div onClick={() => setShowPicker(false)}
                style={{ padding: '9px 14px', cursor: 'pointer', color: 'var(--muted)', fontSize: 12.5, textAlign: 'center' }}>
                Cancel
              </div>
            </div>
          ) : (
            <button className="btn ghost" style={{ fontSize: 12.5, padding: '7px 12px', marginTop: 6 }} onClick={() => setShowPicker(true)}>
              + Add retail product
            </button>
          )}

          {/* Offer */}
          <div className="field" style={{ marginTop: 18, marginBottom: 6 }}>
            <label>Promo / offer</label>
            <select value={offerId} onChange={(e) => setOfferId(e.target.value)}>
              <option value="">None</option>
              {offers.map((o) => <option key={o.id} value={o.id}>{o.name}{o.code ? ' (' + o.code + ')' : ''} · {o.type}</option>)}
            </select>
          </div>

          {/* Gift card */}
          <div className="field" style={{ marginBottom: 6 }}>
            <label>Gift card</label>
            {gcApplied ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '8px 0' }}>
                <span style={{ color: 'var(--mint-700)', fontWeight: 500 }}>{gcApplied.code} · {money(gcApplied.balance)} balance</span>
                <button onClick={() => setGcApplied(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>Remove</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={gcCode} onChange={(e) => setGcCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && applyGc()}
                  placeholder="Enter code"
                  style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none' }} />
                <button className="btn ghost" style={{ fontSize: 13, padding: '7px 12px', whiteSpace: 'nowrap' }}
                  onClick={applyGc} disabled={!gcCode}>Apply</button>
              </div>
            )}
          </div>

          {/* Tip */}
          <div style={{ marginTop: 16, fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.06em' }}>TIP</div>
          <div className="tip-row">
            {[0, 18, 20, 25].map((p) => (
              <button key={p} className={'tip-btn' + (tipPct === p ? ' on' : '')}
                onClick={() => { setTipPct(p); setTipDollar('') }}>
                {p === 0 ? 'None' : p + '%'}
              </button>
            ))}
            <button className={'tip-btn' + (tipPct === null ? ' on' : '')}
              onClick={() => setTipPct(null)}>
              Custom
            </button>
          </div>
          {tipPct === null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}>$</span>
              <input type="number" min="0" step="0.50" value={tipDollar}
                onChange={(e) => setTipDollar(e.target.value)}
                placeholder="0.00"
                autoFocus
                style={{ width: 110, border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none' }} />
            </div>
          )}

          {/* Itemized breakdown */}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 18, paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
              <span>Subtotal</span><span>{money(subtotal)}</span>
            </div>
            {offerDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--mint-700)', marginBottom: 6 }}>
                <span>Discount{offer?.code ? ' · ' + offer.code : ''}</span><span>−{money(offerDiscount)}</span>
              </div>
            )}
            {gcMax > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--mint-700)', marginBottom: 6 }}>
                <span>Gift card · {gcApplied?.code}</span><span>−{money(gcMax)}</span>
              </div>
            )}
            {tipCents > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span>Tip{tipPct !== null && tipPct > 0 ? ' (' + tipPct + '%)' : ''}</span><span>{money(tipCents)}</span>
              </div>
            )}
            <div className="total-row"><span style={{ fontWeight: 600 }}>Total due</span><span className="tv num">{money(total)}</span></div>
          </div>

          {/* Payment method */}
          <div className="field" style={{ marginTop: 14 }}>
            <label>Payment method</label>
            <select value={method} onChange={(e) => { setMethod(e.target.value); setCardError('') }}>
              <option value="card">Card (enter now)</option>
              <option value="cash">Cash</option>
              <option value="reader">Card reader (Stripe Terminal)</option>
            </select>
          </div>
          {method === 'card' && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Card details</label>
              <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '12px 14px', background: 'var(--surface-2)' }}>
                <CardElement
                  options={{ style: { base: { fontSize: '14px', fontFamily: 'Inter, system-ui, sans-serif', color: '#1a2e26', '::placeholder': { color: '#aab2bb' } }, invalid: { color: '#d9657a' } } }}
                  onChange={() => setCardError('')}
                />
              </div>
              {cardError && <div style={{ fontSize: 12, color: 'var(--rose)', marginTop: 6 }}>{cardError}</div>}
            </div>
          )}
        </>}
      </div>

      <div className="dr-foot">
        {paid
          ? <><button className="btn ghost" onClick={refund} disabled={busy} style={{ color: 'var(--rose)' }}>{busy ? '…' : 'Refund'}</button><button className="btn ghost" onClick={onClose}>Close</button></>
          : <><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={charge} disabled={busy}>{busy ? 'Charging…' : 'Charge ' + money(total)}</button></>
        }
      </div>
    </aside>
  )
}
