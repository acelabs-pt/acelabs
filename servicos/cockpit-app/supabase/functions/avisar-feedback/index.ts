// Avisa os sócios por email quando alguém do beta usa "Reportar um problema".
// A app chama esta função logo depois de gravar o reporte, com a sessão do utilizador. A função confirma que o reporte é
// dessa pessoa (e recente), lê-o com a chave de administrador (que nunca sai daqui), gera links de 7 dias para a captura e
// o áudio e envia o email pelo Resend. Se o email falhar, o reporte já está gravado: nada se perde.
// Publicar COM verificação de sessão (o normal): supabase functions deploy avisar-feedback
// Segredo: RESEND_API_KEY (supabase secrets set RESEND_API_KEY=...). Opcional: FEEDBACK_PARA (emails separados por vírgula).

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const SETE_DIAS = 60 * 60 * 24 * 7;
const PARA_POR_OMISSAO = ["pedro@acelabs.pt", "miguel@acelabs.pt"];

const escapar = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = Deno.env.get("SUPABASE_URL")!;
  const quem = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: u } = await quem.auth.getUser();
  if (!u.user) return Response.json({ erro: "Sessão inválida." }, { status: 401, headers: CORS });

  const { id } = await req.json().catch(() => ({ id: null }));
  if (typeof id !== "string") return Response.json({ erro: "Falta o id do reporte." }, { status: 400, headers: CORS });

  const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: f } = await sb.from("feedback").select("*").eq("id", id).maybeSingle();
  if (!f || f.user_id !== u.user.id) return Response.json({ erro: "Reporte não encontrado." }, { status: 404, headers: CORS });
  // Só avisa de reportes acabados de criar (evita reenviar o mesmo email vezes sem conta).
  if (Date.now() - new Date(f.criado_em).getTime() > 10 * 60 * 1000) return Response.json({ ok: true, ignorado: true }, { headers: CORS });

  const chave = Deno.env.get("RESEND_API_KEY");
  if (!chave) return Response.json({ ok: false, erro: "Sem RESEND_API_KEY: reporte gravado, email não enviado." }, { headers: CORS });

  const { data: empresa } = await sb.from("empresas").select("nome, codigo").eq("id", f.empresa_id).maybeSingle();
  const link = async (p: string | null) => (p ? (await sb.storage.from("feedback").createSignedUrl(p, SETE_DIAS)).data?.signedUrl ?? null : null);
  const [captura, audio] = await Promise.all([link(f.captura_path), link(f.audio_path)]);
  const ap = (f.aparelho ?? {}) as Record<string, unknown>;
  const tipo = f.tipo === "sugestao" ? "Sugestão" : "Erro";
  const quemNome = (u.user.user_metadata?.nome as string | undefined) || u.user.email || u.user.id;

  const linhas: [string, string][] = [
    ["Empresa", `${empresa?.nome ?? "?"} (${empresa?.codigo ?? "?"})`],
    ["Quem", `${quemNome}${u.user.email && quemNome !== u.user.email ? ` (${u.user.email})` : ""}`],
    ["Quando", new Date(f.criado_em).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" })],
    ["Página", f.pagina ?? "?"],
    ["Aparelho", `${ap.nativa ? "App nativa" : "Web"}, ecrã ${ap.ecra ?? "?"}, versão ${f.versao ?? "?"}`],
    ["Navegador", String(ap.userAgent ?? "?")],
  ];
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1d1d1f;max-width:620px">
<h2 style="margin:0 0 12px">${tipo} reportado no Cockpit</h2>
${f.texto ? `<p style="white-space:pre-wrap;background:#f5f5f7;border-radius:12px;padding:12px 14px">${escapar(f.texto)}</p>` : "<p><em>Sem texto.</em></p>"}
<p>${captura ? `<a href="${captura}">Ver a captura do ecrã</a>` : "Sem captura."}<br>${audio ? `<a href="${audio}">Ouvir o áudio</a>` : "Sem áudio."}</p>
<table style="border-collapse:collapse;font-size:13px;color:#6e6e73">${linhas.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;vertical-align:top">${k}</td><td style="padding:2px 0">${escapar(v)}</td></tr>`).join("")}</table>
<p style="font-size:12px;color:#6e6e73">Os links valem 7 dias. Reporte ${escapar(f.id)}.</p></div>`;

  const para = (Deno.env.get("FEEDBACK_PARA") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Cockpit <cockpit@acelabs.pt>",
      to: para.length ? para : PARA_POR_OMISSAO,
      reply_to: u.user.email ?? undefined,
      subject: `[Cockpit beta] ${tipo} de ${quemNome} em ${f.pagina ?? "?"}`,
      html,
    }),
  });
  if (!r.ok) return Response.json({ ok: false, erro: `Resend respondeu ${r.status}.` }, { headers: CORS });
  return Response.json({ ok: true }, { headers: CORS });
});
