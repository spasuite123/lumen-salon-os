import { useEffect, useState } from 'react'
import { useApp } from '../lib/AppContext'
import * as data from '../lib/data'
import { money, initials } from '../lib/util'
import { LOCATIONS } from '../lib/demo'

type Col = { label: string; render: (row: any) => any; right?: boolean }
type Cfg = { title: string; sub: string; load: () => Promise<any[]>; cols: Col[] }

const tag = (text: string, kind: string) => <span className={'tag ' + kind}>{text}</span>

const CONFIGS: Record<string, Cfg> = {
  products: {
    title: 'Products', sub: 'Retail catalog and on-hand stock', load: data.getProducts,
    cols: [
      { label: 'Product', render: (p) => p.name },
      { label: 'SKU', render: (p) => p.sku },
      { label: 'Price', render: (p) => money(p.price), right: true },
      { label: 'Cost', render: (p) => money(p.cost), right: true },
      { label: 'On hand', render: (p) => (p.stock <= 3 ? tag(p.stock + ' · low', 'rose') : p.stock), right: true },
    ],
  },
  giftcards: {
    title: 'Gift Cards', sub: 'Outstanding balances and liability', load: data.getGiftCards,
    cols: [
      { label: 'Code', render: (g) => <b>{g.code}</b> },
      { label: 'Owner', render: (g) => g.owner },
      { label: 'Issued', render: (g) => money(g.initial), right: true },
      { label: 'Balance', render: (g) => (g.balance > 0 ? money(g.balance) : tag('Redeemed', 'gray')), right: true },
    ],
  },
  packages: {
    title: 'Packages', sub: 'Pre-paid service bundles', load: data.getPackages,
    cols: [
      { label: 'Package', render: (p) => p.name },
      { label: 'Price', render: (p) => money(p.price), right: true },
      { label: 'Sold', render: (p) => p.sold, right: true },
      { label: 'Sessions left', render: (p) => p.remaining, right: true },
    ],
  },
  memberships: {
    title: 'Memberships', sub: 'Recurring members across all stores', load: data.getMemberships,
    cols: [
      { label: 'Client', render: (m) => m.client },
      { label: 'Plan', render: (m) => m.plan },
      { label: 'Since', render: (m) => m.since },
      { label: 'Status', render: (m) => tag(m.status, m.status === 'active' ? 'green' : 'gray') },
    ],
  },
  offers: {
    title: 'Offers', sub: 'Discounts and promotions', load: data.getOffers,
    cols: [
      { label: 'Offer', render: (o) => o.name },
      { label: 'Code', render: (o) => <b>{o.code}</b> },
      { label: 'Discount', render: (o) => o.type },
      { label: 'Redemptions', render: (o) => o.used, right: true },
      { label: 'Status', render: (o) => tag(o.active ? 'Active' : 'Inactive', o.active ? 'green' : 'gray') },
    ],
  },
  services: {
    title: 'Services', sub: 'Menu offered across locations', load: data.getServices,
    cols: [
      { label: 'Service', render: (s) => s.name },
      { label: 'Category', render: (s) => tag(s.cat, 'violet') },
      { label: 'Duration', render: (s) => s.dur + ' min' },
      { label: 'Price (Layton)', render: (s) => money(s.price.lay ?? Object.values(s.price)[0] ?? 0), right: true },
    ],
  },
  staff: {
    title: 'Staff Members', sub: 'Team and the stores they work at', load: data.getStaff,
    cols: [
      { label: 'Name', render: (s) => <><span className="chip" style={{ background: s.color }}>{initials(s.name)}</span>{s.name}</> },
      { label: 'Role', render: (s) => s.role },
      { label: 'Works at', render: (s) => (s.locs || []).map((l: string) => (LOCATIONS.find((x) => x.id === l)?.name || l)).join(', ') },
    ],
  },
  resources: {
    title: 'Resources', sub: 'Rooms and equipment that can be booked', load: data.getResources,
    cols: [
      { label: 'Resource', render: (r) => r.name },
      { label: 'Type', render: (r) => r.type },
      { label: 'Location', render: (r) => r.loc },
    ],
  },
  campaigns: {
    title: 'Campaigns', sub: 'Email & SMS broadcasts', load: data.getCampaigns,
    cols: [
      { label: 'Campaign', render: (c) => c.name },
      { label: 'Channel', render: (c) => c.channel },
      { label: 'Status', render: (c) => tag(c.status, c.status === 'Sent' ? 'green' : c.status === 'Active' ? 'violet' : 'gray') },
      { label: 'Sent', render: (c) => c.sent, right: true },
      { label: 'Open rate', render: (c) => c.opens, right: true },
    ],
  },
  timeclock: {
    title: 'Time Clock', sub: "Today's punches by staff", load: () => Promise.resolve([
      { staff: 'Maya R.', store: 'Layton', in: '8:45a', out: '— on shift' },
      { staff: 'Sam W.', store: 'Lehi', in: '8:30a', out: '4:30p' },
      { staff: 'Priya N.', store: 'Silicon Slopes', in: '9:10a', out: '— on shift' },
    ]),
    cols: [
      { label: 'Staff', render: (r) => r.staff }, { label: 'Store', render: (r) => r.store },
      { label: 'Clock in', render: (r) => r.in }, { label: 'Clock out', render: (r) => r.out },
    ],
  },
  cashdrawer: {
    title: 'Cash Drawer', sub: 'Open sessions and reconciliation', load: () => Promise.resolve([
      { store: 'Layton', by: 'Maya R.', open: 20000, expected: 24800, variance: -300 },
      { store: 'Lehi', by: 'Sam W.', open: 15000, expected: 15000, variance: 0 },
    ]),
    cols: [
      { label: 'Store', render: (r) => r.store }, { label: 'Opened by', render: (r) => r.by },
      { label: 'Opening', render: (r) => money(r.open), right: true },
      { label: 'Expected', render: (r) => money(r.expected), right: true },
      { label: 'Variance', render: (r) => tag(money(r.variance), r.variance === 0 ? 'green' : 'rose'), right: true },
    ],
  },
}

export default function ListScreen({ kind }: { kind: string }) {
  const cfg = CONFIGS[kind]
  const { current } = useApp()
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { cfg?.load().then(setRows) }, [kind])
  if (!cfg) return <div className="empty"><h3>{kind}</h3></div>
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">{current.name}</div><h1>{cfg.title}</h1><div className="sub">{cfg.sub}</div></div></div>
      <div className="panel"><table className="tbl">
        <thead><tr>{cfg.cols.map((c) => <th key={c.label} className={c.right ? 'r' : ''}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{cfg.cols.map((c) => <td key={c.label} className={c.right ? 'r' : ''}>{c.render(row)}</td>)}</tr>)}</tbody>
      </table></div>
    </div>
  )
}
