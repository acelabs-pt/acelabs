// Acessos ao Cockpit a partir da Torre: ver se uma pessoa já tem conta, criar a conta (empresa + convite por email) e reenviar o link
// para escolher a password.
// Quem chama é a Torre (servidor), com um segredo próprio no cabeçalho "x-torre-token" (diferente do do feedback: criar contas é
// mais do que ler reportes). A chave de administrador nunca sai daqui.
// Publicar SEM verificação de sessão, porque a Torre não tem sessão neste projeto:
//   supabase functions deploy gerir-acessos --no-verify-jwt
// Segredo (o mesmo valor vai para a Torre, na variável COCKPIT_ACESSOS_TOKEN): supabase secrets set ACESSOS_TOKEN=<texto longo e aleatório>
//
// Pedidos (sempre POST, JSON):
//   { acao: "estado", email }                                     conta, empresa e se já entrou; lista das empresas
//   { acao: "criar", email, nome, empresa, empresa_nome?, responsavel?, quem }
//        empresa = código. Se não existir, cria-a (precisa de empresa_nome) em estado piloto. Envia o convite e junta a pessoa.
//        modo: "password" cria a conta já com uma password temporária (devolvida uma vez), sem email.
//   { acao: "reenviar", email, quem }                             email para escolher a password (serve quando o convite expirou)
//   { acao: "nova_password", email, quem }                        password temporária nova para quem já tem conta (sem email)
// Cada criação e reenvio fica na tabela auditoria (quem = "torre:<sócio>").

import { createClient } from "npm:@supabase/supabase-js@2";

const APP = "https://cockpit.acelabs.pt";
const DESTINO = `${APP}/nova-password`;
// Empresas que são nossas: nunca se põem clientes lá dentro.
const RESERVADAS = ["demo", "ensaio"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODIGO = /^[a-z0-9-]{2,40}$/;

function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Password temporária fácil de ditar: sem letras que se confundem (0/O, 1/l/I). Ex.: "Cockpit-7Kmq-4Xtw". */
function passwordTemporaria(): string {
  const letras = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const s = Array.from(bytes, (b) => letras[b % letras.length]).join("");
  return `Cockpit-${s.slice(0, 4)}-${s.slice(4)}`;
}

const responder = (corpo: unknown, status = 200) => Response.json(corpo, { status });
const erro = (msg: string, status = 400) => responder({ erro: msg }, status);

Deno.serve(async (req) => {
  const esperado = Deno.env.get("ACESSOS_TOKEN") ?? "";
  const dado = req.headers.get("x-torre-token") ?? "";
  if (esperado.length < 24 || !igual(dado, esperado)) return erro("Não autorizado.", 401);
  if (req.method !== "POST") return erro("Usar POST.", 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, chave, { auth: { persistSession: false } });
  const H = { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" };

  const p = await req.json().catch(() => ({}));
  const acao = String(p.acao ?? "");
  const email = String(p.email ?? "").trim().toLowerCase();
  const quem = `torre:${String(p.quem ?? "?").trim().toLowerCase().slice(0, 30)}`;
  if (!EMAIL.test(email)) return erro("Email inválido.");

  // Utilizador pelo email (a API de administração não procura por email: percorre as páginas).
  const acharUtilizador = async () => {
    for (let pagina = 1; pagina <= 50; pagina++) {
      const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 1000 });
      if (error) throw new Error("Não foi possível ler as contas.");
      const u = data.users.find((x) => x.email?.toLowerCase() === email);
      if (u) return u;
      if (data.users.length < 1000) return null;
    }
    return null;
  };
  const empresaDe = async (userId: string) => {
    const { data } = await sb.from("membros").select("empresa_id, empresas(codigo, nome, suspensa)").eq("user_id", userId).maybeSingle();
    const e = (data as { empresas?: { codigo: string; nome: string; suspensa: boolean } } | null)?.empresas;
    return e ? { codigo: e.codigo, nome: e.nome, suspensa: e.suspensa } : null;
  };
  const auditar = (empresa_id: string | null, empresa_codigo: string | null, acaoAud: string) =>
    sb.from("auditoria").insert({ quem, empresa_id, empresa_codigo, acao: acaoAud, detalhe: { email } });

  try {
    if (acao === "estado") {
      const u = await acharUtilizador();
      const { data: es } = await sb.from("empresas").select("codigo, nome, suspensa").order("nome");
      const empresas = (es ?? []).filter((e) => !RESERVADAS.includes(e.codigo) && !e.suspensa).map((e) => ({ codigo: e.codigo, nome: e.nome }));
      if (!u) return responder({ utilizador: null, empresa: null, empresas });
      return responder({
        utilizador: { convidado_em: u.invited_at ?? u.created_at, ultimo_acesso: u.last_sign_in_at ?? null },
        empresa: await empresaDe(u.id),
        empresas,
      });
    }

    if (acao === "reenviar") {
      const u = await acharUtilizador();
      if (!u) return erro("Este email ainda não tem conta no Cockpit.");
      const r = await fetch(`${url}/auth/v1/recover?redirect_to=${encodeURIComponent(DESTINO)}`, { method: "POST", headers: H, body: JSON.stringify({ email }) });
      if (!r.ok) {
        const c = await r.json().catch(() => ({}));
        return erro(r.status === 429 ? "Já foi enviado um email há pouco. Espera um minuto e tenta outra vez." : `O Supabase recusou o envio (${c.msg ?? c.message ?? r.status}).`);
      }
      const e = await empresaDe(u.id);
      await auditar(null, e?.codigo ?? null, "reenviar_link");
      return responder({ ok: true });
    }

    if (acao === "criar") {
      const nome = String(p.nome ?? "").trim().slice(0, 120);
      const codigo = String(p.empresa ?? "").trim().toLowerCase();
      const empresaNome = String(p.empresa_nome ?? "").trim().slice(0, 120);
      const responsavel = ["pedro", "miguel"].includes(String(p.responsavel ?? "")) ? String(p.responsavel) : null;
      if (!CODIGO.test(codigo)) return erro("O código da empresa só pode ter letras minúsculas, números e hífens (2 a 40).");
      if (RESERVADAS.includes(codigo)) return erro(`A empresa "${codigo}" é da Ace Labs: escolhe ou cria a empresa do cliente.`);

      const existente = await acharUtilizador();
      if (existente) {
        const e = await empresaDe(existente.id);
        return erro(e ? `Este email já tem conta no Cockpit, na empresa ${e.nome} (${e.codigo}).` : "Este email já tem conta no Cockpit, sem empresa. Fala com o Pedro.");
      }

      // Empresa: a que existe com este código, ou uma nova.
      let { data: emp } = await sb.from("empresas").select("id, codigo, nome, suspensa").eq("codigo", codigo).maybeSingle();
      let criada = false;
      if (emp?.suspensa) return erro(`A empresa ${emp.nome} está suspensa. Reativa-a antes de convidar alguém.`);
      if (!emp) {
        if (!empresaNome) return erro("Falta o nome da empresa nova.");
        const { data: nova, error } = await sb.from("empresas").insert({ codigo, nome: empresaNome }).select("id, codigo, nome, suspensa").single();
        if (error || !nova) return erro("Não foi possível criar a empresa.", 500);
        emp = nova;
        criada = true;
        await sb.from("empresas_admin").update({ estado: "piloto", responsavel, contacto_nome: nome || null, contacto_email: email }).eq("empresa_id", nova.id);
        await auditar(nova.id, nova.codigo, "criar_empresa");
      }

      // Com password temporária: a conta fica pronta logo, sem depender do email. Sem ela: convite por email.
      const comPassword = p.modo === "password";
      const temporaria = comPassword ? passwordTemporaria() : null;
      let c: { id?: string; msg?: string; message?: string } = {};
      let estado = 0;
      if (comPassword) {
        const { data, error } = await sb.auth.admin.createUser({ email, password: temporaria!, email_confirm: true, user_metadata: nome ? { nome } : {} });
        c = { id: data.user?.id, msg: error?.message };
        estado = error ? 500 : 200;
      } else {
        // O destino vai no endereço (?redirect_to=): no corpo o Supabase ignora-o e o link ia para o login.
        const r = await fetch(`${url}/auth/v1/invite?redirect_to=${encodeURIComponent(DESTINO)}`, {
          method: "POST",
          headers: H,
          body: JSON.stringify({ email, data: nome ? { nome } : {} }),
        });
        c = await r.json().catch(() => ({}));
        estado = r.status;
      }
      if (!c.id) {
        if (criada) await sb.from("empresas").delete().eq("id", emp.id); // não deixar uma empresa vazia por uma conta falhada
        return erro(`Não foi possível criar a conta (${c.msg ?? c.message ?? estado}).`, 502);
      }
      const { error: em } = await sb.from("membros").insert({ user_id: c.id, empresa_id: emp.id });
      if (em) {
        await sb.auth.admin.deleteUser(c.id);
        if (criada) await sb.from("empresas").delete().eq("id", emp.id);
        return erro("Não foi possível juntar a pessoa à empresa. Nada ficou criado.", 500);
      }
      await auditar(emp.id, emp.codigo, comPassword ? "criar_com_password_temporaria" : "convidar");
      return responder({ ok: true, empresa: { codigo: emp.codigo, nome: emp.nome }, empresa_criada: criada, password: temporaria });
    }

    if (acao === "nova_password") {
      // Plano B para quem já tem conta: password temporária nova, sem email. A pessoa muda-a em Conta.
      const u = await acharUtilizador();
      if (!u) return erro("Este email ainda não tem conta no Cockpit.");
      const temporaria = passwordTemporaria();
      const { error } = await sb.auth.admin.updateUserById(u.id, { password: temporaria, email_confirm: true });
      if (error) return erro("Não foi possível mudar a password.", 500);
      const e = await empresaDe(u.id);
      await auditar(null, e?.codigo ?? null, "password_temporaria");
      return responder({ ok: true, password: temporaria });
    }

    return erro("Ação desconhecida.");
  } catch (e) {
    return erro(e instanceof Error ? e.message : "Erro inesperado.", 500);
  }
});
