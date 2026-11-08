import { sbBrowser } from "@/lib/supabase-browser";
import { todas } from "@/lib/todas";

// Janela de trabalho das tarefas automáticas: das 9:00 às 19:00 (a última hora de início é 18:30).
const INICIO = 9 * 60;
const FIM = 19 * 60;
// Tenta primeiro 30 minutos entre tarefas; se o dia estiver cheio, 15 e, no limite, 5.
const PASSOS = [30, 15, 5];

const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const minutosDoDia = (d: Date) => d.getHours() * 60 + d.getMinutes();

/**
 * Escolhe uma hora para cada tarefa automática, sem a pôr à mesma hora de outra já marcada nesse dia
 * (tarefas e marcações como visitas, reuniões e escrituras contam como ocupadas e nunca são mexidas).
 * Procura primeiro um intervalo livre com 30 minutos de folga; só se o dia estiver cheio é que aperta para 15 e, no limite, 5.
 * No próprio dia, não escolhe horas que já passaram. Devolve as horas pela ordem dos pedidos.
 */
export async function distribuirHoras(pedidos: { chave: string; dia: Date }[]): Promise<Date[]> {
  if (pedidos.length === 0) return [];
  const tempos = pedidos.map((p) => new Date(p.dia).setHours(0, 0, 0, 0));
  const de = new Date(Math.min(...tempos));
  const ate = new Date(Math.max(...tempos));
  ate.setDate(ate.getDate() + 1);
  const dias = new Set(pedidos.map((p) => chaveDia(p.dia)));

  // minutos já ocupados em cada dia
  const ocupados = new Map<string, number[]>();
  const doDia = (d: Date) => {
    const k = chaveDia(d);
    let v = ocupados.get(k);
    if (!v) ocupados.set(k, (v = []));
    return v;
  };
  const sb = sbBrowser();
  const { data } = await todas<{ inicio: string }>((a, b) =>
    sb.from("tarefas").select("id, inicio").gte("inicio", de.toISOString()).lt("inicio", ate.toISOString()).order("id").range(a, b)
  );
  for (const t of data) {
    const d = new Date(t.inicio);
    if (dias.has(chaveDia(d))) doDia(d).push(minutosDoDia(d));
  }

  const agora = new Date();
  return pedidos.map((p) => {
    const lista = doDia(p.dia);
    // no próprio dia, só horas que ainda não passaram (arredondadas aos 30 minutos seguintes)
    const minimo = chaveDia(p.dia) === chaveDia(agora) ? Math.max(INICIO, Math.ceil((minutosDoDia(agora) + 1) / 30) * 30) : INICIO;
    const livre = (m: number, passo: number) => !lista.some((o) => o > m - passo && o < m + passo);
    let escolhido: number | null = null;
    for (const passo of PASSOS) {
      for (let m = minimo; m < FIM && escolhido === null; m += passo) {
        if (livre(m, passo)) escolhido = m;
      }
      if (escolhido !== null) break;
    }
    if (escolhido === null) {
      // dia cheio (ou já só restam horas passadas): usa o intervalo menos ocupado da janela
      let menos = Infinity;
      for (let m = INICIO; m < FIM; m += 30) {
        const n = lista.filter((o) => o >= m && o < m + 30).length;
        if (n < menos) {
          menos = n;
          escolhido = m;
        }
      }
    }
    lista.push(escolhido ?? INICIO);
    const h = new Date(p.dia);
    h.setHours(Math.floor((escolhido ?? INICIO) / 60), (escolhido ?? INICIO) % 60, 0, 0);
    return h;
  });
}
