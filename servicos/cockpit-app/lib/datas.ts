// Datas no fuso do browser (o consultor está em Portugal). Semana começa à segunda.

export function inicioDoDia(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function somarDias(d: Date, dias: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
}

export function inicioDaSemana(d: Date): Date {
  const r = inicioDoDia(d);
  const diaSemana = (r.getDay() + 6) % 7; // segunda = 0
  return somarDias(r, -diaSemana);
}

export function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatarDia(d: Date): string {
  return d.toLocaleDateString("pt-PT", { weekday: "short", day: "numeric", month: "short" });
}

export function formatarHora(iso: string): string {
  const d = new Date(iso);
  if (d.getHours() === 0 && d.getMinutes() === 0) return "";
  return d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

// Valor para <input type="datetime-local"> (sem fuso) -> ISO com fuso do browser
export function localParaISO(valor: string): string {
  return new Date(valor).toISOString();
}

export function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// Dias de hoje até uma data "YYYY-MM-DD" (negativo se já passou)
export function diasAte(data: string): number {
  const alvo = inicioDoDia(new Date(data + "T00:00:00"));
  return Math.round((alvo.getTime() - inicioDoDia(new Date()).getTime()) / 86400000);
}

export function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Identificador da semana ISO, ex: 2026-W42 (usado nas chaves das tarefas semanais)
export function semanaISO(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((t.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

// ISO -> valor de <input type="datetime-local"> no fuso do browser
export function isoParaLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function somarMeses(d: Date, n: number): Date {
  const alvo = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const diasNoMes = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d.getDate(), diasNoMes));
  return alvo;
}

// "YYYY-MM-DD" no fuso do browser
export function isoDataLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
