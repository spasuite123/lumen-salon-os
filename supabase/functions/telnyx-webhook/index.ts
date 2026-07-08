// telnyx-webhook — INBOUND texts. Set this function's URL as the webhook on your
// Telnyx Messaging Profile. When a client replies, Telnyx POSTs here and we
// append the message to the matching conversation (creating one if needed).
// Deploy:  supabase functions deploy telnyx-webhook --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const evt = await req.json()
    const payload = evt?.data?.payload ?? {}
    const direction = payload?.direction // 'inbound'
    if (direction !== 'inbound') return new Response('ignored', { status: 200 })

    const fromPhone = payload?.from?.phone_number as string
    const toPhone = payload?.to?.[0]?.phone_number as string
    const text = payload?.text as string

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // resolve org by the receiving (business) number
    const { data: setting } = await admin.from('integration_settings').select('org_id').eq('sms_from_number', toPhone).maybeSingle()
    const orgId = setting?.org_id
    if (!orgId) return new Response('no org for number', { status: 200 })

    // match a client by phone (best effort) and find/create the conversation
    const { data: client } = await admin.from('clients').select('id').eq('org_id', orgId).eq('phone', fromPhone).maybeSingle()
    let { data: convo } = await admin.from('conversations').select('id, store_id').eq('org_id', orgId).eq('phone', fromPhone).order('last_message_at', { ascending: false }).maybeSingle()
    if (!convo) {
      const { data: store } = await admin.from('stores').select('id').eq('org_id', orgId).limit(1).maybeSingle()
      const { data: created } = await admin.from('conversations')
        .insert({ org_id: orgId, store_id: store?.id, client_id: client?.id ?? null, channel: 'sms', phone: fromPhone, unread: 1 })
        .select('id, store_id').single()
      convo = created
    }
    await admin.from('messages').insert({
      org_id: orgId, store_id: convo!.store_id, conversation_id: convo!.id,
      direction: 'inbound', body: text, provider: 'telnyx', status: 'received',
    })
    await admin.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', convo!.id)
    return new Response('ok', { status: 200 })
  } catch (e) {
    return new Response(String(e), { status: 200 }) // 200 so Telnyx doesn't retry-storm
  }
})
