// send-sms — outbound text. Called by the app (Inbox). Sends via Telnyx when
// TELNYX_API_KEY is set; otherwise runs in SIMULATE mode (records the message,
// marks it 'simulated', sends nothing — no cost). Deploy:  supabase functions deploy send-sms
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { cors } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { conversation_id, to, body } = await req.json()
    const TELNYX_API_KEY = Deno.env.get('TELNYX_API_KEY')
    const FROM = Deno.env.get('TELNYX_FROM_NUMBER')

    // service-role client so we can write the message row regardless of caller
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let status = 'simulated', externalId: string | null = null, provider = 'simulate'
    if (TELNYX_API_KEY && FROM) {
      provider = 'telnyx'
      const res = await fetch('https://api.telnyx.com/v2/messages', {
        method: 'POST',
        headers: { Authorization: `Bearer ${TELNYX_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to, text: body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.errors?.[0]?.detail || 'Telnyx send failed')
      status = 'sent'; externalId = data?.data?.id ?? null
    }

    // record the outbound message (the app may also optimistically insert; this is the source of truth)
    if (conversation_id) {
      await admin.from('messages').update({ status, external_id: externalId, provider })
        .eq('conversation_id', conversation_id).eq('body', body).eq('direction', 'outbound').is('external_id', null)
    }
    return new Response(JSON.stringify({ ok: true, status, provider, external_id: externalId }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
