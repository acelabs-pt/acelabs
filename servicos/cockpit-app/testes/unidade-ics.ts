// Ficheiro de calendário: horas em UTC, dia inteiro em Lisboa, alarmes e linhas dobradas.
import { eDiaInteiro, gerarIcs, nomeFicheiroIcs } from "../lib/ics";

let mal = 0;
const eq = (nome: string, obtido: unknown, esperado: unknown) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) mal++;
  console.log(`${ok ? "OK   " : "FALHA"} ${nome}${ok ? "" : `: obtido ${JSON.stringify(obtido)}, esperado ${JSON.stringify(esperado)}`}`);
};
const linhas = (s: string) => s.replace(/\r\n /g, "").split("\r\n");
const campo = (s: string, k: string) => linhas(s).find((l) => l.startsWith(k));
const agora = new Date("2026-10-24T08:00:00Z");

// visita às 15h de Lisboa (verão: UTC+1)
const v = gerarIcs({ id: "abc", titulo: "Visita T2 Creixomil, com Ana; levar chaves", tipo: "evento", inicio: "2026-10-20T14:00:00Z", fim: null, telefone: "+351912345678", url: "https://x.pt/crm/compradores/1" }, agora);
eq("linhas terminam em CRLF", v.split("\n").every((l, i, a) => i === a.length - 1 || l.endsWith("\r")), true);
eq("início em UTC", campo(v, "DTSTART"), "DTSTART:20261020T140000Z");
eq("marcação sem fim dura 1 hora", campo(v, "DTEND"), "DTEND:20261020T150000Z");
eq("vírgula e ponto e vírgula escapados", campo(v, "SUMMARY"), "SUMMARY:Visita T2 Creixomil\\, com Ana\\; levar chaves");
eq("alarme 30 minutos antes", campo(v, "TRIGGER"), "TRIGGER:-PT30M");
eq("telefone e ligação na descrição", campo(v, "DESCRIPTION:Telefone"), "DESCRIPTION:Telefone: +351912345678\\nNo Cockpit: https://x.pt/crm/compradores/1");
eq("UID estável pela tarefa", campo(v, "UID"), "UID:abc@cockpit.acelabs.pt");

// tarefa sem hora: meia-noite de Lisboa (inverno: UTC+0; verão: 23h UTC do dia anterior)
eq("meia-noite de Lisboa no verão é dia inteiro", eDiaInteiro("2026-08-09T23:00:00Z"), true);
eq("meia-noite UTC no verão não é dia inteiro", eDiaInteiro("2026-08-10T00:00:00Z"), false);
const d = gerarIcs({ id: "d", titulo: "Ligar", tipo: "tarefa", inicio: "2026-08-09T23:00:00Z", fim: null }, agora);
eq("dia inteiro com a data de Lisboa", [campo(d, "DTSTART"), campo(d, "DTEND")], ["DTSTART;VALUE=DATE:20260810", "DTEND;VALUE=DATE:20260811"]);
eq("dia inteiro avisa às 9h", campo(d, "TRIGGER"), "TRIGGER:PT9H");
const m = gerarIcs({ id: "m", titulo: "Ligar", tipo: "tarefa", inicio: "2026-03-29T00:00:00Z", fim: null }, agora);
eq("dia da mudança de hora (29 mar) acaba no dia seguinte", campo(m, "DTEND"), "DTEND;VALUE=DATE:20260330");
const h = gerarIcs({ id: "h", titulo: "Enviar proposta", tipo: "tarefa", inicio: "2026-10-20T09:30:00Z", fim: null }, agora);
eq("tarefa com hora avisa à hora e dura 30 min", [campo(h, "TRIGGER"), campo(h, "DTEND")], ["TRIGGER:PT0M", "DTEND:20261020T100000Z"]);

// linhas longas com acentos dobram sem partir caracteres
const longo = gerarIcs({ id: "l", titulo: "Reunião de angariação com o proprietário do apartamento T3 em São João da Madeira, Aveiro", tipo: "evento", inicio: "2026-10-20T14:00:00Z", fim: null }, agora);
const enc = new TextEncoder();
eq("nenhuma linha física passa de 75 bytes", longo.split("\r\n").every((l) => enc.encode(l).length <= 75), true);
eq("o título volta inteiro depois de desdobrar", campo(longo, "SUMMARY"), "SUMMARY:Reunião de angariação com o proprietário do apartamento T3 em São João da Madeira\\, Aveiro");
eq("nome do ficheiro sem acentos", nomeFicheiroIcs("Visita à Conceição, T2"), "visita-a-conceicao-t2.ics");

console.log(mal ? `${mal} FALHAS` : "todos ok");
