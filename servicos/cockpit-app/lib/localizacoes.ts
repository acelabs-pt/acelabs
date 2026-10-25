import dados from "@/data/localizacoes.json";

// distrito -> concelho -> freguesias (CAOP 2025, ver data/LEIAME.md)
const ARVORE = dados as Record<string, Record<string, string[]>>;

export const DISTRITOS = Object.keys(ARVORE);

export function concelhosDe(distrito: string): string[] {
  return distrito && ARVORE[distrito] ? Object.keys(ARVORE[distrito]) : [];
}

export function freguesiasDe(distrito: string, concelho: string): string[] {
  return ARVORE[distrito]?.[concelho] ?? [];
}

// Mantém na lista um valor antigo (escrito à mão antes dos seletores) que não exista nas opções,
// para não o perder ao editar um comprador.
export function incluirAtual(opcoes: string[], atual: string): string[] {
  return atual && !opcoes.includes(atual) ? [atual, ...opcoes] : opcoes;
}

// Zona de procura de um comprador. Só o distrito = distrito inteiro; com concelho = concelho
// inteiro; com freguesia = só essa freguesia.
export type Local = { distrito: string; concelho?: string; freguesia?: string };

export function etiquetaLocal(l: Local): string {
  if (l.freguesia) return `${l.freguesia}, ${l.concelho}`;
  if (l.concelho) return `${l.concelho} (todo o concelho)`;
  return `${l.distrito} (todo o distrito)`;
}

// Resumo curto para listas: "Guimarães, Braga" ou "3 zonas" quando são muitas.
export function resumoLocais(locais: Local[] | null | undefined): string {
  if (!locais || locais.length === 0) return "";
  const nomes = locais.map((l) => l.freguesia || l.concelho || l.distrito);
  return nomes.length <= 2 ? nomes.join(", ") : `${nomes.length} zonas`;
}

// Alguma das zonas do comprador sobrepõe-se à zona escolhida no filtro (qualquer nível).
export function localCobre(
  locais: Local[] | null | undefined,
  f: { distrito: string; concelho: string; freguesia: string }
): boolean {
  return (locais ?? []).some(
    (l) =>
      l.distrito === f.distrito &&
      (!f.concelho || !l.concelho || l.concelho === f.concelho) &&
      (!f.freguesia || !l.freguesia || l.freguesia === f.freguesia)
  );
}
