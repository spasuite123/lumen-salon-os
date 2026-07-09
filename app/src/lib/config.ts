export type App = { id: string; name: string; group: 'core' | 'mkt' | 'setup' }

export const APPS: App[] = [
  { id: 'calendar', name: 'Calendar', group: 'core' },
  { id: 'schedule', name: 'Schedule', group: 'core' },
  { id: 'clients', name: 'Clients', group: 'core' },
  { id: 'sales', name: 'Sales', group: 'core' },
  { id: 'inbox', name: 'Inbox', group: 'core' },
  { id: 'reports', name: 'Reports', group: 'core' },
  { id: 'products', name: 'Products', group: 'core' },
  { id: 'giftcards', name: 'Gift Cards', group: 'core' },
  { id: 'packages', name: 'Packages', group: 'core' },
  { id: 'memberships', name: 'Memberships', group: 'core' },
  { id: 'cashdrawer', name: 'Cash Drawer', group: 'core' },
  { id: 'timeclock', name: 'Time Clock', group: 'core' },
  { id: 'payroll', name: 'Payroll', group: 'core' },
  { id: 'forms', name: 'Forms', group: 'core' },
  { id: 'offers', name: 'Offers', group: 'mkt' },
  { id: 'campaigns', name: 'Campaigns', group: 'mkt' },
  { id: 'flows', name: 'Flows', group: 'mkt' },
  { id: 'settings', name: 'Settings', group: 'setup' },
  { id: 'staff', name: 'Staff Members', group: 'setup' },
  { id: 'services', name: 'Services', group: 'setup' },
  { id: 'resources', name: 'Resources', group: 'setup' },
  { id: 'integrations', name: 'Integrations', group: 'setup' },
]

// apps shown in the top nav; the rest live in the launcher
export const NAV = ['calendar', 'clients', 'sales', 'inbox', 'reports', 'products', 'giftcards']
export const BADGES: Record<string, number> = { inbox: 6 }

export const SETTINGS: { section: string; pages: string[] }[] = [
  { section: 'Business Setup', pages: ['Business Details', 'Business Hours', 'Locations', 'Phone Numbers', 'Web Chat', 'Logo & Branding', 'Payroll', 'Advanced Settings'] },
  { section: 'Calendar & Appointments', pages: ['Display Preferences', 'Scheduling Options', 'Waiting Room', 'Cancel & Reschedule', 'Express Booking', 'Quick Tools'] },
  { section: 'Payments & Checkout', pages: ['Payment Accounts', 'Front Desk Displays', 'Checkout Settings'] },
  { section: 'Online Booking', pages: ['Setup & Integration', 'Preferences', 'Staff Selection'] },
  { section: 'Automated Messages', pages: ['Appointment Booked', 'Appointment Canceled', 'Appointment Rescheduled', 'Form Submitted', 'Waitlist Entries', 'Check-In Process', 'Sale Closed', 'Gift Cards', 'Memberships', 'Message Defaults'] },
]

export const REPORTCATS: [string, string[]][] = [
  ['Staff', ['Service & Product Sales By Staff', 'Time Clock', 'Days Off']],
  ['Sales', ['Sales Summary', 'Service Sales', 'Product Sales', 'Sales by Time Period']],
  ['Refunds', ['Refund Summary', 'Refund Details']],
  ['Offers', ['Offers Usage', 'Offers Summary']],
  ['Client Account Balances', ['Client Account Usage', 'Client Account Balances', 'Client Account Deposits']],
  ['Gift Cards', ['Gift Card Usage', 'Gift Card Balances', 'Gift Card Sales', 'Gift Card Sales Details']],
  ['Packages', ['Package Usage', 'Outstanding Packages', 'Package Sales', 'Package Sales Details']],
  ['Memberships', ['Membership Payments', 'Membership Credit Usage', 'Memberships Started', 'Memberships Cancellations']],
  ['Payments', ['Payment Summary', 'Payment Details', 'Revenue by Service Type', 'Cash Drawer Activity', 'Deposits Collected', 'Deposits Used']],
  ['Inventory', ['Cost of Goods', 'Product Inventory', 'Product Inventory Changes', 'Product Stock & Usage']],
  ['Business', ['Cashflow', 'Business Intelligence: Appointments', 'Business Intelligence: Sales', 'Business Intelligence: Forecast', 'Client Retention', 'Appointment Cancellations', 'Appointments Export']],
  ['Data Export', ['Appointments']],
]
