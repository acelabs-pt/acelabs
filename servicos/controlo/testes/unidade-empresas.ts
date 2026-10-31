// Cockpit partilhado (várias empresas no mesmo projeto Supabase): a plataforma de controlo só pode ver e tocar em contas
// da empresa do cliente em causa. Usa um Supabase simulado em memória (fetch trocado), por isso corre sem rede.
// Corre com: npx tsx testes/unidade-empresas.ts
import { criarUtilizador, executar, listarUtilizadores, remover, suspender, type Ctx } from "../supabase/functions/_shared/nucleo";

let falhas = 0;
const ok = (nome: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${extra ? ": " + extra : ""}`);
  if (!cond) falhas++;
};
const falha = async (nome: string, f: () => Promise<unknown>, quer: RegExp) => {
  try {
    await f();
    ok(nome, false, "aceitou");
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    ok(nome, quer.test(m), m);
  }
};

// --- Supabase simulado -------------------------------------------------------------------------------------------
type U = { id: string; email: string; created_at: string; banned_until: string | null };
let empresas: Array<{ id: string; codigo: string; nome: string; suspensa: boolean }>;
let membros: Array<{ user_id: string; empresa_id: string }>;
let users: U[];
let temEmpresas = true;
let seq = 0;
const novo = (email: string): U => ({ id: `u${++seq}`, email, created_at: new Date(2026, 9, seq).toISOString(), banned_until: null });

function reiniciar() {
  seq = 0;
  empresas = [
    { id: "E-alfa", codigo: "alfa", nome: "Alfa", suspensa: false },
    { id: "E-beta", codigo: "beta", nome: "Beta", suspensa: false },
  ];
  users = [novo("a1@alfa.pt"), novo("a2@alfa.pt"), novo("b1@beta.pt"), novo("orfao@x.pt")];
  membros = [
    { user_id: users[0].id, empresa_id: "E-alfa" },
    { user_id: users[1].id, empresa_id: "E-alfa" },
    { user_id: users[2].id, empresa_id: "E-beta" },
  ];
  temEmpresas = true;
}
const resp = (corpo: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
const filtro = (q: URLSearchParams, k: string) => q.get(k)?.replace(/^eq\./, "") ?? null;
const inserts: Array<Record<string, unknown>> = [];

globalThis.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
  const u = new URL(String(entrada));
  const q = u.searchParams;
  const m = init?.method ?? "GET";
  const corpo = init?.body ? JSON.parse(String(init.body)) : null;
  const p = u.pathname;
  if (p === "/rest/v1/empresas") {
    if (!temEmpresas) return resp({ message: "relation does not exist" }, 404);
    let l = empresas;
    const cod = filtro(q, "codigo");
    if (cod) l = l.filter((e) => e.codigo === cod);
    return resp(l);
  }
  if (p === "/rest/v1/membros") {
    if (m === "GET") {
      let l = membros;
      const e = filtro(q, "empresa_id");
      const us = filtro(q, "user_id");
      if (e) l = l.filter((x) => x.empresa_id === e);
      if (us) l = l.filter((x) => x.user_id === us);
      return resp(l);
    }
    if (m === "POST") {
      inserts.push(corpo);
      membros.push({ user_id: corpo.user_id, empresa_id: corpo.empresa_id ?? "(sem)" });
      return resp(null, 201);
    }
    if (m === "DELETE") {
      const us = filtro(q, "user_id");
      membros = membros.filter((x) => x.user_id !== us);
      return resp(null, 204);
    }
  }
  if (p === "/auth/v1/admin/users" && m === "GET") return resp({ users });
  if (p === "/auth/v1/admin/users" && m === "POST") {
    const n = novo(corpo.email);
    users.push(n);
    return resp({ id: n.id });
  }
  if (p === "/auth/v1/invite" && m === "POST") {
    const n = novo(corpo.email);
    users.push(n);
    return resp({ id: n.id });
  }
  const mu = p.match(/^\/auth\/v1\/admin\/users\/([^/]+)$/);
  if (mu) {
    const id = mu[1];
    const x = users.find((y) => y.id === id);
    if (m === "GET") return x ? resp(x) : resp({}, 404);
    if (m === "PUT") {
      if (x) x.banned_until = corpo.ban_duration === "none" ? null : "2126-01-01T00:00:00Z";
      return resp(x ?? {});
    }
    if (m === "DELETE") {
      users = users.filter((y) => y.id !== id);
      return resp({});
    }
  }
  return resp({ erro: `rota desconhecida ${m} ${p}` }, 500);
}) as typeof fetch;

const base: Ctx = { url: "https://exemplo.supabase.co", chave: "chave-de-teste", produto: "cockpit", appUrl: "https://cockpit.acelabs.pt" };
const alfa: Ctx = { ...base, empresa: "alfa" };
const beta: Ctx = { ...base, empresa: "beta" };

(async () => {
  // 1. Listar
  reiniciar();
  let l = await listarUtilizadores(alfa);
  ok("alfa lista só as contas de alfa", l.length === 2 && l.every((x) => x.email.endsWith("@alfa.pt")), l.map((x) => x.email).join(","));
  l = await listarUtilizadores(beta);
  ok("beta lista só as contas de beta", l.length === 1 && l[0].email === "b1@beta.pt");
  ok("contas sem empresa não aparecem em nenhuma", ![...(await listarUtilizadores(alfa)), ...(await listarUtilizadores(beta))].some((x) => x.email === "orfao@x.pt"));
  l = await listarUtilizadores(base);
  ok("sem empresa (modo antigo) lista todas, como antes", l.length === 4);
  await falha("empresa que não existe é recusada", () => listarUtilizadores({ ...base, empresa: "gama" }), /Não existe a empresa/);

  // 2. Agir sobre contas de outra empresa
  const b1 = users[2].id;
  await falha("alfa não suspende uma conta de beta", () => suspender(alfa, b1, true), /não pertence/);
  await falha("alfa não remove uma conta de beta", () => remover(alfa, b1), /não pertence/);
  ok("a conta de beta continua intacta (existe e não está suspensa)", users.some((x) => x.id === b1 && !x.banned_until) && membros.some((x) => x.user_id === b1));
  await falha("ninguém age sobre uma conta sem empresa", () => remover(alfa, users[3].id), /não pertence/);
  await suspender(alfa, users[0].id, true);
  ok("alfa suspende uma conta sua", !!users[0].banned_until);
  await suspender(alfa, users[0].id, false);
  ok("e reativa-a", !users[0].banned_until);
  await remover(alfa, users[1].id);
  ok("alfa remove uma conta sua (conta e registo de membro)", !users.some((x) => x.email === "a2@alfa.pt") && !membros.some((x) => x.user_id === "u2"));

  // 3. Criar
  reiniciar();
  inserts.length = 0;
  const r = await criarUtilizador(alfa, { email: "nova@alfa.pt", modo: "password" });
  ok("criar em alfa junta a conta à empresa de alfa", inserts.at(-1)?.empresa_id === "E-alfa" && !!r.passwordTemporaria, JSON.stringify(inserts.at(-1)));
  l = await listarUtilizadores(alfa);
  ok("a nova conta aparece em alfa e não em beta", l.some((x) => x.email === "nova@alfa.pt") && !(await listarUtilizadores(beta)).some((x) => x.email === "nova@alfa.pt"));
  await criarUtilizador(beta, { email: "convite@beta.pt", modo: "convite" });
  ok("convite em beta fica na empresa de beta", inserts.at(-1)?.empresa_id === "E-beta");
  await falha("sem indicar a empresa, um projeto com várias empresas recusa criar", () => criarUtilizador(base, { email: "perdida@x.pt", modo: "password" }), /várias empresas/);
  ok("e não deixou uma conta criada a meio", !users.some((x) => x.email === "perdida@x.pt"));
  await falha("criar numa empresa que não existe é recusado antes de criar a conta", () => criarUtilizador({ ...base, empresa: "gama" }, { email: "g@x.pt", modo: "password" }), /Não existe a empresa/);
  ok("e não deixou uma conta criada a meio (empresa inexistente)", !users.some((x) => x.email === "g@x.pt"));

  // 4. Projeto com uma só empresa e sem indicar o código: a conta fica nessa
  reiniciar();
  empresas = [empresas[0]];
  membros = membros.filter((x) => x.empresa_id === "E-alfa");
  inserts.length = 0;
  await criarUtilizador(base, { email: "unica@alfa.pt", modo: "password" });
  ok("com uma só empresa, criar sem código usa essa", inserts.at(-1)?.empresa_id === "E-alfa");

  // 5. Projeto antigo (sem tabela empresas)
  reiniciar();
  temEmpresas = false;
  inserts.length = 0;
  await criarUtilizador(base, { email: "antigo@x.pt", modo: "password" });
  ok("projeto antigo (sem empresas): criar continua a funcionar, sem empresa_id", inserts.length === 1 && !("empresa_id" in inserts[0]));
  await falha("projeto antigo + código de empresa: diz que falta a migração", () => listarUtilizadores(alfa), /migracao_multiempresa/);

  // 6. A empresa vem dentro do pedido assinado (modo "função")
  reiniciar();
  const viaPedido = (await executar(base, { acao: "listar", empresa: "alfa" })) as Array<{ email: string }>;
  ok("pedido assinado com empresa: lista só essa empresa", viaPedido.length === 2 && viaPedido.every((x) => x.email.endsWith("@alfa.pt")));
  await falha("pedido assinado: remover conta de outra empresa é recusado", () => executar(base, { acao: "remover", id: b1, empresa: "alfa" }), /não pertence/);
  ok("e a conta de beta continua lá", users.some((x) => x.id === b1));
  const semEmpresa = (await executar(base, { acao: "listar" })) as unknown[];
  ok("pedido sem empresa mantém o comportamento antigo", semEmpresa.length === 4);

  console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
})();
