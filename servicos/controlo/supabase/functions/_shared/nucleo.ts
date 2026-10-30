// Núcleo da administração de um cliente: listar, convidar/criar, suspender e remover utilizadores, e ver o estado
// da instalação. Só usa fetch e WebCrypto (sem APIs do Deno nem do Node), por isso corre nos dois sítios:
//  - na app de controlo (modo "chave": com a chave de administrador do cliente guardada só no computador de quem a usa);
//  - na função `admin` publicada no Supabase de CADA cliente (modo "funcao": a chave de administrador nunca sai de lá,
//    e a app de controlo só envia pedidos assinados).

export type Produto = "cockpit" | "cpcv";
// codigoApp: código do cliente na app Cockpit com vários clientes num deploy; o convite abre /convite/<código>.
// empresa: código da empresa quando o Cockpit corre num projeto Supabase PARTILHADO (migracao_multiempresa.sql). Com ele, listar,
// criar, suspender e remover só tocam em contas dessa empresa. Sem ele o projeto é de um só cliente (modo antigo).
// quem: quem pediu a ação (pedro ou miguel), para o registo de ações. Na função `admin` vem da chave que assinou o pedido.
export type Ctx = { url: string; chave: string; produto: Produto; appUrl?: string; codigoApp?: string; empresa?: string; quem?: string };

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

/** O id da empresa deste contexto, no Cockpit partilhado. Sem c.empresa devolve null (projeto de um só cliente). */
async function empresaDe(c: Ctx): Promise<string | null> {
  if (c.produto !== "cockpit" || !c.empresa) return null;
  const r = await pedir(c, `/rest/v1/empresas?select=id&codigo=eq.${encodeURIComponent(c.empresa.toLowerCase())}`);
  if (!r.ok) throw new Error("Este projeto ainda não tem várias empresas (corre migracao_multiempresa.sql em Estado).");
  const id = (r.corpo as Array<{ id: string }>)[0]?.id;
  if (!id) throw new Error(`Não existe a empresa "${c.empresa}" neste projeto. Cria-a primeiro (scripts/empresa.mjs no Cockpit).`);
  return id;
}

/** Antes de agir sobre uma conta: tem de ser membro DESTA empresa (a plataforma nunca toca em contas de outra). */
async function garantirDaEmpresa(c: Ctx, id: string): Promise<void> {
  const emp = await empresaDe(c);
  if (!emp) return;
  const r = await pedir(c, `/rest/v1/membros?select=user_id&user_id=eq.${encodeURIComponent(id)}&empresa_id=eq.${emp}`);
  if (!r.ok || !(r.corpo as unknown[])?.length) throw new Error("Esta conta não pertence a esta empresa.");
}

export async function listarUtilizadores(c: Ctx): Promise<Utilizador[]> {
  const emp = await empresaDe(c);
  let users: Array<Record<string, string | null>>;
  if (emp) {
    // Projeto partilhado: vão buscar-se só as contas dos membros desta empresa (a lista global tem as de todos os clientes).
    const m = await pedir(c, `/rest/v1/membros?select=user_id&empresa_id=eq.${emp}`);
    if (!m.ok) throw new Error("Não foi possível listar os membros da empresa.");
    const ids = (m.corpo as Array<{ user_id: string }>).map((x) => x.user_id);
    const contas = await Promise.all(ids.map((id) => pedir(c, `/auth/v1/admin/users/${id}`)));
    users = contas.filter((x) => x.ok && x.corpo).map((x) => x.corpo as Record<string, string | null>);
  } else {
    const r = await pedir(c, "/auth/v1/admin/users?per_page=200");
    if (!r.ok) throw new Error("Não foi possível listar os utilizadores. Confirma o endereço e a chave do cliente.");
    users = ((r.corpo as { users?: Array<Record<string, unknown>> })?.users ?? []) as Array<Record<string, string | null>>;
  }

  let nomes = new Map<string, { nome: string; papel: string }>();
  let membros: Set<string> | null = null;
  if (c.produto === "cpcv") {
    const p = await pedir(c, "/rest/v1/profiles?select=id,nome,role");
    if (p.ok) nomes = new Map((p.corpo as Array<{ id: string; nome: string; role: string }>).map((x) => [x.id, { nome: x.nome, papel: x.role }]));
  } else {
    const m = await pedir(c, emp ? `/rest/v1/membros?select=user_id&empresa_id=eq.${emp}` : "/rest/v1/membros?select=user_id");
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

  // Cockpit partilhado: a empresa tem de ser conhecida ANTES de convidar (senão ficava um convite sem empresa).
  let emp = await empresaDe(c);
  if (c.produto === "cockpit" && !emp) {
    const todas = await pedir(c, "/rest/v1/empresas?select=id");
    if (todas.ok && (todas.corpo as unknown[]).length > 1) throw new Error("Este projeto tem várias empresas: indica o código da empresa deste cliente.");
    emp = todas.ok ? ((todas.corpo as Array<{ id: string }>)[0]?.id ?? null) : null;
  }

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
      : await pedir(c, "/rest/v1/membros", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(emp ? { user_id: id, empresa_id: emp } : { user_id: id }) });
  if (!perfil.ok) {
    // não deixar uma conta a meio: apagar a conta acabada de criar e dizer porquê
    await pedir(c, `/auth/v1/admin/users/${id}`, { method: "DELETE" });
    throw new Error(
      perfil.status === 404
        ? "A base de dados deste cliente ainda não tem as tabelas (corre as migrações em Estado)."
        : "A conta foi criada mas o perfil falhou, por isso foi anulada. Confirma as migrações em Estado."
    );
  }
  await registar(c, "utilizador.criar", { email, modo: n.modo, papel }, emp, c.empresa ?? null);
  return { id, passwordTemporaria: pass };
}

async function emailDe(c: Ctx, id: string): Promise<string> {
  const r = await pedir(c, `/auth/v1/admin/users/${id}`);
  return r.ok ? String((r.corpo as { email?: string })?.email ?? "") : "";
}

export async function suspender(c: Ctx, id: string, suspenso: boolean): Promise<void> {
  await garantirDaEmpresa(c, id);
  // "876000h" é um ban de 100 anos; "none" levanta-o. A conta e os dados ficam intactos.
  const r = await pedir(c, `/auth/v1/admin/users/${id}`, { method: "PUT", body: JSON.stringify({ ban_duration: suspenso ? "876000h" : "none" }) });
  if (!r.ok) throw new Error("Não foi possível alterar o estado da conta.");
  await registar(c, suspenso ? "utilizador.suspender" : "utilizador.reativar", { email: await emailDe(c, id) }, await empresaDe(c), c.empresa ?? null);
}

export async function remover(c: Ctx, id: string): Promise<void> {
  await garantirDaEmpresa(c, id);
  const email = await emailDe(c, id);
  if (c.produto === "cpcv") await pedir(c, `/rest/v1/profiles?id=eq.${id}`, { method: "DELETE" });
  else await pedir(c, `/rest/v1/membros?user_id=eq.${id}`, { method: "DELETE" });
  const r = await pedir(c, `/auth/v1/admin/users/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Não foi possível apagar a conta.");
  await registar(c, "utilizador.remover", { email }, await empresaDe(c), c.empresa ?? null);
}

export type Verificacao = { ok: boolean; texto: string; conselho?: string };

const TABELAS: Record<Produto, Array<[string, string, string]>> = {
  cockpit: [
    ["contactos", "Tabelas base", "create_tables.sql"],
    ["membros", "Lista de membros (só convidados veem dados)", "migracao_seguranca.sql"],
    ["push_subscricoes", "Notificações push", "migracao_notificacoes.sql"],
    ["empresas", "Várias empresas no mesmo projeto (isolamento por cliente)", "migracao_multiempresa.sql"],
    ["empresas_admin", "Administração das empresas e registo de ações", "migracao_admin.sql"],
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
  if (c.produto === "cockpit" && c.empresa) {
    const e = await pedir(c, `/rest/v1/empresas?select=nome,suspensa&codigo=eq.${encodeURIComponent(c.empresa.toLowerCase())}`);
    const linha = e.ok ? (e.corpo as Array<{ nome: string; suspensa: boolean }>)[0] : undefined;
    v.push({
      ok: !!linha && !linha.suspensa,
      texto: linha ? `Empresa "${c.empresa}": ${linha.nome}${linha.suspensa ? " (SUSPENSA)" : ""}` : `Empresa "${c.empresa}"`,
      conselho: !linha ? "Não existe: cria-a com scripts/empresa.mjs no Cockpit." : linha.suspensa ? "Os membros não veem dados enquanto estiver suspensa." : undefined,
    });
  }
  if (c.produto === "cockpit") {
    // Chamada sem sessão: a função recusa (auth.uid() é nulo) e não apaga nada; só interessa se existe (404 = falta a migração).
    const r = await pedir(c, "/rest/v1/rpc/apagar_minha_conta", { method: "POST", body: "{}" });
    const p = await pedir(c, "/rest/v1/rpc/registar_push_ios", { method: "POST", body: JSON.stringify({ p_token: "x" }) });
    const an = await pedir(c, "/rest/v1/rpc/registar_push_nativo", { method: "POST", body: JSON.stringify({ p_token: "x", p_tipo: "android" }) });
    v.push({ ok: p.status !== 404, texto: "Notificações do iPhone (registo de aparelhos)", conselho: p.status !== 404 ? undefined : "Volta a correr migracao_notificacoes.sql neste projeto." });
    v.push({ ok: an.status !== 404, texto: "Notificações do Android (registo de aparelhos)", conselho: an.status !== 404 ? undefined : "Volta a correr migracao_notificacoes.sql neste projeto." });
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
// Administração das EMPRESAS do Cockpit partilhado (migracao_admin.sql): painel, dados internos, estado e registo de ações.
// Só fazem sentido no projeto partilhado; num projeto de um só cliente falham com uma mensagem a explicar.
// ---------------------------------------------------------------------------------------------

export const ESTADOS_EMPRESA = ["piloto", "ativa", "suspensa", "terminada"] as const;
export type EstadoEmpresa = (typeof ESTADOS_EMPRESA)[number];

export type EmpresaResumo = {
  id: string;
  codigo: string;
  nome: string;
  estado: EstadoEmpresa;
  suspensa: boolean;
  criada_em: string;
  inicio: string;
  contacto_nome: string | null;
  contacto_email: string | null;
  responsavel: string | null;
  notas: string | null;
  utilizadores: number;
  convites_por_aceitar: number;
  ultimo_acesso: string | null;
  aparelhos: number;
  compradores: number;
  proprietarios: number;
  angariacoes: number;
  tarefas: number;
  atividade_7d: number;
};

export type DadosEmpresa = {
  nome?: string;
  contacto_nome?: string;
  contacto_email?: string;
  responsavel?: string;
  notas?: string;
  inicio?: string;
};

export type EntradaAuditoria = { id: number; quando: string; quem: string; empresa_codigo: string | null; acao: string; detalhe: Record<string, unknown> };

const MIGRAR_ADMIN = "Falta a migração da administração: corre migracao_admin.sql no SQL Editor deste projeto.";

function codigoValido(codigo: string): string {
  const c = codigo.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(c)) throw new Error("O código da empresa só pode ter letras minúsculas, números e hífens (2 a 40).");
  return c;
}

/** Escreve no registo de ações. Num projeto sem a migração (404) ignora; qualquer outra falha é um erro, para nunca agir sem deixar rasto. */
export async function registar(c: Ctx, acao: string, detalhe: Record<string, unknown> = {}, empresaId: string | null = null, empresaCodigo: string | null = null): Promise<void> {
  const r = await pedir(c, "/rest/v1/auditoria", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ quem: c.quem ?? "desconhecido", empresa_id: empresaId, empresa_codigo: empresaCodigo ?? c.empresa ?? null, acao, detalhe }),
  });
  if (!r.ok && r.status !== 404) throw new Error("Não foi possível escrever no registo de ações.");
}

export async function listarEmpresas(c: Ctx): Promise<EmpresaResumo[]> {
  const r = await pedir(c, "/rest/v1/rpc/resumo_empresas", { method: "POST", body: "{}" });
  if (r.status === 404) throw new Error(MIGRAR_ADMIN);
  if (!r.ok) throw new Error("Não foi possível ler as empresas deste projeto.");
  return r.corpo as EmpresaResumo[];
}

export async function contasSemEmpresa(c: Ctx): Promise<Array<{ id: string; email: string; criado_em: string; ultimo_acesso: string | null }>> {
  const r = await pedir(c, "/rest/v1/rpc/contas_sem_empresa", { method: "POST", body: "{}" });
  if (r.status === 404) throw new Error(MIGRAR_ADMIN);
  if (!r.ok) throw new Error("Não foi possível ler as contas sem empresa.");
  return r.corpo as Array<{ id: string; email: string; criado_em: string; ultimo_acesso: string | null }>;
}

async function empresaPorCodigo(c: Ctx, codigo: string): Promise<{ id: string; codigo: string; nome: string }> {
  const r = await pedir(c, `/rest/v1/empresas?select=id,codigo,nome&codigo=eq.${encodeURIComponent(codigo)}`);
  if (r.status === 404) throw new Error("Este projeto ainda não tem várias empresas (corre migracao_multiempresa.sql).");
  const e = (r.corpo as Array<{ id: string; codigo: string; nome: string }>)?.[0];
  if (!r.ok || !e) throw new Error(`Não existe a empresa "${codigo}".`);
  return e;
}

function camposInternos(d: DadosEmpresa): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of ["contacto_nome", "contacto_email", "responsavel", "notas"] as const) if (d[k] !== undefined) o[k] = d[k]!.trim() || null;
  if (d.contacto_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.contacto_email.trim())) throw new Error("O email de contacto é inválido.");
  if (d.responsavel && !["pedro", "miguel"].includes(d.responsavel.trim().toLowerCase())) throw new Error("O responsável é o pedro ou o miguel (ou fica vazio).");
  if (typeof o.responsavel === "string") o.responsavel = o.responsavel.toLowerCase();
  if (d.inicio) {
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d.inicio)) throw new Error("A data de início tem de ser AAAA-MM-DD.");
    o.inicio = d.inicio;
  }
  return o;
}

export async function criarEmpresa(c: Ctx, codigo: string, nome: string, d: DadosEmpresa = {}): Promise<{ id: string; codigo: string }> {
  const cod = codigoValido(codigo);
  if (!nome.trim()) throw new Error("Indica o nome da empresa.");
  const interno = camposInternos(d);
  const r = await pedir(c, "/rest/v1/empresas", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ codigo: cod, nome: nome.trim() }) });
  if (r.status === 404) throw new Error("Este projeto ainda não tem várias empresas (corre migracao_multiempresa.sql).");
  if (r.status === 409) throw new Error(`Já existe uma empresa com o código "${cod}".`);
  const id = (r.corpo as Array<{ id: string }>)?.[0]?.id;
  if (!r.ok || !id) throw new Error("Não foi possível criar a empresa.");
  if (Object.keys(interno).length) {
    const u = await pedir(c, `/rest/v1/empresas_admin?empresa_id=eq.${id}`, { method: "PATCH", body: JSON.stringify(interno) });
    if (u.status === 404) throw new Error(MIGRAR_ADMIN);
  }
  await registar(c, "empresa.criar", { nome: nome.trim() }, id, cod);
  return { id, codigo: cod };
}

export async function atualizarEmpresa(c: Ctx, codigo: string, d: DadosEmpresa): Promise<void> {
  const e = await empresaPorCodigo(c, codigoValido(codigo));
  const interno = camposInternos(d);
  if (d.nome !== undefined) {
    if (!d.nome.trim()) throw new Error("O nome da empresa não pode ficar vazio.");
    const r = await pedir(c, `/rest/v1/empresas?id=eq.${e.id}`, { method: "PATCH", body: JSON.stringify({ nome: d.nome.trim() }) });
    if (!r.ok) throw new Error("Não foi possível mudar o nome.");
  }
  if (Object.keys(interno).length) {
    const r = await pedir(c, `/rest/v1/empresas_admin?empresa_id=eq.${e.id}`, { method: "PATCH", body: JSON.stringify(interno) });
    if (r.status === 404) throw new Error(MIGRAR_ADMIN);
    if (!r.ok) throw new Error("Não foi possível guardar os dados da empresa.");
  }
  // O registo guarda o que mudou, sem o texto das notas (podem ter dados pessoais): só se diz que mudaram.
  await registar(c, "empresa.atualizar", { campos: [...(d.nome !== undefined ? ["nome"] : []), ...Object.keys(interno)] }, e.id, e.codigo);
}

export async function definirEstadoEmpresa(c: Ctx, codigo: string, estado: string): Promise<void> {
  if (!(ESTADOS_EMPRESA as readonly string[]).includes(estado)) throw new Error("Estado inválido.");
  const e = await empresaPorCodigo(c, codigoValido(codigo));
  const parada = estado === "suspensa" || estado === "terminada";
  // Primeiro a flag que a base de dados usa para cortar o acesso, depois o estado (o gatilho só corrige estados incoerentes).
  const s = await pedir(c, `/rest/v1/empresas?id=eq.${e.id}`, { method: "PATCH", body: JSON.stringify({ suspensa: parada }) });
  if (!s.ok) throw new Error("Não foi possível alterar o acesso da empresa.");
  const r = await pedir(c, `/rest/v1/empresas_admin?empresa_id=eq.${e.id}`, { method: "PATCH", body: JSON.stringify({ estado }) });
  if (r.status === 404) throw new Error(MIGRAR_ADMIN);
  if (!r.ok) throw new Error("Não foi possível guardar o estado.");
  await registar(c, "empresa.estado", { estado }, e.id, e.codigo);
}

/** Apaga a empresa, os dados dela e as contas dos seus membros. Exige repetir o código da empresa. */
export async function apagarEmpresa(c: Ctx, codigo: string, confirmar: string): Promise<{ contasApagadas: number }> {
  const cod = codigoValido(codigo);
  if (confirmar.trim().toLowerCase() !== cod) throw new Error("Para apagar, escreve o código da empresa.");
  const e = await empresaPorCodigo(c, cod);
  const m = await pedir(c, `/rest/v1/membros?select=user_id&empresa_id=eq.${e.id}`);
  const ids = m.ok ? (m.corpo as Array<{ user_id: string }>).map((x) => x.user_id) : [];
  // Deixa o rasto ANTES de apagar: depois já não há empresa a que o ligar.
  await registar(c, "empresa.apagar", { nome: e.nome, contas: ids.length }, e.id, e.codigo);
  const r = await pedir(c, `/rest/v1/empresas?id=eq.${e.id}`, { method: "DELETE" });
  if (!r.ok) throw new Error("Não foi possível apagar a empresa.");
  let apagadas = 0;
  for (const id of ids) if ((await pedir(c, `/auth/v1/admin/users/${id}`, { method: "DELETE" })).ok) apagadas++;
  return { contasApagadas: apagadas };
}

export async function listarAuditoria(c: Ctx, empresa?: string, limite = 100): Promise<EntradaAuditoria[]> {
  const f = empresa ? `&empresa_codigo=eq.${encodeURIComponent(codigoValido(empresa))}` : "";
  const r = await pedir(c, `/rest/v1/auditoria?select=id,quando,quem,empresa_codigo,acao,detalhe&order=quando.desc&limit=${Math.min(Math.max(limite, 1), 500)}${f}`);
  if (r.status === 404) throw new Error(MIGRAR_ADMIN);
  if (!r.ok) throw new Error("Não foi possível ler o registo de ações.");
  return r.corpo as EntradaAuditoria[];
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
export async function executar(c0: Ctx, p: Pedido): Promise<unknown> {
  // A empresa vai dentro do pedido assinado (um projeto partilhado serve várias empresas).
  const c: Ctx = typeof p.empresa === "string" && p.empresa ? { ...c0, empresa: p.empresa.toLowerCase() } : c0;
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
    case "empresas":
      return await listarEmpresas(c);
    case "contas_sem_empresa":
      return await contasSemEmpresa(c);
    case "empresa_criar":
      return await criarEmpresa(c, String(p.codigo ?? ""), String(p.nome ?? ""), p.dados as DadosEmpresa | undefined);
    case "empresa_atualizar":
      return await atualizarEmpresa(c, String(p.codigo ?? ""), (p.dados ?? {}) as DadosEmpresa), { ok: true };
    case "empresa_estado":
      return await definirEstadoEmpresa(c, String(p.codigo ?? ""), String(p.estado ?? "")), { ok: true };
    case "empresa_apagar":
      return await apagarEmpresa(c, String(p.codigo ?? ""), String(p.confirmar ?? ""));
    case "auditoria":
      return await listarAuditoria(c, typeof p.empresa === "string" && p.empresa ? p.empresa : undefined, Number(p.limite) || 100);
    default:
      throw new Error("ação desconhecida");
  }
}
