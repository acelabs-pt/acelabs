// Verifica, só em leitura, o Supabase de um cliente: se as migrações estão corridas e as definições de segurança. Uso:
//
//   node scripts/verificar-seguranca.mjs
//
// Lê NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY do ambiente ou do .env.local desta pasta.
// Para outro projeto (por exemplo o Demo): node scripts/verificar-seguranca.mjs .env.demo
// Usa só a chave pública: não precisa da chave de administrador e não altera nada.
import { existsSync, readFileSync } from "node:fs";

const env = { ...process.env };
const ficheiroEnv = process.argv[2] || ".env.local";
if (existsSync(ficheiroEnv)) {
  for (const l of readFileSync(ficheiroEnv, "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

let problemas = 0;
const linha = (ok, texto, conselho) => {
  console.log(`${ok ? "OK    " : "ALERTA"} ${texto}`);
  if (!ok) {
    problemas++;
    console.log(`       ${conselho}`);
  }
};

const h = { apikey: anon, Authorization: `Bearer ${anon}` };

// Migrações: o que cada ficheiro SQL cria tem de existir (sem sessão as tabelas respondem vazias, não 404)
console.log("Base de dados");
const existe = async (caminho, init) => {
  const r = await fetch(`${url}/rest/v1/${caminho}`, { headers: { ...h, "Content-Type": "application/json" }, ...init });
  return r.status !== 404 && r.status !== 400;
};
linha(await existe("contactos?select=id&limit=1"), "Tabelas base (create_tables.sql)", "Corre create_tables.sql no SQL Editor do Supabase.");
linha(
  (await existe("comprador_zonas?select=id&limit=1")) && (await existe("correspondencias?select=id&limit=1")) && (await existe("angariacoes?select=tipo_imovel,valor&limit=1")),
  "Várias zonas e alertas de imóveis (migracao_zonas_correspondencias.sql)",
  "Corre migracao_zonas_correspondencias.sql (sem ela não há alertas de correspondência nem dados do imóvel nas angariações)."
);
linha(await existe("rpc/resumo_angariacoes", { method: "POST", body: "{}" }), "Resumo rápido das angariações (migracao_escala.sql)", "Corre migracao_escala.sql (sem ela o Dashboard fica lento com muitas angariações).");

console.log("\nSegurança");
const s = await (await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon } })).json();
linha(s.disable_signup === true, "Registo público desligado", 'Authentication, Sign In / Providers: desligar "Allow new users to sign up".');
linha(!s.external?.anonymous_users, "Entrada anónima desligada", "Authentication: desligar anonymous sign-ins.");

// Com a chave pública e sem sessão, nenhuma tabela pode devolver dados
for (const t of ["contactos", "compradores", "proprietarios", "angariacoes", "tarefas", "chamadas"]) {
  const r = await fetch(`${url}/rest/v1/${t}?select=id&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
  const corpo = await r.json().catch(() => null);
  linha(Array.isArray(corpo) ? corpo.length === 0 : true, `Sem sessão, "${t}" não devolve dados`, "As regras (RLS) desta tabela deixam ler sem sessão. Corre create_tables.sql e migracao_seguranca.sql.");
}

// A lista de membros existe? (migracao_seguranca.sql)
const m = await fetch(`${url}/rest/v1/membros?select=user_id&limit=1`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } });
linha(m.status !== 404, "Lista de membros criada (só convidados veem dados)", "Corre migracao_seguranca.sql (segunda camada de segurança).");

// Notificações push (migracao_notificacoes.sql): opcional, mas o botão "Ativar notificações" precisa dela.
linha(await existe("push_subscricoes?select=id&limit=1"), "Tabela das notificações push", "Corre migracao_notificacoes.sql (sem ela, ligar as notificações dá erro).");

// Registo do iPhone nas notificações (migracao_notificacoes.sql). Sem sessão a chamada é recusada, não 404.
linha(await existe("rpc/registar_push_ios", { method: "POST", body: JSON.stringify({ p_token: "x" }) }), "Registo de aparelhos iOS (migracao_notificacoes.sql, versão recente)", "Volta a correr migracao_notificacoes.sql (a parte de cima): acrescenta o suporte a iPhone.");
linha(await existe("rpc/registar_push_nativo", { method: "POST", body: JSON.stringify({ p_token: "x", p_tipo: "android" }) }), "Registo de aparelhos Android (migracao_notificacoes.sql, versão recente)", "Volta a correr migracao_notificacoes.sql (a parte de cima): acrescenta o suporte a Android.");

// Apagar a conta dentro da app (migracao_apagar_conta.sql): obrigatório para a App Store. Sem sessão a chamada é recusada (401/403), não 404.
linha(await existe("rpc/apagar_minha_conta", { method: "POST", body: "{}" }), "Apagar a própria conta (migracao_apagar_conta.sql)", "Corre migracao_apagar_conta.sql (a Apple exige que se possa apagar a conta dentro da app).");

// Várias empresas no mesmo projeto (migracao_multiempresa.sql): cada cliente só vê os seus dados.
linha(await existe("rpc/empresa_atual", { method: "POST", body: "{}" }), "Várias empresas no mesmo projeto (migracao_multiempresa.sql)", "Corre migracao_multiempresa.sql: sem ela os dados de clientes diferentes não ficam separados.");
const empr = await fetch(`${url}/rest/v1/empresas?select=id&limit=1`, { headers: { ...h, "Content-Type": "application/json" } });
if (empr.status !== 404) {
  const j = await empr.json().catch(() => null);
  linha(empr.status !== 200 || (Array.isArray(j) && j.length === 0), 'Sem sessão, "empresas" não devolve dados', "Confirma as regras de acesso da tabela empresas (migracao_multiempresa.sql).");
}

console.log(problemas ? `\n${problemas} ${problemas === 1 ? "problema" : "problemas"} a resolver.` : "\nTudo em ordem.");
process.exit(problemas ? 2 : 0);
