import type { Contacto } from "./types";

// Etiquetas e cores por estado de relação, partilhadas entre Hoje, Contactos
// e a ficha de contacto - mesma paleta usada no mockup validado pelos sócios
// (ver pesquisa-boas-praticas.md / especificacao-produto.md).
const ESTILO: Record<Contacto["estado_relacao"], { label: string; bg: string; texto: string }> = {
  lead_frio: { label: "Lead frio", bg: "bg-[#f0f0f2]", texto: "text-secundario" },
  lead_morno: { label: "Lead morno", bg: "bg-ambar-fundo", texto: "text-ambar-texto" },
  lead_quente: { label: "Lead quente", bg: "bg-ambar-texto", texto: "text-white" },
  cliente_comprador: { label: "Cliente comprador", bg: "bg-[#eaf3fd]", texto: "text-azul-escuro" },
  cliente_proprietario: { label: "Cliente proprietário", bg: "bg-[#e8f7ee]", texto: "text-[#167a3e]" },
};

export function rotuloEstado(estado: Contacto["estado_relacao"]) {
  return ESTILO[estado].label;
}

export function estiloEstado(estado: Contacto["estado_relacao"]) {
  return ESTILO[estado];
}

export function diasDesde(data: string | null, agora: string) {
  if (!data) return "Sem contacto registado";
  const dias = Math.floor(
    (new Date(agora).getTime() - new Date(data).getTime()) / (1000 * 60 * 60 * 24)
  );
  return `Sem contacto há ${dias} dia${dias === 1 ? "" : "s"}`;
}
