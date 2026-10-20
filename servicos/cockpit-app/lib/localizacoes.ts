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
