# Integrations — texting, payments, online booking

Everything here is **built and dormant**. Nothing bills you until you provision the
provider and flip the status to Live in **Settings → Integrations** (⌘K → Integrations).
Until then it runs in simulate/test mode at zero cost.

The control panel writes to one table (`integration_settings`) holding only
**non-secret** config + on/off flags. Real API secrets live in Supabase Edge
Function secrets, never in the database or the browser bundle.

---

## 1. Two-way texting (Telnyx)

**How it works.** Outbound: the app calls the `send-sms` Edge Function, which calls
Telnyx. Inbound: Telnyx POSTs each incoming text to the `telnyx-webhook` Edge
Function, which appends it to the right conversation in the `messages` table. The
Inbox reads/writes those tables.

**Turn it on (~$1/number/mo + ~$0.004/text):**
1. Create a Telnyx account, buy a number, create a Messaging Profile.
2. Deploy the functions:
   ```bash
   supabase functions deploy send-sms
   supabase functions deploy telnyx-webhook --no-verify-jwt
   supabase secrets set TELNYX_API_KEY=KEY... TELNYX_FROM_NUMBER=+1801...
   ```
3. In the Telnyx Messaging Profile, set the **inbound webhook URL** to your
   `telnyx-webhook` function URL.
4. In Settings → Integrations, set SMS to **Live** and enter your from-number.

Test mode (status = Test) records outbound messages without sending — useful to
wire up the Inbox UI before paying.

## 2. Front-desk + online payments (Stripe)

**How it works.** The app asks the `create-payment-intent` Edge Function for a
PaymentIntent. At the front desk an iPad running **Stripe Terminal** with a reader
(e.g. WisePOS E or the BBPOS M2) collects the card; online, the card is entered in
the browser. `stripe-webhook` marks the payment confirmed. (This is essentially
what Mangomint resells.) The checkout drawer already has the **Payment method**
selector — "Card on reader (Stripe Terminal)" routes through this path.

**Turn it on (Stripe: 2.7% + 5¢ card-present; reader ~$59–$249 one-time):**
1. Create a Stripe account; order a Terminal reader.
2. Deploy:
   ```bash
   supabase functions deploy create-payment-intent
   supabase functions deploy stripe-webhook --no-verify-jwt
   supabase secrets set STRIPE_SECRET_KEY=sk_live_...
   ```
3. Add the `stripe-webhook` URL as a webhook endpoint in the Stripe dashboard
   (events: `payment_intent.succeeded`, `payment_intent.payment_failed`).
4. In Settings → Integrations, set Payments to **Live**, paste your publishable key,
   and enable the iPad reader.
5. On the iPad, pair the reader with the Stripe Terminal SDK (one-time).

Until then, "Card (manual)" and "Cash" record the sale exactly as today.

## 3. Online booking

**How it works.** A public, login-free page at `/book/<slug>` reads your services,
staff and locations through two locked-down database functions
(`public_book_options`, `create_public_booking`) — the public never touches your
tables directly. A booking writes straight into your calendar as a `booked`
appointment, creating the client by phone if new.

**Turn it on (free):**
1. In Settings → Integrations, enable online booking and set a slug
   (e.g. `drift-reflexology`).
2. Share or embed the link it shows you: `https://your-site.netlify.app/book/drift-reflexology`
   (embed with an `<iframe>` on your website).

That's it — no provider needed. Mark which services are bookable online with the
`online_bookable` flag on each service (defaults to on).

---

## Files

- `supabase/migrations/14_integrations.sql` — settings table, flags, columns, and
  the two public booking functions. Run it once in the SQL editor.
- `supabase/functions/` — the four Edge Functions (send-sms, telnyx-webhook,
  create-payment-intent, stripe-webhook) + shared CORS. Deploy when you're ready.
- `src/lib/integrations.ts` — the app-side helpers (settings + function callers,
  with safe fallbacks so the app works before anything is deployed).
- `src/screens/Integrations.tsx` — the control panel and the public booking page.

Nothing here charges you until you deploy a function and set a status to Live.
