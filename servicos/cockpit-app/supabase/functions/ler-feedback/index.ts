// Centro de feedback da Torre: devolve os reportes feitos no Cockpit ("Reportar um problema") com links temporários para a captura e o
// áudio, e deixa marcar o estado (novo, visto, resolvido).
// Quem chama é a Torre (servidor), com um segredo partilhado no cabeçalho "x-torre-token". A chave de administrador nunca sai daqui.
// Publicar SEM verificação de sessão, porque a Torre não tem sessão neste projeto:
//   supabase functions deploy ler-feedback --no-verify-jwt
// Segredo (o mesmo valor vai para a Torre, na variável COCKPIT_FEEDBACK_TOKEN): supabase secrets set FEEDBACK_LEITURA_TOKEN=<texto longo e aleatório>

import { createClient } from "npm:@supabase/supabase-js@2";

const HORA = 60 * 60;
const ESTADOS = ["novo", "visto", "resolvido"];

function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  const esperado = Deno.env.get("FEEDBACK_LEITURA_TOKEN") ?? "";
  const dado = req.headers.get("x-torre-token") ?? "";
  if (esperado.length < 24 || !igual(dado, esperado)) return Response.json({ erro: "Não autorizado." }, { status: 401 });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (req.method === "POST") {
    const { id, estado } = await req.json().catch(() => ({ id: null, estado: null }));
    if (typeof id !== "string" || !ESTADOS.includes(estado)) return Response.json({ erro: "Pedido inválido." }, { status: 400 });
    const { error } = await sb.from("feedback").update({ estado }).eq("id", id);
    return error ? Response.json({ erro: "Não foi possível guardar." }, { status: 500 }) : Response.json({ ok: true });
  }

  const { data: linhas, error } = await sb.from("feedback").select("*").order("criado_em", { ascending: false }).limit(300);
  if (error) return Response.json({ erro: "Não foi possível ler." }, { status: 500 });

  const empresas = new Map<string, string>();
  const { data: es } = await sb.from("empresas").select("id, nome");
  for (const e of es ?? []) empresas.set(e.id, e.nome);

  const emails = new Map<string, string>();
  for (const uid of new Set((linhas ?? []).map((l) => l.user_id).filter(Boolean))) {
    const { data } = await sb.auth.admin.getUserById(uid as string);
    if (data.user?.email) emails.set(uid as string, data.user.email);
  }

  const link = async (p: string | null) => (p ? (await sb.storage.from("feedback").createSignedUrl(p, HORA)).data?.signedUrl ?? null : null);
  const saida = await Promise.all(
    (linhas ?? []).map(async (l) => ({
      id: l.id,
      criado_em: l.criado_em,
      tipo: l.tipo,
      texto: l.texto,
      pagina: l.pagina,
      estado: l.estado,
      versao: l.versao,
      aparelho: l.aparelho,
      empresa: empresas.get(l.empresa_id) ?? null,
      email: l.user_id ? emails.get(l.user_id) ?? null : null,
      captura: await link(l.captura_path),
      audio: await link(l.audio_path),
    }))
  );
  return Response.json({ feedback: saida });
});
