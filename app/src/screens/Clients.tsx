import React, { useEffect, useState } from 'react'
import { getAppointments, getClients, getServices, getStaff, createClientRow, updateClientNotes, getVisitNotes, saveVisitNote } from '../lib/data'
import { money, initials } from '../lib/util'
import { toast } from '../lib/toast'

const TAG_COLORS: Record<string, string> = {
  'VIP': '#7C6FD0',
  'New Client': '#0FA06F',
  'Lapsed': '#E8951F',
  'Allergy Note': '#D9657A',
}
const ALL_TAGS = ['VIP', 'New Client', 'Lapsed', 'Allergy Note']

export default function Clients() {
  const [clients, setClients] = useState<any[]>([])
  const [appts, setAppts] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [visitNotes, setVisitNotes] = useState<Record<string, string>>({})
  const [sel, setSel] = useState<string>('')
  const [reload, setReload] = useState(0)
  const [adding, setAdding] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getClients().then((c) => { setClients(c); if (c[0] && !sel) setSel(c[0].id) })
    getAppointments().then(setAppts)
    getServices().then(setServices)
    getStaff().then(setStaff)
    getVisitNotes().then(setVisitNotes)
  }, [reload])

  const svc = (id: string) => services.find((s) => s.id === id)
  const stf = (id: string) => staff.find((s) => s.id === id)
  const priceOf = (a: any) => { const s = svc(a.svcId); return s ? (s.price[a.locId] ?? Object.values(s.price)[0] ?? 0) : 0 }

  const c = clients.find((x) => x.id === sel)
  const visits = appts.filter((a) => a.clientId === sel)
  const paidVisits = visits.filter((a) => a.status === 'paid')
  const spend = paidVisits.reduce((s, a) => s + priceOf(a), 0)
  const lastVisit = paidVisits[paidVisits.length - 1] || null
  const upcoming = visits.find((a) => a.status === 'booked')

  const filtered = search
    ? clients.filter((x) => x.name.toLowerCase().includes(search.toLowerCase()) || (x.phone || '').includes(search))
    : clients

  const onSaveClient = async (notes: string, email: string, tags: string[]) => {
    await updateClientNotes(sel, notes, email, tags)
    setReload((r) => r + 1)
    toast('Saved')
  }

  const onSaveVisitNote = async (apptId: string, note: string) => {
    await saveVisitNote(apptId, note)
    setVisitNotes((prev) => ({ ...prev, [apptId]: note }))
  }

  return (
    <div className="two-pane" style={{ gridTemplateColumns: '300px 1fr' }}>
      {/* ── Left: client list ── */}
      <div className="pane-list">
        <div style={{ padding: '14px 14px 10px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', fontSize: 13, outline: 'none' }}
          />
          <button className="btn" style={{ padding: '7px 12px', whiteSpace: 'nowrap' }} onClick={() => setAdding(true)}>+ New</button>
        </div>
        {filtered.map((x) => {
          const v = appts.filter((a) => a.clientId === x.id)
          const paid = v.filter((a) => a.status === 'paid').length
          return (
            <div key={x.id} className={'list-item' + (sel === x.id ? ' sel' : '')} onClick={() => setSel(x.id)}>
              <span className="ava" style={{ background: x.color }}>{initials(x.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{x.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span>{paid} visits</span>
                  {(x.tags || []).map((t: string) => (
                    <span key={t} style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: (TAG_COLORS[t] || '#888') + '22', color: TAG_COLORS[t] || '#888' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
        {!filtered.length && (
          <div style={{ padding: '20px 16px', color: 'var(--muted)', fontSize: 13 }}>No clients found</div>
        )}
      </div>

      {/* ── Right: profile ── */}
      <div className="pane-body" style={{ overflow: 'auto' }}>
        {c && (
          <ClientProfile
            key={c.id}
            client={c}
            visits={visits}
            spend={spend}
            lastVisit={lastVisit}
            upcoming={upcoming}
            svc={svc}
            stf={stf}
            priceOf={priceOf}
            visitNotes={visitNotes}
            onSave={onSaveClient}
            onSaveVisitNote={onSaveVisitNote}
          />
        )}
      </div>

      {adding && (
        <NewClientModal onClose={() => setAdding(false)} onDone={() => { setAdding(false); setReload((r) => r + 1) }} />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  ClientProfile                                              */
/* ─────────────────────────────────────────────────────────── */
function ClientProfile({ client: c, visits, spend, lastVisit, upcoming, svc, stf, priceOf, visitNotes, onSave, onSaveVisitNote }: any) {
  const [editing, setEditing] = useState(false)
  const [draftNotes, setDraftNotes] = useState(c.notes || '')
  const [draftEmail, setDraftEmail] = useState(c.email || '')
  const [draftTags, setDraftTags] = useState<string[]>(c.tags || [])
  const [notesDirty, setNotesDirty] = useState(false)
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null)
  const [visitDraft, setVisitDraft] = useState<Record<string, string>>({})

  // Reset draft when client changes
  useEffect(() => {
    setDraftNotes(c.notes || '')
    setDraftEmail(c.email || '')
    setDraftTags(c.tags || [])
    setNotesDirty(false)
    setEditing(false)
    setExpandedVisit(null)
  }, [c.id])

  const toggleTag = (t: string) =>
    setDraftTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))

  const handleSave = () => {
    onSave(draftNotes, draftEmail, draftTags)
    setEditing(false)
    setNotesDirty(false)
  }

  const openVisitNote = (apptId: string) => {
    setVisitDraft((prev) => ({ ...prev, [apptId]: visitNotes[apptId] || '' }))
    setExpandedVisit(apptId)
  }

  const commitVisitNote = (apptId: string) => {
    onSaveVisitNote(apptId, visitDraft[apptId] || '')
    setExpandedVisit(null)
  }

  const lastSvcName = lastVisit ? (svc(lastVisit.svcId)?.name || '—') : '—'

  return (
    <div className="pad">
      {/* ── Header ── */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginBottom: 24 }}>
        <span style={{ width: 72, height: 72, fontSize: 24, background: c.color, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', fontFamily: 'Bricolage Grotesque', fontWeight: 700, flexShrink: 0 }}>
          {initials(c.name)}
        </span>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24, marginBottom: 6 }}>{c.name}</h1>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                value={draftEmail}
                onChange={(e) => setDraftEmail(e.target.value)}
                placeholder="Email address"
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', fontSize: 13, width: 260, outline: 'none' }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ALL_TAGS.map((t) => (
                  <button key={t} onClick={() => toggleTag(t)}
                    style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (draftTags.includes(t) ? TAG_COLORS[t] : 'var(--line)'), background: draftTags.includes(t) ? TAG_COLORS[t] : 'var(--surface-2)', color: draftTags.includes(t) ? '#fff' : 'var(--muted)' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                {c.phone}{c.email ? ' · ' + c.email : ''} · client since {c.since}
                {c.membership && <span style={{ marginLeft: 8, fontWeight: 600, color: 'var(--mint-700)' }}>· {c.membership}</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(c.tags || []).map((t: string) => (
                  <span key={t} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: (TAG_COLORS[t] || '#888') + '18', color: TAG_COLORS[t] || '#888', border: '1px solid ' + (TAG_COLORS[t] || '#888') + '40' }}>{t}</span>
                ))}
              </div>
            </>
          )}
        </div>
        {editing
          ? <button className="btn" style={{ padding: '7px 16px' }} onClick={handleSave}>Save</button>
          : <button className="btn ghost" style={{ padding: '7px 16px' }} onClick={() => setEditing(true)}>Edit</button>
        }
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 22 }}>
        <div className="kpi">
          <div className="lab">Total visits</div>
          <div className="val num">{visits.length}</div>
        </div>
        <div className="kpi">
          <div className="lab">Lifetime spend</div>
          <div className="val num">{money(spend)}</div>
        </div>
        <div className="kpi">
          <div className="lab">Last service</div>
          <div className="val" style={{ fontSize: 15, lineHeight: 1.25 }}>{lastSvcName}</div>
        </div>
        <div className="kpi">
          <div className="lab">Next appt</div>
          <div className="val" style={{ fontSize: 15, lineHeight: 1.25 }}>
            {upcoming ? svc(upcoming.svcId)?.name?.split(' ').slice(0, 2).join(' ') || 'Booked' : '—'}
          </div>
        </div>
      </div>

      {/* ── Client notes ── */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-h">
          <h3>Client notes</h3>
          {notesDirty && (
            <button className="btn" style={{ padding: '5px 12px', fontSize: 12.5 }}
              onClick={() => { onSave(draftNotes, draftEmail, draftTags); setNotesDirty(false) }}>
              Save
            </button>
          )}
        </div>
        <div style={{ padding: '12px 18px' }}>
          <textarea
            value={draftNotes}
            onChange={(e) => { setDraftNotes(e.target.value); setNotesDirty(true) }}
            placeholder="Preferences, allergies, formulas, how they like their coffee — anything the team should know…"
            rows={3}
            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontSize: 13, resize: 'vertical', fontFamily: 'Inter, system-ui', outline: 'none', boxSizing: 'border-box', color: 'var(--ink)', background: 'var(--surface-2)' }}
          />
        </div>
      </div>

      {/* ── Visit history ── */}
      <div className="panel">
        <div className="panel-h">
          <h3>Visit history</h3>
          <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{visits.length} visit{visits.length !== 1 ? 's' : ''}</span>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Service</th>
              <th>Provider</th>
              <th className="r">Amount</th>
              <th className="r">Status</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {visits.map((a: any) => {
              const sv0 = svc(a.svcId)
              const provider = stf(a.staffId)
              const vNote = visitNotes[a.id] || ''
              const isOpen = expandedVisit === a.id
              return (
                <React.Fragment key={a.id}>
                  <tr>
                    <td>
                      <div style={{ fontWeight: 500 }}>{sv0?.name || '—'}</div>
                      {vNote && !isOpen && (
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, fontStyle: 'italic' }}>
                          {vNote.length > 70 ? vNote.slice(0, 70) + '…' : vNote}
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{provider?.name || '—'}</td>
                    <td className="r">{money(priceOf(a))}</td>
                    <td className="r">
                      <span className={'tag ' + (a.status === 'paid' ? 'green' : 'amber')}>
                        {a.status === 'paid' ? 'Paid' : 'Upcoming'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => isOpen ? setExpandedVisit(null) : openVisitNote(a.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: vNote ? 'var(--mint-700)' : 'var(--muted)', padding: '2px 6px', fontWeight: vNote ? 600 : 400 }}>
                        {vNote ? '📝 note' : '+ note'}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={5} style={{ background: 'var(--surface-2)', padding: '12px 18px' }}>
                        <textarea
                          value={visitDraft[a.id] || ''}
                          onChange={(e) => setVisitDraft((prev) => ({ ...prev, [a.id]: e.target.value }))}
                          placeholder="Service notes — color formula, technique, products used, client reactions…"
                          rows={2}
                          autoFocus
                          style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', fontSize: 12.5, resize: 'vertical', fontFamily: 'Inter, system-ui', outline: 'none', boxSizing: 'border-box' }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button className="btn" style={{ padding: '5px 14px', fontSize: 12.5 }} onClick={() => commitVisitNote(a.id)}>Save note</button>
                          <button className="btn ghost" style={{ padding: '5px 14px', fontSize: 12.5 }} onClick={() => setExpandedVisit(null)}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
            {!visits.length && (
              <tr><td colSpan={5} style={{ color: 'var(--muted)', padding: '16px 0' }}>No visits yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────── */
/*  New client modal                                           */
/* ─────────────────────────────────────────────────────────── */
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
        <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} /></div>
        <div className="field" style={{ marginBottom: 20 }}><label>Phone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(801) 555-0100" /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</button>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Add client'}</button>
        </div>
      </div>
    </div>
  )
}
