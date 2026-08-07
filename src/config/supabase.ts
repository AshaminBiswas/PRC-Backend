import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Service role client for server-side operations (bypasses RLS)
export const supabase = createClient(
  env.supabase.url,
  env.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export default supabase;
