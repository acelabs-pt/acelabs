// Extraído de app/cpcv/page.tsx para ser reutilizado também em app/cpcv/admin/page.tsx
// (resumo por gestora), sem duplicar a mesma conta duas vezes.

export const ESTADO_LABEL: Record<string, string> = {
  em_preenchimento: "Em preenchimento",
  pronto_para_aprovacao: "Pronto para aprovação",
  aprovado: "Aprovado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export type Processo = {
  id: string;
  criado_por: string;
  estado: string;
  imovel_morada: string | null;
  criado_em: string;
  atualizado_em: string;
  campos_em_falta: { campo: string; pergunta: string }[] | null;
  aprovado_por?: string | null;
};

export function tempoMedioConclusao(processos: Processo[]): string {
  // Aproximação: usa atualizado_em, que também muda se o processo for depois fechado
  // (concluído/cancelado) - nesses casos o "tempo até aprovar" fica sobrestimado.
  const concluidos = processos.filter((p) => p.estado === "aprovado" || p.estado === "concluido");
  if (concluidos.length === 0) return "-";

  const totalMs = concluidos.reduce((soma, p) => {
    const inicio = new Date(p.criado_em).getTime();
    const fim = new Date(p.atualizado_em).getTime();
    return soma + Math.max(0, fim - inicio);
  }, 0);

  const mediaMs = totalMs / concluidos.length;
  return formatarDuracao(mediaMs);
}

function formatarDuracao(ms: number): string {
  const mediaMin = ms / 1000 / 60;
  if (mediaMin < 60) return `${Math.round(mediaMin)} min`;
  const mediaHoras = mediaMin / 60;
  if (mediaHoras < 24) return `${mediaHoras.toFixed(1)} h`;
  return `${(mediaHoras / 24).toFixed(1)} dias`;
}

export function processosPorDia(processos: Processo[]): { dias: string[]; contagens: number[] } {
  const porDia = new Map<string, number>();
  for (const p of processos) {
    const dia = new Date(p.criado_em).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }
  const diasOrdenados = Array.from(porDia.keys()).sort((a, b) => {
    const [da, ma] = a.split("/").map(Number);
    const [db, mb] = b.split("/").map(Number);
    return ma === mb ? da - db : ma - mb;
  });
  return { dias: diasOrdenados, contagens: diasOrdenados.map((d) => porDia.get(d) ?? 0) };
}

export type ResumoGestora = {
  id: string;
  nome: string;
  aprovados: number;
  concluidos: number;
  tempoMedio: string;
};

// Só mede o que os dados permitem honestamente: quantos cada gestora/admin aprovou e a
// velocidade a que o fez. Não existe hoje uma "fila atribuída por gestora" antes da
// aprovação (qualquer gestora/admin aprova qualquer processo pendente), por isso não se
// finge aqui uma carga de trabalho por pessoa que os dados não sustentam.
export function resumoPorGestora(
  processos: Processo[],
  gestoras: { id: string; nome: string }[]
): { porGestora: ResumoGestora[]; semGestoraAtribuida: number } {
  const porGestora = gestoras.map((g) => {
    const dela = processos.filter((p) => p.aprovado_por === g.id);
    return {
      id: g.id,
      nome: g.nome,
      aprovados: dela.filter((p) => p.estado === "aprovado" || p.estado === "concluido").length,
      concluidos: dela.filter((p) => p.estado === "concluido").length,
      tempoMedio: tempoMedioConclusao(dela),
    };
  });

  const semGestoraAtribuida = processos.filter(
    (p) => (p.estado === "aprovado" || p.estado === "concluido") && !p.aprovado_por
  ).length;

  return { porGestora, semGestoraAtribuida };
}
