import { anthropicClient, EXTRACTION_MODEL } from "./anthropic";

type Parte = {
  papel: string;
  tipo_pessoa: string;
  nome: string;
  nif: string | null;
  documento_validade: string | null;
};

type Processo = {
  preco_total: number | null;
  valor_sinal: number | null;
  prazo_escritura: string | null;
  imovel_area: number | null;
};

const SYSTEM_PROMPT = `Vais rever os dados finais de um Contrato-Promessa de Compra e Venda (CPCV)
português, mesmo antes de ser gerado em PDF/Word para assinatura. Não é a tua tarefa reescrever
nada - é encontrar problemas objectivos que a gestora deva confirmar antes de gerar o documento
final: datas que já passaram (documentos de identificação caducados, prazo de escritura no
passado), valores inconsistentes (sinal maior ou igual ao preço total, área do imóvel
improvável), NIFs com um número de dígitos errado (NIF português tem sempre 9 dígitos), ou
partes com o mesmo nome em papéis opostos (vendedor e comprador serem a mesma pessoa).

Não inventes problemas que não estejam claramente nos dados - se não houver nada de errado,
devolve uma lista vazia. Responde APENAS com um objecto JSON válido, sem markdown, sem texto à
volta, com esta forma exacta:

{ "avisos": string[] }

Cada aviso é uma frase curta em português, directa, a dizer à gestora o que confirmar antes de
gerar o documento (ex.: "O NIF de João Teste tem 8 dígitos, não 9 - confirma antes de gerar.").`;

export async function reverAntesDeGerar(processo: Processo, partes: Parte[]): Promise<string[]> {
  const client = anthropicClient();

  const dados = {
    hoje: new Date().toISOString().slice(0, 10),
    preco_total: processo.preco_total,
    valor_sinal: processo.valor_sinal,
    prazo_escritura: processo.prazo_escritura,
    imovel_area: processo.imovel_area,
    partes: partes.map((p) => ({
      papel: p.papel,
      tipo_pessoa: p.tipo_pessoa,
      nome: p.nome,
      nif: p.nif,
      documento_validade: p.documento_validade,
    })),
  };

  try {
    const resposta = await client.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(dados, null, 2) }],
    });

    const bloco = resposta.content.find((b) => b.type === "text");
    if (!bloco || bloco.type !== "text") return [];

    const jsonText = bloco.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "");

    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed.avisos) ? parsed.avisos.filter((a: unknown) => typeof a === "string") : [];
  } catch (e) {
    // A revisão é um extra de segurança, não um bloqueio - se a IA falhar (rede, JSON
    // inválido), a geração continua sem avisos em vez de impedir a gestora de trabalhar.
    console.error("Erro na revisão pré-geração do CPCV:", e);
    return [];
  }
}
