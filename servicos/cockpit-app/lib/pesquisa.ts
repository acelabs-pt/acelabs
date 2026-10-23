import { semAcentos } from "@/lib/importar/validar";

/**
 * Pesquisa por texto livre numa ficha: ignora maiúsculas e acentos, e cada palavra tem de aparecer
 * em algum dos campos ("ana guimaraes" encontra a Ana de Guimarães). Se o texto tiver 3 ou mais
 * dígitos, também procura nos números (telemóvel escrito com ou sem espaços e indicativo).
 */
export function combina(termo: string, campos: (string | null | undefined)[]): boolean {
  const t = semAcentos(termo);
  if (!t) return true;
  const normais = campos.filter((c): c is string => !!c).map(semAcentos);
  if (t.split(" ").every((p) => normais.some((c) => c.includes(p)))) return true;
  const digitos = termo.replace(/\D/g, "");
  return digitos.length >= 3 && campos.some((c) => !!c && c.replace(/\D/g, "").includes(digitos));
}
