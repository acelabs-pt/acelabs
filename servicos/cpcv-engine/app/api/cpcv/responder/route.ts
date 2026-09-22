import { NextRequest, NextResponse } from "next/server";
import { sbUserServer } from "@/lib/supabase-server";
import { anthropicClient, EXTRACTION_MODEL, dataDeHojePT } from "@/lib/anthropic";
import { mensagemPerguntas } from "@/lib/cpcv-mensagens";
import { filtrarCamposEmFalta } from "@/lib/cpcv-perguntas-filtro";

function systemPrompt(): string {
  return `És um assistente que prepara Contratos-Promessa de Compra e Venda (CPCV)
de imóveis em Portugal. Hoje é ${dataDeHojePT()}. Já tens um estado parcial do processo (partes,
imóvel, negócio, campos em falta) e o agente acabou de responder - normalmente numa única
mensagem - a várias das perguntas em falta ao mesmo tempo.

Regra mais importante: NUNCA inventes valores. Actualiza todos os campos que a resposta do
agente esclarecer (pode esclarecer vários campos de uma vez, mesmo de perguntas diferentes);
tudo o resto mantém-se como estava. Se a resposta não for suficientemente clara para preencher
um campo com confiança, mantém esse campo em "campos_em_falta" em vez de adivinhar. Isto
aplica-se também a referências vagas ou relativas a datas ("para o verão", "daqui a uns meses") -
nunca as convertas numa data exacta; mantém o campo em falta e pergunta a data concreta. Quando o
agente der só o dia e o mês de uma data (sem ano, ex. "15 de abril"), usa a data de hoje acima
para escolher o ano certo - a próxima ocorrência futura dessa data, nunca uma já passada.

Regra igualmente importante: se o agente disser explicitamente que não sabe, não tem essa
informação, ou pedir para deixar em aberto/para a gestora decidir, trata a pergunta como
respondida - remove-a de "campos_em_falta" e deixa o campo correspondente null. NUNCA voltes a
fazer a mesma pergunta depois de o agente já ter dito que não sabe a resposta; isso prende o
processo num ciclo sem saída.

Uma parte pode ser pessoa singular ou pessoa colectiva (empresa) - usa "nome" para a denominação
social quando for colectiva, e preenche "representante_nome"/"certidao_permanente" nesse caso.
Se a pessoa for solteira (ou o regime de bens não se aplicar), deixa "regime_bens" a null - nunca
escrevas "não aplicável" ou semelhante nesse campo.

NUNCA perguntes por método de pagamento, reserva, condições suspensivas estruturadas
(avaliação/financiamento/dias), comodato, IBAN do sinal, ou emails para o contrato - esses campos
são preenchidos à parte, num formulário próprio, não fazem parte desta conversa. Se uma das
"perguntas que foram feitas" for sobre um desses temas, ignora-a - não voltes a incluí-la em
"campos_em_falta".

Excepção importante: se o "tipo_contrato" indicado no estado actual for
"comprador_nosso_angariacao_externa", o CPCV em si vem da agência externa - nunca perguntes pelos
dados do vendedor (nome, NIF, morada, documento) nem mantenhas uma pergunta sobre isso em
"campos_em_falta". Não crias sequer uma parte "vendedor" nesse caso.

Responde APENAS com um objecto JSON válido, sem markdown, sem texto à volta, exactamente com
esta forma (a mesma estrutura do estado que recebeste, já actualizada):

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

Remove de "campos_em_falta" a pergunta que acabou de ser respondida (e qualquer outra que a
resposta já tenha esclarecido). Se ainda faltar informação essencial, mantém/acrescenta a
pergunta correspondente. Se já não faltar nada, devolve "campos_em_falta": [].`;
}

export async function POST(req: NextRequest) {
  const supabase = await sbUserServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  const { processo_id, resposta } = await req.json();

  if (!resposta?.trim()) {
    return NextResponse.json({ error: "Resposta vazia." }, { status: 400 });
  }

  const { data: processo } = await supabase
    .from("cpcv_processos")
    .select("*")
    .eq("id", processo_id)
    .single();

  if (!processo) {
    return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
  }

  const { data: partes } = await supabase
    .from("cpcv_partes")
    .select(
      "papel, tipo_pessoa, nome, estado_civil, regime_bens, nacionalidade, naturalidade, nif, morada, documento_tipo, documento_numero, documento_validade, representante_nome, certidao_permanente"
    )
    .eq("processo_id", processo_id);

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
    partes: partes ?? [],
    imovel: imovelAtual,
    negocio: negocioAtual,
    campos_em_falta: processo.campos_em_falta ?? [],
  };

  const perguntasFeitas: { campo: string; pergunta: string }[] = processo.campos_em_falta ?? [];

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
      messages: [
        {
          role: "user",
          content: `Estado actual:\n${JSON.stringify(estadoActual, null, 2)}\n\nPerguntas que foram feitas ao agente:\n${
            perguntasFeitas.length
              ? perguntasFeitas.map((p, i) => `${i + 1}. ${p.pergunta}`).join("\n")
              : "(nenhuma pergunta específica pendente)"
          }\n\nResposta do agente (pode responder a uma ou várias perguntas de uma vez):\n${resposta}`,
        },
      ],
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
    console.error("Erro ao chamar a IA em /api/cpcv/responder:", e);
    return NextResponse.json(
      { error: "Não foi possível processar a resposta agora. Tenta outra vez daqui a pouco." },
      { status: 500 }
    );
  }

  extraido.campos_em_falta = filtrarCamposEmFalta(extraido.campos_em_falta ?? []);

  const novoEstado = extraido.campos_em_falta?.length ? "em_preenchimento" : "pronto_para_aprovacao";

  // Faz merge com o que já lá estava - nunca apaga um campo já confirmado só porque esta
  // ronda não o devolveu (a IA já é instruída a preservar, mas isto garante que uma
  // resposta incompleta da IA nunca faz o processo andar para trás). Mesma lógica de
  // /api/cpcv/extrair - manter os dois sítios alinhados.
  const imovelMesclado: Record<string, unknown> = { ...imovelAtual };
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
      estado: novoEstado,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", processo_id);

  if (updateError) {
    return NextResponse.json(
      { error: `Erro ao gravar os dados actualizados: ${updateError.message}` },
      { status: 500 }
    );
  }

  const partesValidas = (extraido.partes ?? []).filter(
    (p): p is Record<string, unknown> & { nome: string } =>
      typeof p === "object" && p !== null && typeof (p as Record<string, unknown>).nome === "string" && (p as { nome: string }).nome.trim().length > 0
  );

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
    autor: "agente",
    texto: resposta,
  });

  await supabase.from("cpcv_mensagens").insert({
    processo_id,
    autor: "ia",
    texto: mensagemPerguntas(extraido.campos_em_falta ?? [], false),
  });

  return NextResponse.json({ ok: true, estado: novoEstado });
}
