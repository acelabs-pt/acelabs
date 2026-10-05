import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente com service role (ignora RLS) - usar só em tarefas de administração
// (ex: convidar o primeiro utilizador de uma organização nova). Em todo o
// resto da app usar sbUserServer()/sbBrowser(), que respeitam RLS por
// organizacao_id.
export function sbAdmin() {
  return createClient(url, serviceKey);
}
