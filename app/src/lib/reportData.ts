import { supabase, isSupabaseConfigured } from './supabase'
import { getStaff, getServices } from './data'

const dayStr = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const timeStr = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
export const fmtRange = (from: string, to: string) =>
  new Date(from + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) + ' - ' +
  new Date(to + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

// ---- Service & Product Sales by Staff -------------------------------------
export type StaffSalesRow = { staff: string; nServices: number; serviceSales: number; nProducts: number; productSales: number; total: number }
export type StaffDetail = { staff: string; services: { label: string; count: number; sales: number; isCat?: boolean }[]; serviceTotal: { count: number; sales: number } }

export async function getStaffSales(from: string, to: string, staffId: string) {
  const staff = await getStaff()
  const svcMap: Record<string, any> = {}
  ;(await getServices()).forEach((s) => (svcMap[s.id] = s))
  const staffName: Record<string, string> = {}
  staff.forEach((s) => (staffName[s.id] = s.name))

  let items: any[] = []
  if (isSupabaseConfigured) {
    const { data } = await supabase
      .from('sale_items')
      .select('kind, staff_id, ref_id, description, total_cents, quantity, sales!inner(created_at)')
      .gte('sales.created_at', from + 'T00:00:00')
      .lte('sales.created_at', to + 'T23:59:59')
    items = data || []
  } else {
    items = DEMO_ITEMS
  }

  // overview: every staff member, alphabetical
  const byStaff: Record<string, StaffSalesRow> = {}
  staff.forEach((s) => (byStaff[s.id] = { staff: s.name, nServices: 0, serviceSales: 0, nProducts: 0, productSales: 0, total: 0 }))
  items.forEach((it) => {
    const row = byStaff[it.staff_id]; if (!row) return
    if (it.kind === 'product') { row.nProducts += it.quantity || 1; row.productSales += it.total_cents }
    else { row.nServices += it.quantity || 1; row.serviceSales += it.total_cents }
    row.total += it.total_cents
  })
  const overview = Object.values(byStaff).sort((a, b) => a.staff.localeCompare(b.staff))

  // detail per staff, grouped by service category -> service
  const targetStaff = staffId === 'all' ? staff.map((s) => s.id) : [staffId]
  const details: StaffDetail[] = targetStaff.map((sid) => {
    const its = items.filter((it) => it.staff_id === sid && it.kind !== 'product')
    const cats: Record<string, { count: number; sales: number; svcs: Record<string, { count: number; sales: number }> }> = {}
    its.forEach((it) => {
      const svc = svcMap[it.ref_id]
      const cat = svc?.cat || 'Services'
      const name = svc?.name || it.description
      cats[cat] = cats[cat] || { count: 0, sales: 0, svcs: {} }
      cats[cat].count += it.quantity || 1; cats[cat].sales += it.total_cents
      cats[cat].svcs[name] = cats[cat].svcs[name] || { count: 0, sales: 0 }
      cats[cat].svcs[name].count += it.quantity || 1; cats[cat].svcs[name].sales += it.total_cents
    })
    const lines: StaffDetail['services'] = []
    let tc = 0, ts = 0
    Object.entries(cats).forEach(([cat, c]) => {
      lines.push({ label: cat, count: c.count, sales: c.sales, isCat: true })
      Object.entries(c.svcs).forEach(([n, v]) => lines.push({ label: n, count: v.count, sales: v.sales }))
      tc += c.count; ts += c.sales
    })
    return { staff: staffName[sid] || '—', services: lines, serviceTotal: { count: tc, sales: ts } }
  })

  return { overview, details }
}

// ---- Time Clock -----------------------------------------------------------
export type PunchRow = { day: string; staff: string; in: string; out: string; hours: number; _sort: number }

export async function getTimeClock(from: string, to: string, staffId: string) {
  const staff = await getStaff()
  const name: Record<string, string> = {}; staff.forEach((s) => (name[s.id] = s.name))
  let rows: PunchRow[] = []
  if (isSupabaseConfigured) {
    let q = supabase.from('time_clock').select('staff_id, clock_in, clock_out')
      .gte('clock_in', from + 'T00:00:00').lte('clock_in', to + 'T23:59:59').order('clock_in')
    if (staffId !== 'all') q = q.eq('staff_id', staffId)
    const { data } = await q
    rows = (data || []).map((r: any) => {
      const ci = new Date(r.clock_in), co = r.clock_out ? new Date(r.clock_out) : null
      const hrs = co ? Math.round((co.getTime() - ci.getTime()) / 36000) / 100 : 0
      return { day: dayStr(ci), staff: name[r.staff_id] || '—', in: timeStr(ci), out: co ? timeStr(co) : '—', hours: hrs, _sort: ci.getTime() }
    })
  } else {
    rows = DEMO_PUNCHES.filter((r) => staffId === 'all' || r.staff === name[staffId])
  }
  return rows.sort((a, b) => a._sort - b._sort)
}

// ---- Days Off -------------------------------------------------------------
export type DayOffRow = { staff: string; day: string; reason: string; _sort: number }

export async function getDaysOff(from: string, to: string, staffId: string) {
  const staff = await getStaff()
  const name: Record<string, string> = {}; staff.forEach((s) => (name[s.id] = s.name))
  let rows: DayOffRow[] = []
  if (isSupabaseConfigured) {
    let q = supabase.from('time_off').select('staff_id, start_date, end_date, reason')
      .lte('start_date', to).gte('end_date', from).order('start_date')
    if (staffId !== 'all') q = q.eq('staff_id', staffId)
    const { data } = await q
    rows = (data || []).map((r: any) => {
      const s = new Date(r.start_date + 'T00:00'), e = new Date(r.end_date + 'T00:00')
      const day = r.start_date === r.end_date ? dayStr(s) : dayStr(s) + ' – ' + dayStr(e)
      return { staff: name[r.staff_id] || '—', day, reason: r.reason || 'Other', _sort: s.getTime() }
    })
  } else {
    rows = DEMO_DAYSOFF.filter((r) => staffId === 'all' || r.staff === name[staffId])
  }
  return rows.sort((a, b) => a.staff.localeCompare(b.staff) || a._sort - b._sort)
}

// ---- demo fallbacks (mirror the uploaded report formats) ------------------
const DEMO_ITEMS: any[] = [] // demo mode computes staff sales from seeded checkouts
const DEMO_PUNCHES: PunchRow[] = [
  { day: 'Jun 23, 2026', staff: 'Maya R.', in: '9:30 AM', out: '4:00 PM', hours: 6.5, _sort: 1 },
  { day: 'Jun 23, 2026', staff: 'Jordan T.', in: '9:31 AM', out: '3:38 PM', hours: 6.12, _sort: 2 },
  { day: 'Jun 23, 2026', staff: 'Priya N.', in: '10:45 AM', out: '4:09 PM', hours: 5.4, _sort: 3 },
  { day: 'Jun 24, 2026', staff: 'Maya R.', in: '9:28 AM', out: '5:02 PM', hours: 7.57, _sort: 4 },
  { day: 'Jun 24, 2026', staff: 'Devon K.', in: '11:00 AM', out: '6:30 PM', hours: 7.5, _sort: 5 },
]
const DEMO_DAYSOFF: DayOffRow[] = [
  { staff: 'Alex M.', day: 'May 18, 2026', reason: 'wedding', _sort: 1 },
  { staff: 'Priya N.', day: 'May 16, 2026', reason: 'Other', _sort: 2 },
  { staff: 'Sam W.', day: 'May 23, 2026', reason: 'Other', _sort: 3 },
]

// ---- Sales Summary / Sales by Time Period ---------------------------------
const isoD = (d: Date) => d.toISOString().slice(0, 10)
function startOfWeek(d: Date) { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x }
function bucketOf(dateStr: string, bucket: string) {
  const d = new Date(dateStr)
  if (bucket === 'week') { const s = startOfWeek(d); return { key: isoD(s), label: 'Week of ' + s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), sort: s.getTime() } }
  if (bucket === 'month') return { key: d.getFullYear() + '-' + (d.getMonth() + 1), label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), sort: new Date(d.getFullYear(), d.getMonth(), 1).getTime() }
  if (bucket === 'year') return { key: '' + d.getFullYear(), label: '' + d.getFullYear(), sort: new Date(d.getFullYear(), 0, 1).getTime() }
  return { key: isoD(d), label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), sort: d.getTime() }
}

export type SummaryRow = { period: string; nSales: number; nServices: number; serviceSales: number; nProducts: number; productSales: number; tips: number; refunds: number; sort: number }

export async function getSalesBuckets(from: string, to: string, bucket: string): Promise<SummaryRow[]> {
  if (!isSupabaseConfigured) {
    return [{ period: 'Jun 29', nSales: 29, nServices: 26, serviceSales: 147500, nProducts: 0, productSales: 0, tips: 28400, refunds: 0, sort: 1 }]
  }
  const { data: sales } = await supabase.from('sales').select('id, created_at, tip_cents')
    .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
  const { data: items } = await supabase.from('sale_items').select('kind, total_cents, quantity, sales!inner(created_at)')
    .gte('sales.created_at', from + 'T00:00:00').lte('sales.created_at', to + 'T23:59:59')
  const { data: refunds } = await supabase.from('refunds').select('amount_cents, created_at')
    .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
  const m: Record<string, SummaryRow> = {}
  const get = (k: string, label: string, sort: number) => (m[k] = m[k] || { period: label, sort, nSales: 0, nServices: 0, serviceSales: 0, nProducts: 0, productSales: 0, tips: 0, refunds: 0 })
  ;(sales || []).forEach((s: any) => { const b = bucketOf(s.created_at, bucket); const r = get(b.key, b.label, b.sort); r.nSales++; r.tips += s.tip_cents || 0 })
  ;(items || []).forEach((it: any) => {
    const created = Array.isArray(it.sales) ? it.sales[0]?.created_at : it.sales?.created_at
    const b = bucketOf(created, bucket); const r = get(b.key, b.label, b.sort)
    if (it.kind === 'product') { r.nProducts += it.quantity || 1; r.productSales += it.total_cents }
    else { r.nServices += it.quantity || 1; r.serviceSales += it.total_cents }
  })
  ;(refunds || []).forEach((rf: any) => { const b = bucketOf(rf.created_at, bucket); const r = get(b.key, b.label, b.sort); r.refunds += rf.amount_cents })
  return Object.values(m).sort((a, b) => a.sort - b.sort)
}

// ---- Refund Summary / Refund Details --------------------------------------
export async function getRefundSummary(from: string, to: string, by = 'refund') {
  if (!isSupabaseConfigured) return [] as { date: string; count: number; amount: number; sort: number }[]
  const { data } = await supabase.from('refunds').select('amount_cents, created_at, sales(created_at)')
    .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
  const m: Record<string, { date: string; count: number; amount: number; sort: number }> = {}
  ;(data || []).forEach((r: any) => {
    const saleCreated = Array.isArray(r.sales) ? r.sales[0]?.created_at : r.sales?.created_at
    const base = by === 'sale' && saleCreated ? saleCreated : r.created_at
    const b = bucketOf(base, 'day')
    m[b.key] = m[b.key] || { date: b.label, count: 0, amount: 0, sort: b.sort }
    m[b.key].count++; m[b.key].amount += r.amount_cents
  })
  return Object.values(m).sort((a, b) => a.sort - b.sort)
}

export async function getRefundDetails(from: string, to: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const { data } = await supabase.from('refunds')
    .select('id, sale_id, amount_cents, reason, created_at, clients(name), staff(name)')
    .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').order('created_at')
  return (data || []).map((r: any) => ({
    tx: 'TX' + r.id.slice(0, 4).toUpperCase(),
    refundNo: '#' + r.id.slice(0, 4).toUpperCase(),
    saleNo: r.sale_id ? '#' + r.sale_id.slice(0, 4).toUpperCase() : '—',
    date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    client: (Array.isArray(r.clients) ? r.clients[0]?.name : r.clients?.name) || '—',
    staff: (Array.isArray(r.staff) ? r.staff[0]?.name : r.staff?.name) || '—',
    method: 'Card', account: 'Primary',
    amount: r.amount_cents,
  }))
}

// ---- Service Sales / Product Sales (by category -> item) ------------------
export type CatLine = { label: string; count: number; sales: number; isCat?: boolean }

export async function getServiceSales(from: string, to: string) {
  const svcMap: Record<string, any> = {}
  ;(await getServices()).forEach((s) => (svcMap[s.id] = s))
  let items: any[] = []
  if (isSupabaseConfigured) {
    const { data } = await supabase.from('sale_items').select('kind, ref_id, description, total_cents, quantity, sales!inner(created_at)')
      .eq('kind', 'service').gte('sales.created_at', from + 'T00:00:00').lte('sales.created_at', to + 'T23:59:59')
    items = data || []
  }
  return groupCat(items, (it) => { const s = svcMap[it.ref_id]; return { cat: s?.cat || 'Services', name: s?.name || it.description } })
}

export async function getProductSales(from: string, to: string, sortBy = 'sales') {
  let items: any[] = []
  if (isSupabaseConfigured) {
    const { data } = await supabase.from('sale_items').select('kind, ref_id, description, total_cents, quantity, sales!inner(created_at)')
      .eq('kind', 'product').gte('sales.created_at', from + 'T00:00:00').lte('sales.created_at', to + 'T23:59:59')
    items = data || []
  }
  return groupCat(items, (it) => ({ cat: 'Products', name: it.description }), sortBy)
}

function groupCat(items: any[], pick: (it: any) => { cat: string; name: string }, sortBy = 'sales') {
  const cats: Record<string, { count: number; sales: number; items: Record<string, { count: number; sales: number }> }> = {}
  items.forEach((it) => {
    const { cat, name } = pick(it)
    cats[cat] = cats[cat] || { count: 0, sales: 0, items: {} }
    cats[cat].count += it.quantity || 1; cats[cat].sales += it.total_cents
    cats[cat].items[name] = cats[cat].items[name] || { count: 0, sales: 0 }
    cats[cat].items[name].count += it.quantity || 1; cats[cat].items[name].sales += it.total_cents
  })
  const lines: CatLine[] = []
  let tc = 0, ts = 0
  Object.entries(cats).forEach(([cat, c]) => {
    lines.push({ label: cat, count: c.count, sales: c.sales, isCat: true })
    const entries = Object.entries(c.items).sort((a, b) => sortBy === 'name' ? a[0].localeCompare(b[0]) : sortBy === 'qty' ? b[1].count - a[1].count : b[1].sales - a[1].sales)
    entries.forEach(([n, v]) => lines.push({ label: n, count: v.count, sales: v.sales }))
    tc += c.count; ts += c.sales
  })
  return { lines, total: { count: tc, sales: ts } }
}

// ---- Offers Usage / Offers Summary ----------------------------------------
export async function getOffersUsage(from: string, to: string, offerId = 'all') {
  if (!isSupabaseConfigured) return [] as any[]
  let q = supabase.from('offer_redemptions')
    .select('amount_cents, created_at, sale_id, offers(name,code), clients(name), sales(subtotal_cents)')
    .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').order('created_at')
  if (offerId !== 'all') q = q.eq('offer_id', offerId)
  const { data } = await q
  return (data || []).map((r: any) => {
    const after = (Array.isArray(r.sales) ? r.sales[0]?.subtotal_cents : r.sales?.subtotal_cents) || 0
    const offer = (Array.isArray(r.offers) ? r.offers[0] : r.offers) || {}
    return {
      saleNo: r.sale_id ? '#' + r.sale_id.slice(0, 4).toUpperCase() : '—',
      date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      client: (Array.isArray(r.clients) ? r.clients[0]?.name : r.clients?.name) || '—',
      offer: offer.code || offer.name || '—',
      before: after + r.amount_cents, discount: r.amount_cents, after,
    }
  })
}

export async function getOffersSummary(from: string, to: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const { data } = await supabase.from('offer_redemptions')
    .select('amount_cents, offers(name,code)')
    .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
  const m: Record<string, { offer: string; code: string; used: number; discount: number }> = {}
  ;(data || []).forEach((r: any) => {
    const o = (Array.isArray(r.offers) ? r.offers[0] : r.offers) || {}
    const key = o.name || '—'
    m[key] = m[key] || { offer: o.name || '—', code: o.code || '', used: 0, discount: 0 }
    m[key].used++; m[key].discount += r.amount_cents
  })
  return Object.values(m).sort((a, b) => b.discount - a.discount)
}

// ---- Client Account Balance (usage / balances / deposits) -----------------
const acctClient = (t: any) => {
  const ca = Array.isArray(t.client_accounts) ? t.client_accounts[0] : t.client_accounts
  const cl = ca ? (Array.isArray(ca.clients) ? ca.clients[0] : ca.clients) : null
  return cl?.name || '—'
}

export async function getAccountUsage(from: string, to: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const { data } = await supabase.from('client_account_transactions')
    .select('id, amount_cents, created_at, client_accounts(clients(name))')
    .eq('kind', 'charge').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').order('created_at')
  return (data || []).map((t: any) => ({
    date: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    saleNo: '#' + t.id.slice(0, 4).toUpperCase(), client: acctClient(t), amount: Math.abs(t.amount_cents),
  }))
}

export async function getAccountBalances(asOf: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const { data } = await supabase.from('client_account_transactions')
    .select('account_id, amount_cents, created_at, client_accounts(clients(name))')
    .lte('created_at', asOf + 'T23:59:59')
  const m: Record<string, { client: string; amount: number }> = {}
  ;(data || []).forEach((t: any) => {
    m[t.account_id] = m[t.account_id] || { client: acctClient(t), amount: 0 }
    m[t.account_id].amount += t.amount_cents
  })
  return Object.values(m).filter((r) => r.amount !== 0).sort((a, b) => a.client.localeCompare(b.client))
}

export async function getAccountDeposits(from: string, to: string) {
  if (!isSupabaseConfigured) return { deposits: [], refunds: [] } as any
  const { data } = await supabase.from('client_account_transactions')
    .select('id, kind, amount_cents, created_at, client_accounts(clients(name))')
    .in('kind', ['deposit', 'refund']).gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').order('created_at')
  const deposits: any[] = [], refunds: any[] = []
  ;(data || []).forEach((t: any) => {
    const base = { date: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), client: acctClient(t) }
    if (t.kind === 'deposit') deposits.push({ ...base, saleNo: '#' + t.id.slice(0, 4).toUpperCase(), amount: t.amount_cents })
    else refunds.push({ ...base, refundNo: '#' + t.id.slice(0, 4).toUpperCase(), amount: Math.abs(t.amount_cents) })
  })
  return { deposits, refunds }
}

// ---- Gift Cards (usage / balances / sales / sales details) ----------------
const gcName = (g: any) => {
  const gc = Array.isArray(g.gift_cards) ? g.gift_cards[0] : g.gift_cards
  return gc || {}
}
const clientName = (obj: any) => {
  const c = Array.isArray(obj?.clients) ? obj.clients[0] : obj?.clients
  return c?.name || ''
}

export async function getGiftCardUsage(from: string, to: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const { data } = await supabase.from('gift_card_transactions')
    .select('id, amount_cents, created_at, gift_cards(code, issued_at)')
    .eq('kind', 'redeem').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').order('created_at')
  return (data || []).map((t: any) => {
    const gc = gcName(t)
    return {
      date: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      saleNo: '#' + t.id.slice(0, 4).toUpperCase(), code: gc.code || '—',
      created: gc.issued_at ? new Date(gc.issued_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
      lastSale: new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: Math.abs(t.amount_cents), staff: '—',
    }
  })
}

export async function getGiftCardBalances(asOf: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const { data } = await supabase.from('gift_card_transactions')
    .select('gift_card_id, amount_cents, created_at, gift_cards(code, clients(name))')
    .lte('created_at', asOf + 'T23:59:59')
  const m: Record<string, { code: string; purchaser: string; amount: number }> = {}
  ;(data || []).forEach((t: any) => {
    const gc = gcName(t)
    m[t.gift_card_id] = m[t.gift_card_id] || { code: gc.code || '—', purchaser: clientName(gc), amount: 0 }
    m[t.gift_card_id].amount += t.amount_cents
  })
  return Object.values(m).filter((r) => r.amount > 0).sort((a, b) => a.code.localeCompare(b.code))
}

export async function getGiftCardSales(from: string, to: string) {
  if (!isSupabaseConfigured) return { count: 0, adjustments: 0, sales: 0, refundCount: 0, refunds: 0 }
  const { data } = await supabase.from('gift_card_transactions')
    .select('kind, amount_cents')
    .in('kind', ['issue', 'adjust']).gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
  let count = 0, sales = 0, adjustments = 0
  ;(data || []).forEach((t: any) => {
    if (t.kind === 'issue') { count++; sales += t.amount_cents } else adjustments += t.amount_cents
  })
  return { count, adjustments, sales, refundCount: 0, refunds: 0 }
}

export async function getGiftCardSalesDetails(from: string, to: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const { data } = await supabase.from('gift_cards')
    .select('id, code, initial_cents, issued_at, clients(name)')
    .gte('issued_at', from + 'T00:00:00').lte('issued_at', to + 'T23:59:59').order('issued_at')
  return (data || []).map((g: any) => ({
    saleNo: '#' + g.id.slice(0, 4).toUpperCase(),
    date: new Date(g.issued_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    client: clientName(g), code: g.code, promotion: '—',
    value: g.initial_cents, price: g.initial_cents, staff: 'No staff',
  }))
}

// ---- Packages (usage / outstanding / sales / sales details) ---------------
const one = (x: any) => (Array.isArray(x) ? x[0] : x)

async function packageCreditTotals(): Promise<Record<string, number>> {
  const { data } = await supabase.from('package_items').select('package_id, quantity')
  const m: Record<string, number> = {}
  ;(data || []).forEach((r: any) => { m[r.package_id] = (m[r.package_id] || 0) + r.quantity })
  return m
}

export async function getPackageSales(from: string, to: string) {
  if (!isSupabaseConfigured) return { rows: [] as any[], refunds: [] as any[] }
  const { data } = await supabase.from('client_packages')
    .select('package_id, purchased_at, packages(name, price_cents)')
    .gte('purchased_at', from + 'T00:00:00').lte('purchased_at', to + 'T23:59:59')
  const m: Record<string, { name: string; count: number; sales: number }> = {}
  ;(data || []).forEach((r: any) => {
    const p = one(r.packages) || {}
    m[r.package_id] = m[r.package_id] || { name: p.name || '—', count: 0, sales: 0 }
    m[r.package_id].count++; m[r.package_id].sales += p.price_cents || 0
  })
  return { rows: Object.values(m).sort((a, b) => b.sales - a.sales), refunds: [] }
}

export async function getPackageSalesDetails(from: string, to: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const { data } = await supabase.from('client_packages')
    .select('id, purchased_at, packages(name, price_cents), clients(name)')
    .gte('purchased_at', from + 'T00:00:00').lte('purchased_at', to + 'T23:59:59').order('purchased_at')
  return (data || []).map((r: any) => {
    const p = one(r.packages) || {}
    return {
      saleNo: '#' + r.id.slice(0, 4).toUpperCase(),
      date: new Date(r.purchased_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      client: one(r.clients)?.name || '—', packageName: p.name || '—', price: p.price_cents || 0, staff: 'No staff',
    }
  })
}

export async function getPackageUsage(from: string, to: string) {
  if (!isSupabaseConfigured) return { service: [] as any[] }
  const totals = await packageCreditTotals()
  const { data } = await supabase.from('package_redemptions')
    .select('id, redeemed_at, services(name), client_packages(purchased_at, package_id, clients(name), packages(name, price_cents))')
    .gte('redeemed_at', from + 'T00:00:00').lte('redeemed_at', to + 'T23:59:59').order('redeemed_at')
  const service = (data || []).map((r: any) => {
    const cp = one(r.client_packages) || {}
    const pkg = one(cp.packages) || {}
    const unit = (pkg.price_cents || 0) / (totals[cp.package_id] || 1)
    return {
      date: new Date(r.redeemed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      saleNo: '#' + r.id.slice(0, 4).toUpperCase(), client: one(cp.clients)?.name || '—',
      package: pkg.name || '—',
      created: cp.purchased_at ? new Date(cp.purchased_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
      service: one(r.services)?.name || '—', value: Math.round(unit),
    }
  })
  return { service }
}

export async function getOutstandingPackages(asOf: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const totals = await packageCreditTotals()
  const { data: cps } = await supabase.from('client_packages')
    .select('id, purchased_at, package_id, packages(name, price_cents), clients(name, phone, email)')
    .lte('purchased_at', asOf + 'T23:59:59')
  const { data: reds } = await supabase.from('package_redemptions')
    .select('client_package_id, redeemed_at').lte('redeemed_at', asOf + 'T23:59:59')
  const used: Record<string, number> = {}
  ;(reds || []).forEach((r: any) => { used[r.client_package_id] = (used[r.client_package_id] || 0) + 1 })
  const out: any[] = []
  ;(cps || []).forEach((cp: any) => {
    const p = one(cp.packages) || {}
    const total = totals[cp.package_id] || 0
    const remaining = total - (used[cp.id] || 0)
    if (remaining <= 0) return
    const unit = (p.price_cents || 0) / (total || 1)
    const cl = one(cp.clients) || {}
    out.push({
      package: p.name || '—',
      purchaseDate: new Date(cp.purchased_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      client: cl.name || '—', email: cl.email || '-', phone: cl.phone || '-',
      remainingServices: remaining, remainingProducts: '', amount: Math.round(remaining * unit),
    })
  })
  return out.sort((a, b) => a.package.localeCompare(b.package))
}

// ---- Memberships (payments / credit usage / started / cancellations) ------
export async function getMembershipPayments(from: string, to: string) {
  if (!isSupabaseConfigured) return { rows: [] as any[] }
  const { data } = await supabase.from('membership_payments')
    .select('amount_cents, paid_on, client_memberships(started_on, membership_plans(name))')
    .gte('paid_on', from).lte('paid_on', to)
  const m: Record<string, { name: string; total: number; nnew: number; sales: number }> = {}
  ;(data || []).forEach((p: any) => {
    const cm = one(p.client_memberships) || {}
    const plan = one(cm.membership_plans) || {}
    const key = plan.name || '—'
    m[key] = m[key] || { name: key, total: 0, nnew: 0, sales: 0 }
    m[key].total++; m[key].sales += p.amount_cents
    if (cm.started_on && cm.started_on >= from && cm.started_on <= to) m[key].nnew++
  })
  return { rows: Object.values(m).sort((a, b) => b.sales - a.sales) }
}

export async function getMembershipCreditUsage(from: string, to: string) {
  if (!isSupabaseConfigured) return { service: [] as any[] }
  const { data } = await supabase.from('membership_credits')
    .select('id, amount_cents, created_at, kind, client_memberships(clients(name), membership_plans(name))')
    .eq('kind', 'used').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').order('created_at')
  const service = (data || []).map((r: any) => {
    const cm = one(r.client_memberships) || {}
    return {
      date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      saleNo: '#' + r.id.slice(0, 4).toUpperCase(), client: one(cm.clients)?.name || '—',
      membership: one(cm.membership_plans)?.name || '—', service: '—', serviceCredit: '—', value: Math.abs(r.amount_cents),
    }
  })
  return { service }
}

export async function getMembershipsStarted(from: string, to: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const { data } = await supabase.from('client_memberships')
    .select('started_on, status, clients(name, phone, email), membership_plans(name)')
    .gte('started_on', from).lte('started_on', to).order('started_on')
  return (data || []).map((r: any) => ({
    startDate: new Date(r.started_on + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    client: one(r.clients)?.name || '—', phone: one(r.clients)?.phone || '-', email: one(r.clients)?.email || '-',
    plan: one(r.membership_plans)?.name || '—', status: r.status, staff: '—',
  }))
}

export async function getMembershipCancellations(from: string, to: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const { data } = await supabase.from('client_memberships')
    .select('started_on, canceled_on, clients(name, phone, email), membership_plans(name)')
    .eq('status', 'canceled').gte('canceled_on', from).lte('canceled_on', to).order('canceled_on')
  return (data || []).map((r: any) => ({
    started: new Date(r.started_on + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    client: one(r.clients)?.name || '—', phone: one(r.clients)?.phone || '-', email: one(r.clients)?.email || '-',
    plan: one(r.membership_plans)?.name || '—',
    canceledOn: r.canceled_on ? new Date(r.canceled_on + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—',
  }))
}

// ---- Payments (summary / details / cash drawer / deposits) ----------------
const PM_LABEL: Record<string, string> = {
  cash: 'Cash', reader: 'Credit Card (in-person)', card: 'Credit Card (virtual)',
  gift_card: 'Gift Card', account: 'Client Account',
}

export async function getPaymentSummary(from: string, to: string) {
  if (!isSupabaseConfigured) return { methods: [] as any[], other: [] as any[] }
  const F = from + 'T00:00:00', T = to + 'T23:59:59'
  const methods: Record<string, { label: string; count: number; amount: number }> = {}
  const add = (label: string, amount: number) => {
    methods[label] = methods[label] || { label, count: 0, amount: 0 }
    methods[label].count++; methods[label].amount += amount
  }
  const { data: pays } = await supabase.from('payments').select('method, amount_cents').gte('created_at', F).lte('created_at', T)
  ;(pays || []).forEach((p: any) => add(PM_LABEL[p.method] || p.method, p.amount_cents))
  const { data: gc } = await supabase.from('gift_card_transactions').select('amount_cents').eq('kind', 'redeem').gte('created_at', F).lte('created_at', T)
  ;(gc || []).forEach((r: any) => add('Gift Card', Math.abs(r.amount_cents)))
  const { data: ca } = await supabase.from('client_account_transactions').select('amount_cents').eq('kind', 'charge').gte('created_at', F).lte('created_at', T)
  ;(ca || []).forEach((r: any) => add('Client Account', Math.abs(r.amount_cents)))
  const { data: mc } = await supabase.from('membership_credits').select('amount_cents').eq('kind', 'used').gte('created_at', F).lte('created_at', T)
  let mu = { label: 'Membership Usage', count: 0, amount: 0 }
  ;(mc || []).forEach((r: any) => { mu.count++; mu.amount += Math.abs(r.amount_cents) })
  return { methods: Object.values(methods).sort((a, b) => a.label.localeCompare(b.label)), other: mu.count ? [mu] : [] }
}

export async function getPaymentDetails(from: string, to: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const { data } = await supabase.from('payments')
    .select('amount_cents, method, created_at, sale_id, sales(created_at, total_cents, clients(name), staff(name))')
    .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').order('created_at')
  return (data || []).map((p: any) => {
    const s = one(p.sales) || {}
    return {
      saleNo: p.sale_id ? '#' + p.sale_id.slice(0, 4).toUpperCase() : '—',
      payDate: new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      saleDate: s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
      client: one(s.clients)?.name || '—', staff: one(s.staff)?.name || '',
      amount: p.amount_cents, method: PM_LABEL[p.method] || p.method, saleTotal: s.total_cents || 0,
    }
  })
}

export async function getCashDrawer(from: string, to: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const F = from + 'T00:00:00', T = to + 'T23:59:59'
  const { data: cash } = await supabase.from('payments').select('amount_cents, created_at, sale_id').eq('method', 'cash').gte('created_at', F).lte('created_at', T)
  const { data: refs } = await supabase.from('refunds').select('amount_cents, created_at, sale_id').gte('created_at', F).lte('created_at', T)
  const rows = [
    ...(cash || []).map((p: any) => ({ date: new Date(p.created_at).toLocaleDateString('en-US'), type: 'Cash payment', details: p.sale_id ? 'From Sale #' + p.sale_id.slice(0, 4).toUpperCase() : '—', amount: p.amount_cents, sort: new Date(p.created_at).getTime() })),
    ...(refs || []).map((r: any) => ({ date: new Date(r.created_at).toLocaleDateString('en-US'), type: 'Reversed cash payment', details: r.sale_id ? 'From Sale #' + r.sale_id.slice(0, 4).toUpperCase() : '—', amount: -r.amount_cents, sort: new Date(r.created_at).getTime() })),
  ]
  return rows.sort((a, b) => a.sort - b.sort)
}

// Deposits (online booking pre-payments) — no deposits table yet, returns empty.
export async function getDepositsCollected(_from: string, _to: string) { return [] as any[] }
export async function getDepositsUsed(_from: string, _to: string) { return [] as any[] }

// ---- Inventory (COGS / inventory / changes / stock & usage) ---------------
const groupKey = (p: any, groupBy: string) => groupBy === 'category' ? (p.category || 'Uncategorized') : groupBy === 'brand' ? (p.brand || 'No brand') : (p.name || '—')

export async function getProductBrands() {
  if (!isSupabaseConfigured) return [] as string[]
  const { data } = await supabase.from('products').select('brand').not('brand', 'is', null)
  return Array.from(new Set((data || []).map((r: any) => r.brand).filter(Boolean))).sort()
}

export async function getCostOfGoods(from: string, to: string, groupBy = 'product') {
  if (!isSupabaseConfigured) return { rows: [] as any[] }
  const { data } = await supabase.from('inventory_movements')
    .select('qty_delta, products(name, cost_cents, price_cents, category, brand)')
    .eq('kind', 'sale').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
  const m: Record<string, { label: string; units: number; cogs: number; retail: number }> = {}
  ;(data || []).forEach((r: any) => {
    const p = one(r.products) || {}
    const key = groupKey(p, groupBy)
    const units = Math.abs(r.qty_delta)
    m[key] = m[key] || { label: key, units: 0, cogs: 0, retail: 0 }
    m[key].units += units; m[key].cogs += units * (p.cost_cents || 0); m[key].retail += units * (p.price_cents || 0)
  })
  return { rows: Object.values(m).map((r) => ({ ...r, margin: r.retail - r.cogs })).sort((a, b) => b.cogs - a.cogs) }
}

export async function getProductInventory(asOf: string, groupBy = 'product') {
  if (!isSupabaseConfigured) return [] as any[]
  const { data: inv } = await supabase.from('product_inventory').select('product_id, qty_on_hand, products(name, sku, cost_cents, category, brand)')
  // adjust current on-hand back to end of asOf by removing movements after that day
  const { data: after } = await supabase.from('inventory_movements').select('product_id, qty_delta').gt('created_at', asOf + 'T23:59:59')
  const futdelta: Record<string, number> = {}
  ;(after || []).forEach((r: any) => { futdelta[r.product_id] = (futdelta[r.product_id] || 0) + r.qty_delta })
  const perProduct: Record<string, any> = {}
  ;(inv || []).forEach((r: any) => {
    const p = one(r.products) || {}
    perProduct[r.product_id] = perProduct[r.product_id] || { product: p.name || '—', sku: p.sku || '—', category: p.category || 'Uncategorized', brand: p.brand || 'No brand', cost: p.cost_cents || 0, onHand: 0 }
    perProduct[r.product_id].onHand += r.qty_on_hand
  })
  Object.entries(perProduct).forEach(([pid, r]: any) => { r.onHand -= (futdelta[pid] || 0) })
  const list = Object.values(perProduct).filter((r: any) => r.onHand !== 0)
  if (groupBy === 'product') return list.map((r: any) => ({ label: r.product, sku: r.sku, category: r.category, brand: r.brand, onHand: r.onHand, value: r.onHand * r.cost })).sort((a: any, b: any) => a.label.localeCompare(b.label))
  const g: Record<string, any> = {}
  list.forEach((r: any) => { const k = groupBy === 'category' ? r.category : r.brand; g[k] = g[k] || { label: k, onHand: 0, value: 0 }; g[k].onHand += r.onHand; g[k].value += r.onHand * r.cost })
  return Object.values(g).sort((a: any, b: any) => a.label.localeCompare(b.label))
}

export async function getInventoryChanges(from: string, to: string, brand = 'all') {
  if (!isSupabaseConfigured) return [] as any[]
  const { data } = await supabase.from('inventory_movements')
    .select('created_at, kind, qty_delta, products(name, brand), staff(name)')
    .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59').order('created_at')
  const label: Record<string, string> = { receive: 'Received', sale: 'Sold', adjust: 'Adjustment', transfer: 'Transfer' }
  return (data || []).map((r: any) => ({ ...r, _brand: one(r.products)?.brand }))
    .filter((r: any) => brand === 'all' || r._brand === brand)
    .map((r: any) => ({
      date: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      product: one(r.products)?.name || '—', type: label[r.kind] || r.kind, qty: r.qty_delta, staff: one(r.staff)?.name || '—',
    }))
}

export async function getProductStockUsage(from: string, to: string, groupBy = 'product', brand = 'all') {
  if (!isSupabaseConfigured) return [] as any[]
  const { data: inv } = await supabase.from('product_inventory').select('product_id, qty_on_hand, products(name, sku, category, brand)')
  const { data: mv } = await supabase.from('inventory_movements').select('product_id, kind, qty_delta, products(brand)').gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
  const per: Record<string, any> = {}
  ;(inv || []).forEach((r: any) => {
    const p = one(r.products) || {}
    if (brand !== 'all' && (p.brand || 'No brand') !== brand) return
    per[r.product_id] = per[r.product_id] || { product: p.name || '—', sku: p.sku || '—', category: p.category || 'Uncategorized', brand: p.brand || 'No brand', onHand: 0, received: 0, sold: 0, adjusted: 0 }
    per[r.product_id].onHand += r.qty_on_hand
  })
  ;(mv || []).forEach((r: any) => {
    if (!per[r.product_id]) return
    if (r.kind === 'receive') per[r.product_id].received += r.qty_delta
    else if (r.kind === 'sale') per[r.product_id].sold += Math.abs(r.qty_delta)
    else if (r.kind === 'adjust') per[r.product_id].adjusted += r.qty_delta
  })
  const list = Object.values(per)
  if (groupBy === 'product') return list.sort((a: any, b: any) => a.product.localeCompare(b.product))
  const g: Record<string, any> = {}
  list.forEach((r: any) => { const k = groupBy === 'category' ? r.category : r.brand; g[k] = g[k] || { product: k, sku: '', onHand: 0, received: 0, sold: 0, adjusted: 0 }; g[k].onHand += r.onHand; g[k].received += r.received; g[k].sold += r.sold; g[k].adjusted += r.adjusted })
  return Object.values(g).sort((a: any, b: any) => a.product.localeCompare(b.product))
}

// ---- Business (cashflow / BI / retention / cancellations / export) --------
const hrs = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 3600000
const dstr = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export async function getCashflow(from: string, to: string) {
  if (!isSupabaseConfigured) return { rows: [] as any[] }
  const F = from + 'T00:00:00', T = to + 'T23:59:59'
  const { data: pays } = await supabase.from('payments').select('method, amount_cents, created_at').in('method', ['cash', 'card', 'reader']).gte('created_at', F).lte('created_at', T)
  const { data: refs } = await supabase.from('refunds').select('amount_cents, created_at').gte('created_at', F).lte('created_at', T)
  const m: Record<string, { date: string; gross: number; refunds: number; sort: number }> = {}
  const key = (c: string) => { const b = bucketOf(c, 'day'); m[b.key] = m[b.key] || { date: b.label, gross: 0, refunds: 0, sort: b.sort }; return m[b.key] }
  ;(pays || []).forEach((p: any) => { key(p.created_at).gross += p.amount_cents })
  ;(refs || []).forEach((r: any) => { key(r.created_at).refunds += r.amount_cents })
  return { rows: Object.values(m).map((r) => ({ ...r, net: r.gross - r.refunds })).sort((a, b) => a.sort - b.sort) }
}

export async function getBISales(from: string, to: string) {
  const staff = await getStaff()
  const nameById: Record<string, string> = {}; staff.forEach((s) => (nameById[s.id] = s.name))
  if (!isSupabaseConfigured) return staff.map((s) => ({ staff: s.name, nSales: 0, avgProduct: 0, avgService: 0, avgProducts: 0 }))
  const { data } = await supabase.from('sales').select('staff_id, sale_items(kind, total_cents, quantity)')
    .gte('created_at', from + 'T00:00:00').lte('created_at', to + 'T23:59:59')
  const agg: Record<string, any> = {}
  staff.forEach((s) => (agg[s.id] = { staff: s.name, nSales: 0, svc: 0, prod: 0, pqty: 0 }))
  ;(data || []).forEach((sale: any) => {
    const a = agg[sale.staff_id]; if (!a) return
    let svc = 0, prod = 0, pq = 0
    ;(sale.sale_items || []).forEach((it: any) => { if (it.kind === 'product') { prod += it.total_cents; pq += it.quantity || 1 } else svc += it.total_cents })
    a.nSales++; a.svc += svc; a.prod += prod; a.pqty += pq
  })
  return Object.values(agg).map((a: any) => ({
    staff: a.staff, nSales: a.nSales,
    avgProduct: a.nSales ? Math.round(a.prod / a.nSales) : 0,
    avgService: a.nSales ? Math.round(a.svc / a.nSales) : 0,
    avgProducts: a.nSales ? a.pqty / a.nSales : 0,
  })).sort((a: any, b: any) => a.staff.localeCompare(b.staff))
}

export async function getBIForecast(from: string, to: string) {
  if (!isSupabaseConfigured) return { rows: [] as any[] }
  const { data } = await supabase.from('appointments').select('starts_at, ends_at, price_cents, status')
    .gte('starts_at', from + 'T00:00:00').lte('starts_at', to + 'T23:59:59').neq('status', 'canceled')
  const m: Record<string, { date: string; appts: number; hours: number; projected: number; sort: number }> = {}
  ;(data || []).forEach((a: any) => {
    const b = bucketOf(a.starts_at, 'day'); m[b.key] = m[b.key] || { date: b.label, appts: 0, hours: 0, projected: 0, sort: b.sort }
    m[b.key].appts++; m[b.key].hours += hrs(a.starts_at, a.ends_at); m[b.key].projected += a.price_cents
  })
  return { rows: Object.values(m).sort((a, b) => a.sort - b.sort) }
}

// broad fetch to determine each client's first-ever visit (for new/existing + retention)
async function fetchApptsWide() {
  const { data } = await supabase.from('appointments')
    .select('id, client_id, staff_id, starts_at, ends_at, status, created_at')
    .order('starts_at')
  return data || []
}

export async function getBIAppointments(from: string, to: string) {
  const staff = await getStaff()
  if (!isSupabaseConfigured) return staff.map((s) => ({ staff: s.name, booked: 0, total: 0, walkins: 0, prebook: 0, newTotal: 0 }))
  const all = await fetchApptsWide()
  const firstByClient: Record<string, string> = {}
  all.forEach((a: any) => { if (!firstByClient[a.client_id] || a.starts_at < firstByClient[a.client_id]) firstByClient[a.client_id] = a.starts_at })
  const futureByClient: Record<string, string[]> = {}
  all.forEach((a: any) => { (futureByClient[a.client_id] = futureByClient[a.client_id] || []).push(a.starts_at) })
  const inRange = (d: string) => d >= from + 'T00:00:00' && d <= to + 'T23:59:59'
  const agg: Record<string, any> = {}
  staff.forEach((s) => (agg[s.id] = { staff: s.name, booked: 0, total: 0, walkins: 0, prebook: 0, newTotal: 0 }))
  all.filter((a: any) => inRange(a.starts_at) && a.status !== 'canceled').forEach((a: any) => {
    const g = agg[a.staff_id]; if (!g) return
    g.total++; g.booked += hrs(a.starts_at, a.ends_at)
    if (Math.abs(hrs(a.created_at, a.starts_at)) <= 1) g.walkins++
    if ((futureByClient[a.client_id] || []).some((s) => s > a.starts_at)) g.prebook++
    if (firstByClient[a.client_id] === a.starts_at) g.newTotal++
  })
  return Object.values(agg).sort((a: any, b: any) => a.staff.localeCompare(b.staff))
}

export async function getClientRetention(from: string, to: string) {
  const staff = await getStaff()
  if (!isSupabaseConfigured) return staff.map((s) => ({ staff: s.name }))
  const all = await fetchApptsWide()
  const visitsByClient: Record<string, string[]> = {}
  all.forEach((a: any) => { if (a.status !== 'canceled') (visitsByClient[a.client_id] = visitsByClient[a.client_id] || []).push(a.starts_at) })
  Object.values(visitsByClient).forEach((v) => v.sort())
  const firstInRange: Record<string, { date: string; staff: string }> = {}
  all.filter((a: any) => a.status !== 'canceled' && a.starts_at >= from + 'T00:00:00' && a.starts_at <= to + 'T23:59:59')
    .forEach((a: any) => { if (!firstInRange[a.client_id] || a.starts_at < firstInRange[a.client_id].date) firstInRange[a.client_id] = { date: a.starts_at, staff: a.staff_id } })
  const agg: Record<string, any> = {}
  const mk = () => ({ total: 0, r30: 0, r60: 0, r90: 0, r180: 0 })
  staff.forEach((s) => (agg[s.id] = { staff: s.name, ex: mk(), nw: mk() }))
  Object.entries(firstInRange).forEach(([cid, info]: any) => {
    const g = agg[info.staff]; if (!g) return
    const isNew = (visitsByClient[cid] || [])[0] === info.date
    const bucket = isNew ? g.nw : g.ex
    bucket.total++
    const t0 = new Date(info.date).getTime()
    const days = (v: string) => (new Date(v).getTime() - t0) / 86400000
    const has = (n: number) => (visitsByClient[cid] || []).some((v) => { const d = days(v); return d > 0 && d <= n })
    if (has(30)) bucket.r30++; if (has(60)) bucket.r60++; if (has(90)) bucket.r90++; if (has(180)) bucket.r180++
  })
  return Object.values(agg).sort((a: any, b: any) => a.staff.localeCompare(b.staff))
}

export async function getAppointmentCancellations(from: string, to: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const { data } = await supabase.from('appointments')
    .select('starts_at, status, clients(name, phone), staff(name), services(name)')
    .in('status', ['canceled', 'no_show']).gte('starts_at', from + 'T00:00:00').lte('starts_at', to + 'T23:59:59').order('starts_at')
  return (data || []).map((a: any) => ({
    date: new Date(a.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    client: one(a.clients)?.name || '—', phone: one(a.clients)?.phone || '-',
    service: one(a.services)?.name || '—', staff: one(a.staff)?.name || '—',
    status: a.status === 'no_show' ? 'No-show' : 'Canceled',
  }))
}

export async function getAppointmentsExport(from: string, to: string) {
  if (!isSupabaseConfigured) return [] as any[]
  const STAT: Record<string, string> = { booked: 'Booked', confirmed: 'Confirmed', checked_in: 'Checked In', completed: 'Finished', paid: 'Finished', no_show: 'No-show' }
  const { data } = await supabase.from('appointments')
    .select('starts_at, status, price_cents, clients(name), staff(name), services(name)')
    .neq('status', 'canceled').gte('starts_at', from + 'T00:00:00').lte('starts_at', to + 'T23:59:59').order('starts_at')
  return (data || []).map((a: any) => ({
    date: new Date(a.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    client: one(a.clients)?.name || '—', service: one(a.services)?.name || '—',
    provider: one(a.staff)?.name || '—', status: STAT[a.status] || a.status, saleTotal: a.price_cents,
  }))
}

// ---- Revenue by Service Type (payout coding for QuickBooks) ----------------
export async function getRevenueByServiceType(from: string, to: string) {
  if (!isSupabaseConfigured) return { days: [] as any[], serviceCols: [] as string[], detail: [] as any[] }
  const svcMap: Record<string, any> = {}
  ;(await getServices()).forEach((s) => (svcMap[s.id] = s))
  const F = from + 'T00:00:00', T = to + 'T23:59:59'
  const { data: items } = await supabase.from('sale_items')
    .select('kind, ref_id, description, total_cents, sale_id, sales!inner(created_at, clients(name))')
    .gte('sales.created_at', F).lte('sales.created_at', T)
  const { data: sales } = await supabase.from('sales').select('id, created_at, tip_cents, clients(name)')
    .gte('created_at', F).lte('created_at', T)

  const dayOf = (c: string) => { const b = bucketOf(c, 'day'); return { key: b.key, label: b.label, sort: b.sort } }
  const days: Record<string, { label: string; sort: number; cols: Record<string, number>; tips: number; total: number }> = {}
  const colSet = new Set<string>()
  const detail: any[] = []

  ;(items || []).forEach((it: any) => {
    const s = one(it.sales) || {}
    const d = dayOf(s.created_at)
    const svcName = it.kind === 'product' ? 'Products' : (svcMap[it.ref_id]?.name || it.description || 'Service')
    colSet.add(svcName)
    days[d.key] = days[d.key] || { label: d.label, sort: d.sort, cols: {}, tips: 0, total: 0 }
    days[d.key].cols[svcName] = (days[d.key].cols[svcName] || 0) + it.total_cents
    days[d.key].total += it.total_cents
    detail.push({
      sort: new Date(s.created_at).getTime(),
      date: d.label, saleNo: it.sale_id ? '#' + it.sale_id.slice(0, 4).toUpperCase() : '—',
      client: one(s.clients)?.name || '—', service: svcName, amount: it.total_cents,
    })
  })
  ;(sales || []).forEach((s: any) => {
    if (!s.tip_cents) return
    const d = dayOf(s.created_at)
    days[d.key] = days[d.key] || { label: d.label, sort: d.sort, cols: {}, tips: 0, total: 0 }
    days[d.key].tips += s.tip_cents
    days[d.key].total += s.tip_cents
    detail.push({
      sort: new Date(s.created_at).getTime(),
      date: d.label, saleNo: '#' + s.id.slice(0, 4).toUpperCase(),
      client: one(s.clients)?.name || '—', service: 'Tips', amount: s.tip_cents,
    })
  })

  // settlement split: what actually flows to a card payout vs cash vs other tender
  const { data: pays } = await supabase.from('payments').select('method, amount_cents, created_at')
    .gte('created_at', F).lte('created_at', T)
  const settle: Record<string, { card: number; cash: number; other: number }> = {}
  ;(pays || []).forEach((p: any) => {
    const d = dayOf(p.created_at)
    settle[d.key] = settle[d.key] || { card: 0, cash: 0, other: 0 }
    if (p.method === 'card' || p.method === 'reader') settle[d.key].card += p.amount_cents
    else if (p.method === 'cash') settle[d.key].cash += p.amount_cents
    else settle[d.key].other += p.amount_cents
  })
  Object.entries(days).forEach(([k, d]: any) => { d.settle = settle[k] || { card: 0, cash: 0, other: 0 } })

  const serviceCols = Array.from(colSet).sort((a, b) => (a === 'Products' ? 1 : b === 'Products' ? -1 : a.localeCompare(b)))
  return {
    serviceCols,
    days: Object.values(days).sort((a, b) => a.sort - b.sort),
    detail: detail.sort((a, b) => a.sort - b.sort),
  }
}
