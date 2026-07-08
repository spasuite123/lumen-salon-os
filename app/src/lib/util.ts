export const money = (cents: number) =>
  '$' + (Math.round(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export const initials = (name: string) =>
  name.split(' ').map((w) => w[0]).slice(0, 2).join('')

export const fmtTime = (h: number, m: number) => {
  const ap = h >= 12 ? 'pm' : 'am'
  let hh = h % 12
  if (hh === 0) hh = 12
  return hh + (m ? ':' + String(m).padStart(2, '0') : '') + ap
}
