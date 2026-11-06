"use server";

import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";

export type Resultado = { tipo: "movimento" | "fatura" | "entidade" | "debito" | "conta"; id: string; titulo: string; detalhe: string; valor?: number; moeda?: string; href: string; procura: string };

/** Tudo o que a pesquisa rápida (Ctrl K) encontra. Pequeno o suficiente para ir de uma vez para o browser. */
export async function indicePesquisa(): Promise<Resultado[]> {
  const { s } = await exigirSocio();
  const t = await carregar(s);
  const conta = new Map(t.contas.map((c) => [c.id, c.nome]));
  const categoria = new Map(t.categorias.map((c) => [c.id, c.nome]));
  const r: Resultado[] = [];
  for (const f of t.faturas)
    r.push({
      tipo: "fatura",
      id: f.id,
      titulo: f.emitente_nome || f.ficheiro_nome || "Fatura",
      detalhe: [f.numero, f.data?.split("-").reverse().join("/"), f.estado === "rever" ? "por rever" : null].filter(Boolean).join(", "),
      valor: f.total ?? undefined,
      moeda: f.moeda,
      href: `/faturas/${f.id}`,
      procura: [f.emitente_nome, f.emitente_nif, f.numero, f.descricao, f.ficheiro_nome, f.total ? (f.total / 100).toFixed(2) : ""].join(" "),
    });
  for (const e of t.entidades)
    r.push({ tipo: "entidade", id: e.id, titulo: e.nome, detalhe: [e.tipo === "cliente" ? "Cliente" : "Fornecedor", e.nif].filter(Boolean).join(", "), href: `/contactos/${e.id}`, procura: `${e.nome} ${e.nif ?? ""}` });
  for (const d of t.subscricoes) r.push({ tipo: "debito", id: d.id, titulo: d.nome, detalhe: `Débito ${d.periodicidade}`, valor: d.valor_previsto ? -d.valor_previsto : undefined, href: `/debitos/${d.id}`, procura: `${d.nome} ${d.padrao ?? ""}` });
  for (const c of t.contas) r.push({ tipo: "conta", id: c.id, titulo: c.nome, detalhe: "Conta", href: `/movimentos?conta=${c.id}`, procura: `${c.nome} ${c.banco ?? ""}` });
  for (const m of t.movimentos.slice(0, 3000))
    r.push({
      tipo: "movimento",
      id: m.id,
      titulo: m.descricao,
      detalhe: [m.data.split("-").reverse().join("/"), conta.get(m.conta_id), m.categoria_id ? categoria.get(m.categoria_id) : "por classificar"].filter(Boolean).join(", "),
      valor: m.valor,
      href: `/movimentos/${m.id}`,
      procura: `${m.descricao} ${(Math.abs(m.valor) / 100).toFixed(2)} ${(Math.abs(m.valor) / 100).toFixed(2).replace(".", ",")} ${m.notas ?? ""}`,
    });
  return r;
}
