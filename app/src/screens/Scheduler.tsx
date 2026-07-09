import { useEffect, useState, type CSSProperties } from 'react'
import { useApp } from '../lib/AppContext'
import {
  getStaff, getShifts, saveShift, updateShift, deleteShift,
  getStaffAvailability, getStaffScheduleRules,
  saveStaffAvailability, saveStaffScheduleRules,
  getTimeOffForWeek, getApptCountsForWeek,
  type StaffAvailabilityRow, type ScheduleRule, type Shift, type RuleType,
} from '../lib/data'
import { initials, fmtTime, isoDate, getMondayISO, fmtMin } from '../lib/util'
import { toast } from '../lib/toast'
import { Icon } from '../components/Icon'

// Business hours constants
const DS = 10, DE = 22, STEP = 30
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const RULE_TYPES: RuleType[] = ['max_hours_week', 'min_hours_week', 'max_days_week', 'min_days_week']
const RULE_LABELS: Record<string, string> = {
  max_hours_week: 'Max hours / week',
  min_hours_week: 'Min hours / week',
  max_days_week: 'Max days / week',
  min_days_week: 'Min days / week',
}

type ConstraintViolation = { ruleType: RuleType; message: string }

// ---- Pure functions ---------------------------------------------------------

function checkConstraints(staffId: string, weekShifts: Shift[], rules: ScheduleRule[]): ConstraintViolation[] {
  const mine = weekShifts.filter((s) => s.staffId === staffId)
  const totalHours = mine.reduce((acc, s) => acc + (s.endMin - s.startMin), 0) / 60
  const days = new Set(mine.map((s) => s.shiftDate)).size
  const out: ConstraintViolation[] = []
  for (const r of rules) {
    if (r.ruleType === 'max_hours_week' && totalHours > r.value)
      out.push({ ruleType: r.ruleType, message: `Over ${r.value}h max (${totalHours.toFixed(1)}h scheduled)` })
    if (r.ruleType === 'min_hours_week' && totalHours < r.value)
      out.push({ ruleType: r.ruleType, message: `Under ${r.value}h min (${totalHours.toFixed(1)}h scheduled)` })
    if (r.ruleType === 'max_days_week' && days > r.value)
      out.push({ ruleType: r.ruleType, message: `Over ${r.value} days/wk (${days} scheduled)` })
    if (r.ruleType === 'min_days_week' && days < r.value)
      out.push({ ruleType: r.ruleType, message: `Under ${r.value} days/wk (${days} scheduled)` })
  }
  return out
}

function isDayBlocked(dow: number, avail: StaffAvailabilityRow[]): boolean {
  const row = avail.find((a) => a.dayOfWeek === dow)
  return row ? !row.isAvailable : false
}

function getAvailWindow(dow: number, avail: StaffAvailabilityRow[]): { startMin: number; endMin: number } {
  const row = avail.find((a) => a.dayOfWeek === dow)
  return { startMin: row?.startMin ?? DS * 60, endMin: row?.endMin ?? DE * 60 }
}

function isSlotOutsideAvail(startMin: number, endMin: number, dow: number, avail: StaffAvailabilityRow[]): boolean {
  const row = avail.find((a) => a.dayOfWeek === dow)
  if (!row) return false
  if (!row.isAvailable) return true
  if (row.startMin !== null && startMin < row.startMin) return true
  if (row.endMin !== null && endMin > row.endMin) return true
  return false
}

function shiftTimeOpts(): { v: number; label: string }[] {
  const opts: { v: number; label: string }[] = []
  for (let h = DS; h <= DE; h++) {
    for (let m = 0; m < 60; m += STEP) {
      if (h === DE && m > 0) break
      opts.push({ v: h * 60 + m, label: fmtTime(h, m) })
    }
  }
  return opts
}

// ---- Auto-generate algorithm ------------------------------------------------

function autoGenerateShifts(params: {
  weekStart: string
  storeId: string
  cols: any[]
  allRules: Record<string, ScheduleRule[]>
  allAvail: Record<string, StaffAvailabilityRow[]>
  perDayVolumes: Record<string, number>
  targetHours: number
  apptPerProvider: number
}): Omit<Shift, 'id' | 'orgId'>[] {
  const { weekStart, storeId, cols, allRules, allAvail, perDayVolumes, targetHours, apptPerProvider } = params
  const DEFAULT_SHIFT_MINS = 480 // 8 hours default shift length

  const days: string[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + i)
    days.push(isoDate(d))
  }

  const getTargetMins = (staffId: string) => {
    const rules = allRules[staffId] || []
    return (rules.find((r) => r.ruleType === 'max_hours_week')?.value ?? targetHours) * 60
  }

  const scheduledMins: Record<string, number> = {}
  cols.forEach((s) => (scheduledMins[s.id] = 0))

  const proposed: Omit<Shift, 'id' | 'orgId'>[] = []

  // Sort days by appointment volume descending — busiest days get staffed first
  const sortedDays = [...days].sort((a, b) => (perDayVolumes[b] || 0) - (perDayVolumes[a] || 0))

  for (const day of sortedDays) {
    const dow = new Date(day + 'T00:00:00').getDay()
    const volume = perDayVolumes[day] || 2 // assume at least 2 appts so someone always gets scheduled
    const coverageNeeded = Math.max(1, Math.ceil(volume / apptPerProvider))

    // Staff available this day, with remaining capacity, sorted least-used first
    const available = cols
      .filter((s) => {
        if (isDayBlocked(dow, allAvail[s.id] || [])) return false
        return scheduledMins[s.id] < getTargetMins(s.id)
      })
      .sort((a, b) => scheduledMins[a.id] - scheduledMins[b.id])

    for (const s of available.slice(0, coverageNeeded)) {
      const { startMin, endMin: maxEnd } = getAvailWindow(dow, allAvail[s.id] || [])
      const remaining = getTargetMins(s.id) - scheduledMins[s.id]
      const duration = Math.min(DEFAULT_SHIFT_MINS, remaining, maxEnd - startMin)
      if (duration < 60) continue

      proposed.push({ storeId, staffId: s.id, shiftDate: day, startMin, endMin: startMin + duration })
      scheduledMins[s.id] += duration
    }
  }

  return proposed
}

// ---- Main component ---------------------------------------------------------

export default function Scheduler() {
  const { loc, current } = useApp()
  const [weekStart, setWeekStart] = useState<string>(() => getMondayISO(new Date()))
  const [staff, setStaff] = useState<any[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [allAvail, setAllAvail] = useState<Record<string, StaffAvailabilityRow[]>>({})
  const [allRules, setAllRules] = useState<Record<string, ScheduleRule[]>>({})
  const [timeOff, setTimeOff] = useState<any[]>([])
  const [apptCounts, setApptCounts] = useState<{ perStaff: Record<string, number>; perDay: Record<string, number> }>({ perStaff: {}, perDay: {} })
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [drawer, setDrawer] = useState<any>(null)
  const [availModal, setAvailModal] = useState<string | null>(null)
  const [genPanel, setGenPanel] = useState(false)
  const [genOpts, setGenOpts] = useState({ targetHours: 25, apptPerProvider: 3, replace: true })
  const [generating, setGenerating] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => { getStaff().then(setStaff) }, [])

  useEffect(() => {
    if (!staff.length) return
    Promise.all(staff.map((s) => getStaffAvailability(s.id))).then((results) => {
      const m: Record<string, StaffAvailabilityRow[]> = {}
      staff.forEach((s, i) => (m[s.id] = results[i]))
      setAllAvail(m)
    })
    Promise.all(staff.map((s) => getStaffScheduleRules(s.id))).then((results) => {
      const m: Record<string, ScheduleRule[]> = {}
      staff.forEach((s, i) => (m[s.id] = results[i]))
      setAllRules(m)
    })
  }, [staff.length])

  useEffect(() => {
    if (!loc || loc === 'all') return
    getShifts(weekStart, loc).then(setShifts)
    getApptCountsForWeek(weekStart, loc).then(setApptCounts)
  }, [weekStart, loc, reload])

  useEffect(() => {
    const cols = staff.filter((s) => (s.locs || []).includes(loc))
    if (!cols.length) return
    getTimeOffForWeek(weekStart, cols.map((s) => s.id)).then(setTimeOff)
  }, [weekStart, loc, staff.length, reload])

  const cols = staff.filter((s) => (s.locs || []).includes(loc))
  const todayISO = isoDate(new Date())

  const weekDays = [0, 1, 2, 3, 4, 5].map((i) => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + i)
    return { date: d, iso: isoDate(d), dow: d.getDay() }
  })

  const navWeek = (dir: 1 | -1) => {
    const d = new Date(weekStart + 'T00:00:00')
    d.setDate(d.getDate() + dir * 7)
    setWeekStart(isoDate(d))
    setOverrides({})
    setGenPanel(false)
  }

  const weekLabel = new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  if (loc === 'all') {
    return (
      <div className="empty">
        <div className="ec"><Icon name="schedule" size={26} /></div>
        <h3>Schedule runs per store</h3>
        <p>Pick a single store up top to view and build that location's weekly schedule.</p>
      </div>
    )
  }

  // Staff count scheduled per day (for day headers)
  const staffPerDay: Record<string, Set<string>> = {}
  for (const sh of shifts) {
    if (!staffPerDay[sh.shiftDate]) staffPerDay[sh.shiftDate] = new Set()
    staffPerDay[sh.shiftDate].add(sh.staffId)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    const proposed = autoGenerateShifts({
      weekStart, storeId: loc, cols, allRules, allAvail,
      perDayVolumes: apptCounts.perDay,
      targetHours: genOpts.targetHours,
      apptPerProvider: genOpts.apptPerProvider,
    })
    if (genOpts.replace) {
      for (const sh of shifts) await deleteShift(sh.id)
    }
    let saveErrors = 0
    for (const sh of proposed) {
      const res = await saveShift(sh)
      if (!res.ok) saveErrors++
    }
    if (saveErrors > 0) {
      setGenerating(false)
      toast(`Save failed — run migration 18_scheduler.sql in Supabase first (${saveErrors} errors)`)
      return
    }
    // Fetch fresh shifts directly — more reliable than the reload counter
    const fresh = await getShifts(weekStart, loc)
    setShifts(fresh)
    setGenerating(false)
    setGenPanel(false)
    toast(`Generated ${proposed.length} shifts for ${cols.length} staff`)
  }

  const handleSave = async (data: Omit<Shift, 'id' | 'orgId'>) => {
    const res = drawer.mode === 'add'
      ? await saveShift(data)
      : await updateShift(drawer.shift.id, { startMin: data.startMin, endMin: data.endMin, notes: data.notes })
    if (res.ok) {
      toast(drawer.mode === 'add' ? 'Shift added' : 'Shift updated')
      setDrawer(null)
      const fresh = await getShifts(weekStart, loc)
      setShifts(fresh)
    } else toast('Error: ' + (res as any).error)
  }

  const handleDelete = async () => {
    const res = await deleteShift(drawer.shift.id)
    if (res.ok) {
      toast('Shift removed')
      setDrawer(null)
      const fresh = await getShifts(weekStart, loc)
      setShifts(fresh)
    } else toast('Error: ' + (res as any).error)
  }

  const handleAvailSave = async (
    avail: Omit<StaffAvailabilityRow, 'id' | 'staffId'>[],
    rules: Omit<ScheduleRule, 'id' | 'staffId'>[],
    staffId: string
  ) => {
    await Promise.all([saveStaffAvailability(staffId, avail), saveStaffScheduleRules(staffId, rules)])
    const [na, nr] = await Promise.all([getStaffAvailability(staffId), getStaffScheduleRules(staffId)])
    setAllAvail((m) => ({ ...m, [staffId]: na }))
    setAllRules((m) => ({ ...m, [staffId]: nr }))
    toast('Availability saved')
    setAvailModal(null)
  }

  const GRID_COLS = '210px repeat(6, minmax(115px, 1fr))'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', flexShrink: 0, position: 'relative', zIndex: 20 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn ghost" style={{ padding: '7px 10px' }} onClick={() => navWeek(-1)}>‹</button>
          <button className="btn ghost" style={{ padding: '7px 10px' }} onClick={() => navWeek(1)}>›</button>
        </div>
        <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 600, fontSize: 16 }}>
          {weekLabel}
          <div style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 12, color: 'var(--muted)' }}>{current.name}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn ghost" style={{ fontSize: 12.5 }} onClick={() => { setWeekStart(getMondayISO(new Date())); setGenPanel(false) }}>Today</button>

        {/* Generate button + popover */}
        <div style={{ position: 'relative' }}>
          <button className="btn" style={{ gap: 6 }} onClick={() => setGenPanel((v) => !v)}>
            <Icon name="schedule" size={14} /> Generate week ▾
          </button>
          {genPanel && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: 'var(--shadow-lg)', padding: 20, width: 290, zIndex: 60 }}>
              <div style={{ fontFamily: 'Bricolage Grotesque', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Auto-schedule settings</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>Fills the week based on availability, target hours, and expected appointment volume.</div>
              <div className="field">
                <label>Target hours / person</label>
                <input type="number" min={4} max={60} value={genOpts.targetHours}
                  onChange={(e) => setGenOpts((o) => ({ ...o, targetHours: Number(e.target.value) }))} />
              </div>
              <div className="field">
                <label>Appointments per provider / shift</label>
                <input type="number" min={1} max={20} value={genOpts.apptPerProvider}
                  onChange={(e) => setGenOpts((o) => ({ ...o, apptPerProvider: Number(e.target.value) }))} />
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>Used to calculate how many staff are needed per day based on expected volume.</div>
              </div>
              <div className="toggle-row" style={{ maxWidth: '100%', marginBottom: 18 }}>
                <div className="t-l">
                  <b>Replace existing shifts</b>
                  <p>Clear this week before generating</p>
                </div>
                <div className={`switch${genOpts.replace ? ' on' : ''}`} onClick={() => setGenOpts((o) => ({ ...o, replace: !o.replace }))} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost" style={{ flex: 1 }} onClick={() => setGenPanel(false)}>Cancel</button>
                <button className="btn" style={{ flex: 1 }} onClick={handleGenerate} disabled={generating}>
                  {generating ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ minWidth: 700 }}>

          {/* Sticky day header row */}
          <div style={{ display: 'grid', gridTemplateColumns: GRID_COLS, position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface)', borderBottom: '2px solid var(--line)' }}>
            <div style={{ padding: '10px 16px', borderRight: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.04em', color: 'var(--faint)' }}>
                {cols.length} STAFF · {current.name.toUpperCase()}
              </span>
            </div>
            {weekDays.map(({ date, iso, dow }) => {
              const appts = apptCounts.perDay[iso] || 0
              const scheduled = staffPerDay[iso]?.size || 0
              const needed = appts > 0 ? Math.ceil(appts / genOpts.apptPerProvider) : 0
              const isToday = iso === todayISO
              const covered = needed === 0 || scheduled >= needed
              return (
                <div key={iso} style={{ padding: '8px 10px', borderLeft: '1px solid var(--line-2)', textAlign: 'center' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: isToday ? 'var(--mint-700)' : 'var(--ink)', lineHeight: 1.3 }}>
                    {DAY_LABELS[dow]}
                    <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>{date.getDate()}</span>
                    {isToday && <span className="tag green" style={{ marginLeft: 5, fontSize: 9 }}>Today</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 5, flexWrap: 'wrap' }}>
                    {appts > 0 && <span className="tag gray" style={{ fontSize: 9.5, padding: '2px 6px' }}>{appts} appts</span>}
                    <span className={`tag ${covered ? 'green' : 'amber'}`} style={{ fontSize: 9.5, padding: '2px 6px' }}>
                      {scheduled}{needed > 0 ? `/${needed}` : ''} staff
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Staff rows */}
          {cols.map((s, rowIdx) => {
            const sRules = allRules[s.id] || []
            const sAvail = allAvail[s.id] || []
            const weekHours = shifts.filter((sh) => sh.staffId === s.id).reduce((acc, sh) => acc + (sh.endMin - sh.startMin), 0) / 60
            const targetHours = sRules.find((r) => r.ruleType === 'max_hours_week')?.value ?? genOpts.targetHours
            const violations = checkConstraints(s.id, shifts, sRules)
            const override = overrides[s.id] || false
            const evenRow = rowIdx % 2 === 0

            return (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: GRID_COLS, borderBottom: '1px solid var(--line-2)', minHeight: 74 }}>

                {/* Staff info cell — sticky left */}
                <div style={{
                  position: 'sticky', left: 0, zIndex: 2,
                  background: evenRow ? 'var(--surface)' : 'var(--surface-2)',
                  padding: '9px 14px', borderRight: '1px solid var(--line)',
                  display: 'flex', alignItems: 'center', gap: 9,
                }}>
                  <span className="chip" style={{ background: s.color, width: 30, height: 30, borderRadius: 8, flexShrink: 0, margin: 0 }}>{initials(s.name)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 2 }}>{s.role}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: violations.length ? 'var(--rose)' : 'var(--mint-700)' }}>
                        {weekHours.toFixed(1)}h
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--faint)' }}>/ {targetHours}h</span>
                      {violations.length > 0 && (
                        <div
                          className={`switch${override ? ' on' : ''}`}
                          style={{ width: 28, height: 16, flexShrink: 0 }}
                          title={override ? 'Override on — constraints bypassed' : violations.map((v) => v.message).join(' · ')}
                          onClick={() => setOverrides((o) => ({ ...o, [s.id]: !o[s.id] }))}
                        />
                      )}
                    </div>
                  </div>
                  <button
                    title="Edit availability & rules"
                    onClick={() => setAvailModal(s.id)}
                    style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--line)', background: 'none', display: 'grid', placeItems: 'center', color: 'var(--faint)', cursor: 'pointer', flexShrink: 0 }}>
                    <Icon name="settings" size={12} />
                  </button>
                </div>

                {/* Day cells */}
                {weekDays.map(({ iso, dow }) => {
                  const blocked = isDayBlocked(dow, sAvail) && !override
                  const dayShift = shifts.find((sh) => sh.staffId === s.id && sh.shiftDate === iso)
                  const hasTimeOff = timeOff.some((to) => to.staffId === s.id && to.startDate <= iso && to.endDate >= iso)
                  const bookings = apptCounts.perStaff[s.id + '_' + iso] || 0
                  const cellBg = evenRow ? 'var(--surface)' : 'var(--surface-2)'
                  const blockedBg = 'repeating-linear-gradient(45deg,rgba(0,0,0,.025),rgba(0,0,0,.025) 4px,transparent 4px,transparent 10px)'

                  const handleCellClick = () => {
                    if (dayShift) {
                      setDrawer({ mode: 'edit', staffId: s.id, shiftDate: iso, startMin: dayShift.startMin, shift: dayShift })
                    } else {
                      const win = getAvailWindow(dow, sAvail)
                      setDrawer({ mode: 'add', staffId: s.id, shiftDate: iso, startMin: win.startMin })
                    }
                  }

                  return (
                    <div key={iso}
                      onClick={handleCellClick}
                      style={{ borderLeft: '1px solid var(--line-2)', cursor: 'pointer', position: 'relative', background: blocked && !dayShift ? blockedBg : cellBg, minHeight: 74 }}
                      onMouseEnter={(e) => { if (!dayShift) (e.currentTarget as HTMLElement).style.background = 'var(--mint-soft)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = blocked && !dayShift ? blockedBg : cellBg }}
                    >
                      {/* Time off overlay (no shift) */}
                      {hasTimeOff && !dayShift && (
                        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,rgba(217,101,122,.07),rgba(217,101,122,.07) 5px,transparent 5px,transparent 14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                          <span className="tag rose" style={{ fontSize: 9 }}>Time off</span>
                        </div>
                      )}

                      {/* Blocked day label */}
                      {blocked && !dayShift && !hasTimeOff && (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 600 }}>OFF</span>
                        </div>
                      )}

                      {/* Empty cell placeholder */}
                      {!blocked && !dayShift && !hasTimeOff && (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 13, color: 'var(--line)', fontWeight: 300 }}>–</span>
                        </div>
                      )}

                      {/* Scheduled shift */}
                      {dayShift && (
                        <div style={{ padding: '8px 10px', height: '100%' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: s.color, lineHeight: 1.2 }}>
                            {fmtMin(dayShift.startMin)} – {fmtMin(dayShift.endMin)}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                            {((dayShift.endMin - dayShift.startMin) / 60).toFixed(1)}h
                            {bookings > 0 && <span style={{ marginLeft: 5 }}>· {bookings} bkgs</span>}
                          </div>
                          {/* Booking density bar */}
                          {bookings > 0 && (
                            <div style={{ marginTop: 6, height: 4, borderRadius: 3, background: s.color + '25', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: 3, background: s.color + 'aa',
                                width: Math.min(100, Math.round((bookings / Math.max(1, genOpts.apptPerProvider)) * 100)) + '%',
                                transition: 'width .3s',
                              }} />
                            </div>
                          )}
                          {hasTimeOff && (
                            <span className="tag rose" style={{ fontSize: 9, marginTop: 4, display: 'inline-flex' }}>Time off conflict</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {cols.length === 0 && (
            <div className="empty" style={{ padding: '60px 20px' }}>
              <div className="ec"><Icon name="staff" size={24} /></div>
              <h3>No staff at {current.name}</h3>
              <p>Assign staff members to this location in the Staff setup to start scheduling.</p>
            </div>
          )}
        </div>
      </div>

      {/* Weekly summary footer */}
      {cols.length > 0 && <WeeklySummaryBar cols={cols} shifts={shifts} targetHours={genOpts.targetHours} allRules={allRules} />}

      {drawer && (
        <ShiftDrawer
          drawer={drawer} staff={cols} allRules={allRules} allAvail={allAvail}
          weekShifts={shifts} timeOff={timeOff} overrides={overrides} loc={loc}
          onClose={() => setDrawer(null)} onSave={handleSave} onDelete={handleDelete}
        />
      )}

      {availModal && (
        <AvailabilityModal
          staffId={availModal}
          staffName={staff.find((s) => s.id === availModal)?.name || ''}
          initialAvail={allAvail[availModal] || []}
          initialRules={allRules[availModal] || []}
          onClose={() => setAvailModal(null)}
          onSave={(av, ru) => handleAvailSave(av, ru, availModal)}
        />
      )}
    </div>
  )
}

// ---- Sub-components ---------------------------------------------------------

function WeeklySummaryBar({ cols, shifts, targetHours, allRules }: { cols: any[]; shifts: Shift[]; targetHours: number; allRules: Record<string, ScheduleRule[]> }) {
  return (
    <div className="sched-summary">
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)', flexShrink: 0, marginRight: 4 }}>Week total</span>
      {cols.map((s) => {
        const mins = shifts.filter((sh) => sh.staffId === s.id).reduce((acc, sh) => acc + (sh.endMin - sh.startMin), 0)
        const hours = mins / 60
        const target = allRules[s.id]?.find((r) => r.ruleType === 'max_hours_week')?.value ?? targetHours
        const pct = Math.min(100, Math.round((hours / target) * 100))
        const over = hours > target
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 130, padding: '0 8px', borderLeft: '1px solid var(--line-2)' }}>
            <span className="chip" style={{ background: s.color, width: 20, height: 20, fontSize: 8, margin: 0, borderRadius: 6 }}>{initials(s.name)}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: over ? 'var(--rose)' : 'var(--ink)' }}>
                {hours.toFixed(1)}h <span style={{ fontWeight: 400, color: 'var(--faint)', fontSize: 10 }}>/ {target}h</span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: 'var(--line)', width: 60, marginTop: 2 }}>
                <div style={{ height: '100%', borderRadius: 2, background: over ? 'var(--rose)' : s.color, width: pct + '%' }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ShiftDrawer({ drawer, staff, allRules, allAvail, weekShifts, timeOff, overrides, loc, onClose, onSave, onDelete }: any) {
  const s = staff.find((x: any) => x.id === drawer.staffId)
  const defaultEnd = Math.min(drawer.startMin + 480, DE * 60)
  const [startMin, setStartMin] = useState<number>(drawer.startMin)
  const [endMin, setEndMin] = useState<number>(drawer.mode === 'edit' ? drawer.shift.endMin : defaultEnd)
  const [notes, setNotes] = useState<string>(drawer.mode === 'edit' ? (drawer.shift.notes || '') : '')
  const [busy, setBusy] = useState(false)
  const timeOpts = shiftTimeOpts()

  const proposed: Shift[] = [
    ...weekShifts.filter((sh: Shift) => !(drawer.mode === 'edit' && sh.id === drawer.shift?.id)),
    { id: '__proposed__', orgId: '', storeId: loc, staffId: drawer.staffId, shiftDate: drawer.shiftDate, startMin, endMin },
  ]
  const rules: ScheduleRule[] = allRules[drawer.staffId] || []
  const violations = checkConstraints(drawer.staffId, proposed, rules)
  const override = overrides[drawer.staffId] || false
  const canConfirm = !busy && endMin > startMin && (violations.length === 0 || override)

  const dateLabel = new Date(drawer.shiftDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const hasTimeOff = timeOff.some((to: any) => to.staffId === drawer.staffId && to.startDate <= drawer.shiftDate && to.endDate >= drawer.shiftDate)
  const avail: StaffAvailabilityRow[] = allAvail[drawer.staffId] || []
  const dow = new Date(drawer.shiftDate + 'T00:00:00').getDay()
  const outsideAvail = isSlotOutsideAvail(startMin, endMin, dow, avail)

  const confirm = async () => {
    setBusy(true)
    await onSave({ storeId: loc, staffId: drawer.staffId, shiftDate: drawer.shiftDate, startMin, endMin, notes: notes || undefined })
    setBusy(false)
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="dr-head">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="chip" style={{ background: s?.color, width: 36, height: 36, borderRadius: '50%', margin: 0 }}>{initials(s?.name || '')}</span>
            <div>
              <b style={{ fontSize: 15 }}>{drawer.mode === 'add' ? 'Add shift' : 'Edit shift'}</b>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s?.name} · {dateLabel}</div>
            </div>
          </div>
          <button className="x-btn" onClick={onClose}>✕</button>
        </div>
        <div className="dr-body">
          <div className="field">
            <label>Start time</label>
            <select value={startMin} onChange={(e) => { const v = Number(e.target.value); setStartMin(v); if (endMin <= v) setEndMin(Math.min(v + 480, DE * 60)) }}>
              {timeOpts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>End time</label>
            <select value={endMin} onChange={(e) => setEndMin(Number(e.target.value))}>
              {timeOpts.filter((o) => o.v > startMin).map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>{((endMin - startMin) / 60).toFixed(1)} hours</div>
          </div>
          <div className="field">
            <label>Notes <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(optional)</span></label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Opening shift, cover for Jordan…" />
          </div>

          {hasTimeOff && (
            <div style={{ background: '#FBE6EB', border: '1px solid #f4c2cc', borderRadius: 10, padding: '10px 13px', marginBottom: 14, fontSize: 12.5 }}>
              <b style={{ color: '#b3475e' }}>⚠ Time off on this date</b>
              <p style={{ color: '#b3475e', marginTop: 3 }}>{s?.name} has approved time off. You can still schedule this shift if needed.</p>
            </div>
          )}
          {outsideAvail && (
            <div style={{ background: '#FBE6EB', border: '1px solid #f4c2cc', borderRadius: 10, padding: '10px 13px', marginBottom: 14, fontSize: 12.5 }}>
              <b style={{ color: '#b3475e' }}>Outside normal availability</b>
              <p style={{ color: '#b3475e', marginTop: 3 }}>This shift overlaps {s?.name}'s restricted hours for this day.</p>
            </div>
          )}
          {violations.length > 0 && (
            <div style={{ background: override ? 'var(--mango-soft)' : '#FBE6EB', border: `1px solid ${override ? '#e8b654' : '#f4c2cc'}`, borderRadius: 10, padding: '10px 13px', marginBottom: 14, fontSize: 12.5 }}>
              <b style={{ color: override ? '#b5740f' : '#b3475e' }}>
                {override ? '⚠ Override active' : '⛔ Schedule constraint violated'}
              </b>
              <ul style={{ paddingLeft: 16, marginTop: 5, color: override ? '#b5740f' : '#b3475e' }}>
                {violations.map((v) => <li key={v.ruleType} style={{ marginTop: 3 }}>{v.message}</li>)}
              </ul>
              {!override && <p style={{ color: '#b3475e', marginTop: 6, fontStyle: 'italic', fontSize: 11.5 }}>Enable the Override toggle on {s?.name}'s row to save anyway.</p>}
            </div>
          )}
        </div>
        <div className="dr-foot">
          {drawer.mode === 'edit' && <button className="btn ghost" onClick={onDelete} style={{ color: 'var(--rose)', flex: 'none' }}>Delete</button>}
          <button className="btn ghost" onClick={onClose} style={{ flex: 'none' }}>Cancel</button>
          <button className="btn" onClick={confirm} disabled={!canConfirm}>{busy ? 'Saving…' : 'Confirm shift'}</button>
        </div>
      </aside>
    </>
  )
}

function AvailabilityModal({ staffId, staffName, initialAvail, initialRules, onClose, onSave }: {
  staffId: string; staffName: string
  initialAvail: StaffAvailabilityRow[]; initialRules: ScheduleRule[]
  onClose: () => void
  onSave: (avail: Omit<StaffAvailabilityRow, 'id' | 'staffId'>[], rules: Omit<ScheduleRule, 'id' | 'staffId'>[]) => Promise<void>
}) {
  const initDays = (): StaffAvailabilityRow[] =>
    [1, 2, 3, 4, 5, 6].map((d) => {
      const ex = initialAvail.find((a) => a.dayOfWeek === d)
      return ex ?? { id: '', staffId, dayOfWeek: d, isAvailable: true, startMin: null, endMin: null }
    })

  const [avail, setAvail] = useState<StaffAvailabilityRow[]>(initDays)
  const [rules, setRules] = useState<Omit<ScheduleRule, 'id' | 'staffId'>[]>(
    initialRules.map((r) => ({ ruleType: r.ruleType, value: r.value }))
  )
  const [busy, setBusy] = useState(false)

  const updateDay = (dow: number, patch: Partial<StaffAvailabilityRow>) =>
    setAvail((a) => a.map((row) => row.dayOfWeek === dow ? { ...row, ...patch } : row))

  const addRule = () => {
    const existing = new Set(rules.map((r) => r.ruleType))
    const next = RULE_TYPES.find((t) => !existing.has(t))
    if (!next) return
    setRules((r) => [...r, { ruleType: next, value: next.includes('hours') ? 40 : 5 }])
  }

  const availTimeOpts = (): { v: number; label: string }[] => {
    const opts: { v: number; label: string }[] = []
    for (let h = 5; h <= 22; h++) {
      for (let m = 0; m < 60; m += 30) {
        if (h === 22 && m > 0) break
        opts.push({ v: h * 60 + m, label: fmtTime(h, m) })
      }
    }
    return opts
  }
  const timeOpts = availTimeOpts()

  const selectStyle: CSSProperties = {
    border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px',
    fontSize: 12.5, background: 'var(--surface)', color: 'var(--ink)', maxWidth: 120,
  }

  const save = async () => {
    setBusy(true)
    await onSave(
      avail.map((a) => ({ dayOfWeek: a.dayOfWeek, isAvailable: a.isAvailable, startMin: a.startMin, endMin: a.endMin })),
      rules
    )
    setBusy(false)
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h2 style={{ fontSize: 18 }}>Availability & Rules</h2>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>{staffName}</div>
          </div>
          <button className="x-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mint-700)', marginBottom: 10 }}>
          Weekly Availability
        </div>
        {avail.map((row) => (
          <div key={row.dayOfWeek} className="avail-day-row">
            <div className="day-label">{DAY_LABELS[row.dayOfWeek]}</div>
            <div className={`switch${row.isAvailable ? ' on' : ''}`} onClick={() => updateDay(row.dayOfWeek, { isAvailable: !row.isAvailable })} />
            {row.isAvailable ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select style={selectStyle} value={row.startMin ?? ''}
                  onChange={(e) => updateDay(row.dayOfWeek, { startMin: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Open (store hrs)</option>
                  {timeOpts.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
                <span style={{ color: 'var(--faint)', fontSize: 12 }}>to</span>
                <select style={selectStyle} value={row.endMin ?? ''}
                  onChange={(e) => updateDay(row.dayOfWeek, { endMin: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Close (store hrs)</option>
                  {timeOpts.filter((o) => !row.startMin || o.v > row.startMin).map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
              </div>
            ) : (
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Not available</span>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mint-700)' }}>Schedule Rules</div>
          <button className="btn ghost" style={{ padding: '5px 11px', fontSize: 12 }} onClick={addRule}>+ Add rule</button>
        </div>
        {rules.length === 0 && (
          <div style={{ color: 'var(--faint)', fontSize: 13, padding: '6px 0', marginBottom: 8 }}>No rules — no hour or day limits enforced.</div>
        )}
        {rules.map((rule, i) => (
          <div key={i} className="rule-row">
            <select value={rule.ruleType}
              onChange={(e) => setRules((r) => r.map((x, j) => j === i ? { ...x, ruleType: e.target.value as RuleType } : x))}
              style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', fontSize: 13, background: 'var(--surface)', flex: 1, color: 'var(--ink)' }}>
              {RULE_TYPES.map((t) => <option key={t} value={t}>{RULE_LABELS[t]}</option>)}
            </select>
            <input type="number" min={0} max={rule.ruleType.includes('hours') ? 80 : 7} value={rule.value}
              onChange={(e) => setRules((r) => r.map((x, j) => j === i ? { ...x, value: Number(e.target.value) } : x))}
              style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', fontSize: 13, width: 70, textAlign: 'center', background: 'var(--surface)', color: 'var(--ink)' }}
            />
            <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{rule.ruleType.includes('hours') ? 'hours' : 'days'}</span>
            <button onClick={() => setRules((r) => r.filter((_, j) => j !== i))} style={{ color: 'var(--rose)', fontSize: 16, padding: '4px 8px', lineHeight: 1 }}>✕</button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  )
}
