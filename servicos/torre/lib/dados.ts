import type { SupabaseClient } from "@supabase/supabase-js";
import { lerTodos } from "./supabase";
import type { Categoria, Conta, Contrato, Entidade, Fatura, Movimento, Regra, Socio, SocioMovimento, Subscricao } from "./tipos";

export type Tudo = {
  socios: Socio[];
  contas: Conta[];
  categorias: Categoria[];
  entidades: Entidade[];
  subscricoes: Subscricao[];
  movimentos: Movimento[];
  sociosMov: SocioMovimento[];
  regras: Regra[];
  faturas: Fatura[];
  contratos: Contrato[];
};

/** Os dados da empresa cabem à vontade em memória (centenas a poucos milhares de linhas): lê-se tudo e conta-se no servidor. */
export async function carregar(s: SupabaseClient): Promise<Tudo> {
  const [socios, contas, categorias, entidades, subscricoes, movimentos, sociosMov, regras, faturas, contratos] = await Promise.all([
    lerTodos<Socio>(s, "socios"),
    lerTodos<Conta>(s, "contas"),
    lerTodos<Categoria>(s, "categorias"),
    lerTodos<Entidade>(s, "entidades"),
    lerTodos<Subscricao>(s, "subscricoes"),
    lerTodos<Movimento>(s, "movimentos", "data"),
    lerTodos<SocioMovimento>(s, "socios_movimentos", "data"),
    lerTodos<Regra>(s, "regras"),
    lerTodos<Fatura>(s, "faturas", "criado_em"),
    lerTodos<Contrato>(s, "contratos", "inicio"),
  ]);
  socios.sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  contas.sort((a, b) => ordemConta(a) - ordemConta(b) || a.nome.localeCompare(b.nome, "pt"));
  categorias.sort((a, b) => a.tipo.localeCompare(b.tipo) || a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt"));
  entidades.sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  subscricoes.sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  return { socios, contas, categorias, entidades, subscricoes, movimentos, sociosMov, regras, faturas, contratos };
}

function ordemConta(c: Conta): number {
  return { empresa: 0, conjunta: 1, cartao: 2, pessoal: 3 }[c.tipo];
}

export const ROTULO_TIPO_CONTA: Record<Conta["tipo"], string> = {
  empresa: "Conta da empresa",
  conjunta: "Conta conjunta dos sócios",
  pessoal: "Conta pessoal",
  cartao: "Cartão",
};

export const ROTULO_TIPO_CATEGORIA: Record<Categoria["tipo"], string> = {
  custo: "Custos",
  proveito: "Proveitos",
  interno: "Movimentos internos (fora do resultado)",
};
