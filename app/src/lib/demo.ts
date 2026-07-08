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

export const CLIENTS = [
  { id: 'c1', name: 'Hannah Brooks', phone: '(801) 555-0142', since: 2022, color: '#0FA06F' },
  { id: 'c2', name: 'Olivia Chen', phone: '(801) 555-0198', since: 2023, color: '#7C6FD0' },
  { id: 'c3', name: 'Marcus Webb', phone: '(385) 555-0167', since: 2021, color: '#3D94C9' },
  { id: 'c4', name: 'Sofia Ramirez', phone: '(801) 555-0123', since: 2024, color: '#D9657A' },
  { id: 'c5', name: 'Tyler Nguyen', phone: '(385) 555-0211', since: 2023, color: '#E8951F' },
  { id: 'c6', name: 'Grace Liu', phone: '(801) 555-0156', since: 2022, color: '#5C7488' },
  { id: 'c7', name: 'Ethan Park', phone: '(801) 555-0188', since: 2024, color: '#0B7E58' },
  { id: 'c8', name: 'Isabella Moore', phone: '(385) 555-0144', since: 2021, color: '#b5740f' },
]

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
  { name: 'Argan Oil Treatment', sku: 'AO-01', price: 2800, cost: 1200, stock: 11 },
  { name: 'Styling Cream', sku: 'SC-01', price: 2200, cost: 800, stock: 6 },
  { name: 'Hydrating Serum', sku: 'HS-02', price: 4600, cost: 1900, stock: 2 },
  { name: 'Detangling Brush', sku: 'DB-03', price: 1800, cost: 600, stock: 14 },
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
