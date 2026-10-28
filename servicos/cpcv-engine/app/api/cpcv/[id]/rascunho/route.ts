import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { gerarPdfCpcv } from "@/lib/cpcv-pdf";
import { gerarDocxCpcv } from "@/lib/cpcv-docx";
import { temGestaoTotal } from "@/lib/cpcv-auth";

// Sem isto, um GET route handler fica sujeito ao Full Route Cache do Next.js e podia servir um
// rascunho desactualizado para a mesma URL (mesmo processo, mesmo "?tipo=pdf/docx") mesmo depois
// de o processo ter sido editado - ver o mesmo problema, confirmado em sessão de QA, na rota de
// download (app/api/cpcv/[id]/download/route.ts).
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

  // Gerar um rascunho a qualquer momento (mesmo antes de aprovar) é só para a gestora
  // consultar - não grava nada no processo nem no Storage, ao contrário da aprovação.
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!temGestaoTotal(perfil?.role)) {
    return NextResponse.json({ error: "Só a gestora de processos pode gerar rascunhos." }, { status: 403 });
  }

  const tipo = req.nextUrl.searchParams.get("tipo");
  if (tipo !== "pdf" && tipo !== "docx") {
    return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
  }

  const { data: processo } = await supabase.from("cpcv_processos").select("*").eq("id", id).single();
  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  const { data: partes } = await supabase
    .from("cpcv_partes")
    .select(
      "papel, tipo_pessoa, nome, estado_civil, regime_bens, nacionalidade, naturalidade, nif, morada, documento_tipo, documento_numero, documento_validade, representante_nome, certidao_permanente, email, casal"
    )
    .eq("processo_id", id);

  const { data: hipotecas } = await supabase
    .from("cpcv_hipotecas")
    .select("entidade_credora, natureza, numero_apresentacao, data_registo")
    .eq("processo_id", id);

  let buffer: Buffer;
  try {
    // O Word também passa pelo PDF: é a paginação do PDF que dá o número de páginas usado como
    // valor inicial do campo NUMPAGES no Word (ver lib/cpcv-pdf.ts e lib/cpcv-docx.ts).
    const { pdf, paginas } = await gerarPdfCpcv(processo, partes ?? [], hipotecas ?? []);
    buffer = tipo === "pdf" ? pdf : await gerarDocxCpcv(processo, partes ?? [], hipotecas ?? [], paginas);
  } catch (e) {
    return NextResponse.json(
      { error: `Erro ao gerar o rascunho: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": CONTENT_TYPE[tipo],
      "Content-Disposition": `attachment; filename="cpcv-rascunho.${tipo}"`,
      "Content-Length": String(buffer.length),
      // Ver o comentário equivalente em app/api/cpcv/[id]/download/route.ts - mesmo URL a cada
      // pedido (mesmo processo, mesmo "?tipo="), por isso o browser tem de ser instruído a
      // nunca reutilizar uma resposta já recebida.
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}
