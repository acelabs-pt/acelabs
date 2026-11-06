// Leitura de faturas (PDF ou foto) com o Claude. Só corre no servidor: a chave nunca chega ao browser.
// Saída estruturada (schema validado pela API), por isso não há texto solto nem blocos de markdown para limpar.
// O que vier do código QR da AT ganha sempre a isto (ver lerFatura em app/acoes-faturas.ts).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/** Um só sítio para o modelo. Haiku 5.5 com esforço baixo chega para faturas (decisão do Pedro, 2026-11-06); os valores
 *  das faturas portuguesas vêm do código QR, que ganha sempre à IA. */
export const MODELO_FATURAS = "claude-haiku-5-5";

const Esquema = z.object({
  e_fatura: z.boolean().describe("true se o documento for uma fatura, fatura-recibo, recibo, nota de crédito ou talão de compra"),
  tipo: z.enum(["fatura", "fatura-recibo", "fatura simplificada", "recibo", "nota de crédito", "outro"]),
  emitente_nome: z.string().nullable().describe("Nome de quem emitiu (o fornecedor), como aparece no documento"),
  emitente_nif: z.string().nullable().describe("NIF ou VAT do emitente, só letras e algarismos, sem espaços"),
  adquirente_nome: z.string().nullable(),
  adquirente_nif: z.string().nullable(),
  numero: z.string().nullable().describe("Número do documento, tal e qual (ex.: FT 2026A/123, INV-0042)"),
  data: z.string().nullable().describe("Data de emissão, AAAA-MM-DD"),
  vencimento: z.string().nullable().describe("Data de vencimento ou limite de pagamento, AAAA-MM-DD"),
  moeda: z.string().describe("Código ISO 4217 da moeda dos valores (EUR, USD...)"),
  base: z.number().nullable().describe("Total sem impostos, em unidades da moeda (ex.: 20.00)"),
  iva: z.number().nullable().describe("Total de IVA/VAT/impostos, em unidades da moeda"),
  total: z.number().nullable().describe("Total a pagar com impostos, em unidades da moeda"),
  descricao: z.string().nullable().describe("O que foi comprado, em português de Portugal, curto (até 80 caracteres)"),
  categoria: z.string().nullable().describe("Uma das categorias da lista dada, escrita exatamente igual, ou null"),
  duvidas: z.array(z.string()).describe("O que não se conseguiu ler com certeza, em português de Portugal, frases curtas"),
});

export type LeituraIa = z.infer<typeof Esquema>;

export function iaDisponivel(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function lerComIa(bytes: Buffer, tipo: string, categorias: string[]): Promise<LeituraIa> {
  const cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const hoje = new Date().toLocaleDateString("pt-PT", { year: "numeric", month: "long", day: "numeric" });
  const dados = bytes.toString("base64");
  const ficheiro: Anthropic.ContentBlockParam =
    tipo === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: dados } }
      : { type: "image", source: { type: "base64", media_type: tipo as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: dados } };

  const r = await cliente.messages.parse({
    model: MODELO_FATURAS,
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(Esquema) },
    system:
      `Lês faturas e recibos de uma pequena empresa portuguesa (Ace Labs) para a contabilidade interna. Hoje é ${hoje}. ` +
      "Copia os valores tal como estão no documento, na moeda do documento. Se um valor não estiver legível ou não existir, " +
      "usa null e explica em duvidas; nunca inventes nem calcules um total que não esteja escrito (a base e o IVA podem " +
      "deduzir-se do total só se a taxa estiver escrita). Datas sem ano: usa o ano mais provável perto de hoje.",
    messages: [
      {
        role: "user",
        content: [
          ficheiro,
          {
            type: "text",
            text: `Lê este documento. Categorias possíveis para a despesa ou receita: ${categorias.join("; ")}.`,
          },
        ],
      },
    ],
  });
  if (r.stop_reason === "refusal") throw new Error("A IA recusou ler este documento.");
  if (!r.parsed_output) throw new Error("A IA não devolveu dados.");
  return r.parsed_output;
}
