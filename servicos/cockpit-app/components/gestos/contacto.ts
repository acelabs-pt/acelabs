import type { AcaoSwipe } from "@/components/gestos/SwipeLinha";

/** Gestos de contacto de uma linha com telemóvel: direita liga (e avisa quem chama, para registar a chamada), esquerda abre o WhatsApp. Sem telemóvel, sem gestos. */
export function swipeContacto(tel: string | null | undefined, aoLigar?: () => void): { direita?: AcaoSwipe; esquerda?: AcaoSwipe } {
  if (!tel) return {};
  return {
    direita: { rotulo: "Ligar", classe: "bg-azul text-white", onAcao: () => {
        aoLigar?.();
        window.location.href = `tel:${tel}`;
      },
    },
    esquerda: {
      rotulo: "WhatsApp",
      classe: "bg-verde text-tinta",
      onAcao: () => void window.open(`https://wa.me/${tel.replace(/\D/g, "")}`, "_blank", "noopener"),
    },
  };
}
