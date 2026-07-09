import {
  Calendar, Users, Receipt, Mail, BarChart3, ShoppingBag, Gift, Layers,
  Award, Wallet, Clock, Banknote, ClipboardList, Percent, Send, Workflow,
  Settings, UserCircle, ListChecks, LayoutGrid, LayoutDashboard,
  Search, Bell, Grid3x3, ChevronDown, Plug, CalendarRange,
} from 'lucide-react'

const MAP: Record<string, any> = {
  calendar: Calendar, clients: Users, sales: Receipt, inbox: Mail, reports: BarChart3,
  products: ShoppingBag, giftcards: Gift, packages: Layers, memberships: Award,
  cashdrawer: Wallet, timeclock: Clock, payroll: Banknote, forms: ClipboardList,
  offers: Percent, campaigns: Send, flows: Workflow, settings: Settings,
  staff: UserCircle, services: ListChecks, resources: LayoutGrid, dashboard: LayoutDashboard, integrations: Plug,
  search: Search, bell: Bell, apps: Grid3x3, chevron: ChevronDown, schedule: CalendarRange,
}

export function Icon({ name, size = 20, ...rest }: { name: string; size?: number; [k: string]: any }) {
  const C = MAP[name] || LayoutGrid
  return <C size={size} strokeWidth={1.9} {...rest} />
}
