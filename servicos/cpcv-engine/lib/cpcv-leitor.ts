import JSZip from "jszip";
import { anthropicClient, REVISAO_FINAL_MODEL } from "./anthropic";
import { ORDINAIS, formatarNif } from "./cpcv-clausulas";
import { formatarEuros } from "./cpcv-types";
import type { Hipoteca, Parte, Processo } from "./cpcv-types";

// Leitor do contrato JÁ GERADO. Ao contrário de lib/cpcv-revisao.ts (que olha para os dados antes de
// gerar), este lê o Word final, parágrafo a parágrafo, como a solicitadora o leria: primeiro
// verificações de regra (campos em branco, numeração, dados que faltam no texto) e depois uma leitura
// por IA ao documento inteiro, a ver se faz sentido. Nunca bloqueia nem altera o documento - devolve
// pontos para a gestora rever.

export type Problema = {
  gravidade: "alta" | "media" | "baixa";
  onde: string;
  problema: string;
  sugestao?: string;
  origem: "regra" | "ia";
};

export type Leitura = {
  veredito: "ok" | "rever";
  problemas: Problema[];
  iaCorreu: boolean;
};

// Texto do .docx, um parágrafo por linha (é isto que a solicitadora vê no Word).
export async function textoDoDocx(docx: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(docx);
  const xml = await zip.file("word/document.xml")!.async("string");
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:tab\/>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function trecho(texto: string, indice: number, tamanho = 70): string {
  return texto.slice(Math.max(0, indice - tamanho), indice + tamanho).replace(/\s+/g, " ").trim();
}

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "");
}

export function verificacoesDeRegra(texto: string, processo: Processo, partes: Parte[], hipotecas: Hipoteca[]): Problema[] {
  const p: Problema[] = [];
  const add = (gravidade: Problema["gravidade"], onde: string, problema: string, sugestao?: string) =>
    p.push({ gravidade, onde, problema, sugestao, origem: "regra" });

  // 1. Campos em branco e lixo de código.
  // O espaço em branco de um dado em falta são exactamente 12 sublinhados; as linhas de assinatura são mais longas.
  for (const m of texto.matchAll(/(?<!_)_{12}(?!_)/g)) {
    add("alta", `…${trecho(texto, m.index ?? 0)}…`, "Campo em branco no contrato.", "Preencher o dado em falta no processo e gerar de novo.");
  }
  const lixo = texto.match(/undefined|\bnull\b|NaN|\[object|\{\{|\}\}/);
  if (lixo) add("alta", `…${trecho(texto, texto.indexOf(lixo[0]))}…`, `O texto contém "${lixo[0]}" (erro de geração).`);

  // 2. Palavras repetidas e pontuação partida.
  for (const m of texto.matchAll(/\b([A-Za-zÀ-ÿ]{3,})\s+\1\b/gi)) {
    add("media", `…${trecho(texto, m.index ?? 0)}…`, `Palavra repetida: "${m[1]}".`);
  }
  for (const m of texto.matchAll(/,\s*,|\.\s*\.(?!\.)|\s,|\(\s|\s\)/g)) {
    add("baixa", `…${trecho(texto, m.index ?? 0)}…`, "Pontuação ou espaçamento estranho.");
  }
  if (/ {2,}/.test(texto)) add("baixa", "vários pontos", "Há espaços duplos no texto.");

  // 3. Cláusulas e pontos numerados em sequência.
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const ordinaisVistos = linhas.filter((l) => /^Cláusula [A-ZÁÉÍÓÚ][A-Za-zÀ-ÿ ]+$/.test(l)).map((l) => l.replace("Cláusula ", ""));
  ordinaisVistos.forEach((o, i) => {
    if (o !== ORDINAIS[i]) add("alta", `Cláusula ${o}`, `Numeração das cláusulas fora de sequência: esperava "Cláusula ${ORDINAIS[i]}" na posição ${i + 1}.`);
  });
  let esperado = 0;
  for (const l of linhas) {
    if (/^Cláusula [A-ZÁÉÍÓÚ]/.test(l)) {
      esperado = 1;
      continue;
    }
    const m = l.match(/^(\d+) – /);
    if (m && esperado > 0) {
      if (Number(m[1]) !== esperado) add("alta", `…${l.slice(0, 60)}…`, `Ponto numerado fora de sequência (${m[1]} em vez de ${esperado}).`);
      esperado = Number(m[1]) + 1;
    }
  }

  // 4. Dados do processo que têm de estar no texto.
  const t = normalizar(texto);
  const tem = (valor: string | null | undefined) => !!valor && t.includes(normalizar(valor));
  for (const parte of partes) {
    if (!tem(parte.nome)) add("alta", parte.nome, "O nome desta parte não aparece no contrato.");
    if (parte.nif && !tem(formatarNif(parte.nif))) add("alta", parte.nome, "O NIF desta parte não aparece no contrato.");
    if (parte.email && !tem(parte.email)) add("media", parte.nome, "O email desta parte não aparece no contrato.");
    if (parte.morada && !/\b\d{4}-\d{3}\b/.test(parte.morada)) add("alta", parte.nome, "A morada desta parte não tem código postal.", "Acrescentar o código postal (0000-000) à morada.");
  }
  if (typeof processo.preco_total === "number" && !texto.includes(formatarEuros(processo.preco_total))) {
    add("alta", "Cláusula Segunda", "O preço total do processo não aparece no contrato.");
  }
  if (typeof processo.valor_sinal === "number" && !texto.includes(formatarEuros(processo.valor_sinal))) {
    add("alta", "Cláusula Segunda", "O valor do sinal do processo não aparece no contrato.");
  }
  if (processo.reserva === true && typeof processo.valor_reserva === "number" && !texto.includes(formatarEuros(processo.valor_reserva))) {
    add("alta", "Cláusula Segunda", "O processo tem reserva, mas o valor da reserva não aparece no contrato.");
  }
  for (const h of hipotecas) {
    if (h.numero_apresentacao && !tem(h.numero_apresentacao)) add("alta", "Cláusula Primeira", `A inscrição ${h.numero_apresentacao} (hipoteca/ónus) não aparece no contrato.`);
  }
  if (hipotecas.length > 0 && !/hipoteca/i.test(texto)) add("alta", "Cláusula Primeira", "O processo tem hipotecas mas o contrato não as menciona.");

  // 5. Estado civil e "maior".
  if (/\b(divorciad[oa]|viúv[oa]),\s*maior/i.test(texto)) add("media", "identificação", 'Divorciado/viúvo não leva "maior".');
  if (/\b(Solteir[oa]|Divorciad[oa]|Viúv[oa]|Casad[oa])\b/.test(texto)) add("baixa", "identificação", "Estado civil escrito com maiúscula inicial.");

  // 6. Datas e valores com lógica.
  if (processo.prazo_escritura && processo.data_assinatura_contrato && processo.prazo_escritura < processo.data_assinatura_contrato) {
    add("alta", "Cláusula Terceira", "A data-limite da escritura é anterior à data de assinatura do contrato.");
  }
  if (typeof processo.preco_total === "number" && typeof processo.valor_sinal === "number" && processo.valor_sinal >= processo.preco_total) {
    add("alta", "Cláusula Segunda", "O sinal é igual ou superior ao preço total.");
  }

  // 7. Exemplares = número de outorgantes.
  const ex = texto.match(/FEITO EM ([A-ZÇÃÕ]+) EXEMPLARES/);
  if (!ex) add("media", "texto final", "Não encontrei a frase dos exemplares no fim do contrato.");

  return p;
}

const SYSTEM_PROMPT = `És uma solicitadora portuguesa experiente a ler, de ponta a ponta, um Contrato-Promessa de
Compra e Venda (CPCV) que acabou de ser gerado por um programa, antes de ir para assinatura. Vais
receber o texto completo do contrato (tal como está no Word) e os dados do processo de onde saiu.

O teu trabalho é dizer se o contrato FAZ SENTIDO e está pronto a assinar. Procura, por esta ordem:
1. Contradições entre cláusulas, ou entre o texto e os dados do processo (nomes, NIFs, valores, datas,
   moradas, número de hipotecas, quem recebe o sinal, quantos outorgantes).
2. Frases que não fazem sentido, estão incompletas, repetem informação, ou têm erros de
   concordância (singular/plural, género) ou de português.
3. Campos em branco ("____") ou dados evidentemente errados (data absurda, valor com o extenso
   diferente do número, código postal que não bate com a localidade).
4. Cláusulas que referem algo que não existe no contrato (ex.: "cláusula anterior" que não diz o que é
   dito) ou pontos que se contradizem (ex.: sinal para a agência numa cláusula e para o vendedor noutra).
5. Algo que uma solicitadora estranharia por motivos legais ou práticos.

A redação fixa das cláusulas vem de um modelo aprovado pela solicitadora: não a critiques por estilo.
Só a assinales se contradisser os dados DESTE processo ou o resto do contrato. Dados de identificação
repetidos entre pessoas (NIF, CC) só os assinales se forem claramente erro e não dados de teste óbvios.

Convenções DELIBERADAS que NÃO são erro: nomes das partes em MAIÚSCULAS; "primeiro outorgante" /
"segundo outorgante" sempre no masculino; pontos numerados como "1 – "; redação fixa e formal das
cláusulas (vem de um modelo aprovado); o contrato não menciona o valor da comissão; os sublinhados do
fim dos parágrafos não aparecem no texto que recebes.

Não inventes problemas. Se estiver tudo coerente, devolve a lista vazia. Cada problema é concreto, cita
o sítio e diz o que mudar. Responde APENAS com um objecto JSON válido, sem markdown, exactamente assim:

{
  "veredito": "ok" | "rever",
  "problemas": [
    { "gravidade": "alta" | "media" | "baixa", "onde": string, "problema": string, "sugestao": string }
  ]
}

"alta" = não deve ser assinado assim; "media" = deve ser corrigido; "baixa" = polimento.`;

function resumoDosDados(processo: Processo, partes: Parte[], hipotecas: Hipoteca[]) {
  return {
    hoje: new Date().toISOString().slice(0, 10),
    partes: partes.map((p) => ({
      papel: p.papel,
      tipo_pessoa: p.tipo_pessoa,
      nome: p.nome,
      nif: p.nif,
      estado_civil: p.estado_civil,
      regime_bens: p.regime_bens,
      morada: p.morada,
      email: p.email ?? null,
    })),
    imovel: {
      e_fracao_autonoma: processo.imovel_e_fracao_autonoma,
      condominio: processo.imovel_condominio,
      concelho: processo.imovel_concelho,
      freguesia: processo.imovel_freguesia,
      certificado_estado: processo.imovel_certificado_estado ?? "valido",
    },
    negocio: {
      preco_total: processo.preco_total,
      valor_sinal: processo.valor_sinal,
      reserva: processo.reserva ? { valor: processo.valor_reserva, ate: processo.reserva_ate_data } : null,
      destino_sinal: processo.destino_sinal,
      metodo_pagamento: processo.metodo_pagamento,
      condicionado_avaliacao: processo.condicionado_avaliacao,
      prazo_escritura: processo.prazo_escritura,
      data_assinatura_contrato: processo.data_assinatura_contrato,
      tem_bens_moveis: processo.tem_bens_moveis,
    },
    hipotecas: hipotecas.map((h) => ({ natureza: h.natureza, entidade: h.entidade_credora, inscricao: h.numero_apresentacao, data: h.data_registo })),
  };
}

async function leituraPorIA(texto: string, processo: Processo, partes: Parte[], hipotecas: Hipoteca[]): Promise<Problema[] | null> {
  try {
    const client = anthropicClient();
    const resposta = await client.messages.create(
      {
        model: REVISAO_FINAL_MODEL,
        // O modelo começa por um bloco de raciocínio que conta para o limite - folga larga.
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `DADOS DO PROCESSO:\n${JSON.stringify(resumoDosDados(processo, partes, hipotecas), null, 2)}\n\nTEXTO DO CONTRATO:\n${texto}`,
          },
        ],
      },
      { timeout: 120_000 }
    );
    console.info(`Leitura final do contrato: ${resposta.usage.input_tokens} tokens de entrada, ${resposta.usage.output_tokens} de saída.`);
    const bloco = resposta.content.find((b) => b.type === "text");
    if (!bloco || bloco.type !== "text") {
      console.error("Leitura final do contrato: a resposta não trouxe texto (stop_reason:", resposta.stop_reason, ")");
      return null;
    }
    const json = bloco.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed.problemas)) return null;
    return parsed.problemas
      .filter((x: Record<string, unknown>) => typeof x?.problema === "string")
      .map((x: Record<string, unknown>) => ({
        gravidade: x.gravidade === "alta" || x.gravidade === "baixa" ? x.gravidade : "media",
        onde: String(x.onde ?? ""),
        problema: String(x.problema),
        sugestao: x.sugestao ? String(x.sugestao) : undefined,
        origem: "ia" as const,
      }));
  } catch (e) {
    console.error("Erro na leitura final do contrato por IA:", e);
    return null;
  }
}

// Lê o Word gerado. A leitura por IA é um extra (se falhar, ficam só as verificações de regra e
// `iaCorreu` vem a false, para a gestora saber que a IA não chegou a ler).
export async function lerContrato(
  docx: Buffer,
  processo: Processo,
  partes: Parte[],
  hipotecas: Hipoteca[],
  opcoes: { ia?: boolean } = {}
): Promise<Leitura> {
  const texto = await textoDoDocx(docx);
  const problemas = verificacoesDeRegra(texto, processo, partes, hipotecas);
  let iaCorreu = false;
  if (opcoes.ia !== false) {
    const daIA = await leituraPorIA(texto, processo, partes, hipotecas);
    if (daIA) {
      iaCorreu = true;
      problemas.push(...daIA);
    }
  }
  const ordem = { alta: 0, media: 1, baixa: 2 };
  problemas.sort((a, b) => ordem[a.gravidade] - ordem[b.gravidade]);
  return { veredito: problemas.some((x) => x.gravidade !== "baixa") ? "rever" : "ok", problemas, iaCorreu };
}

export function resumoDaLeitura(l: Leitura): string {
  if (l.problemas.length === 0) {
    return l.iaCorreu
      ? "Leitura final do contrato: li o Word gerado de ponta a ponta e não encontrei problemas."
      : "Leitura final do contrato: sem problemas nas verificações automáticas (a leitura por IA não correu).";
  }
  const linhas = l.problemas.map((p) => `- [${p.gravidade}] ${p.onde ? `${p.onde}: ` : ""}${p.problema}${p.sugestao ? ` (${p.sugestao})` : ""}`);
  return `Leitura final do contrato: ${l.problemas.length} ponto(s) a ver.\n${linhas.join("\n")}`;
}
