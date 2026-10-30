import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Produto } from "../supabase/functions/_shared/nucleo";

// Lista de clientes (um projeto Supabase por cliente). Fica num ficheiro local, fora do git. Não contém segredos:
// a chave `anon` é pública por natureza; a chave de administrador (modo "chave") vem de uma variável de ambiente
// CHAVE_<ID> no ficheiro .env.local deste computador, e no modo "funcao" nem existe aqui.

export type Cliente = {
  id: string;
  nome: string;
  produto: Produto;
  supabase_url: string;
  anon_key: string;
  app_url?: string;
  /** Código da empresa no projeto Cockpit PARTILHADO (migracao_multiempresa.sql): várias empresas no mesmo Supabase. Com ele, a plataforma só vê e só toca em contas desta empresa. Sem ele, o projeto é de um só cliente. */
  empresa?: string;
  /** O projeto Cockpit PARTILHADO da Ace Labs (várias empresas). Não é um cliente: é onde se vê o Painel e as empresas. Só um cliente tem isto. */
  partilhado?: boolean;
  /** Código do cliente na app Cockpit com vários clientes num deploy (COCKPIT_CLIENTES). Sem ele o convite abre /nova-password. */
  codigo_app?: string;
  /** "chave": usa CHAVE_<ID> deste computador. "funcao": pede à função `admin` do cliente, com pedido assinado. */
  modo: "chave" | "funcao";
  notas?: string;
};

function ficheiro(): string {
  return process.env.CONTROLO_DADOS || path.join(process.cwd(), "dados", "clientes.json");
}

export function lerClientes(): Cliente[] {
  const f = ficheiro();
  if (!existsSync(f)) return [];
  try {
    return JSON.parse(readFileSync(f, "utf8")) as Cliente[];
  } catch {
    return [];
  }
}

function gravar(lista: Cliente[]) {
  const f = ficheiro();
  mkdirSync(path.dirname(f), { recursive: true });
  writeFileSync(f, JSON.stringify(lista, null, 2) + "\n");
}

export function obterCliente(id: string): Cliente | undefined {
  return lerClientes().find((c) => c.id === id);
}

export function slug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function guardarCliente(c: Cliente) {
  const lista = lerClientes().filter((x) => x.id !== c.id);
  lista.push(c);
  lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  gravar(lista);
}

export function removerCliente(id: string) {
  gravar(lerClientes().filter((c) => c.id !== id));
}

/** Nome da variável de ambiente com a chave de administrador deste cliente (modo "chave"). */
export function nomeVariavelChave(id: string): string {
  return `CHAVE_${id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
}
