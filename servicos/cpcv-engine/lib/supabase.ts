import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-side client with service role (bypasses RLS) - use only in API routes
export function sbServer() {
  return createClient(url, serviceKey);
}

// Client-side client with anon key - use in browser components
export function sbClient() {
  return createClient(url, anonKey);
}
