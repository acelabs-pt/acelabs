import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { gerarHtmlCpcv } from "@/lib/cpcv-template";
import { gerarDocxCpcv } from "@/lib/cpcv-docx";
import { launchChromium } from "@/lib/cpcv-browser";

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
  if (perfil?.role !== "gestora") {
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
      "papel, tipo_pessoa, nome, estado_civil, regime_bens, nacionalidade, naturalidade, nif, morada, documento_tipo, documento_numero, documento_validade, representante_nome, certidao_permanente"
    )
    .eq("processo_id", id);

  let buffer: Buffer;
  try {
    if (tipo === "pdf") {
      const html = gerarHtmlCpcv(processo, partes ?? []);
      const browser = await launchChromium();
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle" });
        buffer = await page.pdf({ format: "A4", printBackground: true });
      } finally {
        await browser.close();
      }
    } else {
      buffer = await gerarDocxCpcv(processo, partes ?? []);
    }
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
    },
  });
}
