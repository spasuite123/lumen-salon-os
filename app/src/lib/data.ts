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
  const { data } = await supabase.from('clients').select('id,name,phone').order('name')
  const palette = ['#0FA06F', '#7C6FD0', '#3D94C9', '#D9657A', '#E8951F', '#5C7488', '#0B7E58', '#b5740f']
  return (data || []).map((c: any, i: number) => ({ ...c, color: palette[i % palette.length], since: 2023 }))
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
    demo.CLIENTS.push({ id: 'n' + Date.now(), name, phone, since: new Date().getFullYear(), color: '#0FA06F' })
    return { ok: true }
  }
  const org = await getOrgId()
  const { error } = await supabase.from('clients').insert({ org_id: org, name, phone })
  return { ok: !error, error: error?.message }
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
