import { useEffect, useState } from 'react'
import { getStaff, getOffers } from '../lib/data'
import { getStaffSales, getTimeClock, getDaysOff, getSalesBuckets, getServiceSales, getProductSales, getRefundSummary, getRefundDetails, getOffersUsage, getOffersSummary, getAccountUsage, getAccountBalances, getAccountDeposits, getGiftCardUsage, getGiftCardBalances, getGiftCardSales, getGiftCardSalesDetails, getPackageSales, getPackageSalesDetails, getPackageUsage, getOutstandingPackages, getMembershipPayments, getMembershipCreditUsage, getMembershipsStarted, getMembershipCancellations, getPaymentSummary, getPaymentDetails, getCashDrawer, getDepositsCollected, getDepositsUsed, getCostOfGoods, getProductInventory, getInventoryChanges, getProductStockUsage, getProductBrands, getCashflow, getBISales, getBIForecast, getBIAppointments, getClientRetention, getAppointmentCancellations, getAppointmentsExport, getRevenueByServiceType, fmtRange } from '../lib/reportData'
import { exportExcel, exportPDF } from '../lib/export'
import { money } from '../lib/util'

// date helpers
const iso = (d: Date) => d.toISOString().slice(0, 10)
function weekDefault() { const t = new Date(); const f = new Date(); f.setDate(t.getDate() - 6); return { from: iso(f), to: iso(t) } }
function monthDefault() { const t = new Date(); return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(new Date(t.getFullYear(), t.getMonth() + 1, 0)) } }

function useStaffList() {
  const [staff, setStaff] = useState<any[]>([])
  useEffect(() => { getStaff().then(setStaff) }, [])
  return staff
}

function FilterBar({ from, to, setFrom, setTo, staffId, setStaffId, staff, extra, onPDF, onXLS, hideStaff }: any) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 18 }}>
      <div className="field" style={{ margin: 0, maxWidth: 160 }}><label>From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div className="field" style={{ margin: 0, maxWidth: 160 }}><label>To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      {!hideStaff && (
        <div className="field" style={{ margin: 0, maxWidth: 220 }}><label>Staff</label>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="all">All staff</option>
            {staff.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      {extra}
      <div style={{ flex: 1 }} />
      <button className="btn ghost" onClick={onXLS}>⬇ Excel</button>
      <button className="btn ghost" onClick={onPDF}>⬇ PDF</button>
    </div>
  )
}

/* ============ Service & Product Sales by Staff ============ */
export function StaffSalesReport() {
  const staff = useStaffList()
  const d = weekDefault()
  const [from, setFrom] = useState(d.from)
  const [to, setTo] = useState(d.to)
  const [staffId, setStaffId] = useState('all')
  const [data, setData] = useState<any>({ overview: [], details: [] })

  useEffect(() => { getStaffSales(from, to, staffId).then(setData) }, [from, to, staffId])

  const period = fmtRange(from, to)
  const withSales = data.details.filter((x: any) => x.serviceTotal.sales > 0 || staffId !== 'all')

  const onPDF = () => {
    const blocks: any[] = [{
      heading: 'Overview', columns: ['Staff Member', '# Services', 'Service Sales', '# Products', 'Product Sales', 'Total Sales'],
      align: ['left', 'right', 'right', 'right', 'right', 'right'],
      rows: data.overview.map((r: any) => [r.staff, r.nServices, money(r.serviceSales), r.nProducts, money(r.productSales), money(r.total)]),
    }]
    withSales.forEach((det: any) => blocks.push({
      heading: det.staff, columns: ['Service Category / Service', '# Services', 'Sales'], align: ['left', 'right', 'right'],
      rows: [...det.services.map((l: any) => [(l.isCat ? '' : '   ') + l.label, l.count, money(l.sales)]), ['Total', det.serviceTotal.count, money(det.serviceTotal.sales)]],
    }))
    exportPDF('Service_Product_Sales_By_Staff', { title: 'Service & Product Sales by Staff', period, blocks })
  }
  const onXLS = () => {
    const overview = [['Staff Member', '# Services', 'Service Sales', '# Products', 'Product Sales', 'Total Sales'],
      ...data.overview.map((r: any) => [r.staff, r.nServices, r.serviceSales / 100, r.nProducts, r.productSales / 100, r.total / 100])]
    const detail: any[][] = [['Staff', 'Service Category / Service', '# Services', 'Sales']]
    withSales.forEach((det: any) => { det.services.forEach((l: any) => detail.push([det.staff, l.label, l.count, l.sales / 100])); detail.push([det.staff, 'Total', det.serviceTotal.count, det.serviceTotal.sales / 100]) })
    exportExcel('Service_Product_Sales_By_Staff', [{ name: 'Overview', aoa: overview }, { name: 'Detail', aoa: detail }])
  }

  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Staff Report · {period}</div><h1>Service &amp; Product Sales by Staff</h1></div></div>
      <FilterBar {...{ from, to, setFrom, setTo, staffId, setStaffId, staff, onPDF, onXLS }} />
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-h"><h3>Overview</h3></div>
        <table className="tbl">
          <thead><tr><th>Staff Member</th><th className="r"># Services</th><th className="r">Service Sales</th><th className="r"># Products</th><th className="r">Product Sales</th><th className="r">Total Sales</th></tr></thead>
          <tbody>{data.overview.map((r: any, i: number) => (
            <tr key={i}><td>{r.staff}</td><td className="r">{r.nServices}</td><td className="r">{money(r.serviceSales)}</td><td className="r">{r.nProducts}</td><td className="r">{money(r.productSales)}</td><td className="r" style={{ fontWeight: 600 }}>{money(r.total)}</td></tr>
          ))}</tbody>
        </table>
      </div>
      {withSales.map((det: any, i: number) => (
        <div className="panel" key={i} style={{ marginBottom: 14 }}>
          <div className="panel-h"><h3>{det.staff}</h3></div>
          <table className="tbl">
            <thead><tr><th>Service Category / Service</th><th className="r"># Services</th><th className="r">Sales</th></tr></thead>
            <tbody>
              {det.services.map((l: any, j: number) => (
                <tr key={j}><td style={{ paddingLeft: l.isCat ? 18 : 38, fontWeight: l.isCat ? 600 : 400 }}>{l.label}</td><td className="r">{l.count}</td><td className="r">{money(l.sales)}</td></tr>
              ))}
              <tr><td style={{ fontWeight: 700 }}>Total</td><td className="r" style={{ fontWeight: 700 }}>{det.serviceTotal.count}</td><td className="r" style={{ fontWeight: 700 }}>{money(det.serviceTotal.sales)}</td></tr>
            </tbody>
          </table>
        </div>
      ))}
      {!withSales.length && <div style={{ color: 'var(--muted)', padding: 20 }}>No sales in this range. Check out an appointment on the Calendar, then refresh.</div>}
    </div>
  )
}

/* ============ Time Clock ============ */
export function TimeClockReport() {
  const staff = useStaffList()
  const d = weekDefault()
  const [from, setFrom] = useState(d.from)
  const [to, setTo] = useState(d.to)
  const [staffId, setStaffId] = useState('all')
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getTimeClock(from, to, staffId).then(setRows) }, [from, to, staffId])
  const period = fmtRange(from, to)
  const totalHrs = rows.reduce((s, r) => s + r.hours, 0)

  const cols = ['Day', 'Staff', 'Clock-In', 'Clock-Out', 'Paid Hours']
  const body = rows.map((r) => [r.day, r.staff, r.in, r.out, r.hours])
  const onPDF = () => exportPDF('Time_Clock', { title: 'Time Clock', period, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'left', 'left', 'right'] }] })
  const onXLS = () => exportExcel('Time_Clock', [{ name: 'Time Clock', aoa: [['Period:', period], [], cols, ...body] }])

  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Staff Report · {period}</div><h1>Time Clock</h1></div></div>
      <FilterBar {...{ from, to, setFrom, setTo, staffId, setStaffId, staff, onPDF, onXLS }} />
      <div className="panel">
        <div className="panel-h"><h3>Punches</h3><span className="tag green">{totalHrs.toFixed(2)} paid hrs</span></div>
        <table className="tbl">
          <thead><tr><th>Day</th><th>Staff</th><th>Clock-In</th><th>Clock-Out</th><th className="r">Paid Hours</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td>{r.day}</td><td>{r.staff}</td><td>{r.in}</td><td>{r.out}</td><td className="r num">{r.hours.toFixed(2)}</td></tr>)}
            {!rows.length && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No punches in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Days Off ============ */
export function DaysOffReport() {
  const staff = useStaffList()
  const d = monthDefault()
  const [from, setFrom] = useState(d.from)
  const [to, setTo] = useState(d.to)
  const [staffId, setStaffId] = useState('all')
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getDaysOff(from, to, staffId).then(setRows) }, [from, to, staffId])
  const period = fmtRange(from, to)

  const cols = ['Staff Member', 'Day', 'Reason']
  const body = rows.map((r) => [r.staff, r.day, r.reason])
  const onPDF = () => exportPDF('Days_Off_By_Staff', { title: 'Days Off by Staff', period, blocks: [{ columns: cols, rows: body }] })
  const onXLS = () => exportExcel('Days_Off_By_Staff', [{ name: 'Days Off', aoa: [['Period:', period], [], cols, ...body] }])

  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Staff Report · {period}</div><h1>Days Off by Staff</h1></div></div>
      <FilterBar {...{ from, to, setFrom, setTo, staffId, setStaffId, staff, onPDF, onXLS }} />
      <div className="panel">
        <div className="panel-h"><h3>Time off</h3><span className="tag gray">{rows.length} days</span></div>
        <table className="tbl">
          <thead><tr><th>Staff Member</th><th>Day</th><th>Reason</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td>{r.staff}</td><td>{r.day}</td><td>{r.reason}</td></tr>)}
            {!rows.length && <tr><td colSpan={3} style={{ color: 'var(--muted)' }}>No days off in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Sales Summary & Sales by Time Period ============ */
const SUMMARY_COLS = ['# Sales', '# Services', 'Service Sales', 'Service Refunds', '# Products', 'Product Sales', 'Product Refunds', 'Subtotal', 'Taxes', 'Tax Refunds', 'Tips', 'Tip Refunds', 'Gross Total', 'Refunds', 'Adjusted Total']
function summaryCells(r: any) {
  const subtotal = r.serviceSales + r.productSales, gross = subtotal + r.tips, refunds = r.refunds || 0
  return [r.nSales, r.nServices, r.serviceSales, 0, r.nProducts, r.productSales, 0, subtotal, 0, 0, r.tips, 0, gross, refunds, gross - refunds]
}

function SummaryLike({ title, firstCol, defaultBucket, showBucket }: any) {
  const m = monthDefault()
  const [from, setFrom] = useState(showBucket ? m.from : weekDefault().from)
  const [to, setTo] = useState(showBucket ? m.to : weekDefault().to)
  const [bucket, setBucket] = useState(defaultBucket)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getSalesBuckets(from, to, bucket).then(setRows) }, [from, to, bucket])
  const period = fmtRange(from, to)

  const totals = rows.reduce((a, r) => { const c = summaryCells(r); c.forEach((v, i) => (a[i] = (a[i] || 0) + (v as number))); return a }, [] as number[])
  const fmtCell = (v: number, i: number) => (i === 0 || i === 1 || i === 4 ? v : money(v))
  const head = [firstCol, ...SUMMARY_COLS]
  const bodyDisp = rows.map((r) => [r.period, ...summaryCells(r).map(fmtCell)])
  const totalDisp = ['Total', ...totals.map(fmtCell)]

  const onPDF = () => exportPDF(title.replace(/ /g, '_'), { title, period, blocks: [{ columns: head, rows: [...bodyDisp, totalDisp], align: head.map((_, i) => (i === 0 ? 'left' : 'right')) }] })
  const onXLS = () => exportExcel(title.replace(/ /g, '_'), [{ name: title.slice(0, 28), aoa: [['Location(s):', 'Drift Reflexology'], ['Period:', period], [], head, ...rows.map((r) => [r.period, ...summaryCells(r).map((v, i) => (i === 0 || i === 1 || i === 4 ? v : (v as number) / 100))]), ['Total', ...totals.map((v, i) => (i === 0 || i === 1 || i === 4 ? v : v / 100))]] }])

  const extra = showBucket ? (
    <div className="field" style={{ margin: 0, maxWidth: 150 }}><label>Group by</label>
      <select value={bucket} onChange={(e) => setBucket(e.target.value)}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="year">Year</option></select>
    </div>
  ) : null

  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Sales Report · {period}</div><h1>{title}</h1></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} extra={extra} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panel-h"><h3>{title}</h3><span className="tag green">{rows.length} rows</span></div>
        <table className="tbl" style={{ minWidth: 1100 }}>
          <thead><tr>{head.map((c, i) => <th key={c} className={i ? 'r' : ''}>{c}</th>)}</tr></thead>
          <tbody>
            {bodyDisp.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'r num' : ''}>{c}</td>)}</tr>)}
            {rows.length > 0 && <tr style={{ fontWeight: 700 }}>{totalDisp.map((c, j) => <td key={j} className={j ? 'r num' : ''} style={{ fontWeight: 700 }}>{c}</td>)}</tr>}
            {!rows.length && <tr><td colSpan={head.length} style={{ color: 'var(--muted)' }}>No sales in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
export function SalesSummaryReport() { return <SummaryLike title="Sales Summary" firstCol="Date" defaultBucket="day" showBucket={false} /> }
export function SalesByPeriodReport() { return <SummaryLike title="Sales by Time Period" firstCol="Period" defaultBucket="month" showBucket={true} /> }

/* ============ Service Sales ============ */
export function ServiceSalesReport() {
  const d = weekDefault()
  const [from, setFrom] = useState(d.from)
  const [to, setTo] = useState(d.to)
  const [data, setData] = useState<any>({ lines: [], total: { count: 0, sales: 0 } })
  useEffect(() => { getServiceSales(from, to).then(setData) }, [from, to])
  const period = fmtRange(from, to)
  const cols = ['Service Category / Service', '# Services', 'Sales']
  const rows = [...data.lines.map((l: any) => [(l.isCat ? '' : '   ') + l.label, l.count, money(l.sales)]), ['Total', data.total.count, money(data.total.sales)]]
  const onPDF = () => exportPDF('Service_Sales', { title: 'Service Sales', period, blocks: [{ columns: cols, rows, align: ['left', 'right', 'right'] }] })
  const onXLS = () => exportExcel('Service_Sales', [{ name: 'Service Sales', aoa: [['Period:', period], [], cols, ...data.lines.map((l: any) => [l.label, l.count, l.sales / 100]), ['Total', data.total.count, data.total.sales / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Sales Report · {period}</div><h1>Service Sales</h1><div className="sub">Quantities and sales totals of services</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel">
        <div className="panel-h"><h3>Service Sales</h3><span className="tag green">{money(data.total.sales)}</span></div>
        <table className="tbl">
          <thead><tr><th>Service Category / Service</th><th className="r"># Services</th><th className="r">Sales</th></tr></thead>
          <tbody>
            {data.lines.map((l: any, i: number) => <tr key={i}><td style={{ paddingLeft: l.isCat ? 18 : 38, fontWeight: l.isCat ? 600 : 400 }}>{l.label}</td><td className="r">{l.count}</td><td className="r">{money(l.sales)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td className="r" style={{ fontWeight: 700 }}>{data.total.count}</td><td className="r" style={{ fontWeight: 700 }}>{money(data.total.sales)}</td></tr>
            {!data.lines.length && <tr><td colSpan={3} style={{ color: 'var(--muted)' }}>No service sales in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Product Sales ============ */
export function ProductSalesReport() {
  const m = monthDefault()
  const [from, setFrom] = useState(m.from)
  const [to, setTo] = useState(m.to)
  const [sortBy, setSortBy] = useState('sales')
  const [data, setData] = useState<any>({ lines: [], total: { count: 0, sales: 0 } })
  useEffect(() => { getProductSales(from, to, sortBy).then(setData) }, [from, to, sortBy])
  const period = fmtRange(from, to)
  const cols = ['Product Category / Product', '# Products', 'Sales']
  const onPDF = () => exportPDF('Product_Sales', { title: 'Product Sales', period, blocks: [{ columns: cols, rows: [...data.lines.map((l: any) => [(l.isCat ? '' : '   ') + l.label, l.count, money(l.sales)]), ['Total', data.total.count, money(data.total.sales)]], align: ['left', 'right', 'right'] }] })
  const onXLS = () => exportExcel('Product_Sales', [{ name: 'Product Sales', aoa: [['Period:', period], [], cols, ...data.lines.map((l: any) => [l.label, l.count, l.sales / 100]), ['Total', data.total.count, data.total.sales / 100]] }])
  const extra = (
    <div className="field" style={{ margin: 0, maxWidth: 160 }}><label>Sort by</label>
      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="sales">Total Sales</option><option value="qty">Quantity</option><option value="name">Name</option></select>
    </div>
  )
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Sales Report · {period}</div><h1>Product Sales</h1><div className="sub">Quantities and sales totals of products</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} extra={extra} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel">
        <div className="panel-h"><h3>Product Sales</h3><span className="tag green">{money(data.total.sales)}</span></div>
        <table className="tbl">
          <thead><tr><th>Product Category / Product</th><th className="r"># Products</th><th className="r">Sales</th></tr></thead>
          <tbody>
            {data.lines.map((l: any, i: number) => <tr key={i}><td style={{ paddingLeft: l.isCat ? 18 : 38, fontWeight: l.isCat ? 600 : 400 }}>{l.label}</td><td className="r">{l.count}</td><td className="r">{money(l.sales)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td className="r" style={{ fontWeight: 700 }}>{data.total.count}</td><td className="r" style={{ fontWeight: 700 }}>{money(data.total.sales)}</td></tr>
            {!data.lines.length && <tr><td colSpan={3} style={{ color: 'var(--muted)' }}>No product sales in this range. (Your services show under Service Sales.)</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Refund Summary ============ */
export function RefundSummaryReport() {
  const m = weekDefault()
  const [from, setFrom] = useState(m.from)
  const [to, setTo] = useState(m.to)
  const [by, setBy] = useState('refund')
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getRefundSummary(from, to, by).then(setRows) }, [from, to, by])
  const period = fmtRange(from, to)
  const tot = rows.reduce((a, r) => ({ count: a.count + r.count, amount: a.amount + r.amount }), { count: 0, amount: 0 })

  const cols = ['Date', '# Refunds', 'Subtotal', 'Taxes', 'Tips', 'Total']
  const body = [...rows.map((r) => [r.date, r.count, money(r.amount), money(0), money(0), money(r.amount)]), ['Total', tot.count, money(tot.amount), money(0), money(0), money(tot.amount)]]
  const onPDF = () => exportPDF('Refund_Summary', { title: 'Refund Summary', period, blocks: [{ heading: 'Filtered by: ' + (by === 'sale' ? 'Sale Date' : 'Refund Date'), columns: cols, rows: body, align: ['left', 'right', 'right', 'right', 'right', 'right'] }] })
  const onXLS = () => exportExcel('Refund_Summary', [{ name: 'Refund Summary', aoa: [['Period:', period], ['Filtered by:', by === 'sale' ? 'Sale Date' : 'Refund Date'], [], cols, ...rows.map((r) => [r.date, r.count, r.amount / 100, 0, 0, r.amount / 100]), ['Total', tot.count, tot.amount / 100, 0, 0, tot.amount / 100]] }])
  const extra = (
    <div className="field" style={{ margin: 0, maxWidth: 170 }}><label>Filter refunds by</label>
      <select value={by} onChange={(e) => setBy(e.target.value)}><option value="refund">Refund Date</option><option value="sale">Sale Date</option></select>
    </div>
  )
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Refunds · {period}</div><h1>Refund Summary</h1><div className="sub">Daily totals and quantities of all refund types</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} extra={extra} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel">
        <div className="panel-h"><h3>Total Refunds</h3><span className="tag gray">Filtered by: {by === 'sale' ? 'Sale Date' : 'Refund Date'}</span></div>
        <table className="tbl">
          <thead><tr><th>Date</th><th className="r"># Refunds</th><th className="r">Subtotal</th><th className="r">Taxes</th><th className="r">Tips</th><th className="r">Total</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td>{r.date}</td><td className="r">{r.count}</td><td className="r">{money(r.amount)}</td><td className="r">{money(0)}</td><td className="r">{money(0)}</td><td className="r">{money(r.amount)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td className="r" style={{ fontWeight: 700 }}>{tot.count}</td><td className="r" style={{ fontWeight: 700 }}>{money(tot.amount)}</td><td className="r" style={{ fontWeight: 700 }}>{money(0)}</td><td className="r" style={{ fontWeight: 700 }}>{money(0)}</td><td className="r" style={{ fontWeight: 700 }}>{money(tot.amount)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Refund Details ============ */
export function RefundDetailsReport() {
  const m = weekDefault()
  const [from, setFrom] = useState(m.from)
  const [to, setTo] = useState(m.to)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getRefundDetails(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const cols = ['Transaction #', 'Refund #', 'Sale #', 'Transaction Date', 'Client', 'Staff Member', 'Refund Method', 'Payment Account', 'Refund Amount']
  const body = rows.map((r) => [r.tx, r.refundNo, r.saleNo, r.date, r.client, r.staff, r.method, r.account, '-' + money(r.amount)])
  const onPDF = () => exportPDF('Refund_Details', { title: 'Refund Details', period, blocks: [{ heading: 'Payment Refunds', columns: cols, rows: body, align: ['left', 'left', 'left', 'left', 'left', 'left', 'left', 'left', 'right'] }] })
  const onXLS = () => exportExcel('Refund_Details', [{ name: 'Refund Details', aoa: [['Period:', period], [], cols, ...rows.map((r) => [r.tx, r.refundNo, r.saleNo, r.date, r.client, r.staff, r.method, r.account, -r.amount / 100])] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Refunds · {period}</div><h1>Refund Details</h1><div className="sub">Every refund transaction, with amount and method</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panel-h"><h3>Payment Refunds</h3><span className="tag gray">{rows.length}</span></div>
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead><tr>{cols.map((c, i) => <th key={c} className={i === cols.length - 1 ? 'r' : ''}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td>{r.tx}</td><td>{r.refundNo}</td><td>{r.saleNo}</td><td>{r.date}</td><td>{r.client}</td><td>{r.staff}</td><td>{r.method}</td><td>{r.account}</td><td className="r" style={{ color: 'var(--rose)' }}>-{money(r.amount)}</td></tr>)}
            {!rows.length && <tr><td colSpan={9} style={{ color: 'var(--muted)' }}>No refunds in this range. Open a paid appointment on the Calendar and hit Refund to create one.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Offers Usage ============ */
export function OffersUsageReport() {
  const m = weekDefault()
  const [from, setFrom] = useState(m.from)
  const [to, setTo] = useState(m.to)
  const [offerId, setOfferId] = useState('all')
  const [offers, setOffers] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getOffers().then((o) => setOffers(o.filter((x: any) => x.id))) }, [])
  useEffect(() => { getOffersUsage(from, to, offerId).then(setRows) }, [from, to, offerId])
  const period = fmtRange(from, to)
  const tot = rows.reduce((a, r) => ({ before: a.before + r.before, disc: a.disc + r.discount, after: a.after + r.after }), { before: 0, disc: 0, after: 0 })

  const cols = ['Sale #', 'Date', 'Client', 'Offer', 'Sale Total (Before Discount)', 'Applied Discount', 'Sale Total (After Discount)']
  const body = [...rows.map((r) => [r.saleNo, r.date, r.client, r.offer, money(r.before), money(r.discount), money(r.after)]), ['Total', '', '', '', money(tot.before), money(tot.disc), money(tot.after)]]
  const onPDF = () => exportPDF('Offers_Usage', { title: 'Offers Usage', period, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'left', 'left', 'right', 'right', 'right'] }] })
  const onXLS = () => exportExcel('Offers_Usage', [{ name: 'Offers Usage', aoa: [['Period:', period], [], cols, ...rows.map((r) => [r.saleNo, r.date, r.client, r.offer, r.before / 100, r.discount / 100, r.after / 100]), ['Total', '', '', '', tot.before / 100, tot.disc / 100, tot.after / 100]] }])
  const extra = (
    <div className="field" style={{ margin: 0, maxWidth: 220 }}><label>Offer</label>
      <select value={offerId} onChange={(e) => setOfferId(e.target.value)}><option value="all">All offers</option>{offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
    </div>
  )
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Offers · {period}</div><h1>Offers Usage</h1><div className="sub">Details of offer usages</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} extra={extra} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panel-h"><h3>Offer usages</h3><span className="tag green">{money(tot.disc)} discounted</span></div>
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead><tr><th>Sale #</th><th>Date</th><th>Client</th><th>Offer</th><th className="r">Sale Total (Before)</th><th className="r">Applied Discount</th><th className="r">Sale Total (After)</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td>{r.saleNo}</td><td>{r.date}</td><td>{r.client}</td><td>{r.offer}</td><td className="r">{money(r.before)}</td><td className="r">{money(r.discount)}</td><td className="r">{money(r.after)}</td></tr>)}
            {rows.length > 0 && <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td></td><td></td><td></td><td className="r" style={{ fontWeight: 700 }}>{money(tot.before)}</td><td className="r" style={{ fontWeight: 700 }}>{money(tot.disc)}</td><td className="r" style={{ fontWeight: 700 }}>{money(tot.after)}</td></tr>}
            {!rows.length && <tr><td colSpan={7} style={{ color: 'var(--muted)' }}>No offer usage in this range. Apply an offer at checkout on the Calendar to create one.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Offers Summary ============ */
export function OffersSummaryReport() {
  const m = monthDefault()
  const [from, setFrom] = useState(m.from)
  const [to, setTo] = useState(m.to)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getOffersSummary(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const tot = rows.reduce((a, r) => ({ used: a.used + r.used, disc: a.disc + r.discount }), { used: 0, disc: 0 })
  const cols = ['Offer', 'Code', '# used', 'Discounts']
  const body = [...rows.map((r) => [r.offer, r.code, r.used, money(r.discount)]), ['Total', '', tot.used, money(tot.disc)]]
  const onPDF = () => exportPDF('Offers_Summary', { title: 'Offers Summary', period, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'right', 'right'] }] })
  const onXLS = () => exportExcel('Offers_Summary', [{ name: 'Offers Summary', aoa: [['Period:', period], [], cols, ...rows.map((r) => [r.offer, r.code, r.used, r.discount / 100]), ['Total', '', tot.used, tot.disc / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Offers · {period}</div><h1>Offers Summary</h1><div className="sub">Daily summary of the offers being used</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel">
        <div className="panel-h"><h3>Offers</h3><span className="tag green">{money(tot.disc)}</span></div>
        <table className="tbl">
          <thead><tr><th>Offer</th><th>Code</th><th className="r"># used</th><th className="r">Discounts</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td>{r.offer}</td><td>{r.code}</td><td className="r">{r.used}</td><td className="r">{money(r.discount)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td></td><td className="r" style={{ fontWeight: 700 }}>{tot.used}</td><td className="r" style={{ fontWeight: 700 }}>{money(tot.disc)}</td></tr>
            {!rows.length && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No offers used in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Client Account Balance Usage ============ */
export function AccountUsageReport() {
  const m = monthDefault()
  const [from, setFrom] = useState(m.from)
  const [to, setTo] = useState(m.to)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getAccountUsage(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const tot = rows.reduce((s, r) => s + r.amount, 0)
  const cols = ['Date', 'Sale #', 'Client', 'Amount']
  const body = [...rows.map((r) => [r.date, r.saleNo, r.client, money(r.amount)]), ['Total', '', '', money(tot)]]
  const onPDF = () => exportPDF('Client_Account_Balance_Usage', { title: 'Client Account Balance Usage', period, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'left', 'right'] }] })
  const onXLS = () => exportExcel('Client_Account_Balance_Usage', [{ name: 'Usage', aoa: [['Period:', period], [], cols, ...rows.map((r) => [r.date, r.saleNo, r.client, r.amount / 100]), ['Total', '', '', tot / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Client Accounts · {period}</div><h1>Client Account Balance Usage</h1><div className="sub">Details of client account balance usages</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel">
        <div className="panel-h"><h3>Usage</h3><span className="tag green">{money(tot)}</span></div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Sale #</th><th>Client</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td>{r.date}</td><td>{r.saleNo}</td><td>{r.client}</td><td className="r">{money(r.amount)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td></td><td></td><td className="r" style={{ fontWeight: 700 }}>{money(tot)}</td></tr>
            {!rows.length && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No account usage in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Client Account Balances (as of a day) ============ */
export function AccountBalancesReport() {
  const [asOf, setAsOf] = useState(iso(new Date()))
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getAccountBalances(asOf).then(setRows) }, [asOf])
  const asOfLabel = new Date(asOf + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const tot = rows.reduce((s, r) => s + r.amount, 0)
  const cols = ['Client', 'Amount']
  const body = [...rows.map((r) => [r.client, money(r.amount)]), ['Total', money(tot)]]
  const onPDF = () => exportPDF('Client_Account_Balances', { title: 'Client Account Balances', period: 'At end of day: ' + asOfLabel, blocks: [{ columns: cols, rows: body, align: ['left', 'right'] }] })
  const onXLS = () => exportExcel('Client_Account_Balances', [{ name: 'Balances', aoa: [['At end of day:', asOfLabel], [], cols, ...rows.map((r) => [r.client, r.amount / 100]), ['Total', tot / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Client Accounts</div><h1>Client Account Balances</h1><div className="sub">Current account balances</div></div></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 18 }}>
        <div className="field" style={{ margin: 0, maxWidth: 200 }}><label>Show balance at end of day</label><input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
        <div style={{ flex: 1 }} />
        <button className="btn ghost" onClick={onXLS}>⬇ Excel</button>
        <button className="btn ghost" onClick={onPDF}>⬇ PDF</button>
      </div>
      <div className="panel">
        <div className="panel-h"><h3>At End Of Day: {asOfLabel}</h3><span className="tag green">{money(tot)}</span></div>
        <table className="tbl">
          <thead><tr><th>Client</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td>{r.client}</td><td className="r" style={{ color: r.amount < 0 ? 'var(--rose)' : undefined }}>{money(r.amount)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td className="r" style={{ fontWeight: 700 }}>{money(tot)}</td></tr>
            {!rows.length && <tr><td colSpan={2} style={{ color: 'var(--muted)' }}>No account balances as of this date.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Client Account Balance Deposits ============ */
export function AccountDepositsReport() {
  const m = monthDefault()
  const [from, setFrom] = useState(m.from)
  const [to, setTo] = useState(m.to)
  const [data, setData] = useState<any>({ deposits: [], refunds: [] })
  useEffect(() => { getAccountDeposits(from, to).then(setData) }, [from, to])
  const period = fmtRange(from, to)
  const depTot = data.deposits.reduce((s: number, r: any) => s + r.amount, 0)
  const refTot = data.refunds.reduce((s: number, r: any) => s + r.amount, 0)
  const onPDF = () => exportPDF('Client_Account_Balance_Deposits', { title: 'Client Account Balance Deposits', period, blocks: [
    { heading: 'Deposits', columns: ['Date', 'Sale #', 'Client', 'Amount'], align: ['left', 'left', 'left', 'right'], rows: [...data.deposits.map((r: any) => [r.date, r.saleNo, r.client, money(r.amount)]), ['Total', '', '', money(depTot)]] },
    { heading: 'Refunds', columns: ['Date', 'Refund #', 'Client', 'Refund'], align: ['left', 'left', 'left', 'right'], rows: [...data.refunds.map((r: any) => [r.date, r.refundNo, r.client, money(r.amount)]), ['Total', '', '', money(refTot)]] },
  ] })
  const onXLS = () => exportExcel('Client_Account_Balance_Deposits', [
    { name: 'Deposits', aoa: [['Period:', period], [], ['Date', 'Sale #', 'Client', 'Amount'], ...data.deposits.map((r: any) => [r.date, r.saleNo, r.client, r.amount / 100]), ['Total', '', '', depTot / 100]] },
    { name: 'Refunds', aoa: [['Date', 'Refund #', 'Client', 'Refund'], ...data.refunds.map((r: any) => [r.date, r.refundNo, r.client, r.amount / 100]), ['Total', '', '', refTot / 100]] },
  ])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Client Accounts · {period}</div><h1>Client Account Balance Deposits</h1><div className="sub">Details of client account balance deposits</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-h"><h3>Deposits</h3><span className="tag green">{money(depTot)}</span></div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Sale #</th><th>Client</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {data.deposits.map((r: any, i: number) => <tr key={i}><td>{r.date}</td><td>{r.saleNo}</td><td>{r.client}</td><td className="r">{money(r.amount)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td></td><td></td><td className="r" style={{ fontWeight: 700 }}>{money(depTot)}</td></tr>
            {!data.deposits.length && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No deposits in this range.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <div className="panel-h"><h3>Refunds</h3><span className="tag gray">{money(refTot)}</span></div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Refund #</th><th>Client</th><th className="r">Refund</th></tr></thead>
          <tbody>
            {data.refunds.map((r: any, i: number) => <tr key={i}><td>{r.date}</td><td>{r.refundNo}</td><td>{r.client}</td><td className="r">{money(r.amount)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td></td><td></td><td className="r" style={{ fontWeight: 700 }}>{money(refTot)}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Gift Card Usage ============ */
export function GiftCardUsageReport() {
  const m = monthDefault()
  const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getGiftCardUsage(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const tot = rows.reduce((s, r) => s + r.amount, 0)
  const cols = ['Date', 'Sale #', 'Gift Card #', 'Created Date', 'Last Sale Date', 'Amount', 'Service Staff Member(s)']
  const body = rows.map((r) => [r.date, r.saleNo, r.code, r.created, r.lastSale, money(r.amount), r.staff])
  const onPDF = () => exportPDF('Gift_Card_Usage', { title: 'Gift Card Usage', period, blocks: [{ columns: cols, rows: [...body, ['Total', '', '', '', '', money(tot), '']], align: ['left', 'left', 'left', 'left', 'left', 'right', 'left'] }] })
  const onXLS = () => exportExcel('Gift_Card_Usage', [{ name: 'Gift Card Usage', aoa: [['Period:', period], [], cols, ...rows.map((r) => [r.date, r.saleNo, r.code, r.created, r.lastSale, r.amount / 100, r.staff]), ['Total', '', '', '', '', tot / 100, '']] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Gift Cards · {period}</div><h1>Gift Card Usage</h1><div className="sub">Details of gift card usages</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panel-h"><h3>Usage</h3><span className="tag green">{money(tot)}</span></div>
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead><tr><th>Date</th><th>Sale #</th><th>Gift Card #</th><th>Created</th><th>Last Sale</th><th className="r">Amount</th><th>Service Staff</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td>{r.date}</td><td>{r.saleNo}</td><td>{r.code}</td><td>{r.created}</td><td>{r.lastSale}</td><td className="r">{money(r.amount)}</td><td>{r.staff}</td></tr>)}
            {rows.length > 0 && <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td colSpan={4}></td><td className="r" style={{ fontWeight: 700 }}>{money(tot)}</td><td></td></tr>}
            {!rows.length && <tr><td colSpan={7} style={{ color: 'var(--muted)' }}>No gift card usage in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Gift Card Balances ============ */
export function GiftCardBalancesReport() {
  const [asOf, setAsOf] = useState(iso(new Date()))
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getGiftCardBalances(asOf).then(setRows) }, [asOf])
  const asOfLabel = new Date(asOf + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const tot = rows.reduce((s, r) => s + r.amount, 0)
  const cols = ['Gift Card #', 'Purchaser', 'Owner', 'Purchased For', 'Amount']
  const body = [...rows.map((r) => [r.code, r.purchaser, '', '', money(r.amount)]), ['Total', '', '', '', money(tot)]]
  const onPDF = () => exportPDF('Gift_Card_Balances', { title: 'Gift Card Balances', period: 'At end of day: ' + asOfLabel, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'left', 'left', 'right'] }] })
  const onXLS = () => exportExcel('Gift_Card_Balances', [{ name: 'Gift Card Balances', aoa: [['At end of day:', asOfLabel], [], cols, ...rows.map((r) => [r.code, r.purchaser, '', '', r.amount / 100]), ['Total', '', '', '', tot / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Gift Cards</div><h1>Gift Card Balances</h1><div className="sub">Outstanding gift card balances</div></div></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 18 }}>
        <div className="field" style={{ margin: 0, maxWidth: 200 }}><label>Show balance at end of day</label><input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
        <div style={{ flex: 1 }} /><button className="btn ghost" onClick={onXLS}>⬇ Excel</button><button className="btn ghost" onClick={onPDF}>⬇ PDF</button>
      </div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panel-h"><h3>At End Of Day: {asOfLabel}</h3><span className="tag green">{money(tot)}</span></div>
        <table className="tbl" style={{ minWidth: 700 }}>
          <thead><tr><th>Gift Card #</th><th>Purchaser</th><th>Owner</th><th>Purchased For</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td>{r.code}</td><td>{r.purchaser}</td><td></td><td></td><td className="r">{money(r.amount)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td colSpan={3}></td><td className="r" style={{ fontWeight: 700 }}>{money(tot)}</td></tr>
            {!rows.length && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No outstanding balances as of this date.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Gift Card Sales (summary) ============ */
export function GiftCardSalesReport() {
  const m = monthDefault()
  const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [d, setD] = useState<any>({ count: 0, adjustments: 0, sales: 0, refundCount: 0, refunds: 0 })
  useEffect(() => { getGiftCardSales(from, to).then(setD) }, [from, to])
  const period = fmtRange(from, to)
  const onPDF = () => exportPDF('Gift_Card_Sales', { title: 'Gift Card Sales', period, blocks: [
    { heading: 'Gift Cards', columns: ['# Gift Cards', 'Adjustments', 'Sales'], align: ['right', 'right', 'right'], rows: [[d.count, money(d.adjustments), money(d.sales)]] },
    { heading: 'Refunds', columns: ['# Refunds', 'Refunds'], align: ['right', 'right'], rows: [[d.refundCount, money(d.refunds)]] },
  ] })
  const onXLS = () => exportExcel('Gift_Card_Sales', [{ name: 'Gift Card Sales', aoa: [['Period:', period], [], ['# Gift Cards', 'Adjustments', 'Sales'], [d.count, d.adjustments / 100, d.sales / 100], [], ['# Refunds', 'Refunds'], [d.refundCount, d.refunds / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Gift Cards · {period}</div><h1>Gift Card Sales</h1><div className="sub">Quantities and sales totals of gift cards</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-h"><h3>Gift Cards</h3></div>
        <table className="tbl"><thead><tr><th className="r"># Gift Cards</th><th className="r">Adjustments</th><th className="r">Sales</th></tr></thead>
          <tbody><tr><td className="r num">{d.count}</td><td className="r num">{money(d.adjustments)}</td><td className="r num" style={{ fontWeight: 600 }}>{money(d.sales)}</td></tr></tbody></table>
      </div>
      <div className="panel">
        <div className="panel-h"><h3>Refunds</h3></div>
        <table className="tbl"><thead><tr><th className="r"># Refunds</th><th className="r">Refunds</th></tr></thead>
          <tbody><tr><td className="r num">{d.refundCount}</td><td className="r num">{money(d.refunds)}</td></tr></tbody></table>
      </div>
    </div>
  )
}

/* ============ Gift Card Sales Details ============ */
export function GiftCardSalesDetailsReport() {
  const m = monthDefault()
  const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getGiftCardSalesDetails(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const cols = ['Sale #', 'Sale Date', 'Client', 'Gift Card #', 'Promotion', 'Gift Card Value', 'Price', 'Sold By Staff']
  const body = rows.map((r) => [r.saleNo, r.date, r.client, r.code, r.promotion, money(r.value), money(r.price), r.staff])
  const onPDF = () => exportPDF('Gift_Card_Sales_Details', { title: 'Gift Card Sales Details', period, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'left', 'left', 'left', 'right', 'right', 'left'] }] })
  const onXLS = () => exportExcel('Gift_Card_Sales_Details', [{ name: 'Gift Card Sales Details', aoa: [['Period:', period], [], cols, ...rows.map((r) => [r.saleNo, r.date, r.client, r.code, r.promotion, r.value / 100, r.price / 100, r.staff])] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Gift Cards · {period}</div><h1>Gift Card Sales Details</h1><div className="sub">Details for each sale of a gift card</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panel-h"><h3>Gift card sales</h3><span className="tag green">{rows.length}</span></div>
        <table className="tbl" style={{ minWidth: 1000 }}>
          <thead><tr><th>Sale #</th><th>Sale Date</th><th>Client</th><th>Gift Card #</th><th>Promotion</th><th className="r">Value</th><th className="r">Price</th><th>Sold By</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td>{r.saleNo}</td><td>{r.date}</td><td>{r.client}</td><td>{r.code}</td><td>{r.promotion}</td><td className="r">{money(r.value)}</td><td className="r">{money(r.price)}</td><td>{r.staff}</td></tr>)}
            {!rows.length && <tr><td colSpan={8} style={{ color: 'var(--muted)' }}>No gift cards sold in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ============ Package Sales (summary) ============ */
export function PackageSalesReport() {
  const m = monthDefault(); const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [d, setD] = useState<any>({ rows: [], refunds: [] })
  useEffect(() => { getPackageSales(from, to).then(setD) }, [from, to])
  const period = fmtRange(from, to)
  const tc = d.rows.reduce((s: number, r: any) => s + r.count, 0), ts = d.rows.reduce((s: number, r: any) => s + r.sales, 0)
  const onPDF = () => exportPDF('Package_Sales', { title: 'Package Sales', period, blocks: [
    { heading: 'Packages', columns: ['Name', '# Packages', 'Adjustments', 'Sales'], align: ['left', 'right', 'right', 'right'], rows: [...d.rows.map((r: any) => [r.name, r.count, '-', money(r.sales)]), ['Total', tc, '-', money(ts)]] },
    { heading: 'Refunds', columns: ['Name', '# Refunds', 'Refunds'], align: ['left', 'right', 'right'], rows: [['Total', 0, money(0)]] },
  ] })
  const onXLS = () => exportExcel('Package_Sales', [{ name: 'Package Sales', aoa: [['Period:', period], [], ['Name', '# Packages', 'Adjustments', 'Sales'], ...d.rows.map((r: any) => [r.name, r.count, 0, r.sales / 100]), ['Total', tc, 0, ts / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Packages · {period}</div><h1>Package Sales</h1><div className="sub">Quantities and sales totals of packages</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-h"><h3>Packages</h3><span className="tag green">{money(ts)}</span></div>
        <table className="tbl"><thead><tr><th>Name</th><th className="r"># Packages</th><th className="r">Adjustments</th><th className="r">Sales</th></tr></thead>
          <tbody>{d.rows.map((r: any, i: number) => <tr key={i}><td>{r.name}</td><td className="r">{r.count}</td><td className="r">-</td><td className="r">{money(r.sales)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td className="r" style={{ fontWeight: 700 }}>{tc}</td><td className="r">-</td><td className="r" style={{ fontWeight: 700 }}>{money(ts)}</td></tr>
            {!d.rows.length && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No package sales in this range.</td></tr>}</tbody></table>
      </div>
      <div className="panel"><div className="panel-h"><h3>Refunds</h3></div>
        <table className="tbl"><thead><tr><th>Name</th><th className="r"># Refunds</th><th className="r">Refunds</th></tr></thead>
          <tbody><tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td className="r num">0</td><td className="r num">{money(0)}</td></tr></tbody></table>
      </div>
    </div>
  )
}

/* ============ Package Sales Details ============ */
export function PackageSalesDetailsReport() {
  const m = monthDefault(); const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getPackageSalesDetails(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const cols = ['Sale #', 'Sale Date', 'Client', 'Package Name', 'Price', 'Sold By Staff']
  const body = rows.map((r) => [r.saleNo, r.date, r.client, r.packageName, money(r.price), r.staff])
  const onPDF = () => exportPDF('Package_Sales_Details', { title: 'Package Sales Details', period, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'left', 'left', 'right', 'left'] }] })
  const onXLS = () => exportExcel('Package_Sales_Details', [{ name: 'Package Sales Details', aoa: [['Period:', period], [], cols, ...rows.map((r) => [r.saleNo, r.date, r.client, r.packageName, r.price / 100, r.staff])] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Packages · {period}</div><h1>Package Sales Details</h1><div className="sub">Details for each sale of a package</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panel-h"><h3>Package sales</h3><span className="tag green">{rows.length}</span></div>
        <table className="tbl" style={{ minWidth: 800 }}>
          <thead><tr><th>Sale #</th><th>Sale Date</th><th>Client</th><th>Package Name</th><th className="r">Price</th><th>Sold By</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.saleNo}</td><td>{r.date}</td><td>{r.client}</td><td>{r.packageName}</td><td className="r">{money(r.price)}</td><td>{r.staff}</td></tr>)}
            {!rows.length && <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>No packages sold in this range.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Package Usage ============ */
export function PackageUsageReport() {
  const m = weekDefault(); const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [d, setD] = useState<any>({ service: [] })
  useEffect(() => { getPackageUsage(from, to).then(setD) }, [from, to])
  const period = fmtRange(from, to)
  const tot = d.service.reduce((s: number, r: any) => s + r.value, 0)
  const cols = ['Date', 'Sale #', 'Client', 'Package', 'Created Date', 'Service', 'Value']
  const body = [...d.service.map((r: any) => [r.date, r.saleNo, r.client, r.package, r.created, r.service, money(r.value)]), ['Total', '', '', '', '', '', money(tot)]]
  const onPDF = () => exportPDF('Package_Usage', { title: 'Package Usage', period, blocks: [
    { heading: 'Service Usage', columns: cols, align: ['left', 'left', 'left', 'left', 'left', 'left', 'right'], rows: body },
    { heading: 'Service Usage Refunds', columns: ['Refund Date', 'Refund #', 'Client', 'Service', '# Returned Credits', 'Refund Amount'], align: ['left', 'left', 'left', 'left', 'right', 'right'], rows: [['Total', '', '', '', 0, money(0)]] },
    { heading: 'Product Usage Refunds', columns: ['Refund Date', 'Refund #', 'Client', 'Product Usage', '# Returned Credits', 'Value'], align: ['left', 'left', 'left', 'left', 'right', 'right'], rows: [['Total', '', '', '', 0, money(0)]] },
  ] })
  const onXLS = () => exportExcel('Package_Usage', [
    { name: 'Service Usage', aoa: [['Period:', period], [], cols, ...d.service.map((r: any) => [r.date, r.saleNo, r.client, r.package, r.created, r.service, r.value / 100]), ['Total', '', '', '', '', '', tot / 100]] },
    { name: 'Refunds', aoa: [['Service Usage Refunds'], ['Total', 0, 0], [], ['Product Usage Refunds'], ['Total', 0, 0]] },
  ])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Packages · {period}</div><h1>Package Usage</h1><div className="sub">Details of package usages</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto', marginBottom: 16 }}>
        <div className="panel-h"><h3>Service Usage</h3><span className="tag green">{money(tot)}</span></div>
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead><tr><th>Date</th><th>Sale #</th><th>Client</th><th>Package</th><th>Created</th><th>Service</th><th className="r">Value</th></tr></thead>
          <tbody>{d.service.map((r: any, i: number) => <tr key={i}><td>{r.date}</td><td>{r.saleNo}</td><td>{r.client}</td><td>{r.package}</td><td>{r.created}</td><td>{r.service}</td><td className="r">{money(r.value)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td colSpan={5}></td><td className="r" style={{ fontWeight: 700 }}>{money(tot)}</td></tr>
            {!d.service.length && <tr><td colSpan={7} style={{ color: 'var(--muted)' }}>No package usage in this range.</td></tr>}</tbody></table>
      </div>
      <div className="panel"><div className="panel-h"><h3>Usage Refunds</h3><span className="tag gray">$0.00</span></div>
        <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>No returned package credits in this range.</div></div>
    </div>
  )
}

/* ============ Outstanding Packages ============ */
export function OutstandingPackagesReport() {
  const [asOf, setAsOf] = useState(iso(new Date()))
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getOutstandingPackages(asOf).then(setRows) }, [asOf])
  const asOfLabel = new Date(asOf + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const tot = rows.reduce((s, r) => s + r.amount, 0)
  const cols = ['Package', 'Purchase Date', 'Client', 'Email', 'Phone', 'Remaining Services', 'Remaining Products', 'Amount']
  const body = [...rows.map((r) => [r.package, r.purchaseDate, r.client, r.email, r.phone, r.remainingServices, r.remainingProducts, money(r.amount)]), ['', '', '', '', '', '', '', money(tot)]]
  const onPDF = () => exportPDF('Outstanding_Packages', { title: 'Outstanding Packages', period: 'As of ' + asOfLabel, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'left', 'left', 'left', 'right', 'right', 'right'] }] })
  const onXLS = () => exportExcel('Outstanding_Packages', [{ name: 'Outstanding Packages', aoa: [['As of:', asOfLabel], [], cols, ...rows.map((r) => [r.package, r.purchaseDate, r.client, r.email, r.phone, r.remainingServices, r.remainingProducts, r.amount / 100]), ['', '', '', '', '', '', '', tot / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Packages</div><h1>Outstanding Packages</h1><div className="sub">Outstanding package credits</div></div></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 18 }}>
        <div className="field" style={{ margin: 0, maxWidth: 200 }}><label>Show credits at end of day</label><input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
        <div style={{ flex: 1 }} /><button className="btn ghost" onClick={onXLS}>⬇ Excel</button><button className="btn ghost" onClick={onPDF}>⬇ PDF</button>
      </div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panel-h"><h3>As of {asOfLabel}</h3><span className="tag green">{money(tot)}</span></div>
        <table className="tbl" style={{ minWidth: 1000 }}>
          <thead><tr><th>Package</th><th>Purchase Date</th><th>Client</th><th>Email</th><th>Phone</th><th className="r">Remaining Services</th><th className="r">Remaining Products</th><th className="r">Amount</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.package}</td><td>{r.purchaseDate}</td><td>{r.client}</td><td>{r.email}</td><td>{r.phone}</td><td className="r">{r.remainingServices}</td><td className="r">{r.remainingProducts}</td><td className="r">{money(r.amount)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td colSpan={7}></td><td className="r" style={{ fontWeight: 700 }}>{money(tot)}</td></tr>
            {!rows.length && <tr><td colSpan={8} style={{ color: 'var(--muted)' }}>No outstanding packages as of this date.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Membership Payments ============ */
export function MembershipPaymentsReport() {
  const m = weekDefault(); const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [d, setD] = useState<any>({ rows: [] })
  useEffect(() => { getMembershipPayments(from, to).then(setD) }, [from, to])
  const period = fmtRange(from, to)
  const tt = d.rows.reduce((a: any, r: any) => ({ total: a.total + r.total, nnew: a.nnew + r.nnew, sales: a.sales + r.sales }), { total: 0, nnew: 0, sales: 0 })
  const onPDF = () => exportPDF('Membership_Payments', { title: 'Membership Payments', period, blocks: [
    { heading: 'Membership Payments', columns: ['Name', 'Total', 'New', 'Sales'], align: ['left', 'right', 'right', 'right'], rows: [...d.rows.map((r: any) => [r.name, r.total, r.nnew, money(r.sales)]), ['Total', tt.total, tt.nnew, money(tt.sales)]] },
    { heading: 'Refunds', columns: ['Name', '# Refunds', 'Refunds'], align: ['left', 'right', 'right'], rows: [['Total', 0, money(0)]] },
  ] })
  const onXLS = () => exportExcel('Membership_Payments', [{ name: 'Membership Payments', aoa: [['Period:', period], [], ['Name', 'Total Payments', 'New', 'Sales'], ...d.rows.map((r: any) => [r.name, r.total, r.nnew, r.sales / 100]), ['Total', tt.total, tt.nnew, tt.sales / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Memberships · {period}</div><h1>Membership Payments</h1><div className="sub">Payments for new memberships and renewals</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-h"><h3>Membership Payments</h3><span className="tag green">{money(tt.sales)}</span></div>
        <table className="tbl"><thead><tr><th>Name</th><th className="r">Total</th><th className="r">New</th><th className="r">Sales</th></tr></thead>
          <tbody>{d.rows.map((r: any, i: number) => <tr key={i}><td>{r.name}</td><td className="r">{r.total}</td><td className="r">{r.nnew}</td><td className="r">{money(r.sales)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td className="r" style={{ fontWeight: 700 }}>{tt.total}</td><td className="r" style={{ fontWeight: 700 }}>{tt.nnew}</td><td className="r" style={{ fontWeight: 700 }}>{money(tt.sales)}</td></tr>
            {!d.rows.length && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No membership payments in this range.</td></tr>}</tbody></table>
      </div>
      <div className="panel"><div className="panel-h"><h3>Refunds</h3></div>
        <table className="tbl"><thead><tr><th>Name</th><th className="r"># Refunds</th><th className="r">Refunds</th></tr></thead>
          <tbody><tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td className="r num">0</td><td className="r num">{money(0)}</td></tr></tbody></table>
      </div>
    </div>
  )
}

/* ============ Membership Credit Usage ============ */
export function MembershipCreditUsageReport() {
  const m = monthDefault(); const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [d, setD] = useState<any>({ service: [] })
  useEffect(() => { getMembershipCreditUsage(from, to).then(setD) }, [from, to])
  const period = fmtRange(from, to)
  const tot = d.service.reduce((s: number, r: any) => s + r.value, 0)
  const cols = ['Date', 'Sale #', 'Client', 'Membership', 'Service', 'Service Credit', 'Value']
  const onPDF = () => exportPDF('Membership_Credit_Usage', { title: 'Membership Credit Usage', period, blocks: [
    { heading: 'Service Usage', columns: cols, align: ['left', 'left', 'left', 'left', 'left', 'left', 'right'], rows: [...d.service.map((r: any) => [r.date, r.saleNo, r.client, r.membership, r.service, r.serviceCredit, money(r.value)]), ['Total', '', '', '', '', '', money(tot)]] },
    { heading: 'Service Usage Refunds', columns: ['Refund Date', 'Refund #', 'Client', 'Service', '# Returned Credits', 'Refund Amount'], align: ['left', 'left', 'left', 'left', 'right', 'right'], rows: [['Total', '', '', '', 0, money(0)]] },
  ] })
  const onXLS = () => exportExcel('Membership_Credit_Usage', [{ name: 'Service Usage', aoa: [['Period:', period], [], cols, ...d.service.map((r: any) => [r.date, r.saleNo, r.client, r.membership, r.service, r.serviceCredit, r.value / 100]), ['Total', '', '', '', '', '', tot / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Memberships · {period}</div><h1>Membership Credit Usage</h1><div className="sub">Details of membership services used</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto', marginBottom: 16 }}>
        <div className="panel-h"><h3>Service Usage</h3><span className="tag green">{money(tot)}</span></div>
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead><tr><th>Date</th><th>Sale #</th><th>Client</th><th>Membership</th><th>Service</th><th>Service Credit</th><th className="r">Value</th></tr></thead>
          <tbody>{d.service.map((r: any, i: number) => <tr key={i}><td>{r.date}</td><td>{r.saleNo}</td><td>{r.client}</td><td>{r.membership}</td><td>{r.service}</td><td>{r.serviceCredit}</td><td className="r">{money(r.value)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td colSpan={5}></td><td className="r" style={{ fontWeight: 700 }}>{money(tot)}</td></tr>
            {!d.service.length && <tr><td colSpan={7} style={{ color: 'var(--muted)' }}>No membership credit usage in this range.</td></tr>}</tbody></table>
      </div>
      <div className="panel"><div className="panel-h"><h3>Usage Refunds</h3><span className="tag gray">$0.00</span></div>
        <div style={{ padding: 16, color: 'var(--muted)', fontSize: 13 }}>No returned membership credits in this range.</div></div>
    </div>
  )
}

/* ============ Memberships Started ============ */
export function MembershipsStartedReport() {
  const m = monthDefault(); const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getMembershipsStarted(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const cols = ['Start Date', 'Client', 'Phone', 'Email', 'Membership Plan', 'Membership Status', 'Staff Member']
  const body = rows.map((r) => [r.startDate, r.client, r.phone, r.email, r.plan, r.status, r.staff])
  const onPDF = () => exportPDF('Memberships_Started', { title: 'Memberships Started', period, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'left', 'left', 'left', 'left', 'left'] }] })
  const onXLS = () => exportExcel('Memberships_Started', [{ name: 'Memberships Started', aoa: [['Period:', period], [], cols, ...body] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Memberships · {period}</div><h1>Memberships Started</h1><div className="sub">Memberships started within the selected period</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panel-h"><h3>Started</h3><span className="tag green">{rows.length}</span></div>
        <table className="tbl" style={{ minWidth: 1000 }}>
          <thead><tr><th>Start Date</th><th>Client</th><th>Phone</th><th>Email</th><th>Plan</th><th>Status</th><th>Staff</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.startDate}</td><td>{r.client}</td><td>{r.phone}</td><td>{r.email}</td><td>{r.plan}</td><td>{r.status}</td><td>{r.staff}</td></tr>)}
            {!rows.length && <tr><td colSpan={7} style={{ color: 'var(--muted)' }}>No memberships started in this range.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Membership Cancellations ============ */
export function MembershipCancellationsReport() {
  const t = new Date(); const from = new Date(); from.setDate(t.getDate() - 90)
  const [f, setF] = useState(from.toISOString().slice(0, 10)); const [to, setTo] = useState(t.toISOString().slice(0, 10))
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getMembershipCancellations(f, to).then(setRows) }, [f, to])
  const period = fmtRange(f, to)
  const cols = ['Started', 'Client', 'Phone', 'Email', 'Membership Plan', 'Canceled On']
  const body = rows.map((r) => [r.started, r.client, r.phone, r.email, r.plan, r.canceledOn])
  const onPDF = () => exportPDF('Membership_Cancellations', { title: 'Membership Cancellations', period, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'left', 'left', 'left', 'left'] }] })
  const onXLS = () => exportExcel('Membership_Cancellations', [{ name: 'Membership Cancellations', aoa: [['Period:', period], [], cols, ...body] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Memberships · {period}</div><h1>Membership Cancellations</h1><div className="sub">Memberships canceled within the selected period</div></div></div>
      <FilterBar from={f} to={to} setFrom={setF} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panel-h"><h3>Cancellations</h3><span className="tag gray">{rows.length}</span></div>
        <table className="tbl" style={{ minWidth: 900 }}>
          <thead><tr><th>Started</th><th>Client</th><th>Phone</th><th>Email</th><th>Plan</th><th>Canceled On</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.started}</td><td>{r.client}</td><td>{r.phone}</td><td>{r.email}</td><td>{r.plan}</td><td>{r.canceledOn}</td></tr>)}
            {!rows.length && <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>No cancellations in this range.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Payment Summary ============ */
export function PaymentSummaryReport() {
  const m = weekDefault(); const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [d, setD] = useState<any>({ methods: [], other: [] })
  useEffect(() => { getPaymentSummary(from, to).then(setD) }, [from, to])
  const period = fmtRange(from, to)
  const mTot = d.methods.reduce((a: any, r: any) => ({ c: a.c + r.count, a: a.a + r.amount }), { c: 0, a: 0 })
  const oTot = d.other.reduce((a: any, r: any) => ({ c: a.c + r.count, a: a.a + r.amount }), { c: 0, a: 0 })
  const onPDF = () => exportPDF('Payment_Summary', { title: 'Payment Summary', period, blocks: [
    { heading: 'Payments', columns: ['Payment Method', '# Payments', 'Amount'], align: ['left', 'right', 'right'], rows: [...d.methods.map((r: any) => [r.label, r.count, money(r.amount)]), ['Total', mTot.c, money(mTot.a)]] },
    ...(d.other.length ? [{ heading: 'Other', columns: ['', 'Usages', 'Amount'], align: ['left', 'right', 'right'] as any, rows: [...d.other.map((r: any) => [r.label, r.count, money(r.amount)]), ['Total', oTot.c, money(oTot.a)]] }] : []),
  ] })
  const onXLS = () => exportExcel('Payment_Summary', [{ name: 'Payment Summary', aoa: [['Period:', period], [], ['Payment Method', '# Payments', 'Amount'], ...d.methods.map((r: any) => [r.label, r.count, r.amount / 100]), ['Total', mTot.c, mTot.a / 100], [], ['Other', 'Usages', 'Amount'], ...d.other.map((r: any) => [r.label, r.count, r.amount / 100])] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Payments · {period}</div><h1>Payment Summary</h1><div className="sub">Quantities and totals of payments by type</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-h"><h3>Payment Method</h3><span className="tag green">{money(mTot.a)}</span></div>
        <table className="tbl"><thead><tr><th>Payment Method</th><th className="r"># Payments</th><th className="r">Amount</th></tr></thead>
          <tbody>{d.methods.map((r: any, i: number) => <tr key={i}><td>{r.label}</td><td className="r">{r.count}</td><td className="r">{money(r.amount)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td className="r" style={{ fontWeight: 700 }}>{mTot.c}</td><td className="r" style={{ fontWeight: 700 }}>{money(mTot.a)}</td></tr>
            {!d.methods.length && <tr><td colSpan={3} style={{ color: 'var(--muted)' }}>No payments in this range.</td></tr>}</tbody></table>
      </div>
      {d.other.length > 0 && <div className="panel">
        <div className="panel-h"><h3>Other</h3></div>
        <table className="tbl"><thead><tr><th></th><th className="r">Usages</th><th className="r">Amount</th></tr></thead>
          <tbody>{d.other.map((r: any, i: number) => <tr key={i}><td>{r.label}</td><td className="r">{r.count}</td><td className="r">{money(r.amount)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td className="r" style={{ fontWeight: 700 }}>{oTot.c}</td><td className="r" style={{ fontWeight: 700 }}>{money(oTot.a)}</td></tr></tbody></table>
      </div>}
    </div>
  )
}

/* ============ Payment Details ============ */
export function PaymentDetailsReport() {
  const m = weekDefault(); const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getPaymentDetails(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const cols = ['Sale #', 'Payment Date', 'Sale Date', 'Client', 'Staff Member(s)', 'Amount', 'Payment Method', 'Sale Total']
  const body = rows.map((r) => [r.saleNo, r.payDate, r.saleDate, r.client, r.staff, money(r.amount), r.method, money(r.saleTotal)])
  const onPDF = () => exportPDF('Payment_Details', { title: 'Payment Details', period, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'left', 'left', 'left', 'right', 'left', 'right'] }] })
  const onXLS = () => exportExcel('Payment_Details', [{ name: 'Payment Details', aoa: [['Period:', period], [], cols, ...rows.map((r) => [r.saleNo, r.payDate, r.saleDate, r.client, r.staff, r.amount / 100, r.method, r.saleTotal / 100])] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Payments · {period}</div><h1>Payment Details</h1><div className="sub">Payment amount and method for each sale</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panel-h"><h3>Payments</h3><span className="tag green">{rows.length}</span></div>
        <table className="tbl" style={{ minWidth: 1000 }}>
          <thead><tr><th>Sale #</th><th>Payment Date</th><th>Sale Date</th><th>Client</th><th>Staff</th><th className="r">Amount</th><th>Method</th><th className="r">Sale Total</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.saleNo}</td><td>{r.payDate}</td><td>{r.saleDate}</td><td>{r.client}</td><td>{r.staff}</td><td className="r">{money(r.amount)}</td><td>{r.method}</td><td className="r">{money(r.saleTotal)}</td></tr>)}
            {!rows.length && <tr><td colSpan={8} style={{ color: 'var(--muted)' }}>No payments in this range.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Cash Drawer Activity ============ */
export function CashDrawerReport() {
  const m = weekDefault(); const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getCashDrawer(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const tot = rows.reduce((s, r) => s + r.amount, 0)
  const cols = ['Date', 'Type', 'Details', 'Amount']
  const body = rows.map((r) => [r.date, r.type, r.details, money(r.amount)])
  const onPDF = () => exportPDF('Cash_Drawer_Activity', { title: 'Cash Drawer Activity', period, blocks: [{ columns: cols, rows: [...body, ['', '', 'Net', money(tot)]], align: ['left', 'left', 'left', 'right'] }] })
  const onXLS = () => exportExcel('Cash_Drawer_Activity', [{ name: 'Cash Drawer Activity', aoa: [['Period:', period], [], cols, ...rows.map((r) => [r.date, r.type, r.details, r.amount / 100]), ['', '', 'Net', tot / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Payments · {period}</div><h1>Cash Drawer Activity</h1><div className="sub">Cash payments, pay-ins, pay-outs and adjustments</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel">
        <div className="panel-h"><h3>Activity</h3><span className="tag green">{money(tot)} net</span></div>
        <table className="tbl"><thead><tr><th>Date</th><th>Type</th><th>Details</th><th className="r">Amount</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.date}</td><td>{r.type}</td><td>{r.details}</td><td className="r" style={{ color: r.amount < 0 ? 'var(--rose)' : undefined }}>{money(r.amount)}</td></tr>)}
            {!rows.length && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No cash drawer activity in this range.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Deposits Collected / Used ============ */
function DepositsView({ title, sub, firstCol }: any) {
  const m = monthDefault(); const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const period = fmtRange(from, to)
  const cols = [firstCol, 'Sale #', 'Client', 'Deposit Amount']
  const onPDF = () => exportPDF(title.replace(/ /g, '_'), { title, period, blocks: [{ columns: cols, rows: [['Total', '', '', money(0)]], align: ['left', 'left', 'left', 'right'] }] })
  const onXLS = () => exportExcel(title.replace(/ /g, '_'), [{ name: title, aoa: [['Period:', period], [], cols, ['Total', '', '', 0]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Payments · {period}</div><h1>{title}</h1><div className="sub">{sub}</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel">
        <div className="panel-h"><h3>{title}</h3><span className="tag gray">$0.00</span></div>
        <table className="tbl"><thead><tr><th>{firstCol}</th><th>Sale #</th><th>Client</th><th className="r">Deposit Amount</th></tr></thead>
          <tbody><tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td></td><td></td><td className="r" style={{ fontWeight: 700 }}>{money(0)}</td></tr></tbody></table>
        <div style={{ padding: '10px 16px', color: 'var(--muted)', fontSize: 13 }}>Booking deposits appear here once online booking collects a deposit (Integrations → Online booking).</div>
      </div>
    </div>
  )
}
export function DepositsCollectedReport() { return <DepositsView title="Deposits Collected" sub="Deposit payments collected in online booking" firstCol="Payment Date" /> }
export function DepositsUsedReport() { return <DepositsView title="Deposits Used" sub="Used deposit payments, based on sale date when the sale is closed" firstCol="Sale Date" /> }

/* ============ Inventory shared controls ============ */
function GroupBySelect({ value, onChange, withProduct = true }: any) {
  return (
    <div className="field" style={{ margin: 0, maxWidth: 160 }}><label>Group by</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {withProduct && <option value="product">Product</option>}
        <option value="category">Category</option>
        <option value="brand">Brand</option>
      </select>
    </div>
  )
}
function BrandSelect({ value, onChange, brands }: any) {
  return (
    <div className="field" style={{ margin: 0, maxWidth: 180 }}><label>Filter by brand</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}><option value="all">All brands</option>{brands.map((b: string) => <option key={b} value={b}>{b}</option>)}</select>
    </div>
  )
}

/* ============ Cost of Goods ============ */
export function CostOfGoodsReport() {
  const m = monthDefault(); const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [groupBy, setGroupBy] = useState('category')
  const [d, setD] = useState<any>({ rows: [] })
  useEffect(() => { getCostOfGoods(from, to, groupBy).then(setD) }, [from, to, groupBy])
  const period = fmtRange(from, to)
  const label = groupBy === 'category' ? 'Category' : groupBy === 'brand' ? 'Brand' : 'Product'
  const t = d.rows.reduce((a: any, r: any) => ({ u: a.u + r.units, c: a.c + r.cogs, rt: a.rt + r.retail, mg: a.mg + r.margin }), { u: 0, c: 0, rt: 0, mg: 0 })
  const cols = [label, 'Units Sold', 'COGS', 'Retail', 'Margin']
  const body = [...d.rows.map((r: any) => [r.label, r.units, money(r.cogs), money(r.retail), money(r.margin)]), ['Total', t.u, money(t.c), money(t.rt), money(t.mg)]]
  const onPDF = () => exportPDF('Cost_of_Goods', { title: 'Cost of Goods', period, blocks: [{ columns: cols, rows: body, align: ['left', 'right', 'right', 'right', 'right'] }] })
  const onXLS = () => exportExcel('Cost_of_Goods', [{ name: 'Cost of Goods', aoa: [['Period:', period], ['Grouped by:', label], [], cols, ...d.rows.map((r: any) => [r.label, r.units, r.cogs / 100, r.retail / 100, r.margin / 100]), ['Total', t.u, t.c / 100, t.rt / 100, t.mg / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Inventory · {period}</div><h1>Cost of Goods</h1><div className="sub">COGS and margin on products sold</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} extra={<GroupBySelect value={groupBy} onChange={setGroupBy} />} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel"><div className="panel-h"><h3>Cost of Goods</h3><span className="tag green">{money(t.mg)} margin</span></div>
        <table className="tbl"><thead><tr><th>{label}</th><th className="r">Units Sold</th><th className="r">COGS</th><th className="r">Retail</th><th className="r">Margin</th></tr></thead>
          <tbody>{d.rows.map((r: any, i: number) => <tr key={i}><td>{r.label}</td><td className="r">{r.units}</td><td className="r">{money(r.cogs)}</td><td className="r">{money(r.retail)}</td><td className="r">{money(r.margin)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td className="r" style={{ fontWeight: 700 }}>{t.u}</td><td className="r" style={{ fontWeight: 700 }}>{money(t.c)}</td><td className="r" style={{ fontWeight: 700 }}>{money(t.rt)}</td><td className="r" style={{ fontWeight: 700 }}>{money(t.mg)}</td></tr>
            {!d.rows.length && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No product sales in this range.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Product Inventory (as of end of day) ============ */
export function ProductInventoryReport() {
  const [asOf, setAsOf] = useState(iso(new Date()))
  const [groupBy, setGroupBy] = useState('product')
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getProductInventory(asOf, groupBy).then(setRows) }, [asOf, groupBy])
  const asOfLabel = new Date(asOf + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const val = rows.reduce((s, r) => s + r.value, 0)
  const grouped = groupBy !== 'product'
  const label = groupBy === 'category' ? 'Category' : groupBy === 'brand' ? 'Brand' : 'Product'
  const cols = grouped ? [label, 'On Hand', 'Inventory Value'] : ['Product', 'SKU', 'Category', 'Brand', 'On Hand', 'Inventory Value']
  const body = [...rows.map((r) => grouped ? [r.label, r.onHand, money(r.value)] : [r.label, r.sku, r.category, r.brand, r.onHand, money(r.value)]), grouped ? ['Total', '', money(val)] : ['Total', '', '', '', '', money(val)]]
  const onPDF = () => exportPDF('Product_Inventory', { title: 'Product Inventory', period: 'At end of day: ' + asOfLabel, blocks: [{ columns: cols, rows: body, align: grouped ? ['left', 'right', 'right'] : ['left', 'left', 'left', 'left', 'right', 'right'] }] })
  const onXLS = () => exportExcel('Product_Inventory', [{ name: 'Product Inventory', aoa: [['At end of day:', asOfLabel], ['Grouped by:', label], [], cols, ...rows.map((r) => grouped ? [r.label, r.onHand, r.value / 100] : [r.label, r.sku, r.category, r.brand, r.onHand, r.value / 100]), grouped ? ['Total', '', val / 100] : ['Total', '', '', '', '', val / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Inventory</div><h1>Product Inventory</h1><div className="sub">Stock on hand and value at end of day</div></div></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 18 }}>
        <div className="field" style={{ margin: 0, maxWidth: 200 }}><label>Show inventory at end of day</label><input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></div>
        <GroupBySelect value={groupBy} onChange={setGroupBy} />
        <div style={{ flex: 1 }} /><button className="btn ghost" onClick={onXLS}>⬇ Excel</button><button className="btn ghost" onClick={onPDF}>⬇ PDF</button>
      </div>
      <div className="panel" style={{ overflowX: 'auto' }}><div className="panel-h"><h3>At End Of Day: {asOfLabel}</h3><span className="tag green">{money(val)} value</span></div>
        <table className="tbl" style={{ minWidth: grouped ? 500 : 800 }}><thead><tr>{cols.map((c, i) => <th key={c} className={(grouped ? i > 0 : i > 3) ? 'r' : ''}>{c}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => grouped
            ? <tr key={i}><td>{r.label}</td><td className="r">{r.onHand}</td><td className="r">{money(r.value)}</td></tr>
            : <tr key={i}><td>{r.label}</td><td>{r.sku}</td><td>{r.category}</td><td>{r.brand}</td><td className="r">{r.onHand}</td><td className="r">{money(r.value)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}>{grouped ? <><td style={{ fontWeight: 700 }}>Total</td><td></td><td className="r" style={{ fontWeight: 700 }}>{money(val)}</td></> : <><td style={{ fontWeight: 700 }}>Total</td><td colSpan={4}></td><td className="r" style={{ fontWeight: 700 }}>{money(val)}</td></>}</tr>
            {!rows.length && <tr><td colSpan={cols.length} style={{ color: 'var(--muted)' }}>No stock on hand as of this date.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Product Inventory Changes ============ */
export function ProductInventoryChangesReport() {
  const m = monthDefault(); const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [brand, setBrand] = useState('all'); const [brands, setBrands] = useState<string[]>([])
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getProductBrands().then(setBrands) }, [])
  useEffect(() => { getInventoryChanges(from, to, brand).then(setRows) }, [from, to, brand])
  const period = fmtRange(from, to)
  const cols = ['Date', 'Product', 'Type', 'Qty Change', 'Staff']
  const body = rows.map((r) => [r.date, r.product, r.type, (r.qty > 0 ? '+' : '') + r.qty, r.staff])
  const onPDF = () => exportPDF('Product_Inventory_Changes', { title: 'Product Inventory Changes', period, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'left', 'right', 'left'] }] })
  const onXLS = () => exportExcel('Product_Inventory_Changes', [{ name: 'Inventory Changes', aoa: [['Period:', period], ['Brand:', brand === 'all' ? 'All' : brand], [], cols, ...rows.map((r) => [r.date, r.product, r.type, r.qty, r.staff])] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Inventory · {period}</div><h1>Product Inventory Changes</h1><div className="sub">Every stock movement in the period</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} extra={<BrandSelect value={brand} onChange={setBrand} brands={brands} />} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel"><div className="panel-h"><h3>Changes</h3><span className="tag gray">{rows.length}</span></div>
        <table className="tbl"><thead><tr><th>Date</th><th>Product</th><th>Type</th><th className="r">Qty Change</th><th>Staff</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.date}</td><td>{r.product}</td><td>{r.type}</td><td className="r" style={{ color: r.qty < 0 ? 'var(--rose)' : 'var(--mint-700)' }}>{r.qty > 0 ? '+' : ''}{r.qty}</td><td>{r.staff}</td></tr>)}
            {!rows.length && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No inventory changes in this range.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Product Stock & Usage ============ */
export function ProductStockUsageReport() {
  const m = monthDefault(); const [from, setFrom] = useState(m.from); const [to, setTo] = useState(m.to)
  const [groupBy, setGroupBy] = useState('product'); const [brand, setBrand] = useState('all'); const [brands, setBrands] = useState<string[]>([])
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getProductBrands().then(setBrands) }, [])
  useEffect(() => { getProductStockUsage(from, to, groupBy, brand).then(setRows) }, [from, to, groupBy, brand])
  const period = fmtRange(from, to)
  const grouped = groupBy !== 'product'
  const label = groupBy === 'category' ? 'Category' : groupBy === 'brand' ? 'Brand' : 'Product'
  const cols = grouped ? [label, 'On Hand', 'Received', 'Sold', 'Adjusted'] : ['Product', 'SKU', 'On Hand', 'Received', 'Sold', 'Adjusted']
  const body = rows.map((r) => grouped ? [r.product, r.onHand, r.received, r.sold, r.adjusted] : [r.product, r.sku, r.onHand, r.received, r.sold, r.adjusted])
  const onPDF = () => exportPDF('Product_Stock_and_Usage', { title: 'Product Stock & Usage', period, blocks: [{ columns: cols, rows: body, align: grouped ? ['left', 'right', 'right', 'right', 'right'] : ['left', 'left', 'right', 'right', 'right', 'right'] }] })
  const onXLS = () => exportExcel('Product_Stock_and_Usage', [{ name: 'Stock & Usage', aoa: [['Period:', period], ['Grouped by:', label], ['Brand:', brand === 'all' ? 'All' : brand], [], cols, ...body] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Inventory · {period}</div><h1>Product Stock &amp; Usage</h1><div className="sub">On hand plus received / sold / adjusted in the period</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} extra={<><GroupBySelect value={groupBy} onChange={setGroupBy} /><BrandSelect value={brand} onChange={setBrand} brands={brands} /></>} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}><div className="panel-h"><h3>Stock &amp; usage</h3><span className="tag gray">{rows.length}</span></div>
        <table className="tbl" style={{ minWidth: 760 }}><thead><tr>{cols.map((c, i) => <th key={c} className={(grouped ? i > 0 : i > 1) ? 'r' : ''}>{c}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => grouped
            ? <tr key={i}><td>{r.product}</td><td className="r">{r.onHand}</td><td className="r">{r.received}</td><td className="r">{r.sold}</td><td className="r">{r.adjusted}</td></tr>
            : <tr key={i}><td>{r.product}</td><td>{r.sku}</td><td className="r">{r.onHand}</td><td className="r">{r.received}</td><td className="r">{r.sold}</td><td className="r">{r.adjusted}</td></tr>)}
            {!rows.length && <tr><td colSpan={cols.length} style={{ color: 'var(--muted)' }}>No products match this filter.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}
/* ============ Business: Cashflow ============ */
const pct = (n: number, d: number) => d ? (n / d * 100).toFixed(2) : '-'
export function CashflowReport() {
  const d = weekDefault(); const [from, setFrom] = useState(d.from); const [to, setTo] = useState(d.to)
  const [data, setData] = useState<any>({ rows: [] })
  useEffect(() => { getCashflow(from, to).then(setData) }, [from, to])
  const period = fmtRange(from, to)
  const t = data.rows.reduce((a: any, r: any) => ({ g: a.g + r.gross, rf: a.rf + r.refunds, n: a.n + r.net }), { g: 0, rf: 0, n: 0 })
  const cols = ['Date', 'Gross', 'Refunds', 'Net']
  const body = [...data.rows.map((r: any) => [r.date, money(r.gross), money(r.refunds), money(r.net)]), ['Total', money(t.g), money(t.rf), money(t.n)]]
  const onPDF = () => exportPDF('Cashflow', { title: 'Cashflow', period, blocks: [{ columns: cols, rows: body, align: ['left', 'right', 'right', 'right'] }] })
  const onXLS = () => exportExcel('Cashflow', [{ name: 'Cashflow', aoa: [['Period:', period], [], cols, ...data.rows.map((r: any) => [r.date, r.gross / 100, r.refunds / 100, r.net / 100]), ['Total', t.g / 100, t.rf / 100, t.n / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Business · {period}</div><h1>Cashflow</h1><div className="sub">Gross and net cash-equivalent payments (excludes gift cards, packages, account credit)</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel"><div className="panel-h"><h3>Cashflow</h3><span className="tag green">{money(t.n)} net</span></div>
        <table className="tbl"><thead><tr><th>Date</th><th className="r">Gross</th><th className="r">Refunds</th><th className="r">Net</th></tr></thead>
          <tbody>{data.rows.map((r: any, i: number) => <tr key={i}><td>{r.date}</td><td className="r">{money(r.gross)}</td><td className="r">{money(r.refunds)}</td><td className="r">{money(r.net)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td className="r" style={{ fontWeight: 700 }}>{money(t.g)}</td><td className="r" style={{ fontWeight: 700 }}>{money(t.rf)}</td><td className="r" style={{ fontWeight: 700 }}>{money(t.n)}</td></tr>
            {!data.rows.length && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No cash-equivalent payments in this range.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Business Intelligence: Sales ============ */
export function BISalesReport() {
  const d = weekDefault(); const [from, setFrom] = useState(d.from); const [to, setTo] = useState(d.to)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getBISales(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const cols = ['Staff', '# Sales', 'Avg Product Total Per Sale', 'Avg Service Total Per Sale', 'Avg # of Products Per Sale']
  const body = rows.map((r) => [r.staff, r.nSales, money(r.avgProduct), money(r.avgService), r.avgProducts.toFixed(2)])
  const onPDF = () => exportPDF('BI_Sales', { title: 'Business Intelligence: Sales', period, blocks: [{ columns: cols, rows: body, align: ['left', 'right', 'right', 'right', 'right'] }] })
  const onXLS = () => exportExcel('BI_Sales', [{ name: 'BI Sales', aoa: [['Period:', period], [], cols, ...rows.map((r) => [r.staff, r.nSales, r.avgProduct / 100, r.avgService / 100, r.avgProducts])] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Business · {period}</div><h1>Business Intelligence: Sales</h1><div className="sub">Average retail and service totals per sale by staff</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}><div className="panel-h"><h3>By staff</h3></div>
        <table className="tbl" style={{ minWidth: 800 }}><thead><tr><th>Staff</th><th className="r"># Sales</th><th className="r">Avg Product / Sale</th><th className="r">Avg Service / Sale</th><th className="r">Avg # Products / Sale</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.staff}</td><td className="r">{r.nSales}</td><td className="r">{money(r.avgProduct)}</td><td className="r">{money(r.avgService)}</td><td className="r">{r.avgProducts.toFixed(2)}</td></tr>)}
            {!rows.length && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No sales in this range.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Business Intelligence: Forecast ============ */
export function BIForecastReport() {
  const t = new Date(); const fwd = new Date(); fwd.setDate(t.getDate() + 30)
  const [from, setFrom] = useState(iso(t)); const [to, setTo] = useState(iso(fwd))
  const [d, setD] = useState<any>({ rows: [] })
  useEffect(() => { getBIForecast(from, to).then(setD) }, [from, to])
  const period = fmtRange(from, to)
  const tt = d.rows.reduce((a: any, r: any) => ({ ap: a.ap + r.appts, h: a.h + r.hours, p: a.p + r.projected }), { ap: 0, h: 0, p: 0 })
  const cols = ['Date', 'Appointments', 'Hours Booked', 'Projected Amount']
  const body = [...d.rows.map((r: any) => [r.date, r.appts, r.hours.toFixed(2), money(r.projected)]), ['Total', tt.ap, tt.h.toFixed(2), money(tt.p)]]
  const onPDF = () => exportPDF('BI_Forecast', { title: 'Business Intelligence: Forecast', period, blocks: [{ columns: cols, rows: body, align: ['left', 'right', 'right', 'right'] }] })
  const onXLS = () => exportExcel('BI_Forecast', [{ name: 'BI Forecast', aoa: [['Period:', period], [], cols, ...d.rows.map((r: any) => [r.date, r.appts, r.hours, r.projected / 100]), ['Total', tt.ap, tt.h, tt.p / 100]] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Business · {period}</div><h1>Business Intelligence: Forecast</h1><div className="sub">Future appointments booked and projected revenue</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel"><div className="panel-h"><h3>Forecast</h3><span className="tag green">{money(tt.p)}</span></div>
        <table className="tbl"><thead><tr><th>Date</th><th className="r">Appointments</th><th className="r">Hours Booked</th><th className="r">Projected Amount</th></tr></thead>
          <tbody>{d.rows.map((r: any, i: number) => <tr key={i}><td>{r.date}</td><td className="r">{r.appts}</td><td className="r">{r.hours.toFixed(2)}</td><td className="r">{money(r.projected)}</td></tr>)}
            <tr style={{ fontWeight: 700 }}><td style={{ fontWeight: 700 }}>Total</td><td className="r" style={{ fontWeight: 700 }}>{tt.ap}</td><td className="r" style={{ fontWeight: 700 }}>{tt.h.toFixed(2)}</td><td className="r" style={{ fontWeight: 700 }}>{money(tt.p)}</td></tr>
            {!d.rows.length && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>No upcoming appointments in this range.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Business Intelligence: Appointments ============ */
export function BIAppointmentsReport() {
  const t = new Date(); const back = new Date(); back.setDate(t.getDate() - 13)
  const [from, setFrom] = useState(iso(back)); const [to, setTo] = useState(iso(t))
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getBIAppointments(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const cols = ['Staff', 'Avail Hrs', 'Booked Hrs', 'Booked %', 'Total Appts', 'Walk-ins', 'Walk-in %', 'Prebookings', 'Prebook %', 'New Clients']
  const body = rows.map((r) => [r.staff, '-', r.booked.toFixed(2), '-', r.total, r.walkins, pct(r.walkins, r.total), r.prebook, pct(r.prebook, r.total), r.newTotal])
  const onPDF = () => exportPDF('BI_Appointments', { title: 'Business Intelligence: Appointments', period, blocks: [{ columns: cols, rows: body, align: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'] }] })
  const onXLS = () => exportExcel('BI_Appointments', [{ name: 'BI Appointments', aoa: [['Period:', period], [], cols, ...rows.map((r) => [r.staff, '', r.booked, '', r.total, r.walkins, pct(r.walkins, r.total), r.prebook, pct(r.prebook, r.total), r.newTotal])] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Business · {period}</div><h1>Business Intelligence: Appointments</h1><div className="sub">Productivity, pre-bookings and walk-ins by staff</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}><div className="panel-h"><h3>By staff</h3></div>
        <table className="tbl" style={{ minWidth: 1000 }}>
          <thead><tr><th>Staff</th><th className="r">Avail</th><th className="r">Booked Hrs</th><th className="r">Booked %</th><th className="r">Total Appts</th><th className="r">Walk-ins</th><th className="r">Walk-in %</th><th className="r">Prebookings</th><th className="r">Prebook %</th><th className="r">New Clients</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.staff}</td><td className="r">-</td><td className="r">{r.booked.toFixed(2)}</td><td className="r">-</td><td className="r">{r.total}</td><td className="r">{r.walkins}</td><td className="r">{pct(r.walkins, r.total)}</td><td className="r">{r.prebook}</td><td className="r">{pct(r.prebook, r.total)}</td><td className="r">{r.newTotal}</td></tr>)}
            {!rows.length && <tr><td colSpan={10} style={{ color: 'var(--muted)' }}>No appointments in this range.</td></tr>}</tbody></table>
        <div style={{ padding: '8px 16px', color: 'var(--muted)', fontSize: 12 }}>Available hours and staff-requested counts require staff scheduling (not yet enabled), so those columns show "-".</div>
      </div>
    </div>
  )
}

/* ============ Client Retention ============ */
export function ClientRetentionReport() {
  const mo = monthDefault(); const [from, setFrom] = useState(mo.from); const [to, setTo] = useState(mo.to)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getClientRetention(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const cell = (b: any) => [b.total, b.r30, pct(b.r30, b.total), b.r60, pct(b.r60, b.total), b.r90, pct(b.r90, b.total), b.r180, pct(b.r180, b.total)]
  const cols = ['Staff', 'Exist Total', 'E R30 #', 'E R30 %', 'E R90 #', 'E R90 %', 'New Total', 'N R30 #', 'N R30 %', 'N R90 #', 'N R90 %']
  const body = rows.filter((r) => r.ex.total || r.nw.total).map((r) => [r.staff, r.ex.total, r.ex.r30, pct(r.ex.r30, r.ex.total), r.ex.r90, pct(r.ex.r90, r.ex.total), r.nw.total, r.nw.r30, pct(r.nw.r30, r.nw.total), r.nw.r90, pct(r.nw.r90, r.nw.total)])
  const onPDF = () => exportPDF('Client_Retention', { title: 'Client Retention', period, blocks: [{ columns: cols, rows: body, align: cols.map((_, i) => i ? 'right' : 'left') as any }] })
  const onXLS = () => exportExcel('Client_Retention', [{ name: 'Client Retention', aoa: [['Period:', period], [], ['Staff', 'Existing Total', 'Ret 30 #', 'Ret 30 %', 'Ret 60 #', 'Ret 60 %', 'Ret 90 #', 'Ret 90 %', 'Ret 180 #', 'Ret 180 %', 'New Total', 'N Ret 30 #', 'N Ret 30 %', 'N Ret 60 #', 'N Ret 60 %', 'N Ret 90 #', 'N Ret 90 %', 'N Ret 180 #', 'N Ret 180 %'], ...rows.map((r) => [r.staff, ...cell(r.ex), ...cell(r.nw)])] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Business · {period}</div><h1>Client Retention</h1><div className="sub">How many clients from the period returned within 30 / 60 / 90 / 180 days</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}><div className="panel-h"><h3>Existing &amp; new clients</h3></div>
        <table className="tbl" style={{ minWidth: 1100 }}>
          <thead>
            <tr><th></th><th className="r" colSpan={5} style={{ textAlign: 'center' }}>Existing Clients</th><th className="r" colSpan={5} style={{ textAlign: 'center' }}>New Clients</th></tr>
            <tr><th>Staff</th><th className="r">Total</th><th className="r">R30 #</th><th className="r">R30 %</th><th className="r">R90 #</th><th className="r">R90 %</th><th className="r">Total</th><th className="r">R30 #</th><th className="r">R30 %</th><th className="r">R90 #</th><th className="r">R90 %</th></tr>
          </thead>
          <tbody>{rows.filter((r) => r.ex.total || r.nw.total).map((r, i) => <tr key={i}><td>{r.staff}</td><td className="r">{r.ex.total}</td><td className="r">{r.ex.r30}</td><td className="r">{pct(r.ex.r30, r.ex.total)}</td><td className="r">{r.ex.r90}</td><td className="r">{pct(r.ex.r90, r.ex.total)}</td><td className="r">{r.nw.total}</td><td className="r">{r.nw.r30}</td><td className="r">{pct(r.nw.r30, r.nw.total)}</td><td className="r">{r.nw.r90}</td><td className="r">{pct(r.nw.r90, r.nw.total)}</td></tr>)}
            {!rows.some((r) => r.ex.total || r.nw.total) && <tr><td colSpan={11} style={{ color: 'var(--muted)' }}>No client visits in this period.</td></tr>}</tbody></table>
        <div style={{ padding: '8px 16px', color: 'var(--muted)', fontSize: 12 }}>Full 30/60/90/180 columns are in the Excel/PDF export; the on-screen table shows 30 &amp; 90 for readability.</div>
      </div>
    </div>
  )
}

/* ============ Appointment Cancellations ============ */
export function AppointmentCancellationsReport() {
  const t = new Date(); const back = new Date(); back.setDate(t.getDate() - 30)
  const [from, setFrom] = useState(iso(back)); const [to, setTo] = useState(iso(t))
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getAppointmentCancellations(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const cols = ['Date', 'Client', 'Phone', 'Service', 'Provider', 'Status']
  const body = rows.map((r) => [r.date, r.client, r.phone, r.service, r.staff, r.status])
  const onPDF = () => exportPDF('Appointment_Cancellations', { title: 'Appointment Cancellations', period, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'left', 'left', 'left', 'left'] }] })
  const onXLS = () => exportExcel('Appointment_Cancellations', [{ name: 'Cancellations', aoa: [['Period:', period], [], cols, ...body] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Business · {period}</div><h1>Appointment Cancellations</h1><div className="sub">Client and appointment details for canceled appointments</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}><div className="panel-h"><h3>Cancellations</h3><span className="tag gray">{rows.length}</span></div>
        <table className="tbl" style={{ minWidth: 800 }}><thead><tr><th>Date</th><th>Client</th><th>Phone</th><th>Service</th><th>Provider</th><th>Status</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.date}</td><td>{r.client}</td><td>{r.phone}</td><td>{r.service}</td><td>{r.staff}</td><td>{r.status}</td></tr>)}
            {!rows.length && <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>No cancellations in this range.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Appointments Export ============ */
export function AppointmentsExportReport() {
  const mo = monthDefault(); const [from, setFrom] = useState(mo.from); const [to, setTo] = useState(mo.to)
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => { getAppointmentsExport(from, to).then(setRows) }, [from, to])
  const period = fmtRange(from, to)
  const cols = ['Date', 'Client Name', 'Service(s)', 'Service Provider(s)', 'Status', 'Sale Total']
  const body = rows.map((r) => [r.date, r.client, r.service, r.provider, r.status, money(r.saleTotal)])
  const onPDF = () => exportPDF('Appointments_Export', { title: 'Appointments Export', period, blocks: [{ columns: cols, rows: body, align: ['left', 'left', 'left', 'left', 'left', 'right'] }] })
  const onXLS = () => exportExcel('Appointments_Export', [{ name: 'Appointments', aoa: [['Period:', period], [], cols, ...rows.map((r) => [r.date, r.client, r.service, r.provider, r.status, r.saleTotal / 100])] }])
  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Business · {period}</div><h1>Appointments Export</h1><div className="sub">Detailed list of all non-canceled appointments</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto' }}><div className="panel-h"><h3>Appointments</h3><span className="tag green">{rows.length}</span></div>
        <table className="tbl" style={{ minWidth: 900 }}><thead><tr><th>Date</th><th>Client</th><th>Service(s)</th><th>Provider(s)</th><th>Status</th><th className="r">Sale Total</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td>{r.date}</td><td>{r.client}</td><td>{r.service}</td><td>{r.provider}</td><td>{r.status}</td><td className="r">{money(r.saleTotal)}</td></tr>)}
            {!rows.length && <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>No appointments in this range.</td></tr>}</tbody></table>
      </div>
    </div>
  )
}

/* ============ Revenue by Service Type (payout coding) ============ */
export function RevenueByServiceReport() {
  const d = weekDefault(); const [from, setFrom] = useState(d.from); const [to, setTo] = useState(d.to)
  const [data, setData] = useState<any>({ days: [], serviceCols: [], detail: [] })
  useEffect(() => { getRevenueByServiceType(from, to).then(setData) }, [from, to])
  const period = fmtRange(from, to)
  const cols = ['Date', ...data.serviceCols, 'Tips', 'Daily Total', 'Card (→ payout)', 'Cash', 'Other Tender']
  const colTotals: Record<string, number> = {}
  let tipT = 0, grandT = 0, cardT = 0, cashT = 0, otherT = 0
  data.days.forEach((r: any) => {
    data.serviceCols.forEach((c: string) => (colTotals[c] = (colTotals[c] || 0) + (r.cols[c] || 0)))
    tipT += r.tips; grandT += r.total
    cardT += r.settle?.card || 0; cashT += r.settle?.cash || 0; otherT += r.settle?.other || 0
  })
  const bodyRows = data.days.map((r: any) => [r.label, ...data.serviceCols.map((c: string) => money(r.cols[c] || 0)), money(r.tips), money(r.total), money(r.settle?.card || 0), money(r.settle?.cash || 0), money(r.settle?.other || 0)])
  const totalRow = ['Total', ...data.serviceCols.map((c: string) => money(colTotals[c] || 0)), money(tipT), money(grandT), money(cardT), money(cashT), money(otherT)]
  const detailCols = ['Date', 'Sale #', 'Client', 'Service Type', 'Amount']
  const detailRows = data.detail.map((r: any) => [r.date, r.saleNo, r.client, r.service, money(r.amount)])

  const onPDF = () => exportPDF('Revenue_by_Service_Type', { title: 'Revenue by Service Type', period, blocks: [
    { heading: 'Daily revenue by service type (ties to daily payout)', columns: cols, rows: [...bodyRows, totalRow], align: cols.map((_, i) => (i ? 'right' : 'left')) as any },
    { heading: 'Line-item detail', columns: detailCols, rows: detailRows, align: ['left', 'left', 'left', 'left', 'right'] },
  ] })
  const onXLS = () => exportExcel('Revenue_by_Service_Type', [
    { name: 'By Day', aoa: [['Period:', period], ['Card (→ payout) = card/reader collections that day; ties to the day payout (gross of fees until Stripe is live)'], [], cols, ...data.days.map((r: any) => [r.label, ...data.serviceCols.map((c: string) => (r.cols[c] || 0) / 100), r.tips / 100, r.total / 100, (r.settle?.card || 0) / 100, (r.settle?.cash || 0) / 100, (r.settle?.other || 0) / 100]), ['Total', ...data.serviceCols.map((c: string) => (colTotals[c] || 0) / 100), tipT / 100, grandT / 100, cardT / 100, cashT / 100, otherT / 100]] },
    { name: 'Detail', aoa: [detailCols, ...data.detail.map((r: any) => [r.date, r.saleNo, r.client, r.service, r.amount / 100])] },
  ])

  return (
    <div className="pad">
      <div className="view-head"><div><div className="eyebrow">Payments · {period}</div><h1>Revenue by Service Type</h1><div className="sub">Each day's revenue coded by service line — daily total ties to that day's payout. Excel has both the pivot and the line-item detail.</div></div></div>
      <FilterBar from={from} to={to} setFrom={setFrom} setTo={setTo} staffId="all" setStaffId={() => {}} staff={[]} onPDF={onPDF} onXLS={onXLS} hideStaff />
      <div className="panel" style={{ overflowX: 'auto', marginBottom: 16 }}>
        <div className="panel-h"><h3>Daily revenue by service type</h3><span className="tag green">{money(grandT)}</span></div>
        <table className="tbl" style={{ minWidth: 200 + 130 * cols.length }}>
          <thead><tr>{cols.map((c, i) => <th key={c} className={i ? 'r' : ''}>{c}</th>)}</tr></thead>
          <tbody>
            {bodyRows.map((r: any[], i: number) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'r num' : ''}>{c}</td>)}</tr>)}
            {data.days.length > 0 && <tr style={{ fontWeight: 700 }}>{totalRow.map((c, j) => <td key={j} className={j ? 'r num' : ''} style={{ fontWeight: 700 }}>{c}</td>)}</tr>}
            {!data.days.length && <tr><td colSpan={cols.length} style={{ color: 'var(--muted)' }}>No sales in this range.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="panel" style={{ overflowX: 'auto' }}>
        <div className="panel-h"><h3>Line-item detail</h3><span className="tag gray">{data.detail.length} lines</span></div>
        <table className="tbl" style={{ minWidth: 700 }}>
          <thead><tr><th>Date</th><th>Sale #</th><th>Client</th><th>Service Type</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {data.detail.map((r: any, i: number) => <tr key={i}><td>{r.date}</td><td>{r.saleNo}</td><td>{r.client}</td><td>{r.service}</td><td className="r">{money(r.amount)}</td></tr>)}
            {!data.detail.length && <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>No line items in this range.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
