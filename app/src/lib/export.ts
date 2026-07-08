import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

/** sheets: [{ name, aoa }] where aoa is an array-of-arrays (rows of cells). */
export function exportExcel(filename: string, sheets: { name: string; aoa: any[][] }[]) {
  const wb = XLSX.utils.book_new()
  sheets.forEach((s) => {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa)
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  })
  XLSX.writeFile(wb, filename + '.xlsx')
}

export type PdfBlock = { heading?: string; columns: string[]; rows: (string | number)[][]; align?: ('left' | 'right')[] }

export function exportPDF(filename: string, opts: { title: string; period?: string; blocks: PdfBlock[] }) {
  const doc = new jsPDF()
  const W = doc.internal.pageSize.getWidth()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  doc.text(opts.title, 14, 16)
  let y = 22
  if (opts.period) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110); doc.text('Period: ' + opts.period, 14, y); doc.setTextColor(0); y += 4 }

  opts.blocks.forEach((b) => {
    if (b.heading) {
      if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 18 }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(b.heading, 14, y + 6); y += 8
    }
    const colStyles: any = {}
    ;(b.align || []).forEach((a, i) => { if (a === 'right') colStyles[i] = { halign: 'right' } })
    autoTable(doc, {
      startY: y + 2,
      head: [b.columns],
      body: b.rows as any,
      headStyles: { fillColor: [35, 43, 69], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: colStyles,
      margin: { left: 14, right: 14 },
    })
    y = (doc as any).lastAutoTable.finalY + 8
  })
  doc.save(filename + '.pdf')
}
