import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { anthropicClient, EXTRACTION_MODEL, dataDeHojePT } from "@/lib/anthropic";
import { mensagemPerguntas } from "@/lib/cpcv-mensagens";
import { filtrarCamposEmFalta } from "@/lib/cpcv-perguntas-filtro";

function mediaTypeFor(nome: string): "application/pdf" | "image/png" | "image/jpeg" | null {
  const ext = nome.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return null;
}

async function textoDaPagina(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AceLabsCPCV/1.0)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const texto = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    return texto.slice(0, 12000) || null;
  } catch {
    return null;
  }
}

function systemPrompt(): string {
  return `És um assistente que prepara Contratos-Promessa de Compra e Venda (CPCV)
de imóveis em Portugal a partir de documentos, texto e páginas de imóveis fornecidos por um
agente imobiliário ou por uma gestora de processos. Hoje é ${dataDeHojePT()}. Já podes ter um
estado parcial do processo (partes, imóvel, negócio) de uma análise anterior - a informação nova
pode chegar em qualquer altura (mais documentos, mais texto, um link de um anúncio).

Regra mais importante: NUNCA inventes valores (nomes, NIFs, moradas, preços, datas). Só extrais o
que está mesmo presente nos documentos/texto/página fornecidos. Tudo o resto entra em
"campos_em_falta" com uma pergunta em português simples e directa para perguntar ao agente. Isto
aplica-se também a referências vagas ou relativas a datas ("para o verão", "daqui a uns meses",
"em breve") - nunca as convertas numa data exacta (ex.: "verão" não é dia 31 de Julho); deixa o
campo em falta e pergunta a data concreta. Quando o texto der só o dia e o mês de uma data (sem
ano, ex. "15 de abril"), usa a data de hoje acima para escolher o ano certo - a próxima ocorrência
futura dessa data, nunca uma já passada.

Regra igualmente importante: se já havia dados de uma análise anterior (indicados abaixo em
"Estado actual"), NUNCA os apagues nem os substituas por null - mantém-nos, e só actualizas um
campo se a informação nova o esclarecer melhor ou o corrigir claramente.

Uma parte pode ser pessoa singular ou pessoa colectiva (empresa). Reconhece isso pelos documentos
(certidão permanente comercial, identificação de representante) ou pelo texto. Para pessoa
colectiva usa o campo "nome" para a denominação social, e preenche "representante_nome" e
"certidao_permanente"; os campos de pessoa singular (estado_civil, nacionalidade, documento_tipo,
etc.) ficam null nesse caso. Se a pessoa for solteira (ou o regime de bens não se aplicar), deixa
"regime_bens" a null - nunca escrevas "não aplicável" ou semelhante nesse campo.

NUNCA perguntes por método de pagamento, reserva, condições suspensivas estruturadas
(avaliação/financiamento/dias), comodato, IBAN do sinal, ou emails para o contrato - esses campos
são preenchidos à parte, num formulário próprio, não fazem parte desta conversa.

Responde APENAS com um objecto JSON válido, sem markdown, sem texto à volta, exactamente com esta forma:

{
  "partes": [
    { "papel": "vendedor" | "comprador", "tipo_pessoa": "singular" | "coletiva", "nome": string,
      "estado_civil": string|null, "regime_bens": string|null, "nacionalidade": string|null,
      "naturalidade": string|null, "nif": string|null, "morada": string|null,
      "documento_tipo": string|null, "documento_numero": string|null, "documento_validade": "YYYY-MM-DD"|null,
      "representante_nome": string|null, "certidao_permanente": string|null }
  ],
  "imovel": {
    "morada": string|null, "freguesia": string|null, "concelho": string|null, "distrito": string|null,
    "tipologia": string|null, "artigo_matricial": string|null, "descricao_predial": string|null,
    "certificado_energetico": string|null, "licenca_utilizacao": string|null, "area": number|null,
    "anexos": string|null, "estado": string|null
  },
  "negocio": {
    "preco_total": number|null, "valor_sinal": number|null, "forma_pagamento_sinal": string|null,
    "prazo_pagamento_sinal": string|null, "prazo_escritura": "YYYY-MM-DD"|null,
    "condicoes_suspensivas": string|null, "penalizacao_incumprimento": string|null
  },
  "campos_em_falta": [ { "campo": string, "pergunta": string } ]
}

Inclui em "campos_em_falta" qualquer campo do imóvel ou do negócio (dos listados acima, não dos
excluídos na regra anterior) que fique null, e qualquer parte (vendedor/comprador) cujos dados de
identificação estejam incompletos - mas não repitas perguntas óbvias se o mesmo dado já foi dado
de outra forma. Devolve sempre a lista completa de "partes" (as que já havia mais as
novas/actualizadas), não só as novas.

Se não houver nenhum documento, texto ou link novo, e o "Estado actual" também estiver vazio
(sem partes, sem dados do imóvel), NÃO devolvas "campos_em_falta" vazio - pergunta sempre pelo
essencial primeiro: quem é o vendedor e quem é o comprador (nome, NIF, morada), a morada do
imóvel, a tipologia, o preço e o prazo para a escritura. Nunca consideres um processo "pronto"
só porque não recebeste nada para analisar.

Excepção importante: se o "tipo_contrato" indicado no estado actual for
"comprador_nosso_angariacao_externa", o CPCV em si vem da agência externa - nunca perguntes pelos
dados do vendedor (nome, NIF, morada, documento). Não crias sequer uma parte "vendedor" nesse caso.
Pergunta apenas pelos dados do comprador e pelos dados do imóvel e do negócio.`;
}

export async function POST(req: NextRequest) {
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { processo_id, texto, link_imovel } = await req.json();

  const { data: processo } = await supabase
    .from("cpcv_processos")
    .select("*")
    .eq("id", processo_id)
    .single();

  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  const { data: partesAtuais } = await supabase
    .from("cpcv_partes")
    .select("papel, nome, estado_civil, regime_bens, nacionalidade, nif, morada, documento_tipo, documento_numero, documento_validade")
    .eq("processo_id", processo_id);

  const { count: totalMensagens } = await supabase
    .from("cpcv_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("processo_id", processo_id);

  const { data: ficheiros } = await supabase
    .from("cpcv_ficheiros")
    .select("storage_path, nome_original, tipo")
    .eq("processo_id", processo_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documentBlocks: any[] = [];

  for (const ficheiro of ficheiros ?? []) {
    const mediaType = mediaTypeFor(ficheiro.nome_original ?? ficheiro.storage_path);
    if (!mediaType) continue;

    const { data: blob, error: downloadError } = await supabase.storage
      .from("cpcv-documentos")
      .download(ficheiro.storage_path);

    if (downloadError || !blob) continue;

    const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");

    if (mediaType === "application/pdf") {
      documentBlocks.push({
        type: "document",
        source: { type: "base64", media_type: mediaType, data: base64 },
      });
    } else {
      documentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64 },
      });
    }
  }

  const linkFinal: string | undefined = link_imovel?.trim() || processo.link_imovel || undefined;
  if (link_imovel?.trim()) {
    const conteudoPagina = await textoDaPagina(link_imovel.trim());
    if (conteudoPagina) {
      documentBlocks.push({
        type: "text",
        text: `Conteúdo da página do imóvel (${link_imovel.trim()}):\n${conteudoPagina}`,
      });
    }
  }

  if (texto?.trim()) {
    documentBlocks.push({ type: "text", text: `Informação adicional dada pelo agente:\n${texto}` });
  }

  const imovelAtual = Object.fromEntries(
    Object.entries(processo)
      .filter(([k]) => k.startsWith("imovel_"))
      .map(([k, v]) => [k.replace(/^imovel_/, ""), v])
  );
  const negocioAtual = {
    preco_total: processo.preco_total,
    valor_sinal: processo.valor_sinal,
    forma_pagamento_sinal: processo.forma_pagamento_sinal,
    prazo_pagamento_sinal: processo.prazo_pagamento_sinal,
    prazo_escritura: processo.prazo_escritura,
    condicoes_suspensivas: processo.condicoes_suspensivas,
    penalizacao_incumprimento: processo.penalizacao_incumprimento,
  };
  const estadoActual = {
    tipo_contrato: processo.tipo_contrato,
    partes: partesAtuais ?? [],
    imovel: imovelAtual,
    negocio: negocioAtual,
  };

  documentBlocks.unshift({
    type: "text",
    text: `Estado actual do processo (o que já se sabia antes desta análise):\n${JSON.stringify(estadoActual, null, 2)}`,
  });

  if (documentBlocks.length === 1) {
    documentBlocks.push({ type: "text", text: "Nenhum documento, texto ou link novo fornecido ainda." });
  }

  const anthropic = anthropicClient();

  let extraido: {
    partes: unknown[];
    imovel: Record<string, unknown>;
    negocio: Record<string, unknown>;
    campos_em_falta: { campo: string; pergunta: string }[];
  };

  try {
    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 4000,
      system: systemPrompt(),
      messages: [{ role: "user", content: documentBlocks }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("A IA não devolveu texto.");
    }

    const jsonText = textBlock.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "");

    extraido = JSON.parse(jsonText);
  } catch (e) {
    console.error("Erro ao chamar a IA em /api/cpcv/extrair:", e);
    return NextResponse.json(
      { error: "Não foi possível analisar os documentos agora. Tenta outra vez daqui a pouco." },
      { status: 500 }
    );
  }

  extraido.campos_em_falta = filtrarCamposEmFalta(extraido.campos_em_falta ?? []);

  const estado = extraido.campos_em_falta?.length ? "em_preenchimento" : "pronto_para_aprovacao";

  // Faz merge com o que já lá estava - nunca apaga um campo já confirmado só porque
  // esta ronda de análise não o devolveu (a IA já é instruída a preservar, mas isto
  // garante que uma resposta incompleta da IA nunca faz o processo andar para trás).
  const imovelMesclado = { ...imovelAtual };
  for (const [k, v] of Object.entries(extraido.imovel ?? {})) {
    if (v !== null && v !== undefined && v !== "") imovelMesclado[k] = v;
  }
  const negocioMesclado: Record<string, unknown> = { ...negocioAtual };
  for (const [k, v] of Object.entries(extraido.negocio ?? {})) {
    if (v !== null && v !== undefined && v !== "") negocioMesclado[k] = v;
  }

  const imovelColunas = Object.fromEntries(
    Object.entries(imovelMesclado).map(([k, v]) => [`imovel_${k}`, v])
  );

  const { error: updateError } = await supabase
    .from("cpcv_processos")
    .update({
      ...imovelColunas,
      ...negocioMesclado,
      campos_em_falta: extraido.campos_em_falta ?? [],
      estado,
      link_imovel: linkFinal ?? null,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", processo_id);

  if (updateError) {
    return NextResponse.json(
      { error: `Erro ao gravar os dados extraídos: ${updateError.message}` },
      { status: 500 }
    );
  }

  // Filtrar partes sem nome - a IA por vezes devolve uma entrada "fantasma" para uma
  // pessoa que sabe existir mas cujo nome não conseguiu confirmar; sem nome não há o
  // que gravar (fica de fora, o campo entra em campos_em_falta à parte).
  const partesValidas = (extraido.partes ?? []).filter(
    (p): p is Record<string, unknown> & { nome: string } =>
      typeof p === "object" && p !== null && typeof (p as Record<string, unknown>).nome === "string" && (p as { nome: string }).nome.trim().length > 0
  );

  // Apaga e reinsere - a IA devolve sempre a lista completa (instruído no prompt),
  // por isso isto substitui em vez de duplicar quando esta rota é chamada outra vez
  // sobre o mesmo processo (ex: gestora acrescenta mais um documento mais tarde).
  await supabase.from("cpcv_partes").delete().eq("processo_id", processo_id);
  if (partesValidas.length > 0) {
    const { error: partesError } = await supabase.from("cpcv_partes").insert(
      partesValidas.map((p) => ({ ...p, processo_id }))
    );
    if (partesError) {
      return NextResponse.json(
        { error: `Erro ao gravar as partes: ${partesError.message}` },
        { status: 500 }
      );
    }
  }

  await supabase.from("cpcv_mensagens").insert({
    processo_id,
    autor: "ia",
    texto: mensagemPerguntas(extraido.campos_em_falta ?? [], (totalMensagens ?? 0) === 0),
  });

  return NextResponse.json({ ok: true, estado });
}
