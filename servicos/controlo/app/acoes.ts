"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { criarCookie, cookieValido, passwordCerta } from "@/lib/sessao";
import { guardarCliente, obterCliente, removerCliente, slug, lerClientes, type Cliente } from "@/lib/clientes";
import { criarEm, removerEm, suspenderEm } from "@/lib/acoes";
import { PAPEIS } from "../supabase/functions/_shared/nucleo";

export type Resposta = { ok?: boolean; erro?: string; aviso?: string; passwordTemporaria?: string };

/** Todas as ações e páginas passam por aqui: sem sessão válida vai para o login. */
export async function exigirSessao(): Promise<void> {
  const c = await cookies();
  if (!cookieValido(c.get("controlo")?.value)) redirect("/login");
}

// Travão simples contra tentativas seguidas (o computador é de uso pessoal, mas custa pouco).
let falhas: { n: number; ate: number } = { n: 0, ate: 0 };

export async function entrar(_: Resposta, f: FormData): Promise<Resposta> {
  if (Date.now() < falhas.ate) return { erro: "Demasiadas tentativas. Espera um minuto." };
  if (!passwordCerta(String(f.get("password") ?? ""))) {
    falhas = { n: falhas.n + 1, ate: falhas.n + 1 >= 5 ? Date.now() + 60_000 : 0 };
    return { erro: "Password errada." };
  }
  falhas = { n: 0, ate: 0 };
  const { valor, maxAge } = criarCookie();
  (await cookies()).set("controlo", valor, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  redirect("/");
}

export async function sair() {
  (await cookies()).delete("controlo");
  redirect("/login");
}

export async function novoCliente(_: Resposta, f: FormData): Promise<Resposta> {
  await exigirSessao();
  const nome = String(f.get("nome") ?? "").trim();
  const produto = String(f.get("produto")) === "cpcv" ? "cpcv" : "cockpit";
  const url = String(f.get("supabase_url") ?? "").trim().replace(/\/$/, "");
  const anon = String(f.get("anon_key") ?? "").trim();
  const appUrl = String(f.get("app_url") ?? "").trim().replace(/\/$/, "");
  const codigoApp = String(f.get("codigo_app") ?? "").trim().toLowerCase();
  const modo = String(f.get("modo")) === "funcao" ? "funcao" : "chave";
  if (!nome) return { erro: "Indica o nome do cliente." };
  if (codigoApp && !/^[a-z0-9-]+$/.test(codigoApp)) return { erro: "O código da app só pode ter letras minúsculas, números e hífens." };
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) return { erro: "O endereço do Supabase tem de ser https://<projeto>.supabase.co." };
  if (anon.length < 20) return { erro: "Falta a chave anon (pública) do projeto." };
  const id = slug(nome);
  if (!id) return { erro: "Nome inválido." };
  if (lerClientes().some((c) => c.id === id)) return { erro: "Já existe um cliente com este nome." };
  const cliente: Cliente = { id, nome, produto, supabase_url: url, anon_key: anon, app_url: appUrl || undefined, codigo_app: codigoApp || undefined, modo };
  guardarCliente(cliente);
  revalidatePath("/");
  redirect(`/clientes/${id}`);
}

export async function convidar(id: string, _: Resposta, f: FormData): Promise<Resposta> {
  await exigirSessao();
  const c = obterCliente(id);
  if (!c) return { erro: "Cliente não encontrado." };
  const papel = String(f.get("papel") ?? PAPEIS[c.produto][0]);
  try {
    const r = await criarEm(c, {
      email: String(f.get("email") ?? ""),
      nome: String(f.get("nome") ?? ""),
      papel,
      modo: String(f.get("modo")) === "password" ? "password" : "convite",
    });
    revalidatePath(`/clientes/${id}`);
    return r.passwordTemporaria
      ? { ok: true, passwordTemporaria: r.passwordTemporaria, aviso: "Conta criada. Dá esta password ao utilizador: só aparece aqui, agora. Ele pode mudá-la depois." }
      : { ok: true, aviso: "Convite enviado. O utilizador recebe um email para escolher a password." };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Não foi possível criar o utilizador." };
  }
}

export async function suspenderUtilizador(f: FormData) {
  await exigirSessao();
  const c = obterCliente(String(f.get("cliente")));
  if (c) await suspenderEm(c, String(f.get("id")), String(f.get("suspender")) === "1").catch(() => {});
  revalidatePath(`/clientes/${String(f.get("cliente"))}`);
}

export async function removerUtilizador(f: FormData) {
  await exigirSessao();
  const c = obterCliente(String(f.get("cliente")));
  if (c) await removerEm(c, String(f.get("id"))).catch(() => {});
  revalidatePath(`/clientes/${String(f.get("cliente"))}`);
}

export async function apagarCliente(f: FormData) {
  await exigirSessao();
  // Só tira o cliente desta lista. Não apaga o projeto Supabase nem os utilizadores dele.
  removerCliente(String(f.get("id")));
  revalidatePath("/");
  redirect("/");
}
