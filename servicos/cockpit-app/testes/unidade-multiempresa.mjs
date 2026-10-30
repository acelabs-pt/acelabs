// Isolamento entre empresas na base de dados (migracao_multiempresa.sql), sem rede e sem Supabase: corre as migrações
// reais num Postgres em memória (PGlite) com as funções e os papéis do Supabase simulados (auth.uid(), anon,
// authenticated, service_role). Prova que uma empresa não vê, não altera e não apaga dados de outra em NENHUMA das
// 14 tabelas, que as chaves únicas são por empresa, e que a migração de uma base antiga (um cliente) passa tudo
// para a empresa "padrao". Este teste nunca pode ser saltado: é ele que garante a separação entre clientes.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pasta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ORDEM = ["create_tables.sql", "migracao_zonas_correspondencias.sql", "migracao_escala.sql", "migracao_seguranca.sql", "migracao_notificacoes.sql", "migracao_apagar_conta.sql"];
const sql = (f) => readFileSync(path.join(pasta, f), "utf8").replace(/\r\n/g, "\n").replace(/create extension if not exists "pgcrypto";/, "");
const TABELAS = [
  "contactos", "compradores", "comprador_imoveis", "comprador_documentos", "comprador_zonas", "proprietarios", "chamadas",
  "angariacoes", "angariacao_acoes", "tarefas", "correspondencias", "metas", "metas_config", "metas_semanas",
];

const out = [];
const ok = (nome, cond, extra = "") => out.push(`${cond ? "OK   " : "FALHA"} ${nome}${extra ? ": " + extra : ""}`);

// Supabase simulado: auth.users, auth.uid() lido das "claims" da sessão, e os três papéis.
const SHIM = `
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, created_at timestamptz default now(), last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public, auth to anon, authenticated, service_role;
grant select on auth.users to authenticated;
grant all on auth.users to service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

async function novaBase(ficheiros) {
  const db = new PGlite();
  await db.exec(SHIM);
  for (const f of ficheiros) await db.exec(sql(f));
  await db.exec("grant all on all tables in schema public to anon, authenticated, service_role");
  return db;
}

/** Corre uma consulta como o papel dado (e utilizador, se houver). Devolve { rows } ou { erro }. */
async function como(db, papel, utilizador, texto, params = []) {
  try {
    await db.exec(`set role ${papel}; select set_config('request.jwt.claim.sub', '${utilizador ?? ""}', false);`);
    const r = await db.query(texto, params);
    return { rows: r.rows, afetadas: r.affectedRows ?? r.rows.length };
  } catch (e) {
    return { erro: String(e.message || e) };
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
  }
}
const admin = (db, t, p) => como(db, "service_role", null, t, p);
const uuid = async (db, t, p) => {
  const r = await admin(db, t, p);
  if (r.erro) throw new Error(r.erro + " :: " + t.slice(0, 80));
  return r.rows[0].id;
};

/** Uma linha em cada uma das 14 tabelas, na empresa dada (chave de administrador, empresa_id explícito). */
async function semear(db, empresa, tag) {
  const e = empresa;
  const c = await uuid(db, "insert into contactos (nome, empresa_id) values ($1, $2) returning id", [`C ${tag}`, e]);
  const cp = await uuid(db, "insert into compradores (contacto_id, empresa_id) values ($1, $2) returning id", [c, e]);
  await admin(db, "insert into comprador_imoveis (comprador_id, empresa_id) values ($1, $2)", [cp, e]);
  await admin(db, "insert into comprador_documentos (comprador_id, nome, empresa_id) values ($1, 'doc', $2)", [cp, e]);
  await admin(db, "insert into comprador_zonas (comprador_id, distrito, empresa_id) values ($1, 'Braga', $2)", [cp, e]);
  const pr = await uuid(db, "insert into proprietarios (contacto_id, empresa_id) values ($1, $2) returning id", [c, e]);
  await admin(db, "insert into chamadas (contacto_id, empresa_id) values ($1, $2)", [c, e]);
  const an = await uuid(db, "insert into angariacoes (titulo, proprietario_id, empresa_id) values ($1, $2, $3) returning id", [`A ${tag}`, pr, e]);
  await admin(db, "insert into angariacao_acoes (angariacao_id, nome, dia, empresa_id) values ($1, 'Fotos', 0, $2)", [an, e]);
  await admin(db, "insert into tarefas (titulo, chave_automacao, empresa_id) values ($1, 'meta:2026-W44', $2)", [`T ${tag}`, e]);
  await admin(db, "insert into correspondencias (comprador_id, angariacao_id, empresa_id) values ($1, $2, $3)", [cp, an, e]);
  await admin(db, "insert into metas (ano, metrica, valor_anual, empresa_id) values (2026, 'visitas', 10, $1)", [e]);
  await admin(db, "insert into metas_config (ano, empresa_id) values (2026, $1)", [e]);
  await admin(db, "insert into metas_semanas (semana, decisao, empresa_id) values ('2026-W44', 'colocada', $1)", [e]);
  return { c, cp, pr, an };
}

// ===========================================================================
// 1. Base nova: todas as migrações por ordem, depois a multiempresa
// ===========================================================================
let db = await novaBase([...ORDEM, "migracao_multiempresa.sql", "migracao_admin.sql"]);
ok("as migrações todas correm numa base nova", true);
const ea = await uuid(db, "insert into empresas (codigo, nome) values ('alfa', 'Alfa') returning id");
const ua = await uuid(db, "insert into auth.users (email) values ('a1@alfa.pt') returning id");
const ua2 = await uuid(db, "insert into auth.users (email) values ('a2@alfa.pt') returning id");
await admin(db, "insert into membros (user_id, empresa_id) values ($1, $2)", [ua, ea]);
await admin(db, "insert into membros (user_id, empresa_id) values ($1, $2)", [ua2, ea]);

// 1a. Modo de um cliente: a chave de administrador sem empresa_id usa a única empresa
let r = await admin(db, "insert into contactos (nome) values ('sem empresa explícita') returning empresa_id");
ok("com uma só empresa, o INSERT de administrador sem empresa_id usa essa", r.rows?.[0]?.empresa_id === ea, r.erro);

// 1b. Entra a segunda empresa
const eb = await uuid(db, "insert into empresas (codigo, nome) values ('beta', 'Beta') returning id");
const ub = await uuid(db, "insert into auth.users (email) values ('b1@beta.pt') returning id");
await admin(db, "insert into membros (user_id, empresa_id) values ($1, $2)", [ub, eb]);
const nu = await uuid(db, "insert into auth.users (email) values ('fora@x.pt') returning id"); // sem empresa
r = await admin(db, "insert into contactos (nome) values ('ambígua')");
ok("com duas empresas, o INSERT de administrador sem empresa_id FALHA (nunca escolhe ao acaso)", !!r.erro, r.erro?.slice(0, 80));
const dadosA = await semear(db, ea, "alfa");
const dadosB = await semear(db, eb, "beta");
ok("administrador semeia as 14 tabelas nas duas empresas com empresa_id explícito", !!dadosA.an && !!dadosB.an);

// 1c. Isolamento tabela a tabela
for (const t of TABELAS) {
  const vistas = await como(db, "authenticated", ua, `select empresa_id from ${t}`);
  const minhas = (vistas.rows ?? []).every((x) => x.empresa_id === ea) && (vistas.rows ?? []).length >= 1;
  ok(`${t}: A só vê linhas da sua empresa`, minhas, vistas.erro);
  const deB = await como(db, "authenticated", ub, `select empresa_id from ${t}`);
  ok(`${t}: B só vê linhas da sua empresa`, (deB.rows ?? []).length >= 1 && deB.rows.every((x) => x.empresa_id === eb), deB.erro);
  const sem = await como(db, "authenticated", nu, `select 1 from ${t}`);
  ok(`${t}: quem não é membro não vê nada`, (sem.rows ?? []).length === 0 && !sem.erro, sem.erro);
  const alvo = await como(db, "authenticated", ua, `update ${t} set empresa_id = empresa_id where empresa_id = $1`, [eb]);
  ok(`${t}: A não consegue alterar linhas de B`, (alvo.afetadas ?? 0) === 0, alvo.erro);
  const apagar = await como(db, "authenticated", ua, `delete from ${t} where empresa_id = $1`, [eb]);
  ok(`${t}: A não consegue apagar linhas de B`, (apagar.afetadas ?? 0) === 0, apagar.erro);
  const mover = await como(db, "authenticated", ua, `update ${t} set empresa_id = $1 where empresa_id = $2`, [eb, ea]);
  ok(`${t}: A não consegue passar linhas suas para B`, !!mover.erro || (mover.afetadas ?? 0) === 0, mover.erro?.slice(0, 60));
}
// B continua com tudo intacto depois das tentativas de A
for (const t of TABELAS) {
  const n = await admin(db, `select count(*)::int as n from ${t} where empresa_id = $1`, [eb]);
  if (n.rows[0].n < 1) ok(`${t}: dados de B ficaram intactos`, false);
}
ok("os dados de B ficaram intactos depois de todas as tentativas de A", true);

// 1d. Inserir
r = await como(db, "authenticated", ua, "insert into contactos (nome) values ('novo do A') returning empresa_id");
ok("INSERT de A sem empresa_id fica na empresa de A", r.rows?.[0]?.empresa_id === ea, r.erro);
r = await como(db, "authenticated", ua, "insert into contactos (nome, empresa_id) values ('intruso', $1)", [eb]);
ok("A não consegue inserir um contacto na empresa de B", !!r.erro);
r = await como(db, "authenticated", nu, "insert into contactos (nome) values ('de fora')");
ok("quem não é membro não consegue inserir", !!r.erro);
r = await como(db, "authenticated", ua, "insert into membros (user_id, empresa_id) values ($1, $2)", [nu, ea]);
ok("um membro não se pode acrescentar a ninguém na lista de membros", !!r.erro);
r = await como(db, "authenticated", nu, "insert into membros (user_id, empresa_id) values ($1, $2)", [nu, ea]);
ok("quem não é membro não se pode juntar a uma empresa", !!r.erro);

// 1e. Empresas e membros
r = await como(db, "authenticated", ua, "select codigo from empresas");
ok("A só vê a sua própria empresa", r.rows?.length === 1 && r.rows[0].codigo === "alfa", r.erro);
r = await como(db, "authenticated", ua, "update empresas set nome = 'x'");
ok("A não consegue alterar empresas", (r.afetadas ?? 0) === 0);
r = await como(db, "authenticated", ua, "select user_id from membros");
ok("A só vê o seu próprio registo de membro", r.rows?.length === 1 && r.rows[0].user_id === ua, r.erro);
r = await como(db, "authenticated", ua, "select empresa_atual() as e");
ok("empresa_atual() dá a empresa do membro", r.rows?.[0]?.e === ea, r.erro);
r = await como(db, "authenticated", nu, "select empresa_atual() as e");
ok("empresa_atual() é null para quem não é membro", r.rows?.[0]?.e === null, r.erro);
r = await como(db, "anon", null, "select count(*) from contactos");
ok("sem sessão (anon) não se lê nada", !!r.erro || Number(r.rows?.[0]?.count ?? 0) === 0);

// 1e2. Quem é membro não pode mexer na lista de membros nem nas empresas
r = await como(db, "authenticated", ua, "update membros set empresa_id = $1 where user_id = $2", [eb, ua]);
ok("A não consegue mudar-se para a empresa de B", (r.afetadas ?? 0) === 0 || !!r.erro, r.erro?.slice(0, 60));
r = await como(db, "authenticated", ua, "delete from membros where user_id = $1", [ub]);
ok("A não consegue apagar membros de B", (r.afetadas ?? 0) === 0 || !!r.erro);
r = await como(db, "authenticated", ua, "insert into empresas (codigo, nome) values ('intrusa', 'X')");
ok("um membro não consegue criar empresas", !!r.erro);
r = await como(db, "authenticated", ua, "delete from empresas");
ok("um membro não consegue apagar empresas", (r.afetadas ?? 0) === 0 || !!r.erro);
await admin(db, "insert into push_subscricoes (user_id, tipo, token) values ($1, 'ios', 'tok-b')", [ub]);
r = await como(db, "authenticated", ua, "select token from push_subscricoes");
ok("A não vê os aparelhos de B", !(r.rows ?? []).some((x) => x.token === "tok-b"), r.erro);

// 1f. Resumo das angariações respeita as regras
r = await como(db, "authenticated", ua, "select angariacao_id from resumo_angariacoes()");
ok("resumo_angariacoes() só devolve angariações da empresa do utilizador", r.rows?.length === 1 && r.rows[0].angariacao_id === dadosA.an, r.erro);

// 1g. Chaves únicas por empresa
r = await admin(db, "insert into tarefas (titulo, chave_automacao, empresa_id) values ('outra', 'meta:2026-W44', $1)", [ea]);
ok("a mesma chave_automacao repetida na MESMA empresa é recusada", !!r.erro);
r = await como(db, "authenticated", ua, "insert into metas (ano, metrica, valor_anual) values (2026, 'visitas', 1)");
ok("a mesma meta repetida na mesma empresa é recusada", !!r.erro);
r = await como(db, "authenticated", ua, "insert into metas (ano, metrica, valor_anual) values (2027, 'visitas', 1) returning empresa_id");
ok("o mesmo tipo de meta noutro ano entra", r.rows?.[0]?.empresa_id === ea, r.erro);
r = await como(db, "authenticated", ua, "insert into metas (empresa_id, ano, metrica, valor_anual) values ($1, 2026, 'visitas', 99) on conflict (empresa_id, ano, metrica) do update set valor_anual = 99 returning valor_anual", [ea]);
ok("upsert de metas por (empresa, ano, metrica) funciona, como a app faz", r.rows?.[0]?.valor_anual === 99, r.erro);
r = await como(db, "authenticated", ua, "insert into metas_config (empresa_id, ano, semanas_uteis) values ($1, 2026, 40) on conflict (empresa_id, ano) do update set semanas_uteis = 40 returning semanas_uteis", [ea]);
ok("upsert de metas_config por (empresa, ano) funciona", r.rows?.[0]?.semanas_uteis === 40, r.erro);
r = await como(db, "authenticated", ua, "insert into metas_semanas (empresa_id, semana, decisao) values ($1, '2026-W44', 'ignorada') on conflict (empresa_id, semana) do update set decisao = 'ignorada' returning decisao", [ea]);
ok("upsert de metas_semanas por (empresa, semana) funciona", r.rows?.[0]?.decisao === "ignorada", r.erro);

// 1h. Notificações: aparelho iOS registado por função
r = await como(db, "authenticated", ua, "select registar_push_ios('tok-a', 'iPhone')");
ok("membro regista aparelho iOS", !r.erro, r.erro);
r = await como(db, "authenticated", nu, "select registar_push_ios('tok-x', 'iPhone')");
ok("quem não é membro não regista aparelhos", !!r.erro);
r = await como(db, "authenticated", ua, "select registar_push_nativo('tok-android', 'android', 'Android')");
ok("membro regista aparelho Android", !r.erro, r.erro);
r = await como(db, "authenticated", ua, "select registar_push_nativo('tok-web', 'web', 'x')");
ok("tipo de aparelho inválido é recusado", !!r.erro);
r = await como(db, "authenticated", nu, "select registar_push_nativo('tok-y', 'android', 'Android')");
ok("quem não é membro não regista aparelhos Android", !!r.erro);
r = await admin(db, "select tipo from push_subscricoes where token = 'tok-android'");
ok("o aparelho Android fica guardado com tipo android", r.rows?.[0]?.tipo === "android", r.erro);

// 1i. Apagar a minha conta: o último membro é o último da MINHA empresa
r = await como(db, "authenticated", ub, "select apagar_minha_conta()");
ok("o único membro de uma empresa não pode apagar a conta (mesmo havendo outra empresa com membros)", !!r.erro && /ultimo_membro/.test(r.erro), r.erro?.slice(0, 80));
r = await como(db, "authenticated", ua2, "select apagar_minha_conta()");
ok("um membro de uma empresa com 2 membros pode apagar a conta", !r.erro, r.erro);
r = await admin(db, "select count(*)::int as n from membros where empresa_id = $1", [ea]);
ok("a empresa fica com 1 membro depois de apagar", r.rows?.[0]?.n === 1);
r = await admin(db, "select count(*)::int as n from contactos where empresa_id = $1", [ea]);
ok("apagar a conta não apaga os dados da empresa", r.rows?.[0]?.n >= 1);

// 1j. Suspender uma empresa
await admin(db, "update empresas set suspensa = true where id = $1", [eb]);
r = await como(db, "authenticated", ub, "select count(*)::int as n from contactos");
ok("empresa suspensa: os membros deixam de ver dados", r.rows?.[0]?.n === 0, r.erro);
r = await como(db, "authenticated", ub, "insert into contactos (nome) values ('x')");
ok("empresa suspensa: os membros deixam de poder escrever", !!r.erro);
r = await como(db, "authenticated", ua, "select count(*)::int as n from contactos");
ok("suspender B não afeta A", r.rows?.[0]?.n >= 1, r.erro);
await admin(db, "update empresas set suspensa = false where id = $1", [eb]);
r = await como(db, "authenticated", ub, "select count(*)::int as n from contactos");
ok("reativar a empresa devolve o acesso", r.rows?.[0]?.n >= 1, r.erro);

// 1j2. Administração: dados internos, registo de ações e resumo (migracao_admin.sql)
r = await admin(db, "select estado from empresas_admin where empresa_id = $1", [ea]);
ok("cada empresa tem a sua linha de dados internos (estado piloto)", r.rows?.[0]?.estado === "piloto", r.erro);
await admin(db, "update empresas_admin set notas = 'so para nos', contacto_email = 'dono@alfa.pt' where empresa_id = $1", [ea]);
for (const t of ["empresas_admin", "auditoria"]) {
  r = await como(db, "authenticated", ua, `select count(*)::int as n from ${t}`);
  ok(`um membro não lê ${t}`, !!r.erro || r.rows?.[0]?.n === 0, r.erro);
  r = await como(db, "anon", null, `select count(*)::int as n from ${t}`);
  ok(`sem sessão não se lê ${t}`, !!r.erro || r.rows?.[0]?.n === 0, r.erro);
}
r = await como(db, "authenticated", ua, "update empresas_admin set estado = 'ativa'");
ok("um membro não altera os dados internos da empresa", !!r.erro || r.afetadas === 0, r.erro);
r = await como(db, "authenticated", ua, "select codigo, nome, suspensa from empresas");
ok("um membro continua a ler só a sua empresa (sem campos internos)", r.rows?.length === 1 && r.rows[0].codigo === "alfa" && !("notas" in r.rows[0]), r.erro);
r = await como(db, "authenticated", ua, "select * from resumo_empresas()");
ok("um membro não chama resumo_empresas()", !!r.erro);
r = await como(db, "anon", null, "select * from resumo_empresas()");
ok("sem sessão não se chama resumo_empresas()", !!r.erro);
r = await como(db, "authenticated", ua, "select * from contas_sem_empresa()");
ok("um membro não chama contas_sem_empresa()", !!r.erro);
const ua3 = await uuid(db, "insert into auth.users (email) values ('a3@alfa.pt') returning id");
await admin(db, "insert into membros (user_id, empresa_id) values ($1, $2)", [ua3, ea]);
await admin(db, "update auth.users set last_sign_in_at = now() where id = $1", [ua]);
r = await admin(db, "select * from resumo_empresas() where codigo = 'alfa'");
const ra = r.rows?.[0];
ok("resumo: utilizadores, convites por aceitar e último acesso", ra?.utilizadores === 2 && ra?.convites_por_aceitar === 1 && !!ra?.ultimo_acesso, r.erro ?? JSON.stringify([ra?.utilizadores, ra?.convites_por_aceitar, ra?.ultimo_acesso]));
ok("resumo: contagens e atividade dos últimos 7 dias", ra?.compradores >= 1 && ra?.atividade_7d >= 1 && ra?.aparelhos >= 1, JSON.stringify(ra));
ok("resumo: traz os dados internos para a administração", ra?.notas === "so para nos" && ra?.contacto_email === "dono@alfa.pt");
r = await admin(db, "select * from resumo_empresas() where codigo = 'beta'");
ok("resumo: não mistura contagens entre empresas", r.rows?.[0]?.utilizadores === (await admin(db, "select count(*)::int as n from membros where empresa_id = $1", [eb])).rows[0].n, r.erro);
const semE = await uuid(db, "insert into auth.users (email) values ('solta@x.pt') returning id");
r = await admin(db, "select email from contas_sem_empresa()");
ok("contas sem empresa: aparece a conta solta e não as de membros", r.rows?.some((x) => x.email === "solta@x.pt") && !r.rows?.some((x) => x.email === "a1@alfa.pt"), r.erro);
await admin(db, "update empresas set suspensa = true where id = $1", [ea]);
r = await admin(db, "select estado from empresas_admin where empresa_id = $1", [ea]);
ok("suspender pelo script marca o estado 'suspensa'", r.rows?.[0]?.estado === "suspensa", r.erro);
await admin(db, "update empresas set suspensa = false where id = $1", [ea]);
r = await admin(db, "select estado from empresas_admin where empresa_id = $1", [ea]);
ok("reativar pelo script volta a 'ativa'", r.rows?.[0]?.estado === "ativa", r.erro);
await admin(db, "insert into auditoria (quem, empresa_id, empresa_codigo, acao, detalhe) values ('pedro', $1, 'beta', 'teste', '{\"x\":1}')", [eb]);

// 1k. Apagar uma empresa apaga os seus dados e só os seus
await admin(db, "delete from empresas where id = $1", [eb]);
r = await admin(db, "select count(*)::int as n from contactos where empresa_id = $1", [eb]);
const sobraB = TABELAS.length;
let tudoB = true;
for (const t of TABELAS) {
  const n = await admin(db, `select count(*)::int as n from ${t} where empresa_id = $1`, [eb]);
  if (n.rows[0].n !== 0) tudoB = false;
}
ok(`apagar a empresa B apaga os dados dela nas ${sobraB} tabelas`, tudoB);
r = await admin(db, "select count(*)::int as n from contactos where empresa_id = $1", [ea]);
ok("e não toca nos dados de A", r.rows?.[0]?.n >= 1);
r = await admin(db, "select count(*)::int as n from empresas_admin where empresa_id = $1", [eb]);
ok("apagar a empresa apaga os dados internos dela", r.rows?.[0]?.n === 0, r.erro);
r = await admin(db, "select empresa_id, empresa_codigo, quem from auditoria where acao = 'teste'");
ok("o registo de ações sobrevive à empresa (guarda o código, perde a ligação)", r.rows?.[0]?.empresa_codigo === "beta" && r.rows?.[0]?.empresa_id === null && r.rows?.[0]?.quem === "pedro", r.erro);
await db.close();

// ===========================================================================
// 2. Base antiga (um cliente por projeto) migrada: tudo passa para a empresa "padrao"
// ===========================================================================
db = await novaBase(ORDEM);
const velho = await uuid(db, "insert into auth.users (email) values ('antigo@cliente.pt') returning id");
await admin(db, "insert into membros (user_id) values ($1)", [velho]);
const cv = await uuid(db, "insert into contactos (nome) values ('antigo') returning id");
await admin(db, "insert into tarefas (titulo, chave_automacao) values ('t', 'meta:x')");
await admin(db, "insert into metas (ano, metrica, valor_anual) values (2026, 'visitas', 5)");
await admin(db, "insert into metas_config (ano) values (2026)");
await admin(db, "insert into metas_semanas (semana, decisao) values ('2026-W40', 'colocada')");
await db.exec(sql("migracao_multiempresa.sql"));
await db.exec(sql("migracao_admin.sql"));
r = await admin(db, "select codigo from empresas");
ok("base antiga: cria a empresa 'padrao'", r.rows?.length === 1 && r.rows[0].codigo === "padrao", r.erro);
let tudo = true;
for (const t of [...TABELAS, "membros"]) {
  const n = await admin(db, `select count(*)::int as n from ${t} where empresa_id is null`);
  if (n.rows[0].n !== 0) tudo = false;
}
ok("base antiga: nenhuma linha fica sem empresa", tudo);
r = await como(db, "authenticated", velho, "select nome from contactos");
ok("base antiga: o membro antigo continua a ver os seus dados", r.rows?.length === 1 && r.rows[0].nome === "antigo", r.erro);
await db.exec(sql("migracao_multiempresa.sql"));
r = await admin(db, "select count(*)::int as n from empresas");
ok("a migração pode correr duas vezes sem estragar nada", r.rows?.[0]?.n === 1 && !r.erro, r.erro);
r = await como(db, "authenticated", velho, "select count(*)::int as n from contactos");
ok("depois da segunda corrida os dados continuam visíveis", r.rows?.[0]?.n === 1, r.erro);
await db.close();

console.log(out.join("\n"));
