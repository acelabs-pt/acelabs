import Anthropic from "@anthropic-ai/sdk";

// Usar sempre no servidor - a key nunca deve chegar ao browser.
export function anthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export const EXTRACTION_MODEL = "claude-haiku-4-5";

// Leitura final do Word gerado (lib/cpcv-leitor.ts): modelo mais forte que a extração, porque aqui
// o que importa é apanhar incoerências no texto jurídico, mesmo que demore mais um pouco.
export const REVISAO_FINAL_MODEL = "claude-sonnet-5-5";

// Leitura de documentos de identificação (nomes de pessoas, NIFs, números de documento): o Haiku
// já trocou a ordem de apelidos e nomes, por isso esta leitura usa o modelo mais forte.
export const LEITURA_PESSOA_MODEL = "claude-sonnet-5-5";

// O modelo não tem noção fiável da data de hoje - sem isto, uma data parcial como "15 de abril"
// (sem ano) é inferida às cegas e pode sair no passado (testado: gerou 2025-04-15 estando já em
// 2026). Interpolar isto no system prompt de cada pedido, nunca cachear o valor.
export function dataDeHojePT(): string {
  return new Date().toLocaleDateString("pt-PT", { year: "numeric", month: "long", day: "numeric" });
}
