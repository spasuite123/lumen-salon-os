import { useEffect, useState } from 'react'
import { useApp } from '../lib/AppContext'
import { getAppointments, getClients, getServices, getReport } from '../lib/data'
import { getConversations } from '../lib/data'
import { money, initials } from '../lib/util'
import { REPORTCATS, SETTINGS } from '../lib/config'
import { Icon } from '../components/Icon'
import { StaffSalesReport, TimeClockReport, DaysOffReport, SalesSummaryReport, ServiceSalesReport, ProductSalesReport, SalesByPeriodReport, RefundSummaryReport, RefundDetailsReport, OffersUsageReport, OffersSummaryReport, AccountUsageReport, AccountBalancesReport, AccountDepositsReport, GiftCardUsageReport, GiftCardBalancesReport, GiftCardSalesReport, GiftCardSalesDetailsReport, PackageSalesReport, PackageSalesDetailsReport, PackageUsageReport, OutstandingPackagesReport, MembershipPaymentsReport, MembershipCreditUsageReport, MembershipsStartedReport, MembershipCancellationsReport, PaymentSummaryReport, PaymentDetailsReport, CashDrawerReport, DepositsCollectedReport, DepositsUsedReport, CostOfGoodsReport, ProductInventoryReport, ProductInventoryChangesReport, ProductStockUsageReport, CashflowReport, BISalesReport, BIForecastReport, BIAppointmentsReport, ClientRetentionReport, AppointmentCancellationsReport, AppointmentsExportReport, RevenueByServiceReport } from './ReportViews'

const SPECIAL_REPORTS: Record<string, any> = {
  'Service & Product Sales By Staff': StaffSalesReport,
  'Time Clock': TimeClockReport,
  'Days Off': DaysOffReport,
  'Sales Summary': SalesSummaryReport,
  'Service Sales': ServiceSalesReport,
  'Product Sales': ProductSalesReport,
  'Sales by Time Period': SalesByPeriodReport,
  'Refund Summary': RefundSummaryReport,
  'Refund Details': RefundDetailsReport,
  'Offers Usage': OffersUsageReport,
  'Offers Summary': OffersSummaryReport,
  'Client Account Usage': AccountUsageReport,
  'Client Account Balances': AccountBalancesReport,
  'Client Account Deposits': AccountDepositsReport,
  'Gift Card Usage': GiftCardUsageReport,
  'Gift Card Balances': GiftCardBalancesReport,
  'Gift Card Sales': GiftCardSalesReport,
  'Gift Card Sales Details': GiftCardSalesDetailsReport,
  'Package Usage': PackageUsageReport,
  'Outstanding Packages': OutstandingPackagesReport,
  'Package Sales': PackageSalesReport,
  'Package Sales Details': PackageSalesDetailsReport,
  'Membership Payments': MembershipPaymentsReport,
  'Membership Credit Usage': MembershipCreditUsageReport,
  'Memberships Started': MembershipsStartedReport,
  'Memberships Cancellations': MembershipCancellationsReport,
  'Payment Summary': PaymentSummaryReport,
  'Payment Details': PaymentDetailsReport,
  'Revenue by Service Type': RevenueByServiceReport,
  'Cash Drawer Activity': CashDrawerReport,
  'Deposits Collected': DepositsCollectedReport,
  'Deposits Used': DepositsUsedReport,
  'Cost of Goods': CostOfGoodsReport,
  'Product Inventory': ProductInventoryReport,
  'Product Inventory Changes': ProductInventoryChangesReport,
  'Product Stock & Usage': ProductStockUsageReport,
  'Cashflow': CashflowReport,
  'Business Intelligence: Appointments': BIAppointmentsReport,
  'Business Intelligence: Sales': BISalesReport,
  'Business Intelligence: Forecast': BIForecastReport,
  'Client Retention': ClientRetentionReport,
  'Appointment Cancellations': AppointmentCancellationsReport,
  'Appointments Export': AppointmentsExportReport,
}

/* ---------------- Sales ---------------- */
export function Sales() {
  const { loc } = useApp()
  const [appts, setAppts] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  useEffect(() => { getAppointments().then(setAppts); getClients().then(setClients); getServices().then(setServices) }, [])
  const svc = (id: string) => services.find((s) => s.id === id)
  const client = (id: string) => clients.find((c) => c.id === id)
  const priceOf = (a: any) => { const s = svc(a.svcId); return s ? (s.price[a.locId] ?? Object.values(s.price)[0] ?? 0) : 0 }
  const A = loc === 'all' ? appts : appts.filter((a) => a.locId === loc)
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Sales</div><h1>Sales</h1><div className="sub">Open tickets and completed sales</div></div></div>
      <div className="panel"><table className="tbl">
        <thead><tr><th>Client</th><th>Service</th><th className="r">Amount</th><th className="r">Status</th></tr></thead>
        <tbody>{A.map((a) => { const cl = client(a.clientId), sv0 = svc(a.svcId); if (!cl || !sv0) return null
          return <tr key={a.id}><td><span className="chip" style={{ background: cl.color }}>{initials(cl.name)}</span>{cl.name}</td>
            <td style={{ color: 'var(--muted)' }}>{sv0.name}</td><td className="r" style={{ fontWeight: 600 }}>{money(priceOf(a))}</td>
            <td className="r"><span className={'tag ' + (a.status === 'paid' ? 'green' : 'amber')}>{a.status === 'paid' ? 'Paid' : 'Open'}</span></td></tr> })}
        </tbody></table></div>
    </div>
  )
}

/* ---------------- Reports ---------------- */
export function Reports() {
  const [report, setReport] = useState('Service & Product Sales By Staff')
  const [rows, setRows] = useState<any[]>([])
  const Special = SPECIAL_REPORTS[report]
  useEffect(() => { if (!Special) getReport('rpt_sales_summary').then(setRows) }, [report])
  return (
    <div className="two-pane" style={{ gridTemplateColumns: '300px 1fr' }}>
      <div className="pane-list" style={{ padding: '8px 10px' }}>
        <div style={{ padding: '10px 12px' }}><h1 style={{ fontSize: 19 }}>Reports</h1><div style={{ fontSize: 12, color: 'var(--muted)' }}>40 reports · auto-scoped by role</div></div>
        {REPORTCATS.map(([cat, rs]) => (
          <div key={cat} style={{ marginTop: 8 }}>
            <div className="set-sec-h">{cat}</div>
            {rs.map((r) => <div key={r} className={'set-link' + (report === r ? ' sel' : '')} onClick={() => setReport(r)}>{r}{SPECIAL_REPORTS[r] ? <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--mint-700)' }}>●</span> : null}</div>)}
          </div>
        ))}
      </div>
      <div className="pane-body">
        {Special ? <Special /> : (
          <div className="pad">
            <div className="view-head"><div><div className="eyebrow">Report</div><h1>{report}</h1><div className="sub">Backed by a rpt_* view · respects your store &amp; role access</div></div>
              <div style={{ display: 'flex', gap: 8 }}><button className="btn ghost">Date range</button><button className="btn ghost">Export CSV</button></div></div>
            <div className="panel"><div className="panel-h"><h3>{report}</h3><span className="tag green">live view</span></div>
              <table className="tbl"><thead><tr><th>Store</th><th className="r">Service</th><th className="r">Product</th><th className="r">Gross</th><th className="r">Net</th></tr></thead>
                <tbody>{rows.map((r, i) => <tr key={i}><td>{r.store}</td><td className="r">{money(r.service_cents ?? r.service ?? 0)}</td><td className="r">{money(r.product_cents ?? r.product ?? 0)}</td><td className="r">{money(r.gross_cents ?? r.gross ?? 0)}</td><td className="r" style={{ fontWeight: 600 }}>{money(r.net_cents ?? r.net ?? 0)}</td></tr>)}</tbody>
              </table></div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------------- Inbox ---------------- */
export function Inbox() {
  const [convos, setConvos] = useState<any[]>([])
  const [sel, setSel] = useState(0)
  useEffect(() => { getConversations().then(setConvos) }, [])
  const cv = convos[sel]
  return (
    <div className="two-pane" style={{ gridTemplateColumns: '330px 1fr' }}>
      <div className="pane-list">
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h1 style={{ fontSize: 19 }}>Inbox</h1><span className="tag amber">{convos.filter((c) => c.unread).length} unread</span></div>
        {convos.map((c, i) => (
          <div key={i} className={'list-item' + (sel === i ? ' sel' : '')} onClick={() => setSel(i)}>
            <span className="ava" style={{ background: c.color }}>{initials(c.client)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>{c.client}</span><span style={{ fontSize: 11, color: 'var(--faint)' }}>{c.time}</span></div>
              <div style={{ fontSize: 12.5, color: c.unread ? 'var(--ink)' : 'var(--muted)', fontWeight: c.unread ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.last}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="pane-body" style={{ display: 'flex', flexDirection: 'column' }}>
        {cv && <>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12 }}><span className="ava" style={{ background: cv.color }}>{initials(cv.client)}</span><b style={{ fontSize: 16 }}>{cv.client}</b></div>
          <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--canvas)' }}>
            <div style={{ alignSelf: 'flex-start', maxWidth: '70%', background: 'var(--surface)', border: '1px solid var(--line)', padding: '11px 14px', borderRadius: '14px 14px 14px 4px' }}>{cv.last}</div>
            <div style={{ alignSelf: 'flex-end', maxWidth: '70%', background: 'var(--mint)', color: '#fff', padding: '11px 14px', borderRadius: '14px 14px 4px 14px' }}>Thanks for reaching out — happy to help with that!</div>
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}><input className="field" style={{ margin: 0, flex: 1 }} placeholder="Type a reply…" /><button className="btn">Send</button></div>
        </>}
      </div>
    </div>
  )
}

/* ---------------- Settings ---------------- */
function Toggle({ on = true }: { on?: boolean }) {
  const [v, setV] = useState(on)
  return <div className={'switch' + (v ? ' on' : '')} onClick={() => setV(!v)} />
}
export function Settings() {
  const [page, setPage] = useState('Business Details')
  const [section, setSection] = useState('Business Setup')
  const tog = (t: string, d: string, on = true) => (
    <div className="toggle-row" key={t}><div className="t-l"><b>{t}</b><p>{d}</p></div><Toggle on={on} /></div>
  )
  let body: any
  if (page === 'Business Details') body = <>
    <div className="field"><label>Business name</label><input defaultValue="Lumen Beauty Co." /></div>
    <div className="field"><label>Support email</label><input defaultValue="hello@lumenbeauty.co" /></div>
    <div className="field"><label>Time zone</label><select defaultValue="MST"><option value="MST">America/Denver (MST)</option><option>America/Los_Angeles</option></select></div>
  </>
  else if (page === 'Business Hours') body = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d, i) => (
    <div className="hours-row" key={d}><span className="day">{d}</span><Toggle on={i < 6} /><input defaultValue={i < 6 ? '9:00 AM' : 'Closed'} style={{ width: 120 }} /><span style={{ color: 'var(--muted)' }}>to</span><input defaultValue={i < 6 ? (i === 5 ? '5:00 PM' : '7:00 PM') : '—'} style={{ width: 120 }} /></div>
  ))
  else if (section === 'Automated Messages') body = <>
    {tog('Enabled', 'Send this message automatically', true)}
    <div className="field" style={{ marginTop: 18 }}><label>Channel</label><select><option>Email + SMS</option><option>Email only</option><option>SMS only</option></select></div>
    <div className="field"><label>Message template</label><textarea rows={5} defaultValue={'Hi {client_name}! This confirms your {service} on {date} at {time} at {location}. Reply C to confirm. — Lumen'} /></div>
  </>
  else body = [tog('Setting one', 'A representative toggle for this page'), tog('Setting two', 'Another configurable option', false)]
  return (
    <div className="two-pane" style={{ gridTemplateColumns: '260px 1fr' }}>
      <div className="pane-list" style={{ padding: '14px 10px' }}>
        <div style={{ padding: '6px 12px 12px' }}><h1 style={{ fontSize: 19 }}>Settings</h1></div>
        {SETTINGS.map((sec) => (
          <div key={sec.section} style={{ marginBottom: 6 }}>
            <div className="set-sec-h">{sec.section}</div>
            {sec.pages.map((p) => <div key={p} className={'set-link' + (page === p ? ' sel' : '')} onClick={() => { setPage(p); setSection(sec.section) }}>{p}</div>)}
          </div>
        ))}
      </div>
      <div className="pane-body"><div className="pad">
        <div className="view-head"><div><div className="eyebrow">{section}</div><h1>{page}</h1><div className="sub">Configure {page.toLowerCase()}</div></div><button className="btn">Save changes</button></div>
        {body}
      </div></div>
    </div>
  )
}

/* ---------------- Scaffold (Payroll, Flows, Forms) ---------------- */
export function Scaffold({ id, title, sub }: { id: string; title: string; sub: string }) {
  return (
    <div className="pad">
      <div className="view-head"><div><h1>{title}</h1><div className="sub">{sub}</div></div></div>
      <div className="scaffold-grid">
        {[['Overview', 'Summary for this module'], ['Activity', 'Recent items'], ['Settings', 'Configure behavior'], ['Create new', 'Add an item']].map((c) => (
          <div className="feat-card" key={c[0]}><div className="fi"><Icon name={id} size={21} /></div><div style={{ fontWeight: 600, fontSize: 15 }}>{c[0]}</div><div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{c[1]}</div></div>
        ))}
      </div>
    </div>
  )
}
