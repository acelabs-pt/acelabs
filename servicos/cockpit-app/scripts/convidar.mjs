// Convida um utilizador para o Cockpit de UM cliente. Ele recebe um email, abre o link e escolhe a própria password
// (nunca se partilha uma password). Uso:
//
//   node scripts/convidar.mjs ana@exemplo.pt https://cockpit.acelabs.pt
//
// Precisa de duas variáveis do projeto Supabase DESSE cliente (no ambiente ou no .env.local desta pasta):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   <- chave de administrador. Nunca vai para o repositório nem para a Vercel.
// O endereço da app (2.º argumento) tem de estar na lista "Redirect URLs" do Supabase (Authentication, URL Configuration).
import { existsSync, readFileSync } from "node:fs";

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim();
  }
}

const [email, app] = process.argv.slice(2);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const chave = env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !app) {
  console.error("Uso: node scripts/convidar.mjs <email> <endereço da app, ex: https://cockpit.acelabs.pt>");
  process.exit(1);
}
if (!url || !chave) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (do projeto Supabase deste cliente).");
  process.exit(1);
}

const r = await fetch(`${url}/auth/v1/invite`, {
  method: "POST",
  headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email, data: {}, redirect_to: `${app.replace(/\/$/, "")}/nova-password` }),
});
const corpo = await r.json().catch(() => ({}));
if (!r.ok) {
  console.error(`Não foi possível convidar (${r.status}): ${corpo.msg ?? corpo.message ?? JSON.stringify(corpo)}`);
  process.exit(1);
}
console.log(`Convite enviado para ${email}. O link abre ${app.replace(/\/$/, "")}/nova-password.`);
