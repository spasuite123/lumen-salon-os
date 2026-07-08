import { supabase, isSupabaseConfigured } from './supabase'

export type IntegrationSettings = {
  sms_status: 'off' | 'test' | 'live'
  sms_from_number?: string
  payments_status: 'off' | 'test' | 'live'
  payments_publishable_key?: string
  payments_terminal_enabled: boolean
  online_booking_enabled: boolean
  booking_slug?: string
}

const DEFAULTS: IntegrationSettings = {
  sms_status: 'off', payments_status: 'off', payments_terminal_enabled: false,
  online_booking_enabled: false, booking_slug: 'lumen-demo',
}

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  if (!isSupabaseConfigured) return DEFAULTS
  const { data } = await supabase.from('integration_settings').select('*').limit(1).maybeSingle()
  return { ...DEFAULTS, ...(data || {}) }
}

export async function saveIntegrationSettings(patch: Partial<IntegrationSettings>) {
  const { data: org } = await supabase.from('organizations').select('id').limit(1).maybeSingle()
  if (!org) return { ok: false, error: 'No org' }
  const { error } = await supabase.from('integration_settings')
    .upsert({ org_id: org.id, ...patch, updated_at: new Date().toISOString() })
  return { ok: !error, error: error?.message }
}

/** Send an outbound text. The function sends via Telnyx when keys are set, or
 *  simulates (no cost). If the function isn't deployed yet, we still succeed
 *  locally so the Inbox keeps working. */
export async function sendSms(conversationId: string, to: string, body: string) {
  if (!isSupabaseConfigured) return { ok: true, simulated: true }
  try {
    const { data, error } = await supabase.functions.invoke('send-sms', { body: { conversation_id: conversationId, to, body } })
    if (error) throw error
    return data
  } catch (e) {
    return { ok: true, simulated: true, note: 'send-sms function not deployed yet' }
  }
}

export async function createPaymentIntent(amountCents: number, mode: 'terminal' | 'online' = 'terminal') {
  if (!isSupabaseConfigured) return { ok: true, simulated: true }
  try {
    const { data, error } = await supabase.functions.invoke('create-payment-intent', { body: { amount_cents: amountCents, mode } })
    if (error) throw error
    return data
  } catch (e) {
    return { ok: false, error: String(e), simulated: true }
  }
}

export async function getPublicBookOptions(slug: string) {
  const { data } = await supabase.rpc('public_book_options', { slug })
  return data as any
}

export async function createPublicBooking(args: {
  slug: string; p_store_id: string; p_service_id: string; p_staff_id: string;
  p_name: string; p_phone: string; p_starts_at: string
}) {
  const { data, error } = await supabase.rpc('create_public_booking', args)
  return { ok: !error, id: data, error: error?.message }
}
