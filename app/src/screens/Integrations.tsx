import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicBookOptions, createPublicBooking, getIntegrationSettings, saveIntegrationSettings } from '../lib/integrations'
import { toast } from '../lib/toast'

/* ===================== PUBLIC BOOKING PAGE (no login) ===================== */
export function PublicBooking() {
  const { slug = '' } = useParams()
  const [opts, setOpts] = useState<any>(null)
  const [storeId, setStoreId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState('10:00')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => { getPublicBookOptions(slug).then((o) => {
    setOpts(o)
    if (o?.enabled) { setStoreId(o.stores?.[0]?.id || ''); setServiceId(o.services?.[0]?.id || ''); setStaffId(o.staff?.[0]?.id || '') }
  }) }, [slug])

  if (!opts) return <div className="login-wrap"><div style={{ color: 'var(--muted)' }}>Loading…</div></div>
  if (!opts.enabled) return <div className="login-wrap"><div className="login-card"><div className="logo">S</div><h1 style={{ fontSize: 20, textAlign: 'center' }}>Online booking isn't available</h1><p style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 8 }}>This spa hasn't turned on online booking yet.</p></div></div>

  const submit = async () => {
    if (!name || !phone) { toast('Name and phone are required'); return }
    setBusy(true)
    const startsAt = new Date(date + 'T' + time + ':00').toISOString()
    const res = await createPublicBooking({ slug, p_store_id: storeId, p_service_id: serviceId, p_staff_id: staffId, p_name: name, p_phone: phone, p_starts_at: startsAt })
    setBusy(false)
    if (res.ok) setDone(true); else toast('Error: ' + res.error)
  }

  if (done) return <div className="login-wrap"><div className="login-card"><div className="logo">L</div><h1 style={{ fontSize: 22, textAlign: 'center' }}>You're booked!</h1><p style={{ textAlign: 'center', color: 'var(--muted)', marginTop: 8 }}>We'll see you soon, {name.split(' ')[0]}. A confirmation will be texted to {phone}.</p></div></div>

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ width: 440 }}>
        <div className="logo">L</div>
        <h1 style={{ fontSize: 22, textAlign: 'center', marginBottom: 4 }}>Book an appointment</h1>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>Pick a service and time that works for you</p>
        <div className="field"><label>Location</label><select value={storeId} onChange={(e) => setStoreId(e.target.value)}>{opts.stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="field"><label>Service</label><select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>{opts.services.map((s: any) => <option key={s.id} value={s.id}>{s.name} · {s.duration_min}min</option>)}</select></div>
        <div className="field"><label>Provider</label><select value={staffId} onChange={(e) => setStaffId(e.target.value)}>{opts.staff.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field" style={{ flex: 1 }}><label>Time</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        </div>
        <div className="field"><label>Your name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" /></div>
        <div className="field" style={{ marginBottom: 20 }}><label>Mobile number</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(801) 555-0100" /></div>
        <button className="btn" style={{ width: '100%', justifyContent: 'center', padding: 12 }} onClick={submit} disabled={busy}>{busy ? 'Booking…' : 'Confirm booking'}</button>
      </div>
    </div>
  )
}

/* ===================== INTEGRATIONS CONTROL PANEL ===================== */
function StatusPill({ s }: { s: string }) {
  const map: any = { off: 'gray', test: 'amber', live: 'green' }
  return <span className={'tag ' + (map[s] || 'gray')}>{s === 'off' ? 'Off' : s === 'test' ? 'Test' : 'Live'}</span>
}

export function Integrations() {
  const [s, setS] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { getIntegrationSettings().then(setS) }, [])
  if (!s) return <div className="pad"><div style={{ color: 'var(--muted)' }}>Loading…</div></div>
  const set = (patch: any) => setS({ ...s, ...patch })
  const save = async () => {
    setBusy(true)
    const res = await saveIntegrationSettings({
      sms_status: s.sms_status, sms_from_number: s.sms_from_number,
      payments_status: s.payments_status, payments_publishable_key: s.payments_publishable_key, payments_terminal_enabled: s.payments_terminal_enabled,
      online_booking_enabled: s.online_booking_enabled, booking_slug: s.booking_slug,
    })
    setBusy(false)
    toast(res.ok ? 'Integration settings saved' : 'Error: ' + res.error)
  }
  const bookingUrl = (typeof window !== 'undefined' ? window.location.origin : '') + '/book/' + (s.booking_slug || '')

  return (
    <div className="pad" style={{ maxWidth: 760 }}>
      <div className="view-head"><div><div className="eyebrow">Setup</div><h1>Integrations</h1><div className="sub">Connect texting, payments, and online booking. Everything is off until you turn it on — no charges before then.</div></div><button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></div>

      {/* SMS */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-h"><h3>Two-way texting (Telnyx)</h3><StatusPill s={s.sms_status} /></div>
        <div style={{ padding: 18 }}>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14 }}>Send and receive client texts in the Inbox. Requires a Telnyx number + API key set as Edge Function secrets, and the <code>send-sms</code> / <code>telnyx-webhook</code> functions deployed.</p>
          <div className="field"><label>Status</label><select value={s.sms_status} onChange={(e) => set({ sms_status: e.target.value })}><option value="off">Off</option><option value="test">Test (simulate, no send)</option><option value="live">Live</option></select></div>
          <div className="field"><label>From number (your Telnyx number)</label><input value={s.sms_from_number || ''} onChange={(e) => set({ sms_from_number: e.target.value })} placeholder="+18015551234" /></div>
        </div>
      </div>

      {/* Payments */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-h"><h3>Payments (Stripe)</h3><StatusPill s={s.payments_status} /></div>
        <div style={{ padding: 18 }}>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14 }}>Charge cards at the front desk with a Stripe Terminal reader, or online. Requires a Stripe account; secret key as an Edge Function secret, publishable key below.</p>
          <div className="field"><label>Status</label><select value={s.payments_status} onChange={(e) => set({ payments_status: e.target.value })}><option value="off">Off</option><option value="test">Test mode</option><option value="live">Live</option></select></div>
          <div className="field"><label>Publishable key</label><input value={s.payments_publishable_key || ''} onChange={(e) => set({ payments_publishable_key: e.target.value })} placeholder="pk_live_…" /></div>
          <div className="toggle-row"><div className="t-l"><b>iPad reader (Stripe Terminal)</b><p>Collect card-present payments at the front desk</p></div><div className={'switch' + (s.payments_terminal_enabled ? ' on' : '')} onClick={() => set({ payments_terminal_enabled: !s.payments_terminal_enabled })} /></div>
        </div>
      </div>

      {/* Online booking */}
      <div className="panel">
        <div className="panel-h"><h3>Online booking</h3><StatusPill s={s.online_booking_enabled ? 'live' : 'off'} /></div>
        <div style={{ padding: 18 }}>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 14 }}>A public booking page you can link or embed on your website. Writes straight into your calendar.</p>
          <div className="toggle-row"><div className="t-l"><b>Enable online booking</b><p>Allow clients to self-book from your site</p></div><div className={'switch' + (s.online_booking_enabled ? ' on' : '')} onClick={() => set({ online_booking_enabled: !s.online_booking_enabled })} /></div>
          <div className="field" style={{ marginTop: 14 }}><label>Booking link slug</label><input value={s.booking_slug || ''} onChange={(e) => set({ booking_slug: e.target.value })} placeholder="drift-reflexology" /></div>
          {s.online_booking_enabled && <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>Public link: <a href={bookingUrl} target="_blank" style={{ color: 'var(--mint-700)', fontWeight: 600 }}>{bookingUrl}</a></div>}
        </div>
      </div>
    </div>
  )
}
