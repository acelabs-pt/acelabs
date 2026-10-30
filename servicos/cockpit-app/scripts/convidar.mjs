// Convida um utilizador para o Cockpit de UMA empresa. Ele recebe um email, abre o link e escolhe a própria password
// (nunca se partilha uma password). Uso:
//
//   node scripts/convidar.mjs ana@exemplo.pt https://cockpit.acelabs.pt alvorada
//
// O 3.º argumento é o código da empresa (scripts/empresa.mjs cria e lista). Obrigatório quando o projeto tem mais de uma
// empresa; com uma só pode omitir-se.
//
// Precisa de duas variáveis do projeto Supabase (no ambiente ou no .env.local desta pasta):
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

const [email, app, codigoEmpresa] = process.argv.slice(2);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const chave = env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !app) {
  console.error("Uso: node scripts/convidar.mjs <email> <endereço da app, ex: https://cockpit.acelabs.pt> [código da empresa]");
  process.exit(1);
}
if (!url || !chave) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (do projeto Supabase).");
  process.exit(1);
}

// Empresa: pelo código; sem código, só serve se existir uma única.
const H = { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" };
let empresaId = null;
const re = await fetch(`${url}/rest/v1/empresas?select=id,codigo`, { headers: H });
if (re.ok) {
  const empresas = await re.json();
  if (codigoEmpresa) {
    empresaId = empresas.find((e) => e.codigo === codigoEmpresa.toLowerCase())?.id ?? null;
    if (!empresaId) {
      console.error(`Não existe a empresa "${codigoEmpresa}". Existem: ${empresas.map((e) => e.codigo).join(", ") || "nenhuma (criar com scripts/empresa.mjs)"}.`);
      process.exit(1);
    }
  } else if (empresas.length === 1) {
    empresaId = empresas[0].id;
  } else {
    console.error(empresas.length ? `Há ${empresas.length} empresas: indica o código da empresa (${empresas.map((e) => e.codigo).join(", ")}).` : "Ainda não existe nenhuma empresa: criar com scripts/empresa.mjs.");
    process.exit(1);
  }
} else if (re.status !== 404) {
  console.error(`Não consegui ler as empresas (${re.status}).`);
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

// Juntar à lista de membros (migracao_seguranca.sql): sem isto, com essa migração corrida, o convidado entra mas não vê dados.
if (corpo.id) {
  const m = await fetch(`${url}/rest/v1/membros`, {
    method: "POST",
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify(empresaId ? { user_id: corpo.id, empresa_id: empresaId } : { user_id: corpo.id }),
  });
  if (m.ok) console.log("Juntado à lista de membros.");
  else if (m.status === 404) console.log("Aviso: a tabela membros não existe. Corre migracao_seguranca.sql neste projeto.");
  else console.error(`Aviso: não foi possível juntar à lista de membros (${m.status}). Junta-o à mão: insert into membros (user_id) values ('${corpo.id}');`);
}
