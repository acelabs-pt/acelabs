import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { gerarPdfCpcv } from "@/lib/cpcv-pdf";
import { gerarDocxCpcv } from "@/lib/cpcv-docx";
import { enviarCpcvParaDrive } from "@/lib/google-drive";
import { reverAntesDeGerar } from "@/lib/cpcv-revisao";
import { temGestaoTotal } from "@/lib/cpcv-auth";
import { descricaoPredialValida } from "@/lib/cpcv-types";
import { informacaoForaDoContrato } from "@/lib/cpcv-alertas";

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

  // Tudo o que as 16 cláusulas do contrato de referência precisam para sair sem espaços em
  // branco (ver lib/cpcv-contrato.ts). As perguntas de sim/não têm de estar respondidas - nunca
  // se presume "não" (fracção autónoma, condomínio, avaliação, destino do sinal, financiamento).
  const emFalta: string[] = [];
  const falta = (condicao: boolean, nome: string) => {
    if (condicao) emFalta.push(nome);
  };

  falta(processo.imovel_e_fracao_autonoma === null || processo.imovel_e_fracao_autonoma === undefined, "resposta se o imóvel é fracção autónoma");
  falta(processo.imovel_condominio === null || processo.imovel_condominio === undefined, "resposta se o imóvel está integrado num condomínio");
  falta(!processo.imovel_morada, "morada do imóvel");
  falta(!processo.imovel_freguesia, "freguesia do imóvel");
  falta(!processo.imovel_concelho, "concelho do imóvel");
  falta(!processo.imovel_conservatoria, "conservatória do registo predial");
  falta(!descricaoPredialValida(processo.imovel_descricao_predial), "número de descrição predial");
  falta(!processo.imovel_artigo_matricial, "artigo matricial");
  falta(!processo.imovel_licenca_utilizacao, "licença de utilização");
  falta(!processo.imovel_licenca_data_emissao, "data de emissão da licença de utilização");
  falta(!processo.imovel_licenca_entidade_emissora, "entidade emissora da licença de utilização");
  falta(!processo.imovel_certificado_energetico, "certificado energético");
  falta(!processo.imovel_certificado_validade, "validade do certificado energético");
  falta(!processo.imovel_certificado_classe, "classe energética");
  if (processo.imovel_e_fracao_autonoma) {
    falta(!processo.imovel_fracao_letra, "letra da fracção");
    falta(!processo.imovel_andar_fracao, "andar/localização da fracção");
    falta(!processo.imovel_finalidade, "finalidade do imóvel");
  }

  falta(processo.preco_total === null || processo.preco_total === undefined, "preço total");
  falta(processo.valor_sinal === null || processo.valor_sinal === undefined, "valor do sinal");
  falta(!processo.prazo_escritura, "data-limite da escritura");
  falta(!processo.data_assinatura_contrato, "data de assinatura do contrato");
  falta(!processo.metodo_pagamento, "método de pagamento (recurso a financiamento bancário)");

  falta(!processo.destino_sinal, "destino do sinal (vendedor ou agência)");
  if (processo.destino_sinal === "vendedor") {
    falta(!processo.iban_sinal, "IBAN do sinal");
    falta(!processo.conta_sinal_banco, "banco da conta do sinal");
    falta(!processo.conta_sinal_titular, "titular da conta do sinal");
  }
  if (processo.destino_sinal === "agencia") {
    falta(!processo.iban_sinal && !process.env.CPCV_AGENCIA_IBAN, "IBAN do sinal");
    falta(!processo.conta_sinal_banco && !process.env.CPCV_AGENCIA_BANCO, "banco da conta do sinal");
    falta(!processo.comissao_modalidade, "modalidade de pagamento da comissão");
    falta(processo.comissao_valor === null || processo.comissao_valor === undefined, "valor da comissão (com IVA)");
  }

  falta(processo.condicionado_avaliacao === null || processo.condicionado_avaliacao === undefined, "resposta se o CPCV fica condicionado a avaliação bancária");
  if (processo.condicionado_avaliacao) {
    falta(processo.valor_avaliacao_minimo === null || processo.valor_avaliacao_minimo === undefined, "valor mínimo da avaliação");
    falta(!processo.avaliacao_prazo_data, "data-limite para comunicar o resultado da avaliação");
    falta(!processo.avaliacao_contacto_email, "email para comunicar o resultado da avaliação");
  }

  if (processo.tem_bens_moveis) falta(!processo.incluidos_no_imovel, "lista de bens móveis incluídos na venda");

  if (emFalta.length > 0) {
    return NextResponse.json(
      {
        error: `Não é possível gerar o CPCV sem: ${emFalta.join(", ")}. Preenche esses campos antes de aprovar.`,
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

  const { data: hipotecas } = await supabase
    .from("cpcv_hipotecas")
    .select("entidade_credora, natureza, numero_apresentacao, data_registo")
    .eq("processo_id", processo_id);

  if (!forcar) {
    // Verificações determinísticas primeiro - "sinal >= preço" é um cálculo exacto, não faz
    // sentido depender de a IA reparar nisso de cada vez.
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
    // Zero linhas em cpcv_hipotecas não distingue "ninguém verificou" de "verificou-se e não
    // há hipotecas" - por isso a confirmação é sempre explícita (ver
    // app/cpcv/[id]/IdentificacaoImovel.tsx), não inferida da lista estar vazia.
    if (!processo.hipotecas_verificadas) {
      avisosDeterministicos.push(
        "Ainda não foi confirmado se existem hipotecas sobre o imóvel - confirma em \"Identificação do imóvel\" antes de gerar."
      );
    }
    if (processo.tem_bens_moveis === null || processo.tem_bens_moveis === undefined) {
      avisosDeterministicos.push(
        "Ainda não foi respondido se há bens móveis ou equipamentos incluídos na venda - sem resposta, o CPCV sai sem a Cláusula de Bens Móveis."
      );
    }
    // Informação registada no processo que não entra em nenhuma das 16 cláusulas - a gestora
    // vê-a aqui antes de gerar, para a tratar fora do documento (ver lib/cpcv-alertas.ts).
    const foraDoContrato = informacaoForaDoContrato(processo);
    if (foraDoContrato.length > 0) {
      avisosDeterministicos.push(
        `Informação registada que NÃO entra no CPCV gerado (fica só para a solicitadora): ${foraDoContrato.join(" | ")}`
      );
    }

    const avisosIA = await reverAntesDeGerar(processo, partes ?? []);
    const avisos = [...avisosDeterministicos, ...avisosIA];
    if (avisos.length > 0) {
      return NextResponse.json({ precisaConfirmacao: true, avisos });
    }
  }

  // O PDF primeiro: é ele que diz quantas páginas o contrato tem, e esse número entra também no
  // Word como valor inicial do campo NUMPAGES (ver lib/cpcv-pdf.ts e lib/cpcv-docx.ts).
  let pdfBuffer: Buffer;
  let paginas: number;
  try {
    ({ pdf: pdfBuffer, paginas } = await gerarPdfCpcv(processo, partes ?? [], hipotecas ?? []));
  } catch (e) {
    return NextResponse.json(
      { error: `Erro ao gerar o PDF: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 }
    );
  }

  let docxBuffer: Buffer;
  try {
    docxBuffer = await gerarDocxCpcv(processo, partes ?? [], hipotecas ?? [], paginas);
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
