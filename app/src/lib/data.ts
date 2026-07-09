import { supabase, isSupabaseConfigured } from './supabase'
import * as demo from './demo'

// Every getter resolves to the same shape whether the data comes from Supabase
// or from local demo data. Screens never need to know which mode they're in.

const D = <T>(v: T) => Promise.resolve(v)

export async function getStores() {
  if (!isSupabaseConfigured) return D(demo.LOCATIONS)
  const { data } = await supabase.from('stores').select('id,name,city,color').order('name')
  return (data || []).map((s: any) => ({ id: s.id, name: s.name, city: s.city, color: s.color }))
}

export async function getStaff() {
  if (!isSupabaseConfigured) return D(demo.STAFF)
  const { data } = await supabase
    .from('staff')
    .select('id,name,title,role,color,staff_stores(store_id)')
  return (data || []).map((s: any) => ({
    id: s.id, name: s.name, role: s.title || s.role, color: s.color,
    locs: (s.staff_stores || []).map((x: any) => x.store_id),
  }))
}

export async function getClients() {
  if (!isSupabaseConfigured) return D(demo.CLIENTS)
  const { data } = await supabase.from('clients').select('id,name,phone,email,notes,tags').order('name')
  const palette = ['#0FA06F', '#7C6FD0', '#3D94C9', '#D9657A', '#E8951F', '#5C7488', '#0B7E58', '#b5740f']
  return (data || []).map((c: any, i: number) => ({
    ...c, color: palette[i % palette.length], since: 2023,
    tags: c.tags || [], notes: c.notes || '', email: c.email || '',
  }))
}

export async function getServices() {
  if (!isSupabaseConfigured) return D(demo.SERVICES)
  const { data } = await supabase
    .from('services')
    .select('id,name,duration_min,category,service_stores(store_id,price_cents)')
  return (data || []).map((s: any) => {
    const price: Record<string, number> = {}
    ;(s.service_stores || []).forEach((p: any) => (price[p.store_id] = p.price_cents))
    return { id: s.id, name: s.name, dur: s.duration_min, cat: s.category, price }
  })
}

export async function getAppointments() {
  if (!isSupabaseConfigured) return D(demo.APPTS)
  const { data } = await supabase
    .from('appointments')
    .select('id,store_id,client_id,staff_id,service_id,starts_at,status')
  return (data || []).map((a: any) => {
    const d = new Date(a.starts_at)
    return {
      id: a.id, locId: a.store_id, clientId: a.client_id, staffId: a.staff_id,
      svcId: a.service_id, h: d.getHours(), m: d.getMinutes(), status: a.status,
    }
  })
}

export async function getProducts() {
  if (!isSupabaseConfigured) return D(demo.PRODUCTS)
  const { data } = await supabase
    .from('products')
    .select('name,sku,price_cents,cost_cents,product_inventory(qty_on_hand)')
  return (data || []).map((p: any) => ({
    name: p.name, sku: p.sku, price: p.price_cents, cost: p.cost_cents,
    stock: (p.product_inventory || []).reduce((s: number, r: any) => s + r.qty_on_hand, 0),
  }))
}

export async function getGiftCards() {
  if (!isSupabaseConfigured) return D(demo.GIFTCARDS)
  const { data } = await supabase.from('gift_cards').select('code,initial_cents,balance_cents')
  return (data || []).map((g: any) => ({ code: g.code, initial: g.initial_cents, balance: g.balance_cents, owner: '' }))
}

// Simpler getters fall back to demo; wire to your own selects/views as needed.
export const getPackages = () => D(demo.PACKAGES)
export const getMemberships = () => D(demo.MEMBERS)
export async function getOffers() {
  if (!isSupabaseConfigured) return demo.OFFERS
  const { data } = await supabase.from('offers').select('id,name,code,kind,value,is_active').order('name')
  return (data || []).map((o: any) => ({
    id: o.id, name: o.name, code: o.code, kind: o.kind, value: Number(o.value), active: o.is_active,
    type: o.kind === 'percent' ? o.value + '% off' : '$' + (o.value / 100).toFixed(0) + ' off', used: 0,
  }))
}
export const getResources = () => D(demo.RESOURCES)
export const getCampaigns = () => D(demo.CAMPAIGNS)
export const getFlows = () => D(demo.FLOWS)
export const getForms = () => D(demo.FORMS)
export const getConversations = () => D(demo.CONVOS)

/** Reports read from the rpt_* views, which auto-scope by role via RLS. */
export async function getReport(view: string) {
  if (!isSupabaseConfigured) {
    return D([
      { store: 'Layton', service: 24000, product: 2800, gross: 26800, net: 26800 },
      { store: 'Lehi', service: 6000, product: 0, gross: 6000, net: 4000 },
      { store: 'Silicon Slopes', service: 14000, product: 0, gross: 14000, net: 14000 },
    ])
  }
  const { data } = await supabase.from(view).select('*')
  return data || []
}

// ---------------------------------------------------------------------------
// WRITES — create a client, book an appointment, take payment at checkout.
// In demo mode these mutate the in-memory arrays; live, they write to Supabase.
// ---------------------------------------------------------------------------

let _orgId: string | null = null
export async function getOrgId() {
  if (!isSupabaseConfigured) return 'a0000000-0000-0000-0000-000000000001'
  if (_orgId) return _orgId
  const { data } = await supabase.from('organizations').select('id').limit(1).maybeSingle()
  _orgId = data?.id || null
  return _orgId
}

export async function createClientRow(name: string, phone: string) {
  if (!isSupabaseConfigured) {
    demo.CLIENTS.push({ id: 'n' + Date.now(), name, phone, email: '', since: new Date().getFullYear(), color: '#0FA06F', notes: '', tags: [] })
    return { ok: true }
  }
  const org = await getOrgId()
  const { error } = await supabase.from('clients').insert({ org_id: org, name, phone })
  return { ok: !error, error: error?.message }
}

export async function updateClientNotes(clientId: string, notes: string, email: string, tags: string[]) {
  if (!isSupabaseConfigured) {
    const c = demo.CLIENTS.find((x) => x.id === clientId)
    if (c) { c.notes = notes; c.email = email; c.tags = tags }
    return { ok: true }
  }
  const { error } = await supabase.from('clients').update({ notes, email, tags }).eq('id', clientId)
  return { ok: !error, error: error?.message }
}

export async function getVisitNotes(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return D({ ...demo.VISIT_NOTES })
  return {}
}

export async function saveVisitNote(apptId: string, note: string) {
  if (!isSupabaseConfigured) {
    demo.VISIT_NOTES[apptId] = note
    return { ok: true }
  }
  return { ok: true }
}

export async function createAppointment(a: {
  storeId: string; clientId: string; staffId: string; serviceId: string;
  h: number; m: number; priceCents: number; durMin: number
}) {
  if (!isSupabaseConfigured) {
    demo.APPTS.push({ id: 'n' + Date.now(), locId: a.storeId, clientId: a.clientId, staffId: a.staffId, svcId: a.serviceId, h: a.h, m: a.m, status: 'booked' })
    return { ok: true }
  }
  const org = await getOrgId()
  const start = new Date(); start.setHours(a.h, a.m, 0, 0)
  const end = new Date(start.getTime() + (a.durMin || 60) * 60000)
  const { error } = await supabase.from('appointments').insert({
    org_id: org, store_id: a.storeId, client_id: a.clientId, staff_id: a.staffId,
    service_id: a.serviceId, starts_at: start.toISOString(), ends_at: end.toISOString(),
    status: 'booked', price_cents: a.priceCents || 0,
  })
  return { ok: !error, error: error?.message }
}

export async function checkoutAppointment(appt: {
  id: string; storeId: string; clientId: string; staffId: string; serviceId: string;
  serviceName: string; priceCents: number
}, tipCents = 0, offer: { id: string; kind: string; value: number } | null = null, method = 'card') {
  const discount = offer ? (offer.kind === 'percent' ? Math.round(appt.priceCents * offer.value / 100) : Math.round(offer.value)) : 0
  const net = Math.max(0, appt.priceCents - discount)
  if (!isSupabaseConfigured) {
    const x = demo.APPTS.find((z) => z.id === appt.id); if (x) x.status = 'paid'
    return { ok: true }
  }
  const org = await getOrgId()
  const total = net + tipCents
  const { data: sale, error: e1 } = await supabase.from('sales').insert({
    org_id: org, store_id: appt.storeId, appointment_id: appt.id, client_id: appt.clientId,
    staff_id: appt.staffId, subtotal_cents: net, tip_cents: tipCents, total_cents: total, payment_method: method,
  }).select('id').single()
  if (e1) return { ok: false, error: e1.message }
  if (sale) {
    await supabase.from('sale_items').insert({
      org_id: org, store_id: appt.storeId, sale_id: sale.id, kind: 'service', ref_id: appt.serviceId,
      description: appt.serviceName || 'Service', staff_id: appt.staffId, quantity: 1,
      unit_price_cents: net, total_cents: net, cost_cents: 0,
    })
    await supabase.from('payments').insert({ org_id: org, store_id: appt.storeId, sale_id: sale.id, method, amount_cents: total })
    if (offer && discount > 0) {
      await supabase.from('offer_redemptions').insert({
        org_id: org, store_id: appt.storeId, offer_id: offer.id, sale_id: sale.id,
        client_id: appt.clientId, amount_cents: discount,
      })
    }
  }
  const { error: e2 } = await supabase.from('appointments').update({ status: 'paid' }).eq('id', appt.id)
  return { ok: !e2, error: e2?.message }
}

export async function refundAppointment(appt: { id: string }) {
  if (!isSupabaseConfigured) return { ok: true, amount: 0 }
  const org = await getOrgId()
  const { data: sale } = await supabase.from('sales')
    .select('id, client_id, staff_id, store_id, subtotal_cents')
    .eq('appointment_id', appt.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!sale) return { ok: false, error: 'No sale found for this appointment' }
  const { error } = await supabase.from('refunds').insert({
    org_id: org, store_id: sale.store_id, sale_id: sale.id, client_id: sale.client_id,
    staff_id: sale.staff_id, amount_cents: sale.subtotal_cents, reason: 'Refund',
  })
  return { ok: !error, error: error?.message, amount: sale.subtotal_cents }
}

// ---------------------------------------------------------------------------
// SCHEDULER — staff availability, schedule rules, and shifts
// ---------------------------------------------------------------------------

const _isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const _addDays = (isoStr: string, n: number): string => {
  const d = new Date(isoStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return _isoDate(d)
}

export type RuleType = 'max_hours_week' | 'min_hours_week' | 'max_days_week' | 'min_days_week' | 'no_specific_days'

export type StaffAvailabilityRow = {
  id: string
  staffId: string
  dayOfWeek: number   // 0=Sun … 6=Sat
  isAvailable: boolean
  startMin: number | null   // null = store open hour
  endMin: number | null     // null = store close hour
}

export type ScheduleRule = {
  id: string
  staffId: string
  ruleType: RuleType
  value: number
}

export type Shift = {
  id: string
  orgId: string
  storeId: string
  staffId: string
  shiftDate: string   // 'YYYY-MM-DD'
  startMin: number    // minutes from midnight
  endMin: number
  notes?: string
}

export async function getStaffAvailability(staffId: string): Promise<StaffAvailabilityRow[]> {
  if (!isSupabaseConfigured)
    return D(demo.STAFF_AVAILABILITY.filter((a: any) => a.staffId === staffId).map((a: any) => ({
      id: a.id, staffId: a.staffId, dayOfWeek: a.dayOfWeek,
      isAvailable: a.isAvailable, startMin: a.startMin, endMin: a.endMin,
    })))
  const { data } = await supabase
    .from('staff_availability')
    .select('id,staff_id,day_of_week,is_available,start_min,end_min')
    .eq('staff_id', staffId)
  return (data || []).map((r: any) => ({
    id: r.id, staffId: r.staff_id, dayOfWeek: r.day_of_week,
    isAvailable: r.is_available, startMin: r.start_min, endMin: r.end_min,
  }))
}

export async function saveStaffAvailability(
  staffId: string,
  rows: Omit<StaffAvailabilityRow, 'id' | 'staffId'>[]
) {
  if (!isSupabaseConfigured) {
    const keep = demo.STAFF_AVAILABILITY.filter((a: any) => a.staffId !== staffId)
    const next = rows.map((r, i) => ({ ...r, id: 'av-' + Date.now() + i, staffId }))
    demo.STAFF_AVAILABILITY.splice(0, Infinity, ...keep, ...next)
    return { ok: true }
  }
  const org = await getOrgId()
  const upserts = rows.map((r) => ({
    org_id: org, staff_id: staffId, day_of_week: r.dayOfWeek,
    is_available: r.isAvailable, start_min: r.startMin, end_min: r.endMin,
  }))
  const { error } = await supabase
    .from('staff_availability')
    .upsert(upserts, { onConflict: 'staff_id,day_of_week' })
  return { ok: !error, error: error?.message }
}

export async function getStaffScheduleRules(staffId: string): Promise<ScheduleRule[]> {
  if (!isSupabaseConfigured)
    return D(demo.SCHEDULE_RULES.filter((r: any) => r.staffId === staffId).map((r: any) => ({
      id: r.id, staffId: r.staffId, ruleType: r.ruleType, value: r.value,
    })))
  const { data } = await supabase
    .from('staff_schedule_rules')
    .select('id,staff_id,rule_type,value')
    .eq('staff_id', staffId)
  return (data || []).map((r: any) => ({
    id: r.id, staffId: r.staff_id, ruleType: r.rule_type, value: r.value,
  }))
}

export async function saveStaffScheduleRules(
  staffId: string,
  rules: Omit<ScheduleRule, 'id' | 'staffId'>[]
) {
  if (!isSupabaseConfigured) {
    const keep = demo.SCHEDULE_RULES.filter((r: any) => r.staffId !== staffId)
    const next = rules.map((r, i) => ({ ...r, id: 'rule-' + Date.now() + i, staffId }))
    demo.SCHEDULE_RULES.splice(0, Infinity, ...keep, ...next)
    return { ok: true }
  }
  const org = await getOrgId()
  await supabase.from('staff_schedule_rules').delete().eq('staff_id', staffId)
  if (!rules.length) return { ok: true }
  const { error } = await supabase.from('staff_schedule_rules').insert(
    rules.map((r) => ({ org_id: org, staff_id: staffId, rule_type: r.ruleType, value: r.value }))
  )
  return { ok: !error, error: error?.message }
}

export async function getShifts(weekStart: string, storeId: string): Promise<Shift[]> {
  const weekEnd = _addDays(weekStart, 6)
  if (!isSupabaseConfigured)
    return D(demo.SHIFTS.filter((s: any) =>
      s.storeId === storeId && s.shiftDate >= weekStart && s.shiftDate <= weekEnd
    ).map((s: any) => ({
      id: s.id, orgId: s.orgId, storeId: s.storeId, staffId: s.staffId,
      shiftDate: s.shiftDate, startMin: s.startMin, endMin: s.endMin, notes: s.notes,
    })))
  const { data } = await supabase
    .from('staff_shifts')
    .select('id,org_id,store_id,staff_id,shift_date,start_min,end_min,notes')
    .eq('store_id', storeId)
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd)
  return (data || []).map((r: any) => ({
    id: r.id, orgId: r.org_id, storeId: r.store_id, staffId: r.staff_id,
    shiftDate: r.shift_date, startMin: r.start_min, endMin: r.end_min, notes: r.notes,
  }))
}

export async function saveShift(shift: Omit<Shift, 'id' | 'orgId'>): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    const id = 'sh' + Date.now()
    demo.SHIFTS.push({ ...shift, id, orgId: 'demo' })
    return { ok: true, id }
  }
  const org = await getOrgId()
  const { data, error } = await supabase
    .from('staff_shifts')
    .insert({
      org_id: org, store_id: shift.storeId, staff_id: shift.staffId,
      shift_date: shift.shiftDate, start_min: shift.startMin, end_min: shift.endMin,
      notes: shift.notes || null,
    })
    .select('id').single()
  return { ok: !error, id: data?.id, error: error?.message }
}

export async function updateShift(id: string, patch: { startMin?: number; endMin?: number; notes?: string }) {
  if (!isSupabaseConfigured) {
    const s = demo.SHIFTS.find((x: any) => x.id === id)
    if (s) Object.assign(s, {
      startMin: patch.startMin ?? s.startMin,
      endMin: patch.endMin ?? s.endMin,
      notes: patch.notes ?? s.notes,
    })
    return { ok: true }
  }
  const updates: any = {}
  if (patch.startMin !== undefined) updates.start_min = patch.startMin
  if (patch.endMin !== undefined) updates.end_min = patch.endMin
  if (patch.notes !== undefined) updates.notes = patch.notes || null
  const { error } = await supabase.from('staff_shifts').update(updates).eq('id', id)
  return { ok: !error, error: error?.message }
}

export async function deleteShift(id: string) {
  if (!isSupabaseConfigured) {
    const i = demo.SHIFTS.findIndex((x: any) => x.id === id)
    if (i >= 0) demo.SHIFTS.splice(i, 1)
    return { ok: true }
  }
  const { error } = await supabase.from('staff_shifts').delete().eq('id', id)
  return { ok: !error, error: error?.message }
}

export async function getApptCountsForWeek(weekStart: string, storeId: string): Promise<{
  perStaff: Record<string, number>  // key: `${staffId}_${date}` → count
  perDay: Record<string, number>    // key: ISO date → total count
}> {
  const weekEnd = _addDays(weekStart, 6)
  if (!isSupabaseConfigured) {
    const perStaff: Record<string, number> = {}
    demo.APPT_COUNTS_DEMO.forEach((a) => { perStaff[a.staffId + '_' + a.shiftDate] = a.count })
    const perDay: Record<string, number> = {}
    demo.DAY_VOLUMES_DEMO.forEach((d) => { perDay[d.shiftDate] = d.count })
    return D({ perStaff, perDay })
  }
  const { data } = await supabase
    .from('appointments')
    .select('staff_id,starts_at')
    .eq('store_id', storeId)
    .gte('starts_at', weekStart + 'T00:00:00')
    .lte('starts_at', weekEnd + 'T23:59:59')
    .not('status', 'in', '("canceled","no_show")')
  const perStaff: Record<string, number> = {}
  const perDay: Record<string, number> = {}
  for (const a of (data || [])) {
    const date = (a.starts_at as string).slice(0, 10)
    const key = a.staff_id + '_' + date
    perStaff[key] = (perStaff[key] || 0) + 1
    perDay[date] = (perDay[date] || 0) + 1
  }
  return { perStaff, perDay }
}

export async function getTimeOffForWeek(weekStart: string, staffIds: string[]) {
  const weekEnd = _addDays(weekStart, 6)
  if (!isSupabaseConfigured)
    return D(demo.TIME_OFF_DEMO.filter((t: any) =>
      staffIds.includes(t.staffId) && t.startDate <= weekEnd && t.endDate >= weekStart
    ))
  const { data } = await supabase
    .from('time_off')
    .select('id,staff_id,start_date,end_date,reason')
    .in('staff_id', staffIds)
    .lte('start_date', weekEnd)
    .gte('end_date', weekStart)
  return (data || []).map((r: any) => ({
    id: r.id, staffId: r.staff_id, startDate: r.start_date, endDate: r.end_date, reason: r.reason,
  }))
}
