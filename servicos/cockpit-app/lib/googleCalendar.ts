import { sbBrowser } from "@/lib/supabase-browser";
import type { Tarefa } from "@/lib/types";

// Endereço que abre o Google Calendar do próprio agente com a marcação já preenchida (só falta "Guardar").
// Não liga a nenhuma conta: o Cockpit não vê o Google do agente, por isso não sabe se a marcação foi guardada
// nem muda o evento sozinho se a data da tarefa mudar.
export function linkGoogleCalendar(t: Pick<Tarefa, "titulo" | "tipo" | "inicio" | "fim">): string {
  const inicio = new Date(t.inicio ?? Date.now());
  const fim = t.fim ? new Date(t.fim) : new Date(inicio.getTime() + (t.tipo === "evento" ? 60 : 15) * 60_000);
  const utc = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: t.titulo,
    dates: `${utc(inicio)}/${utc(fim)}`,
    details: "Tarefa do Cockpit.",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

// Caixa "Google Calendar": o agente escolhe, tarefa a tarefa, quais levar para o seu Google Calendar.
// Ao marcar abre-se o Google Calendar com a marcação preenchida; desmarcar só tira o visto aqui (o evento no Google fica).
// Devolve uma mensagem de erro ou null.
export async function alternarGoogleCalendar(t: Tarefa): Promise<string | null> {
  const quando = t.google_calendar_em ? null : new Date().toISOString();
  const { error } = await sbBrowser().from("tarefas").update({ google_calendar_em: quando }).eq("id", t.id);
  if (error) return "Não foi possível guardar. Falta atualizar a base de dados (migration_google_calendar.sql).";
  if (quando) window.open(linkGoogleCalendar(t), "_blank", "noopener");
  return null;
}
