import { sbBrowser } from "@/lib/supabase-browser";
import { todas } from "@/lib/todas";
import { horaDistribuida } from "@/lib/datas";

// Janela de trabalho para as tarefas automáticas: 9:00 a 18:45, em intervalos de 15 minutos (40 por dia).
const PRIMEIRO = 9 * 4; // 9:00 em quartos de hora
const SLOTS = 40;

const chaveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * Escolhe uma hora para cada tarefa automática sem as pôr à mesma hora de outra já marcada nesse dia.
 * Olha para o calendário (tarefas e marcações já existentes) e vai ocupando os intervalos livres; só quando
 * o dia está cheio (mais de 40 itens) é que repete o intervalo menos ocupado. Devolve as horas pela ordem dos pedidos.
 */
export async function distribuirHoras(pedidos: { chave: string; dia: Date }[]): Promise<Date[]> {
  if (pedidos.length === 0) return [];
  const ocupacao = new Map<string, number[]>();
  const slotsDe = (d: Date) => {
    const k = chaveDia(d);
    let v = ocupacao.get(k);
    if (!v) ocupacao.set(k, (v = new Array(SLOTS).fill(0)));
    return v;
  };

  const tempos = pedidos.map((p) => new Date(p.dia).setHours(0, 0, 0, 0));
  const de = new Date(Math.min(...tempos));
  const ate = new Date(Math.max(...tempos));
  ate.setDate(ate.getDate() + 1);
  const dias = new Set(pedidos.map((p) => chaveDia(p.dia)));

  const sb = sbBrowser();
  const { data } = await todas<{ inicio: string }>((a, b) =>
    sb.from("tarefas").select("id, inicio").gte("inicio", de.toISOString()).lt("inicio", ate.toISOString()).order("id").range(a, b)
  );
  for (const t of data) {
    const d = new Date(t.inicio);
    if (!dias.has(chaveDia(d))) continue;
    const s = Math.floor((d.getHours() * 60 + d.getMinutes()) / 15) - PRIMEIRO;
    if (s >= 0 && s < SLOTS) slotsDe(d)[s]++;
  }

  return pedidos.map((p) => {
    const slots = slotsDe(p.dia);
    // começa num ponto estável (da chave) e fica com o primeiro intervalo livre a partir daí
    const base = horaDistribuida(p.dia, p.chave);
    const inicio = Math.floor((base.getHours() * 60 + base.getMinutes()) / 15) - PRIMEIRO;
    let melhor = inicio;
    for (let i = 0; i < SLOTS; i++) {
      const s = (inicio + i) % SLOTS;
      if (slots[s] < slots[melhor]) melhor = s;
      if (slots[s] === 0) {
        melhor = s;
        break;
      }
    }
    slots[melhor]++;
    const h = new Date(p.dia);
    const minutos = (PRIMEIRO + melhor) * 15;
    h.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0);
    return h;
  });
}
