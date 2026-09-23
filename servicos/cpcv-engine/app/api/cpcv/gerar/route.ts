import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { gerarHtmlCpcv } from "@/lib/cpcv-template";
import { gerarDocxCpcv } from "@/lib/cpcv-docx";
import { launchChromium } from "@/lib/cpcv-browser";
import { enviarCpcvParaDrive } from "@/lib/google-drive";
import { reverAntesDeGerar } from "@/lib/cpcv-revisao";
import { temGestaoTotal } from "@/lib/cpcv-auth";

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
  if (!temGestaoTotal(perfil?.role)) {
    return NextResponse.json(
      { error: "Só a gestora de processos pode aprovar e gerar o CPCV." },
      { status: 403 }
    );
  }

  const { processo_id, forcar } = await req.json();

  const { data: processo } = await supabase
    .from("cpcv_processos")
    .select("*")
    .eq("id", processo_id)
    .single();

  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  // Licença de utilização e certificado energético são obrigações legais para um CPCV -
  // ao contrário dos outros campos em falta (que ficam em branco no documento), estes
  // dois nunca podem faltar num documento gerado para assinatura.
  const camposObrigatoriosEmFalta: string[] = [];
  if (!processo.imovel_licenca_utilizacao) camposObrigatoriosEmFalta.push("licença de utilização");
  if (!processo.imovel_certificado_energetico) camposObrigatoriosEmFalta.push("certificado energético");
  if (camposObrigatoriosEmFalta.length > 0) {
    return NextResponse.json(
      {
        error: `Não é possível gerar o CPCV sem: ${camposObrigatoriosEmFalta.join(", ")}. Preenche em "Condições do negócio" antes de aprovar.`,
      },
      { status: 400 }
    );
  }

  const { data: partes } = await supabase
    .from("cpcv_partes")
    .select(
      "papel, tipo_pessoa, nome, estado_civil, regime_bens, nacionalidade, naturalidade, nif, morada, documento_tipo, documento_numero, documento_validade, representante_nome, certidao_permanente"
    )
    .eq("processo_id", processo_id);

  if (!forcar) {
    // Verificações determinísticas primeiro - "sinal >= preço" é um cálculo exacto, não faz
    // sentido depender de a IA reparar nisso de cada vez (testado: numa ronda de simulação com
    // sinal de 150.000€ e preço de 100.000€, a revisão por IA não gerou nenhum aviso).
    const avisosDeterministicos: string[] = [];
    if (
      typeof processo.preco_total === "number" &&
      typeof processo.valor_sinal === "number" &&
      processo.valor_sinal >= processo.preco_total
    ) {
      avisosDeterministicos.push(
        `O sinal (${processo.valor_sinal} €) é maior ou igual ao preço total (${processo.preco_total} €) - confirma antes de gerar.`
      );
    }

    const avisosIA = await reverAntesDeGerar(processo, partes ?? []);
    const avisos = [...avisosDeterministicos, ...avisosIA];
    if (avisos.length > 0) {
      return NextResponse.json({ precisaConfirmacao: true, avisos });
    }
  }

  const html = gerarHtmlCpcv(processo, partes ?? []);

  let pdfBuffer: Buffer;
  try {
    const browser = await launchChromium();
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

  // Cópia automática no Google Drive - best-effort, não deve impedir a aprovação se
  // falhar (credenciais Google em falta, Drive em baixo, etc.). Ver lib/google-drive.ts.
  let driveFolderUrl: string | null = null;
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    try {
      driveFolderUrl = await enviarCpcvParaDrive(processo, pdfBuffer, docxBuffer);
    } catch (e) {
      console.error("Erro ao enviar o CPCV para o Google Drive:", e);
    }
  }

  const { error: updateError } = await supabase
    .from("cpcv_processos")
    .update({
      pdf_path: pdfPath,
      docx_path: docxPath,
      estado: "aprovado",
      aprovado_por: user.id,
      ...(driveFolderUrl ? { drive_folder_url: driveFolderUrl } : {}),
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
