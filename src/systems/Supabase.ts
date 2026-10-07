import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined
export async function getSupabase() {
  if (client) return client
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim()
  if (!url || !key) throw new Error('Chưa cấu hình Supabase. Thêm Project URL và publishable key vào .env.local để mở phòng HCM202.')
  if (key.startsWith('sb_secret_')) throw new Error('Dùng publishable key cho frontend, không dùng secret key.')
  if (key.startsWith('eyJ')) {
    try { if (JSON.parse(atob(key.split('.')[1])).role === 'service_role') throw new Error('Không dùng service_role key trong frontend.') }
    catch (error) { if (error instanceof Error && error.message.includes('service_role')) throw error }
  }
  const check = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(10000) })
  if (check.status === 401) throw new Error('Supabase: API key không hợp lệ (401). Kiểm tra publishable key của đúng dự án trong .env.local.')
  if (!check.ok) throw new Error(`Supabase chưa sẵn sàng (${check.status}). Kiểm tra dự án và kết nối mạng.`)
  const { createClient } = await import('@supabase/supabase-js')
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  return client
}
