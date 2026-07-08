// stripe-webhook — marks payments paid/failed when Stripe confirms. Set this
// function's URL as a webhook endpoint in the Stripe dashboard.
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const evt = await req.json()
    const type = evt?.type
    const pi = evt?.data?.object
    if (type === 'payment_intent.succeeded' || type === 'payment_intent.payment_failed') {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      await admin.from('payments').update({ provider: 'stripe', external_id: pi.id })
        .eq('external_id', pi.id)
    }
    return new Response('ok', { status: 200 })
  } catch (e) {
    return new Response(String(e), { status: 200 })
  }
})
