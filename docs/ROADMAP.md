# Roadmap

## Done
- [x] Interactive UI prototype (`prototype/index.html`) — calendar, checkout, clients, sales, team, store switcher
- [x] Multi-tenant schema (`01`) — org → stores, staff, services, clients, appointments, sales
- [x] RLS + role model + onboarding (`02`) — owner / manager / front_desk / stylist, verified
- [x] Demo seed (`03`) — 1 org, 3 Utah stores, full menu, clients, a day of bookings
- [x] Domain extension (`04`) — memberships, packages, gift cards, retail + per-store inventory
- [x] Reporting foundation (`05`) — line items, payments, refunds, offers, client accounts, time tracking, inventory movements
- [x] Report engine (`07`) — 23 live report views, auto-scoped via `security_invoker`, validated against demo data
- [x] Reports catalog (`docs/REPORTS.md`) — all 40 mapped to data + status
- [x] **Full report suite (`07`+`08`) — all 40 reports live as 42 scoped views, validated**
- [x] **Remaining modules (`09`) — Inbox, Forms, Campaigns, Flows, Resources, Payroll schema + RLS; every app now backed**
- [x] Full app shell with Mangomint-style navy top nav (active pill, badges) + 20-app launcher
- [x] End-to-end RLS validation on Postgres 16 (role isolation, tenant isolation, write rules, report scoping)

## Next (suggested priority)

1. **Wire the Expo frontend to Supabase.** Replace the prototype's in-memory
   `APPTS` array with real queries. Role-aware calendar: the same screen shows the
   whole floor to front desk/owner and just-my-column to a stylist — RLS already
   enforces it, the client only renders what comes back. Auth via Supabase Auth.

2. **Client-facing online booking.** Public flow: pick location → service → provider
   → open slot → confirm. Needs an availability function (open slots = staff hours
   minus existing appointments) and a deposit/hold step. Booking writes an
   appointment via a constrained RPC (clients aren't authenticated staff).

3. **Checkout that touches real money + records.** Turn the prototype's "Charge"
   into a `sales` insert (+ tip), decrement package redemptions / gift-card balance,
   decrement `product_inventory` on retail add-ons. Payments provider TBD (Stripe).

4. **Reporting roll-ups.** Owner dashboard across stores: revenue, utilization,
   retention, membership MRR. Mostly SQL views over `sales` / `appointments`.

## Parking lot
- Stylist-scoped client visibility (tighten `clients_select`) if needed
- Staff scheduling / working hours table (drives availability + utilization)
- Forms & charting (med-spa / HIPAA path) — separate, higher-compliance track
- Automated reminders / marketing (confirmations, follow-ups)
- Week view + drag-to-reschedule on the calendar
