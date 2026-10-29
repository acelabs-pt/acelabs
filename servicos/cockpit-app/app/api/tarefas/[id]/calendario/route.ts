import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { eDiaInteiro, gerarIcs, nomeFicheiroIcs } from "@/lib/ics";

// Descarrega uma tarefa ou marcação como ficheiro de calendário (.ics), para o calendário do telemóvel
// avisar na hora. Lê com a sessão do agente (RLS): pelo id, sem nomes de clientes no endereço.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sb = await sbUserServer();
  const { data: t } = await sb
    .from("tarefas")
    .select("id, titulo, tipo, inicio, fim, comprador_id, proprietario_id, contacto_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!t) return NextResponse.json({ erro: "Tarefa não encontrada." }, { status: 404 });
  if (!t.inicio) return NextResponse.json({ erro: "A tarefa não tem data." }, { status: 400 });

  let telefone: string | null = null;
  let url = `${req.nextUrl.origin}/calendario`;
  if (t.comprador_id) {
    const { data } = await sb.from("compradores").select("contactos(telemovel)").eq("id", t.comprador_id).maybeSingle();
    telefone = (data?.contactos as unknown as { telemovel: string | null } | null)?.telemovel ?? null;
    url = `${req.nextUrl.origin}/crm/compradores/${t.comprador_id}`;
  } else if (t.proprietario_id) {
    const { data } = await sb.from("proprietarios").select("contactos(telemovel)").eq("id", t.proprietario_id).maybeSingle();
    telefone = (data?.contactos as unknown as { telemovel: string | null } | null)?.telemovel ?? null;
    url = `${req.nextUrl.origin}/crm/proprietarios/${t.proprietario_id}`;
  } else if (t.contacto_id) {
    const { data } = await sb.from("contactos").select("telemovel").eq("id", t.contacto_id).maybeSingle();
    telefone = data?.telemovel ?? null;
  }

  // A app do iPhone pede os dados em JSON para criar o evento direto na agenda (lib/nativo.ts).
  if (req.nextUrl.searchParams.get("formato") === "json") {
    return NextResponse.json(
      { titulo: t.titulo, inicio: t.inicio, fim: t.fim, diaInteiro: eDiaInteiro(t.inicio), telefone, url },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const ics = gerarIcs({ id: t.id, titulo: t.titulo, tipo: t.tipo, inicio: t.inicio, fim: t.fim, telefone, url });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${nomeFicheiroIcs(t.titulo)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
