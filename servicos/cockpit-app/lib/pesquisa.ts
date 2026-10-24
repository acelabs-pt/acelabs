import { semAcentos } from "@/lib/importar/validar";

/**
 * Pesquisa por texto livre numa ficha: ignora maiúsculas e acentos, e cada palavra tem de aparecer
 * em algum dos textos ("ana guimaraes" encontra a Ana de Guimarães). Os telefones só entram quando se
 * escreve um número (3 ou mais dígitos, com ou sem espaços e indicativo): assim "Teste 03" não apanha
 * todos os telemóveis que têm "03" no meio.
 */
export function combina(termo: string, textos: (string | null | undefined)[], telefones: (string | null | undefined)[] = []): boolean {
  const t = semAcentos(termo);
  if (!t) return true;
  const digitos = termo.replace(/\D/g, "");
  const soNumero = digitos.length >= 3 && /^[\d\s+().-]+$/.test(termo.trim());
  if (soNumero) return [...telefones, ...textos].some((c) => !!c && c.replace(/\D/g, "").includes(digitos));
  const normais = textos.filter((c): c is string => !!c).map(semAcentos);
  return t.split(" ").every((p) => normais.some((c) => c.includes(p)));
}
