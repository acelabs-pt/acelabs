// Ficheiro de calendário (iCalendar, RFC 5545) para uma tarefa ou marcação, com alarme.
// O calendário do telemóvel passa a avisar com notificação nativa, sem precisar de push.
// Funções puras: correm no servidor (rota da API) e nos testes.

export type EventoIcs = {
  id: string;
  titulo: string;
  tipo: "tarefa" | "evento";
  inicio: string; // ISO
  fim: string | null;
  telefone?: string | null;
  url?: string | null;
};

const FUSO = "Europe/Lisbon";

/** Partes da data/hora em Lisboa (o servidor corre em UTC). */
function emLisboa(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  );
  return { a: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute };
}

/** Tarefas sem hora guardam-se à meia-noite de Lisboa: são de dia inteiro. */
export function eDiaInteiro(iso: string): boolean {
  const l = emLisboa(new Date(iso));
  return l.h === "00" && l.min === "00";
}

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dataLisboa = (d: Date) => {
  const l = emLisboa(d);
  return `${l.a}${l.m}${l.d}`;
};
const escapar = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Linhas com mais de 75 bytes dobram-se (RFC 5545, 3.1), sem partir caracteres acentuados. */
function dobrar(linha: string): string {
  const enc = new TextEncoder();
  const partes: string[] = [];
  let atual = "";
  for (const ch of linha) {
    const limite = partes.length === 0 ? 75 : 74; // as continuações começam com um espaço
    if (enc.encode(atual + ch).length > limite) {
      partes.push(atual);
      atual = ch;
    } else atual += ch;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

export function gerarIcs(e: EventoIcs, agora = new Date()): string {
  const ini = new Date(e.inicio);
  const diaInteiro = eDiaInteiro(e.inicio);
  const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ace Labs//Cockpit//PT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT"];
  linhas.push(`UID:${e.id}@cockpit.acelabs.pt`, `DTSTAMP:${utc(agora)}`);
  if (diaInteiro) {
    const seguinte = new Date(ini.getTime() + 36 * 3600000); // meio-dia do dia seguinte, a salvo da mudança de hora
    linhas.push(`DTSTART;VALUE=DATE:${dataLisboa(ini)}`, `DTEND;VALUE=DATE:${dataLisboa(seguinte)}`);
  } else {
    const minutos = e.tipo === "evento" ? 60 : 30;
    const fim = e.fim && new Date(e.fim) > ini ? new Date(e.fim) : new Date(ini.getTime() + minutos * 60000);
    linhas.push(`DTSTART:${utc(ini)}`, `DTEND:${utc(fim)}`);
  }
  linhas.push(`SUMMARY:${escapar(e.titulo)}`);
  const descricao = [e.telefone ? `Telefone: ${e.telefone}` : "", e.url ? `No Cockpit: ${e.url}` : ""].filter(Boolean).join("\n");
  if (descricao) linhas.push(`DESCRIPTION:${escapar(descricao)}`);
  if (e.url) linhas.push(`URL:${e.url}`);
  // marcações: 30 minutos antes; tarefas com hora: à hora; dia inteiro: às 9h desse dia
  const aviso = diaInteiro ? "PT9H" : e.tipo === "evento" ? "-PT30M" : "PT0M";
  linhas.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapar(e.titulo)}`, `TRIGGER:${aviso}`, "END:VALARM");
  linhas.push("END:VEVENT", "END:VCALENDAR");
  return linhas.map(dobrar).join("\r\n") + "\r\n";
}

/** Nome do ficheiro só com letras simples (para o cabeçalho Content-Disposition). */
export function nomeFicheiroIcs(titulo: string): string {
  const slug = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "cockpit"}.ics`;
}
