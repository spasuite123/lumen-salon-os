// create-payment-intent — front-desk + online card payments via Stripe.
// For the iPad reader, pass capture for Stripe Terminal; for online, the app
// confirms with the returned client_secret. SIMULATE mode (no STRIPE_SECRET_KEY)
// returns a fake intent so checkout works end-to-end at zero cost.
// Deploy:  supabase functions deploy create-payment-intent
import { cors } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { amount_cents, mode } = await req.json() // mode: 'terminal' | 'online'
    const STRIPE = Deno.env.get('STRIPE_SECRET_KEY')

    if (!STRIPE) {
      return new Response(JSON.stringify({ ok: true, simulated: true, id: 'pi_sim_' + crypto.randomUUID().slice(0, 8), client_secret: 'sim_secret' }),
        { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const params = new URLSearchParams()
    params.set('amount', String(amount_cents))
    params.set('currency', 'usd')
    if (mode === 'terminal') { params.set('payment_method_types[]', 'card_present'); params.set('capture_method', 'automatic') }
    else { params.set('automatic_payment_methods[enabled]', 'true') }

    const res = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${STRIPE}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    })
    const pi = await res.json()
    if (!res.ok) throw new Error(pi?.error?.message || 'Stripe error')
    return new Response(JSON.stringify({ ok: true, id: pi.id, client_secret: pi.client_secret }),
      { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
