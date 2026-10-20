import type { Tarefa } from "@/lib/types";
import { sameDayLocal } from "@/lib/calendario-util";

export const HORA_PX = 48;

export type Ocorrencia = { t: Tarefa; ini: Date; fim: Date; diaInteiro: boolean };

// Uma tarefa/marcação com data vira uma ocorrência no calendário. Às 00:00 e sem hora de fim
// é "dia inteiro". Sem hora de fim, uma marcação dura 1h e uma tarefa 30 min (só visual).
export function ocorrencia(t: Tarefa): Ocorrencia | null {
  if (!t.inicio) return null;
  const ini = new Date(t.inicio);
  const diaInteiro = ini.getHours() === 0 && ini.getMinutes() === 0 && !t.fim;
  const fim = t.fim ? new Date(t.fim) : new Date(ini.getTime() + (t.tipo === "evento" ? 60 : 30) * 60000);
  return { t, ini, fim, diaInteiro };
}

export const doDia = (ocs: Ocorrencia[], dia: Date) => ocs.filter((o) => sameDayLocal(o.ini, dia));

export type Colocada = { o: Ocorrencia; col: number; cols: number; topo: number; altura: number };

// Põe as ocorrências com hora lado a lado quando se sobrepõem (como no calendário da Apple).
export function colocar(ocs: Ocorrencia[], dia: Date): Colocada[] {
  const inicioDia = new Date(dia); inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(inicioDia); fimDia.setDate(fimDia.getDate() + 1);
  const minutos = (d: Date) => (d.getTime() - inicioDia.getTime()) / 60000;
  const lista = ocs
    .filter((o) => !o.diaInteiro)
    .map((o) => ({ o, a: minutos(o.ini), b: minutos(o.fim > fimDia ? fimDia : o.fim) }))
    .sort((x, y) => x.a - y.a || y.b - x.b);

  const out: Colocada[] = [];
  let grupo: { o: Ocorrencia; a: number; b: number; col: number }[] = [];
  let fimGrupo = -1;
  const fechar = () => {
    const cols = Math.max(1, ...grupo.map((g) => g.col + 1));
    for (const g of grupo) {
      const altura = Math.max(((g.b - g.a) / 60) * HORA_PX, 22);
      out.push({ o: g.o, col: g.col, cols, topo: (g.a / 60) * HORA_PX, altura });
    }
    grupo = [];
  };
  const fimPorColuna: number[] = [];
  for (const e of lista) {
    if (grupo.length && e.a >= fimGrupo) { fechar(); fimPorColuna.length = 0; }
    let col = fimPorColuna.findIndex((f) => f <= e.a);
    if (col === -1) col = fimPorColuna.length;
    fimPorColuna[col] = Math.max(e.b, e.a + (22 / HORA_PX) * 60);
    grupo.push({ ...e, col });
    fimGrupo = Math.max(fimGrupo, fimPorColuna[col]);
  }
  if (grupo.length) fechar();
  return out;
}

export const corItem = (t: Tarefa) =>
  t.feita
    ? "bg-black/5 text-secundario border-black/20"
    : t.tipo === "evento"
    ? "bg-azul/15 text-azul-escuro border-azul"
    : "bg-verde/15 text-tinta border-verde";
