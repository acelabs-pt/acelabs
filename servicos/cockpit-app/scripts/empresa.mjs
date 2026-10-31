// Gere as empresas (clientes) de um projeto Cockpit partilhado (migracao_multiempresa.sql). Uso:
//
//   node scripts/empresa.mjs listar
//   node scripts/empresa.mjs criar alvorada "Alvorada Imóveis"
//   node scripts/empresa.mjs renomear padrao demo "Ace Labs Demo"   muda o código (e o nome) de uma empresa
//   node scripts/empresa.mjs suspender alvorada        os membros deixam de ver dados (nada se apaga)
//   node scripts/empresa.mjs reativar alvorada
//   node scripts/empresa.mjs apagar alvorada --confirmo   APAGA os dados da empresa e as contas de login dos membros
//
// Por omissão usa o .env.local; para outro projeto (por exemplo o de produção): --env .env.cockpit
// Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (chave de administrador: nunca vai para o repositório
// nem para a Vercel).
import { existsSync, readFileSync } from "node:fs";

const args = process.argv.slice(2);
const iEnv = args.indexOf("--env");
const ficheiroEnv = iEnv >= 0 ? args.splice(iEnv, 2)[1] : ".env.local";
const confirmo = args.includes("--confirmo");
const [cmd, codigo, ...resto] = args.filter((a) => a !== "--confirmo");

const env = { ...process.env };
if (existsSync(ficheiroEnv)) {
  for (const l of readFileSync(ficheiroEnv, "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
}
const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const chave = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chave) {
  console.error(`Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (em ${ficheiroEnv} ou no ambiente).`);
  process.exit(1);
}
const H = { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" };
const pedir = async (metodo, caminho, corpo, extra = {}) => {
  const r = await fetch(`${url}${caminho}`, { method: metodo, headers: { ...H, ...extra }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text();
  let json = null;
  try { json = t ? JSON.parse(t) : null; } catch { json = t; }
  return { ok: r.ok, status: r.status, corpo: json };
};
const sair = (msg) => { console.error(msg); process.exit(1); };

const lista = await pedir("GET", "/rest/v1/empresas?select=id,codigo,nome,suspensa,criada_em&order=criada_em");
if (!lista.ok) sair(lista.status === 404 ? "A tabela empresas não existe: correr migracao_multiempresa.sql neste projeto." : `Não consegui ler as empresas (${lista.status}).`);
const empresas = lista.corpo;
const achar = (c) => empresas.find((e) => e.codigo === String(c || "").toLowerCase());

if (!cmd || cmd === "listar") {
  const membros = await pedir("GET", "/rest/v1/membros?select=empresa_id");
  const n = new Map();
  for (const m of membros.corpo ?? []) n.set(m.empresa_id, (n.get(m.empresa_id) ?? 0) + 1);
  if (!empresas.length) console.log("Nenhuma empresa. Criar com: node scripts/empresa.mjs criar <código> \"<nome>\"");
  for (const e of empresas) console.log(`${e.codigo.padEnd(18)} ${e.nome.padEnd(28)} ${String(n.get(e.id) ?? 0).padStart(3)} membro(s)${e.suspensa ? "  [SUSPENSA]" : ""}`);
} else if (cmd === "criar") {
  const nome = resto.join(" ").trim();
  const cod = String(codigo || "").trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(cod) || !nome) sair('Uso: criar <código: letras minúsculas, números e hífen> "<nome da empresa>"');
  if (achar(cod)) sair(`A empresa "${cod}" já existe.`);
  const r = await pedir("POST", "/rest/v1/empresas", { codigo: cod, nome }, { Prefer: "return=representation" });
  if (!r.ok) sair(`Não foi possível criar (${r.status}): ${JSON.stringify(r.corpo).slice(0, 200)}`);
  console.log(`Empresa "${cod}" criada. Convidar pessoas: node scripts/convidar.mjs <email> <endereço da app> ${cod}`);
} else if (cmd === "renomear") {
  const e = achar(codigo);
  const novo = String(resto[0] || "").trim().toLowerCase();
  const nome = resto.slice(1).join(" ").trim();
  if (!e) sair(`Não existe a empresa "${codigo}".`);
  if (!/^[a-z0-9-]+$/.test(novo)) sair('Uso: renomear <código atual> <código novo> ["novo nome"]');
  if (achar(novo) && novo !== e.codigo) sair(`Já existe a empresa "${novo}".`);
  const r = await pedir("PATCH", `/rest/v1/empresas?id=eq.${e.id}`, nome ? { codigo: novo, nome } : { codigo: novo });
  if (!r.ok) sair(`Falhou (${r.status}).`);
  console.log(`Empresa "${e.codigo}" passou a "${novo}"${nome ? ` (${nome})` : ""}.`);
} else if (cmd === "suspender" || cmd === "reativar") {
  const e = achar(codigo);
  if (!e) sair(`Não existe a empresa "${codigo}".`);
  const r = await pedir("PATCH", `/rest/v1/empresas?id=eq.${e.id}`, { suspensa: cmd === "suspender" });
  if (!r.ok) sair(`Falhou (${r.status}).`);
  console.log(`Empresa "${e.codigo}" ${cmd === "suspender" ? "suspensa: os membros deixam de ver dados" : "reativada"}.`);
} else if (cmd === "apagar") {
  const e = achar(codigo);
  if (!e) sair(`Não existe a empresa "${codigo}".`);
  if (!confirmo) sair(`Isto APAGA todos os dados da empresa "${e.codigo}" e as contas de login dos seus membros, e não se desfaz. Repetir com --confirmo.`);
  const ms = (await pedir("GET", `/rest/v1/membros?empresa_id=eq.${e.id}&select=user_id`)).corpo ?? [];
  const r = await pedir("DELETE", `/rest/v1/empresas?id=eq.${e.id}`);
  if (!r.ok) sair(`Não foi possível apagar a empresa (${r.status}).`);
  let contas = 0;
  for (const m of ms) if ((await pedir("DELETE", `/auth/v1/admin/users/${m.user_id}`)).ok) contas++;
  console.log(`Empresa "${e.codigo}" apagada, com os dados e ${contas} conta(s) de login.`);
} else {
  sair("Comandos: listar | criar <código> \"<nome>\" | renomear <código> <novo> | suspender <código> | reativar <código> | apagar <código> --confirmo");
}
