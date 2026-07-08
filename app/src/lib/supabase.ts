import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when real Supabase credentials are present. When false the app runs
 *  entirely on local demo data so it works immediately after `npm run dev`. */
export const isSupabaseConfigured = Boolean(url && anon)

export const supabase = isSupabaseConfigured
  ? createClient(url as string, anon as string)
  : (null as any)
