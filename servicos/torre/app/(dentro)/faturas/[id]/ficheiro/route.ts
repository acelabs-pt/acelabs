import { exigirSocio } from "@/lib/sessao";

// O ficheiro de uma fatura, servido pela Torre com a sessão de quem pede (o armazenamento é privado e o browser nunca fala
// com o Supabase). Pode aparecer dentro da página de revisão: ver os cabeçalhos em next.config.mjs.
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { s } = await exigirSocio();
  const { data: f } = await s.from("faturas").select("ficheiro, ficheiro_nome, ficheiro_tipo").eq("id", params.id).maybeSingle();
  if (!f?.ficheiro) return new Response("Não encontrado.", { status: 404 });
  const { data, error } = await s.storage.from("faturas").download(f.ficheiro);
  if (error || !data) return new Response("Não foi possível abrir o ficheiro.", { status: 502 });
  const nome = (f.ficheiro_nome ?? "fatura").replace(/[^\w.\- ]/g, "_");
  return new Response(data, {
    headers: {
      "Content-Type": f.ficheiro_tipo ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
