import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { sbServer } from "@/lib/supabase";

// GET route handlers ficam sujeitos ao Full Route Cache do Next.js por omissão - este export
// evita isso do lado do servidor.
export const dynamic = "force-dynamic";

const CONTENT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const tipo = req.nextUrl.searchParams.get("tipo");
  if (tipo !== "pdf" && tipo !== "docx") {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }

  const { data: processo } = await supabase
    .from("cpcv_processos")
    .select("pdf_path, docx_path")
    .eq("id", id)
    .single();

  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  const path = tipo === "pdf" ? processo.pdf_path : processo.docx_path;
  if (!path) {
    return NextResponse.json({ error: "Documento ainda não gerado." }, { status: 404 });
  }

  // Descarregamos o ficheiro do Storage e devolvemo-lo nós próprios (em vez de redireccionar
  // para um URL assinado da Supabase) - um URL assinado passa por um redirect interno que perde
  // o nome de ficheiro, e o browser acaba por gravar o UUID do objecto em vez de "cpcv.docx".
  // Servindo directamente do nosso domínio controlamos o Content-Disposition sem esse problema.
  //
  // Usa o cliente de serviço (bypassa RLS) só para este passo - a autorização a este processo
  // já foi validada acima, com o cliente da sessão do utilizador, ao ler pdf_path/docx_path.
  // Testado em sessão de QA (Fase 12): ler o mesmo caminho logo a seguir a uma segunda geração
  // (mesmo ficheiro, upsert) através do cliente da sessão devolvia sempre a versão anterior,
  // mesmo bastante tempo depois e mesmo já sem nenhum cache do lado do browser ou do Next.js -
  // consistente com o Storage da Supabase servir pedidos autenticados (não de serviço) a partir
  // de uma camada com propagação mais lenta após um upsert. O cliente de serviço devolveu
  // sempre o conteúdo actual em todos os testes.
  const { data: blob, error } = await sbServer().storage.from("cpcv-documentos").download(path);

  if (error || !blob) {
    return NextResponse.json(
      { error: `Erro ao obter o documento: ${error?.message ?? "desconhecido"}` },
      { status: 500 }
    );
  }

  const buffer = Buffer.from(await blob.arrayBuffer());

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": CONTENT_TYPE[tipo],
      "Content-Disposition": `attachment; filename="cpcv.${tipo}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
