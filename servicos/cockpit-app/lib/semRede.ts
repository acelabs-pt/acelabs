// Lista do dia para mostrar sem rede (public/offline.html lê a mesma chave).
// Fica só no telemóvel do agente, só com o que o cartão "Hoje" mostra, e apaga-se ao sair
// ou ao abrir o login (sessão terminada). A página sem rede só a mostra se for de hoje.
import type { Tarefa } from "@/lib/types";
import { apagarDiaNativo, guardarDiaNativo } from "@/lib/nativo";

export const CHAVE_DIA = "cockpit-dia";

export type DiaGuardado = {
  dia: string; // aaaa-mm-dd, hora local
  guardado_em: string;
  tarefas: { titulo: string; inicio: string; atrasada: boolean; tel: string | null }[];
  proxima: { titulo: string; inicio: string } | null;
};

const diaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function guardarDia(tarefas: Tarefa[], telefone: (t: Tarefa) => string | null) {
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const amanha = new Date(hoje.getTime() + 86400000);
  const lista = tarefas
    .filter((t) => !t.feita && t.inicio && new Date(t.inicio) < amanha)
    .sort((a, b) => a.inicio!.localeCompare(b.inicio!))
    .slice(0, 20)
    .map((t) => ({ titulo: t.titulo, inicio: t.inicio!, atrasada: new Date(t.inicio!) < hoje, tel: telefone(t) }));
  const prox = tarefas
    .filter((t) => !t.feita && t.tipo === "evento" && t.inicio && new Date(t.inicio) >= agora)
    .sort((a, b) => a.inicio!.localeCompare(b.inicio!))[0];
  const dia: DiaGuardado = {
    dia: diaLocal(agora),
    guardado_em: agora.toISOString(),
    tarefas: lista,
    proxima: prox ? { titulo: prox.titulo, inicio: prox.inicio! } : null,
  };
  try {
    localStorage.setItem(CHAVE_DIA, JSON.stringify(dia));
  } catch {
    // modo privado ou armazenamento cheio: a página sem rede mostra só a mensagem
  }
  void guardarDiaNativo(JSON.stringify(dia)); // na casca iOS o ecrã sem ligação lê daqui
}

export function apagarDia() {
  try {
    localStorage.removeItem(CHAVE_DIA);
  } catch {
    // nada a apagar
  }
  void apagarDiaNativo();
}
