// Núcleo da administração de um cliente: listar, convidar/criar, suspender e remover utilizadores, e ver o estado
// da instalação. Só usa fetch e WebCrypto (sem APIs do Deno nem do Node), por isso corre nos dois sítios:
//  - na app de controlo (modo "chave": com a chave de administrador do cliente guardada só no computador de quem a usa);
//  - na função `admin` publicada no Supabase de CADA cliente (modo "funcao": a chave de administrador nunca sai de lá,
//    e a app de controlo só envia pedidos assinados).

export type Produto = "cockpit" | "cpcv";
// codigoApp: código do cliente na app Cockpit com vários clientes num deploy; o convite abre /convite/<código>.
export type Ctx = { url: string; chave: string; produto: Produto; appUrl?: string; codigoApp?: string };

export const PAPEIS: Record<Produto, string[]> = {
  cockpit: ["membro"],
  cpcv: ["agente", "gestora", "admin"],
};

export type Utilizador = {
  id: string;
  email: string;
  nome: string | null;
  papel: string | null;
  criado_em: string;
  ultimo_acesso: string | null;
  suspenso: boolean;
  /** Só no Cockpit: a conta existe mas ainda não está na lista de membros (não vê dados). */
  semAcesso?: boolean;
};

function cab(c: Ctx): Record<string, string> {
  return { apikey: c.chave, Authorization: `Bearer ${c.chave}`, "Content-Type": "application/json" };
}

async function pedir(c: Ctx, caminho: string, init: RequestInit = {}) {
  const r = await fetch(`${c.url.replace(/\/$/, "")}${caminho}`, { ...init, headers: { ...cab(c), ...(init.headers as Record<string, string> | undefined) } });
  const corpo = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, corpo };
}

function mensagem(corpo: unknown, omissao: string): string {
  const c = corpo as { msg?: string; message?: string; error_description?: string; code?: string } | null;
  if (c?.code === "email_exists" || /already been registered|already exists/i.test(c?.msg ?? c?.message ?? "")) return "Já existe uma conta com este email.";
  return omissao;
}

export async function listarUtilizadores(c: Ctx): Promise<Utilizador[]> {
  const r = await pedir(c, "/auth/v1/admin/users?per_page=200");
  if (!r.ok) throw new Error("Não foi possível listar os utilizadores. Confirma o endereço e a chave do cliente.");
  const users = ((r.corpo as { users?: Array<Record<string, unknown>> })?.users ?? []) as Array<Record<string, string | null>>;

  let nomes = new Map<string, { nome: string; papel: string }>();
  let membros: Set<string> | null = null;
  if (c.produto === "cpcv") {
    const p = await pedir(c, "/rest/v1/profiles?select=id,nome,role");
    if (p.ok) nomes = new Map((p.corpo as Array<{ id: string; nome: string; role: string }>).map((x) => [x.id, { nome: x.nome, papel: x.role }]));
  } else {
    const m = await pedir(c, "/rest/v1/membros?select=user_id");
    if (m.ok) membros = new Set((m.corpo as Array<{ user_id: string }>).map((x) => x.user_id));
  }

  return users
    .map((u) => ({
      id: String(u.id),
      email: String(u.email ?? ""),
      nome: nomes.get(String(u.id))?.nome ?? null,
      papel: c.produto === "cpcv" ? (nomes.get(String(u.id))?.papel ?? null) : "membro",
      criado_em: String(u.created_at ?? ""),
      ultimo_acesso: (u.last_sign_in_at as string | null) ?? null,
      suspenso: !!u.banned_until && new Date(String(u.banned_until)).getTime() > Date.now(),
      semAcesso: c.produto === "cockpit" && membros !== null ? !membros.has(String(u.id)) : undefined,
    }))
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
}

function passwordTemporaria(): string {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => letras[b % letras.length]).join("") + "7a";
}

export type NovoUtilizador = {
  email: string;
  nome?: string;
  papel?: string;
  /** "convite": o utilizador recebe um email e escolhe a password (só Cockpit). "password": cria já a conta com uma password temporária para dar ao utilizador. */
  modo: "convite" | "password";
};

export async function criarUtilizador(c: Ctx, n: NovoUtilizador): Promise<{ id: string; passwordTemporaria?: string }> {
  const email = n.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Email inválido.");
  const papel = n.papel ?? PAPEIS[c.produto][0];
  if (!PAPEIS[c.produto].includes(papel)) throw new Error("Papel inválido para este produto.");
  if (c.produto === "cpcv" && !(n.nome ?? "").trim()) throw new Error("Indica o nome.");

  let id: string;
  let pass: string | undefined;
  if (n.modo === "convite") {
    if (c.produto !== "cockpit") throw new Error("O convite por email só existe no Cockpit. No CPCV cria-se com password temporária.");
    if (!c.appUrl) throw new Error("Falta o endereço da app deste cliente (para o link do convite).");
    const r = await pedir(c, "/auth/v1/invite", { method: "POST", body: JSON.stringify({ email, data: {}, redirect_to: `${c.appUrl.replace(/\/$/, "")}${c.codigoApp ? "/convite/" + encodeURIComponent(c.codigoApp) : "/nova-password"}` }) });
    if (!r.ok || !(r.corpo as { id?: string })?.id) throw new Error(mensagem(r.corpo, "Não foi possível enviar o convite."));
    id = (r.corpo as { id: string }).id;
  } else {
    pass = passwordTemporaria();
    const r = await pedir(c, "/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password: pass, email_confirm: true }) });
    if (!r.ok || !(r.corpo as { id?: string })?.id) throw new Error(mensagem(r.corpo, "Não foi possível criar a conta."));
    id = (r.corpo as { id: string }).id;
  }

  // Perfil/lista de membros: sem isto a conta existe mas não vê nada.
  const perfil =
    c.produto === "cpcv"
      ? await pedir(c, "/rest/v1/profiles", { method: "POST", body: JSON.stringify({ id, nome: (n.nome ?? "").trim(), role: papel }) })
      : await pedir(c, "/rest/v1/membros", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ user_id: id }) });
  if (!perfil.ok) {
    // não deixar uma conta a meio: apagar a conta acabada de criar e dizer porquê
    await pedir(c, `/auth/v1/admin/users/${id}`, { method: "DELETE" });
    throw new Error(
      perfil.status === 404
        ? "A base de dados deste cliente ainda não tem as tabelas (corre as migrações em Estado)."
        : "A conta foi criada mas o perfil falhou, por isso foi anulada. Confirma as migrações em Estado."
    );
  }
  return { id, passwordTemporaria: pass };
}

export async function suspender(c: Ctx, id: string, suspenso: boolean): Promise<void> {
  // "876000h" é um ban de 100 anos; "none" levanta-o. A conta e os dados ficam intactos.
  const r = await pedir(c, `/auth/v1/admin/users/${id}`, { method: "PUT", body: JSON.stringify({ ban_duration: suspenso ? "876000h" : "none" }) });
  if (!r.ok) throw new Error("Não foi possível alterar o estado da conta.");
}

export async function remover(c: Ctx, id: string): Promise<void> {
  if (c.produto === "cpcv") await pedir(c, `/rest/v1/profiles?id=eq.${id}`, { method: "DELETE" });
  else await pedir(c, `/rest/v1/membros?user_id=eq.${id}`, { method: "DELETE" });
  const r = await pedir(c, `/auth/v1/admin/users/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Não foi possível apagar a conta.");
}

export type Verificacao = { ok: boolean; texto: string; conselho?: string };

const TABELAS: Record<Produto, Array<[string, string, string]>> = {
  cockpit: [
    ["contactos", "Tabelas base", "create_tables.sql"],
    ["membros", "Lista de membros (só convidados veem dados)", "migracao_seguranca.sql"],
    ["push_subscricoes", "Notificações push", "migracao_notificacoes.sql"],
  ],
  cpcv: [
    ["profiles", "Perfis e papéis", "create_tables_cpcv.sql"],
    ["cpcv_processos", "Processos do CPCV", "create_tables_cpcv.sql"],
    ["cpcv_hipotecas", "Hipotecas (fase 11)", "migration_fase11.sql"],
    ["cpcv_convites", "Convites (fase 6)", "migration_fase6.sql"],
  ],
};

/** Colunas que só existem depois de certas migrações (a mais recente de cada produto). */
const COLUNAS: Record<Produto, Array<[string, string, string]>> = {
  cockpit: [],
  cpcv: [["cpcv_partes?select=email,casal&limit=1", "Dados das partes (email e casal)", "migration_fase15.sql"]],
};

export async function estado(c: Ctx): Promise<Verificacao[]> {
  const v: Verificacao[] = [];
  for (const [tabela, texto, ficheiro] of TABELAS[c.produto]) {
    const r = await pedir(c, `/rest/v1/${tabela}?select=*&limit=1`);
    v.push({ ok: r.ok, texto, conselho: r.ok ? undefined : `Corre ${ficheiro} no SQL Editor deste projeto.` });
  }
  for (const [caminho, texto, ficheiro] of COLUNAS[c.produto]) {
    const r = await pedir(c, `/rest/v1/${caminho}`);
    v.push({ ok: r.ok, texto, conselho: r.ok ? undefined : `Corre ${ficheiro} no SQL Editor deste projeto.` });
  }
  if (c.produto === "cockpit") {
    // Chamada sem sessão: a função recusa (auth.uid() é nulo) e não apaga nada; só interessa se existe (404 = falta a migração).
    const r = await pedir(c, "/rest/v1/rpc/apagar_minha_conta", { method: "POST", body: "{}" });
    const p = await pedir(c, "/rest/v1/rpc/registar_push_ios", { method: "POST", body: JSON.stringify({ p_token: "x" }) });
    v.push({ ok: p.status !== 404, texto: "Notificações do iPhone (registo de aparelhos)", conselho: p.status !== 404 ? undefined : "Volta a correr migracao_notificacoes.sql neste projeto." });
    v.push({ ok: r.status !== 404, texto: "Apagar a própria conta (exigido pela App Store)", conselho: r.status !== 404 ? undefined : "Corre migracao_apagar_conta.sql no SQL Editor deste projeto." });
  }
  // Registo público: tem de estar desligado, senão qualquer pessoa com a chave pública cria conta.
  const s = await fetch(`${c.url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: c.chave } }).then((x) => x.json()).catch(() => null);
  v.push({
    ok: s?.disable_signup === true,
    texto: "Registo público desligado",
    conselho: "Authentication, Sign In / Providers: desligar \"Allow new users to sign up\".",
  });
  const us = await listarUtilizadores(c).catch(() => null);
  if (us) {
    v.push({ ok: us.length > 0, texto: `Utilizadores: ${us.length}`, conselho: us.length === 0 ? "Ainda ninguém tem acesso: cria o primeiro utilizador." : undefined });
    if (c.produto === "cockpit") {
      const semAcesso = us.filter((u) => u.semAcesso).length;
      if (semAcesso > 0) v.push({ ok: false, texto: `${semAcesso} conta(s) fora da lista de membros`, conselho: "Essas contas entram mas não veem dados." });
    }
  }
  return v;
}

// ---------------------------------------------------------------------------------------------
// Pedidos assinados (modo "funcao"): a app de controlo assina um pedido de curta duração com a chave privada
// Ed25519 dos sócios; a função `admin` de cada cliente verifica-o com a chave pública (segredo CONTROLO_CHAVE_PUBLICA)
// e só então executa. Nenhuma chave de administrador de cliente passa por aqui.
// ---------------------------------------------------------------------------------------------

const b64u = (b: ArrayBuffer | Uint8Array): string => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (const x of u) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const deB64u = (s: string): Uint8Array<ArrayBuffer> => {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(p);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const deSpki = (pem: string) => deB64u(pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));

export type Pedido = { acao: string; [k: string]: unknown };

/** Assina um pedido. `privadaPem` é a chave PKCS8 Ed25519. Válido 2 minutos e só para o projeto indicado em `aud`. */
export async function assinar(privadaPem: string, aud: string, pedido: Pedido): Promise<string> {
  const chave = await crypto.subtle.importKey("pkcs8", deSpki(privadaPem), { name: "Ed25519" }, false, ["sign"]);
  const cab = b64u(new TextEncoder().encode(JSON.stringify({ alg: "EdDSA", typ: "JWT" })));
  const agora = Math.floor(Date.now() / 1000);
  const corpo = b64u(new TextEncoder().encode(JSON.stringify({ aud, iat: agora, exp: agora + 120, jti: crypto.randomUUID(), pedido })));
  const sig = await crypto.subtle.sign({ name: "Ed25519" }, chave, new TextEncoder().encode(`${cab}.${corpo}`));
  return `${cab}.${corpo}.${b64u(sig)}`;
}

/** Verifica a assinatura, a validade e o destinatário. Devolve o pedido ou lança erro. */
export async function verificar(publicaPem: string, aud: string, token: string): Promise<Pedido> {
  const [cab, corpo, sig] = token.split(".");
  if (!cab || !corpo || !sig) throw new Error("token inválido");
  const chave = await crypto.subtle.importKey("spki", deSpki(publicaPem), { name: "Ed25519" }, false, ["verify"]);
  const ok = await crypto.subtle.verify({ name: "Ed25519" }, chave, deB64u(sig), new TextEncoder().encode(`${cab}.${corpo}`));
  if (!ok) throw new Error("assinatura inválida");
  const p = JSON.parse(new TextDecoder().decode(deB64u(corpo))) as { aud: string; exp: number; pedido: Pedido };
  if (p.aud !== aud) throw new Error("destinatário errado");
  if (Math.floor(Date.now() / 1000) > p.exp) throw new Error("pedido expirado");
  return p.pedido;
}

/** Executa um pedido já verificado (usado pela função `admin`). */
export async function executar(c: Ctx, p: Pedido): Promise<unknown> {
  switch (p.acao) {
    case "listar":
      return await listarUtilizadores(c);
    case "criar":
      return await criarUtilizador(c, p as unknown as NovoUtilizador);
    case "suspender":
      return await suspender(c, String(p.id), !!p.suspenso), { ok: true };
    case "remover":
      return await remover(c, String(p.id)), { ok: true };
    case "estado":
      return await estado(c);
    default:
      throw new Error("ação desconhecida");
  }
}
