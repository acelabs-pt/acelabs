// Ligar faturas a movimentos do banco, e adivinhar fornecedor e categoria. Funções puras (testadas em testes/unidade.ts).

import { normalizar } from "./texto";
import type { Categoria, Entidade, Fatura, Movimento } from "./tipos";

export type Sugestao = { movimento: Movimento; pontos: number; motivos: string[] };

function dias(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** Palavras que contam para comparar nomes (sem "lda", "sa", "inc" e afins, que estão em todo o lado). */
const VAZIAS = new Set(["lda", "sa", "s", "a", "inc", "llc", "ltd", "ltda", "unipessoal", "limited", "gmbh", "bv", "the", "de", "da", "do", "e", "pbc", "corp", "corporation", "company", "co", "portugal"]);
export function palavras(texto: string | null | undefined): string[] {
  return normalizar(texto ?? "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 3 && !VAZIAS.has(p));
}

/** O nome do fornecedor aparece na descrição do movimento? (ex.: "Vercel Inc." em "DD VERCEL INC 4417") */
export function nomeCombina(nome: string | null | undefined, descricao: string): boolean {
  const p = palavras(nome);
  if (!p.length) return false;
  const d = new Set(palavras(descricao));
  return p.some((x) => d.has(x) || [...d].some((y) => y.length >= 4 && (y.startsWith(x) || x.startsWith(y))));
}

/**
 * Movimentos que podem ter pago (ou recebido) esta fatura, do mais provável para o menos.
 * Conta o valor (quando a fatura é em EUR), o fornecedor, o nome na descrição e a proximidade das datas.
 */
export function sugerirMovimentos(f: Pick<Fatura, "sentido" | "total" | "total_eur" | "moeda" | "data" | "entidade_id" | "emitente_nome">, movimentos: Movimento[], ocupados: Set<string>): Sugestao[] {
  const alvo = f.moeda === "EUR" ? f.total : f.total_eur;
  const r: Sugestao[] = [];
  for (const m of movimentos) {
    if (ocupados.has(m.id)) continue;
    if (f.sentido === "recebida" ? m.valor >= 0 : m.valor <= 0) continue;
    let pontos = 0;
    const motivos: string[] = [];
    if (alvo) {
      const dif = Math.abs(Math.abs(m.valor) - Math.abs(alvo));
      if (dif === 0) {
        pontos += 50;
        motivos.push("mesmo valor");
      } else if (dif <= Math.max(2, Math.abs(alvo) * 0.02)) {
        pontos += 30;
        motivos.push("valor quase igual");
      } else if (f.moeda === "EUR") continue;
    }
    if (f.entidade_id && m.entidade_id === f.entidade_id) {
      pontos += 30;
      motivos.push("mesmo fornecedor");
    } else if (nomeCombina(f.emitente_nome, m.descricao)) {
      pontos += 25;
      motivos.push("nome na descrição");
    }
    if (f.data) {
      const d = dias(f.data, m.data);
      // Pagamentos costumam vir pouco depois da fatura (débitos e cartões no próprio dia; transferências até 45 dias).
      if (d < -10 || d > 60) continue;
      const perto = d >= -3 && d <= 7 ? 20 : d <= 30 ? 10 : 3;
      pontos += perto;
      if (perto >= 10) motivos.push(d === 0 ? "mesmo dia" : `${Math.abs(d)} dia${Math.abs(d) === 1 ? "" : "s"} ${d < 0 ? "antes" : "depois"}`);
    }
    if (pontos >= 40) r.push({ movimento: m, pontos, motivos });
  }
  return r.sort((a, b) => b.pontos - a.pontos).slice(0, 5);
}

/** A sugestão de cima é tão clara que se pode ligar sem perguntar? (valor igual, fornecedor certo, data perto, e sem empate) */
export function ligacaoSegura(s: Sugestao[]): Sugestao | null {
  const [a, b] = s;
  if (!a || a.pontos < 90) return null;
  if (b && b.pontos >= a.pontos - 10) return null;
  return a;
}

/** Fornecedor já conhecido: pelo NIF e, se não houver, pelo nome. */
export function encontrarEntidade(nif: string | null | undefined, nome: string | null | undefined, entidades: Entidade[]): Entidade | null {
  if (nif) {
    const porNif = entidades.find((e) => e.nif === nif);
    if (porNif) return porNif;
  }
  const p = palavras(nome);
  if (!p.length) return null;
  return entidades.find((e) => {
    const q = palavras(e.nome);
    return q.length > 0 && q.every((x) => p.includes(x));
  }) ?? null;
}

/** Categoria mais provável: a última usada com este fornecedor (em faturas ou movimentos), senão a que a IA sugeriu. */
export function sugerirCategoria(entidadeId: string | null, sugeridaIa: string | null, faturas: Fatura[], movimentos: Movimento[], categorias: Categoria[]): string | null {
  if (entidadeId) {
    const f = faturas.find((x) => x.entidade_id === entidadeId && x.categoria_id && x.estado === "confirmada");
    if (f) return f.categoria_id;
    const m = movimentos.find((x) => x.entidade_id === entidadeId && x.categoria_id);
    if (m) return m.categoria_id;
  }
  if (sugeridaIa) {
    const n = normalizar(sugeridaIa);
    const c = categorias.find((x) => x.ativa && normalizar(x.nome) === n);
    if (c) return c.id;
  }
  return null;
}

/** Despesas que deviam ter fatura e não têm (fora movimentos internos, taxas bancárias e impostos). */
export function semFatura(movimentos: Movimento[], faturas: Fatura[], categorias: Categoria[]): Movimento[] {
  const ligados = new Set(faturas.map((f) => f.movimento_id).filter(Boolean) as string[]);
  const dispensa = new Set(categorias.filter((c) => c.tipo === "interno" || c.grupo === "Taxas e impostos").map((c) => c.id));
  return movimentos.filter((m) => m.valor < 0 && !ligados.has(m.id) && !(m.categoria_id && dispensa.has(m.categoria_id)));
}
