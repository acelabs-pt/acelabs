// Chamado uma vez por dia pela Vercel (vercel.json, "crons"). O Supabase grátis pausa o projeto ao fim de 7 dias sem
// atividade; um pedido diário à base de dados mantém-no ligado. Não lê dados: a chave anon não tem acesso a nada.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && req.headers.get("authorization") !== `Bearer ${segredo}`) return new Response("não", { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const r = await fetch(`${url}/rest/v1/categorias?select=id&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    cache: "no-store",
  });
  return Response.json({ ok: true, supabase: r.status });
}
