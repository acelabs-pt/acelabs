// Cria (ou repõe a password de) a conta que o revisor da Apple e o TestFlight usam no projeto Demo. Uso:
//
//   node scripts/revisao-apple.mjs                     (email por omissão: revisao.apple@acelabs.pt)
//   node scripts/revisao-apple.mjs outro@acelabs.pt
//
// Lê .env.demo (fora do git) com NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e DEMO_PERMITIDO_EM (a referência
// do projeto, a parte antes de .supabase.co). PROTEÇÃO: só corre no projeto indicado em DEMO_PERMITIDO_EM, nunca num cliente.
// A password gerada aparece uma vez no ecrã e fica em .demo-revisao.txt (fora do git); ao correr outra vez muda.
// Antes: o SQL do Cockpit corrido no Demo (npm run sql) e a carteira de demonstração semeada (scripts/demo.ts).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";

const env = { ...process.env };
if (existsSync(".env.demo")) {
  for (const l of readFileSync(".env.demo", "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
}
const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const chave = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.demo.");
  process.exit(1);
}
if (!env.DEMO_PERMITIDO_EM || !url.includes(`//${env.DEMO_PERMITIDO_EM}.`)) {
  console.error(`Proteção: ${url} não é o projeto indicado em DEMO_PERMITIDO_EM. Este script só corre no Demo.`);
  process.exit(1);
}

const email = (process.argv[2] || "revisao.apple@acelabs.pt").trim().toLowerCase();
// Sem letras ou números que se confundem (0 O 1 l I), para quem copia à mão.
const ALFABETO = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const password = Array.from({ length: 18 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("") + "7";

const H = { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" };
const falha = async (passo, r) => {
  console.error(`${passo}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  process.exit(1);
};

// 1. Utilizador: cria, ou, se já existe, muda a password
let id = null;
for (let pagina = 1; pagina <= 20 && !id; pagina++) {
  const r = await fetch(`${url}/auth/v1/admin/users?page=${pagina}&per_page=200`, { headers: H });
  if (!r.ok) await falha("Listar utilizadores", r);
  const { users = [] } = await r.json();
  id = users.find((u) => (u.email || "").toLowerCase() === email)?.id ?? null;
  if (users.length < 200) break;
}
if (id) {
  const r = await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "PUT", headers: H, body: JSON.stringify({ password, email_confirm: true }) });
  if (!r.ok) await falha("Mudar a password", r);
  console.log(`Conta ${email} já existia: password mudada.`);
} else {
  const r = await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers: H, body: JSON.stringify({ email, password, email_confirm: true }) });
  if (!r.ok) await falha("Criar o utilizador", r);
  id = (await r.json()).id;
  console.log(`Conta ${email} criada.`);
}

// 2. Juntar à lista de membros (migracao_seguranca.sql): sem isto a conta entra mas não vê dados. Num projeto partilhado
// (migracao_multiempresa.sql) a conta fica na empresa de demonstração ("demo", ou DEMO_EMPRESA no .env.demo).
let empresaId = null;
const codigoEmpresa = (env.DEMO_EMPRESA || "demo").toLowerCase();
const re = await fetch(`${url}/rest/v1/empresas?select=id&codigo=eq.${codigoEmpresa}`, { headers: H });
if (re.ok) {
  empresaId = (await re.json())[0]?.id ?? null;
  if (!empresaId) {
    console.error(`Não existe a empresa "${codigoEmpresa}". Semear primeiro a demonstração (scripts/demo.ts) ou criá-la com scripts/empresa.mjs.`);
    process.exit(1);
  }
}
const m = await fetch(`${url}/rest/v1/membros`, { method: "POST", headers: { ...H, Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(empresaId ? { user_id: id, empresa_id: empresaId } : { user_id: id }) });
if (m.ok) console.log("Juntada à lista de membros.");
else if (m.status === 404) console.log("Aviso: a tabela membros não existe. Corre o SQL do Cockpit no Demo (npm run sql).");
else console.error(`Aviso: não foi possível juntar à lista de membros (${m.status}).`);

writeFileSync(".demo-revisao.txt", `Email: ${email}\nPassword: ${password}\nProjeto: ${url}\n`);
console.log(`\nEmail:    ${email}\nPassword: ${password}\n\nGuardado também em .demo-revisao.txt (fora do git). Vai para as notas de revisão do TestFlight e da App Store.`);
