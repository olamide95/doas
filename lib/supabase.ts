import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ADMIN_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)