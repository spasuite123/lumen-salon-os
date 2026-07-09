// Local demo data — mirrors the Supabase schema so the app runs with no backend.
// Money is in cents to match the database.

export const LOCATIONS = [
  { id: 'lay', name: 'Layton', city: 'Layton, UT', color: '#0FA06F' },
  { id: 'leh', name: 'Lehi', city: 'Lehi, UT', color: '#7C6FD0' },
  { id: 'sld', name: 'Silicon Slopes', city: 'Draper, UT', color: '#E8951F' },
]

export const STAFF = [
  { id: 's1', name: 'Maya R.', role: 'Senior Stylist', color: '#0FA06F', locs: ['lay', 'leh'] },
  { id: 's2', name: 'Jordan T.', role: 'Colorist', color: '#7C6FD0', locs: ['lay'] },
  { id: 's3', name: 'Priya N.', role: 'Esthetician', color: '#D9657A', locs: ['lay', 'sld'] },
  { id: 's4', name: 'Devon K.', role: 'Massage Therapist', color: '#3D94C9', locs: ['lay'] },
  { id: 's5', name: 'Alex M.', role: 'Nail Artist', color: '#E8951F', locs: ['leh', 'sld'] },
  { id: 's6', name: 'Sam W.', role: 'Front Desk', color: '#5C7488', locs: ['leh', 'sld'] },
]

export const SERVICES = [
  { id: 'sv1', name: "Women's Cut & Style", dur: 60, price: { lay: 7500, leh: 8000, sld: 9500 }, cat: 'Hair' },
  { id: 'sv2', name: 'Full Highlights', dur: 120, price: { lay: 16500, leh: 17500, sld: 21000 }, cat: 'Color' },
  { id: 'sv3', name: 'Signature Facial', dur: 60, price: { lay: 11000, leh: 11000, sld: 14000 }, cat: 'Skin' },
  { id: 'sv4', name: 'Deep Tissue Massage', dur: 60, price: { lay: 12000, leh: 12000, sld: 15000 }, cat: 'Body' },
  { id: 'sv5', name: 'Gel Manicure', dur: 45, price: { lay: 5500, leh: 6000, sld: 7000 }, cat: 'Nails' },
  { id: 'sv6', name: "Men's Cut", dur: 30, price: { lay: 4500, leh: 4800, sld: 6000 }, cat: 'Hair' },
  { id: 'sv7', name: 'Brow Lamination', dur: 45, price: { lay: 8500, leh: 8500, sld: 10000 }, cat: 'Skin' },
]

export const CLIENTS: any[] = [
  { id: 'c1', name: 'Hannah Brooks', phone: '(801) 555-0142', email: 'hannah.brooks@gmail.com', since: 2022, color: '#0FA06F', notes: 'Prefers morning appointments. Sensitive to certain keratin treatments — confirm products first. Loves chai lattes.', tags: ['VIP'] },
  { id: 'c2', name: 'Olivia Chen', phone: '(801) 555-0198', email: 'olivia.chen@icloud.com', since: 2023, color: '#7C6FD0', notes: 'Very particular about color temperature — always cool/ashy, never warm.', tags: ['VIP'], membership: 'VIP Monthly' },
  { id: 'c3', name: 'Marcus Webb', phone: '(385) 555-0167', email: 'marcus.webb@outlook.com', since: 2021, color: '#3D94C9', notes: 'Canceled membership Jan 2026. Good reactivation candidate — ask about returning to monthly plan.', tags: ['Lapsed'] },
  { id: 'c4', name: 'Sofia Ramirez', phone: '(801) 555-0123', email: '', since: 2024, color: '#D9657A', notes: '', tags: ['New Client'] },
  { id: 'c5', name: 'Tyler Nguyen', phone: '(385) 555-0211', email: 'tyler.nguyen@gmail.com', since: 2023, color: '#E8951F', notes: '', tags: ['VIP'], membership: 'VIP Monthly' },
  { id: 'c6', name: 'Grace Liu', phone: '(801) 555-0156', email: 'grace.liu@gmail.com', since: 2022, color: '#5C7488', notes: 'Sensitive scalp — no ammonia, fragrance-free formulas only. Always patch test.', tags: ['Allergy Note'] },
  { id: 'c7', name: 'Ethan Park', phone: '(801) 555-0188', email: '', since: 2024, color: '#0B7E58', notes: '', tags: [] },
  { id: 'c8', name: 'Isabella Moore', phone: '(385) 555-0144', email: 'isabella.m@gmail.com', since: 2021, color: '#b5740f', notes: 'Prefers late afternoons. Always books brow services with Priya — do not reassign without asking.', tags: [] },
]

export let VISIT_NOTES: Record<string, string> = {
  'a1': "Women's Cut & Style — trimmed 1.5 in, added textured layers. Growing out bangs. Next visit: check-in on growth, may add curtain bangs.",
  'a2': "Full highlights — Wella 10/0 base, bleach on foils. Toner: T18 + T10 1:1, 20vol, 15 min. Client very happy. Go slightly ashier next time.",
  'd1': "Signature Facial — Hydra Boost serum + collagen mask. Mild congestion around nose, light redness post-treatment (resolved). No adverse reactions.",
}

export const APPTS = [
  { id: 'a1', locId: 'lay', clientId: 'c1', staffId: 's1', svcId: 'sv1', h: 9, m: 0, status: 'paid' },
  { id: 'a2', locId: 'lay', clientId: 'c2', staffId: 's2', svcId: 'sv2', h: 9, m: 30, status: 'paid' },
  { id: 'a3', locId: 'lay', clientId: 'c4', staffId: 's3', svcId: 'sv3', h: 10, m: 0, status: 'booked' },
  { id: 'a4', locId: 'lay', clientId: 'c3', staffId: 's4', svcId: 'sv4', h: 11, m: 0, status: 'booked' },
  { id: 'a5', locId: 'lay', clientId: 'c6', staffId: 's1', svcId: 'sv6', h: 11, m: 30, status: 'booked' },
  { id: 'a6', locId: 'lay', clientId: 'c8', staffId: 's3', svcId: 'sv7', h: 13, m: 0, status: 'booked' },
  { id: 'b1', locId: 'leh', clientId: 'c5', staffId: 's5', svcId: 'sv5', h: 10, m: 0, status: 'paid' },
  { id: 'b2', locId: 'leh', clientId: 'c1', staffId: 's1', svcId: 'sv1', h: 10, m: 30, status: 'booked' },
  { id: 'd1', locId: 'sld', clientId: 'c6', staffId: 's3', svcId: 'sv3', h: 9, m: 30, status: 'paid' },
  { id: 'd2', locId: 'sld', clientId: 'c7', staffId: 's5', svcId: 'sv5', h: 14, m: 0, status: 'booked' },
]

export const PRODUCTS = [
  { name: 'Vitamin C Brightening Serum', sku: 'VC-01', price: 5800, cost: 2100, stock: 9 },
  { name: 'Lavender Body Oil', sku: 'LB-01', price: 3400, cost: 1200, stock: 14 },
  { name: 'Rose Hydration Face Mist', sku: 'RH-02', price: 2800, cost: 900, stock: 7 },
  { name: 'Deep Moisture Eye Cream', sku: 'DM-03', price: 6200, cost: 2400, stock: 5 },
  { name: 'Exfoliating Sugar Scrub', sku: 'ES-04', price: 3200, cost: 1100, stock: 11 },
  { name: 'Aromatherapy Candle', sku: 'AC-05', price: 2200, cost: 700, stock: 18 },
]

export const GIFTCARDS = [
  { code: 'LUMEN-50', initial: 5000, balance: 3500, owner: 'Hannah Brooks' },
  { code: 'LUMEN-100', initial: 10000, balance: 10000, owner: 'Olivia Chen' },
  { code: 'GIFT-25', initial: 2500, balance: 0, owner: 'Marcus Webb' },
]

export const PACKAGES = [
  { name: 'Facial Series (3)', price: 29700, sold: 8, remaining: 14 },
  { name: 'Massage 5-Pack', price: 55000, sold: 4, remaining: 9 },
  { name: 'Color Maintenance (4)', price: 60000, sold: 3, remaining: 7 },
]

export const MEMBERS = [
  { client: 'Olivia Chen', plan: 'VIP Monthly', status: 'active', since: 'Apr 2026' },
  { client: 'Tyler Nguyen', plan: 'VIP Monthly', status: 'active', since: 'Jun 2026' },
  { client: 'Marcus Webb', plan: 'VIP Monthly', status: 'canceled', since: 'Jan 2026' },
]

export const OFFERS = [
  { name: 'New Client 20%', code: 'NEW20', type: '20% off', used: 24, active: true },
  { name: 'Refer-a-Friend', code: 'FRIEND', type: '$15 off', used: 11, active: true },
  { name: 'Summer Glow', code: 'GLOW', type: '15% off', used: 0, active: false },
]

export const RESOURCES = [
  { name: 'Facial Room A', type: 'Treatment room', loc: 'Layton' },
  { name: 'Facial Room B', type: 'Treatment room', loc: 'Layton' },
  { name: 'Massage Suite', type: 'Treatment room', loc: 'Silicon Slopes' },
  { name: 'Color Bar', type: 'Station', loc: 'Lehi' },
]

export const CAMPAIGNS = [
  { name: 'June Newsletter', channel: 'Email', status: 'Sent', sent: 842, opens: '38%' },
  { name: 'Win-back: 60 days', channel: 'Email', status: 'Active', sent: 120, opens: '44%' },
  { name: 'Flash Sale SMS', channel: 'SMS', status: 'Draft', sent: 0, opens: '—' },
]

export const FLOWS = [
  { name: 'Appointment reminder', trigger: '24h before appt', action: 'Send SMS', status: 'On' },
  { name: 'Post-visit review request', trigger: '2h after checkout', action: 'Send email', status: 'On' },
  { name: 'Birthday offer', trigger: 'On client birthday', action: 'Send $10 credit', status: 'On' },
  { name: 'No-show follow-up', trigger: 'On no-show', action: 'Send rebook link', status: 'Off' },
]

export const FORMS = [
  { name: 'New Client Intake', fields: 9, submissions: 148 },
  { name: 'Consent — Chemical Services', fields: 6, submissions: 73 },
  { name: 'Massage Health History', fields: 12, submissions: 54 },
]

export const CONVOS = [
  { client: 'Tyler Nguyen', last: 'Can I move my manicure to Friday?', time: '8:40a', unread: true, color: '#E8951F' },
  { client: 'Grace Liu', last: 'Do you carry the hydrating serum?', time: 'Yest', unread: true, color: '#5C7488' },
  { client: 'Hannah Brooks', last: 'Perfect, see you at 9! Thank you', time: '9:02a', unread: false, color: '#0FA06F' },
  { client: 'Marcus Webb', last: 'Thanks for the massage, felt great.', time: 'Mon', unread: false, color: '#3D94C9' },
]

// ---- Scheduler demo data ----

// Per-staff recurring availability restrictions. No row = fully available that day.
// day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
// start_min / end_min: minutes from midnight (null = store open/close)
export const STAFF_AVAILABILITY: any[] = [
  // Maya (s1): Wednesdays only after 1pm (780 min), Fridays completely off
  { id: 'av1', staffId: 's1', dayOfWeek: 3, isAvailable: true, startMin: 780, endMin: null },
  { id: 'av2', staffId: 's1', dayOfWeek: 5, isAvailable: false, startMin: null, endMin: null },
]

// Per-staff schedule constraint rules
export const SCHEDULE_RULES: any[] = [
  { id: 'r1', staffId: 's1', ruleType: 'max_hours_week', value: 25 },   // Maya: max 25h/wk
  { id: 'r2', staffId: 's3', ruleType: 'min_hours_week', value: 30 },   // Priya: min 30h/wk
  { id: 'r3', staffId: 's2', ruleType: 'max_hours_week', value: 40 },   // Jordan: max 40h/wk
]

// Scheduled shifts for the week of 2026-07-07 (Mon) at Layton store
// Maya total: 9+9+5+8 = 31h → over 25h max (shows violation badge)
// Priya total: 8+8 = 16h → under 30h min (shows violation badge)
export const SHIFTS: any[] = [
  { id: 'sh1', orgId: 'demo', storeId: 'lay', staffId: 's1', shiftDate: '2026-07-07', startMin: 600, endMin: 1140, notes: '' }, // Maya Mon 10am-7pm
  { id: 'sh2', orgId: 'demo', storeId: 'lay', staffId: 's1', shiftDate: '2026-07-08', startMin: 600, endMin: 1140, notes: '' }, // Maya Tue 10am-7pm
  { id: 'sh3', orgId: 'demo', storeId: 'lay', staffId: 's1', shiftDate: '2026-07-09', startMin: 780, endMin: 1080, notes: '' }, // Maya Wed 1pm-6pm
  { id: 'sh4', orgId: 'demo', storeId: 'lay', staffId: 's1', shiftDate: '2026-07-10', startMin: 600, endMin: 1080, notes: '' }, // Maya Thu 10am-6pm
  { id: 'sh5', orgId: 'demo', storeId: 'lay', staffId: 's2', shiftDate: '2026-07-07', startMin: 600, endMin: 1080, notes: '' }, // Jordan Mon 10am-6pm
  { id: 'sh6', orgId: 'demo', storeId: 'lay', staffId: 's2', shiftDate: '2026-07-08', startMin: 600, endMin: 1080, notes: '' }, // Jordan Tue 10am-6pm
  { id: 'sh7', orgId: 'demo', storeId: 'lay', staffId: 's3', shiftDate: '2026-07-07', startMin: 600, endMin: 1080, notes: '' }, // Priya Mon 10am-6pm
  { id: 'sh8', orgId: 'demo', storeId: 'lay', staffId: 's3', shiftDate: '2026-07-08', startMin: 600, endMin: 1080, notes: '' }, // Priya Tue 10am-6pm
]

// Time-off entries overlapping this week — Jordan has Thursday off
export const TIME_OFF_DEMO: any[] = [
  { id: 'to1', staffId: 's2', startDate: '2026-07-10', endDate: '2026-07-10', reason: 'Personal day' },
]

// Appointment counts per staff per day (for shift density display)
export const APPT_COUNTS_DEMO: { staffId: string; shiftDate: string; count: number }[] = [
  { staffId: 's1', shiftDate: '2026-07-07', count: 4 },
  { staffId: 's1', shiftDate: '2026-07-08', count: 6 },
  { staffId: 's1', shiftDate: '2026-07-09', count: 2 },
  { staffId: 's1', shiftDate: '2026-07-10', count: 5 },
  { staffId: 's2', shiftDate: '2026-07-07', count: 3 },
  { staffId: 's2', shiftDate: '2026-07-08', count: 5 },
  { staffId: 's3', shiftDate: '2026-07-07', count: 4 },
  { staffId: 's3', shiftDate: '2026-07-08', count: 3 },
  { staffId: 's4', shiftDate: '2026-07-08', count: 2 },
  { staffId: 's4', shiftDate: '2026-07-10', count: 4 },
]

// Total appointment volume per day at the store (for day header indicators)
export const DAY_VOLUMES_DEMO: { shiftDate: string; count: number }[] = [
  { shiftDate: '2026-07-07', count: 12 },
  { shiftDate: '2026-07-08', count: 18 },
  { shiftDate: '2026-07-09', count: 9 },
  { shiftDate: '2026-07-10', count: 15 },
  { shiftDate: '2026-07-11', count: 6 },
  { shiftDate: '2026-07-12', count: 8 },
]
