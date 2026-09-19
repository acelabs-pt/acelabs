import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { gerarHtmlCpcv } from "@/lib/cpcv-template";
import { gerarDocxCpcv } from "@/lib/cpcv-docx";
import { chromium } from "playwright";

export async function POST(req: NextRequest) {
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  // O agente nunca pode gerar/aprovar sozinho - só a gestora. Verificar o role no
  // servidor (não basta esconder o botão no frontend).
  const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (perfil?.role !== "gestora") {
    return NextResponse.json(
      { error: "Só a gestora de processos pode aprovar e gerar o CPCV." },
      { status: 403 }
    );
  }

  const { processo_id } = await req.json();

  const { data: processo } = await supabase
    .from("cpcv_processos")
    .select("*")
    .eq("id", processo_id)
    .single();

  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  // Gerar é sempre permitido, mesmo com campos por preencher - os campos em falta ficam
  // como espaços em branco no documento (é o que permite pedir "só um template", sem IA
  // nenhuma envolvida, ou gerar uma versão de rascunho a meio da conversa).
  const { data: partes } = await supabase
    .from("cpcv_partes")
    .select(
      "papel, tipo_pessoa, nome, estado_civil, regime_bens, nacionalidade, naturalidade, nif, morada, documento_tipo, documento_numero, documento_validade, representante_nome, certidao_permanente"
    )
    .eq("processo_id", processo_id);

  const html = gerarHtmlCpcv(processo, partes ?? []);

  let pdfBuffer: Buffer;
  try {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    } finally {
      await browser.close();
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Erro ao gerar o PDF: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  let docxBuffer: Buffer;
  try {
    docxBuffer = await gerarDocxCpcv(processo, partes ?? []);
  } catch (e) {
    return NextResponse.json(
      { error: `Erro ao gerar o Word: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  // Usa sempre a pasta do agente dono do processo, não de quem carregou no botão -
  // isso permite à gestora gerar/regerar sem duplicar a pasta nem partir a leitura
  // do agente (as políticas de storage organizam-se por "dono do processo").
  const pdfPath = `${processo.criado_por}/${processo_id}/cpcv.pdf`;
  const docxPath = `${processo.criado_por}/${processo_id}/cpcv.docx`;

  const { error: pdfUploadError } = await supabase.storage
    .from("cpcv-documentos")
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (pdfUploadError) {
    return NextResponse.json(
      { error: `Erro ao guardar o PDF: ${pdfUploadError.message}` },
      { status: 500 }
    );
  }

  const { error: docxUploadError } = await supabase.storage
    .from("cpcv-documentos")
    .upload(docxPath, docxBuffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    });

  if (docxUploadError) {
    return NextResponse.json(
      { error: `Erro ao guardar o Word: ${docxUploadError.message}` },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabase
    .from("cpcv_processos")
    .update({
      pdf_path: pdfPath,
      docx_path: docxPath,
      estado: "aprovado",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", processo_id);

  if (updateError) {
    return NextResponse.json(
      { error: `Erro ao actualizar o processo: ${updateError.message}` },
      { status: 500 }
    );
  }

  await supabase.from("cpcv_mensagens").insert({
    processo_id,
    autor: "ia",
    texto: "O CPCV foi gerado com sucesso. Já podes descarregar o PDF e o Word para revisão e assinatura.",
  });

  return NextResponse.json({ ok: true });
}
