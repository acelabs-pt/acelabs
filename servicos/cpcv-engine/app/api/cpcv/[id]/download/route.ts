import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";

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
  const { data: blob, error } = await supabase.storage.from("cpcv-documentos").download(path);

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
    },
  });
}
