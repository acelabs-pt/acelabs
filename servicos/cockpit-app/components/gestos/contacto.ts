import type { AcaoSwipe } from "@/components/gestos/SwipeLinha";

/** Gestos de contacto de uma linha com telemóvel: direita liga, esquerda abre o WhatsApp. Sem telemóvel, sem gestos. */
export function swipeContacto(tel: string | null | undefined): { direita?: AcaoSwipe; esquerda?: AcaoSwipe } {
  if (!tel) return {};
  return {
    direita: { rotulo: "Ligar", classe: "bg-azul text-white", onAcao: () => void (window.location.href = `tel:${tel}`) },
    esquerda: {
      rotulo: "WhatsApp",
      classe: "bg-verde text-white",
      onAcao: () => void window.open(`https://wa.me/${tel.replace(/\D/g, "")}`, "_blank", "noopener"),
    },
  };
}
