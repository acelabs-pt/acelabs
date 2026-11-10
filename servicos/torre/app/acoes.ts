"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { sb } from "@/lib/supabase";
import { exigirSocio, sessaoSocio } from "@/lib/sessao";
import { paraCentimos } from "@/lib/dinheiro";
import { lerData, type Mapa } from "@/lib/extrato";
import { aplicarRegras, chaveDescricao, reembolsavelPorOmissao } from "@/lib/calculos";
import { normalizar } from "@/lib/texto";
import { TAMANHO_PIN, problemaDoPin, senhaDoPin } from "@/lib/pin";
import { lerAcesso } from "@/lib/acessos";
import type { Conta, Movimento, Periodicidade, Regra } from "@/lib/tipos";

export type Resposta = { ok?: boolean; erro?: string; aviso?: string };

// Campos dos formulários --------------------------------------------------------------------------------------------

function txt(f: FormData, k: string): string {
  return String(f.get(k) ?? "").trim();
}
function opc(f: FormData, k: string): string | null {
  return txt(f, k) || null;
}
function erroDe(e: { message: string } | null): Resposta | null {
  if (!e) return null;
  if (e.message.includes("duplicate key")) return { erro: "Já existe um registo com esse nome." };
  if (e.message.includes("violates check constraint") || e.message.includes("invalid input")) return { erro: "Algum valor não é válido." };
  if (e.message.includes("violates foreign key")) return { erro: "Ainda há registos ligados a este. Retira-os primeiro." };
  return { erro: e.message };
}
function atualizar() {
  revalidatePath("/", "layout");
}

// Entrar e sair -----------------------------------------------------------------------------------------------------

// O Supabase recusa "mudar" para a mesma password; aqui isso quer só dizer que se escolheu o PIN que já se tinha: não é erro.
const mesmoPin = (e: { message: string } | null) => Boolean(e && /different from the old password/i.test(e.message));

// Entra-se com email e PIN (lib/pin.ts). As falhas contam-se na base de dados (vale para todos os servidores da Vercel):
// 10 erradas em 30 minutos bloqueiam esse email durante 30 minutos.
export async function entrar(_: Resposta, f: FormData): Promise<Resposta> {
  const quem = txt(f, "quem");
  const pin = txt(f, "pin").replace(/\s/g, "");
  if (!quem) return { erro: "Escolhe quem és." };
  if (!new RegExp(`^\\d{${TAMANHO_PIN}}$`).test(pin)) return { erro: `O PIN tem ${TAMANHO_PIN} algarismos.` };
  const s = sb();
  const { data: emailSocio } = await s.rpc("email_do_socio", { p_id: quem });
  if (!emailSocio) return { erro: "Este nome já não tem acesso." };
  const email = String(emailSocio).toLowerCase();
  // Lembrar quem entrou neste aparelho, para a lista já vir escolhida da próxima vez.
  cookies().set("torre_quem", quem, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
  const { data: bloqueado } = await s.rpc("pin_bloqueado", { p_email: email });
  if (bloqueado) return { erro: "Demasiadas tentativas erradas. Espera 30 minutos." };
  const { error } = await s.auth.signInWithPassword({ email, password: senhaDoPin(email, pin) });
  if (error) {
    await s.rpc("pin_falhou", { p_email: email });
    return { erro: "PIN errado." };
  }
  await s.rpc("pin_ok");
  redirect("/");
}

// Redefinir o PIN sem estar dentro: o Supabase envia um código de recuperação para o email do sócio (SMTP do Resend,
// modelo de email em português configurado no Supabase); com o código certo fica-se com sessão e grava-se o PIN novo.
export async function enviarCodigoPin(_: Resposta, f: FormData): Promise<Resposta> {
  const quem = txt(f, "quem");
  if (!quem) return { erro: "Escolhe quem és." };
  const s = sb();
  const { data: emailSocio } = await s.rpc("email_do_socio", { p_id: quem });
  if (!emailSocio) return { erro: "Este nome já não tem acesso." };
  const email = String(emailSocio).toLowerCase();
  const { data: bloqueado } = await s.rpc("pin_bloqueado", { p_email: email });
  if (bloqueado) return { erro: "Demasiadas tentativas erradas. Espera 30 minutos." };
  const { error } = await s.auth.resetPasswordForEmail(email);
  if (error) return { erro: /rate|seconds|limit/i.test(error.message) ? "Já foi enviado um código há pouco. Espera um minuto e tenta outra vez." : "Não foi possível enviar o email agora." };
  cookies().set("torre_quem", quem, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
  redirect(`/redefinir?quem=${encodeURIComponent(quem)}&enviado=1`);
}

export async function redefinirPin(_: Resposta, f: FormData): Promise<Resposta> {
  const quem = txt(f, "quem");
  const codigo = txt(f, "codigo").replace(/\s/g, "");
  const nova = txt(f, "nova").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(codigo)) return { erro: "O código vem no email: só algarismos." };
  const problema = problemaDoPin(nova);
  if (problema) return { erro: problema };
  if (nova !== txt(f, "repetir").replace(/\s/g, "")) return { erro: "Os dois PINs não são iguais." };
  const s = sb();
  const { data: emailSocio } = await s.rpc("email_do_socio", { p_id: quem });
  if (!emailSocio) return { erro: "Este nome já não tem acesso." };
  const email = String(emailSocio).toLowerCase();
  const { data: bloqueado } = await s.rpc("pin_bloqueado", { p_email: email });
  if (bloqueado) return { erro: "Demasiadas tentativas erradas. Espera 30 minutos." };
  const { error } = await s.auth.verifyOtp({ email, token: codigo, type: "recovery" });
  if (error) {
    await s.rpc("pin_falhou", { p_email: email });
    return { erro: "Código errado ou fora de prazo. Pede outro se for preciso." };
  }
  const { error: e2 } = await s.auth.updateUser({ password: senhaDoPin(email, nova) });
  if (e2 && !mesmoPin(e2)) return { erro: "O código estava certo mas não foi possível gravar o PIN. Tenta outra vez." };
  await s.rpc("pin_ok");
  await s.rpc("pin_escolhido");
  redirect("/");
}

export async function sair() {
  await sb().auth.signOut();
  redirect("/entrar");
}

export async function mudarPin(_: Resposta, f: FormData): Promise<Resposta> {
  // sessaoSocio (e não exigirSocio): é aqui que quem tem o PIN temporário escolhe o seu.
  const { s } = await sessaoSocio();
  const nova = txt(f, "nova").replace(/\s/g, "");
  const problema = problemaDoPin(nova);
  if (problema) return { erro: problema };
  if (nova !== txt(f, "repetir").replace(/\s/g, "")) return { erro: "Os dois PINs não são iguais." };
  const {
    data: { user },
  } = await s.auth.getUser();
  if (!user?.email) return { erro: "Sessão sem email. Sai e volta a entrar." };
  const { error } = await s.auth.updateUser({ password: senhaDoPin(user.email, nova) });
  if (error && !mesmoPin(error)) return erroDe(error)!;
  await s.rpc("pin_escolhido");
  atualizar();
  return { ok: true, aviso: "PIN mudado. Da próxima vez entras com este." };
}

// Movimentos --------------------------------------------------------------------------------------------------------

async function contaDe(id: string): Promise<Conta | null> {
  if (!id) return null;
  const { s } = await exigirSocio();
  const { data } = await s.from("contas").select("*").eq("id", id).maybeSingle();
  return (data as Conta) ?? null;
}

function camposMovimento(f: FormData, conta: Conta | null): { erro: string } | Partial<Movimento> {
  const data = lerData(txt(f, "data"));
  if (!data) return { erro: "Data inválida." };
  const descricao = txt(f, "descricao").slice(0, 500);
  if (!descricao) return { erro: "Falta a descrição." };
  const v = paraCentimos(txt(f, "valor"));
  if (!v) return { erro: "Valor inválido." };
  const valor = txt(f, "sentido") === "entrada" ? Math.abs(v) : -Math.abs(v);
  const r = txt(f, "reembolsavel");
  // Sem conta de banco: alguém pagou do próprio bolso, por isso tem de se saber quem (para a empresa lhe devolver).
  const socio = opc(f, "socio_id") ?? conta?.titular ?? null;
  if (!conta && !socio) return { erro: "Sem conta, diz quem pagou." };
  return {
    conta_id: conta?.id ?? null,
    data,
    descricao,
    valor,
    categoria_id: opc(f, "categoria_id"),
    entidade_id: opc(f, "entidade_id"),
    subscricao_id: opc(f, "subscricao_id"),
    socio_id: socio,
    reembolsavel: r === "sim" ? true : r === "nao" ? false : conta ? reembolsavelPorOmissao(conta) : true,
    notas: opc(f, "notas"),
  };
}

export async function criarMovimento(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const idConta = txt(f, "conta_id");
  const conta = await contaDe(idConta);
  if (idConta && !conta) return { erro: "Conta não encontrada." };
  const m = camposMovimento(f, conta);
  if ("erro" in m) return { erro: m.erro as string };
  if (!m.categoria_id) {
    const { data: regras } = await s.from("regras").select("*");
    const r = aplicarRegras(m.descricao!, (regras ?? []) as Regra[]);
    if (r) Object.assign(m, { categoria_id: r.categoria_id, entidade_id: m.entidade_id ?? r.entidade_id, subscricao_id: m.subscricao_id ?? r.subscricao_id });
  }
  const { error } = await s.from("movimentos").insert({ ...m, origem: "manual" });
  if (error) return erroDe(error)!;
  atualizar();
  return { ok: true, aviso: "Movimento guardado." };
}

export async function guardarMovimento(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const id = txt(f, "id");
  const idConta = txt(f, "conta_id");
  const conta = await contaDe(idConta);
  if (idConta && !conta) return { erro: "Conta não encontrada." };
  const m = camposMovimento(f, conta);
  if ("erro" in m) return { erro: m.erro as string };
  const { error } = await s.from("movimentos").update(m).eq("id", id);
  if (error) return erroDe(error)!;

  // "Aplicar sempre": guarda a regra e classifica já os outros movimentos por classificar com a mesma frase.
  const frase = txt(f, "regra");
  let aviso = "Movimento guardado.";
  if (frase) {
    const regra = { texto: normalizar(frase), categoria_id: m.categoria_id, entidade_id: m.entidade_id, subscricao_id: m.subscricao_id };
    const { error: e2 } = await s.from("regras").upsert(regra, { onConflict: "texto" });
    if (e2) return erroDe(e2)!;
    const { data: soltos } = await s.from("movimentos").select("id, descricao").is("categoria_id", null);
    const ids = (soltos ?? []).filter((x) => normalizar(x.descricao).includes(regra.texto)).map((x) => x.id);
    if (ids.length) {
      const extra: Record<string, string | null> = { categoria_id: m.categoria_id ?? null };
      if (m.entidade_id) extra.entidade_id = m.entidade_id;
      if (m.subscricao_id) extra.subscricao_id = m.subscricao_id;
      await s.from("movimentos").update(extra).in("id", ids);
    }
    aviso += ids.length ? ` Regra criada e aplicada a mais ${ids.length}.` : " Regra criada.";
  }
  atualizar();
  return { ok: true, aviso };
}

/** Classificar um movimento na própria lista, sem abrir a ficha. Devolve a frase que daria uma regra ("Aplicar sempre"). */
export async function classificarMovimento(id: string, categoriaId: string | null): Promise<{ erro?: string; frase?: string }> {
  const { s } = await exigirSocio();
  const { data: m } = await s.from("movimentos").select("id, descricao").eq("id", id).maybeSingle();
  if (!m) return { erro: "Este movimento já não existe." };
  const { error } = await s.from("movimentos").update({ categoria_id: categoriaId }).eq("id", id);
  if (error) return { erro: error.message };
  atualizar();
  return { frase: chaveDescricao(m.descricao) };
}

/** Cria a regra com a frase do movimento e a categoria que ele tem, e classifica já os outros por classificar com essa frase. */
export async function aplicarSempre(id: string): Promise<{ erro?: string; n?: number; frase?: string }> {
  const { s } = await exigirSocio();
  const { data: m } = await s.from("movimentos").select("descricao, categoria_id, entidade_id, subscricao_id").eq("id", id).maybeSingle();
  if (!m?.categoria_id) return { erro: "Este movimento ainda não tem categoria." };
  const frase = chaveDescricao(m.descricao);
  if (!frase) return { erro: "Não encontrei uma frase para a regra. Cria-a em Definições." };
  const regra = { texto: normalizar(frase), categoria_id: m.categoria_id, entidade_id: m.entidade_id, subscricao_id: m.subscricao_id };
  const { error } = await s.from("regras").upsert(regra, { onConflict: "texto" });
  if (error) return { erro: error.message };
  const { data: soltos } = await s.from("movimentos").select("id, descricao").is("categoria_id", null);
  const ids = (soltos ?? []).filter((x) => normalizar(x.descricao).includes(regra.texto)).map((x) => x.id);
  if (ids.length) await s.from("movimentos").update({ categoria_id: regra.categoria_id, entidade_id: regra.entidade_id, subscricao_id: regra.subscricao_id }).in("id", ids);
  atualizar();
  return { n: ids.length, frase };
}

export async function apagarMovimento(f: FormData) {
  const { s } = await exigirSocio();
  await s.from("movimentos").delete().eq("id", txt(f, "id"));
  atualizar();
  redirect("/movimentos");
}

export type LinhaImportar = { data: string; descricao: string; valor: number; chave: string };

/** Grava as linhas escolhidas de um extrato. Linhas já importadas (mesma chave na mesma conta) ficam de fora. */
export async function importarExtrato(pedido: { conta_id: string; ficheiro: string; separador: string; mapa: Mapa; linhas: LinhaImportar[] }): Promise<{ erro?: string; novas?: number; duplicadas?: number }> {
  const { s } = await exigirSocio();
  const conta = await contaDe(pedido.conta_id);
  if (!conta) return { erro: "Conta não encontrada." };
  if (!pedido.linhas.length) return { erro: "Não escolheste nenhuma linha." };
  if (pedido.linhas.length > 5000) return { erro: "Demasiadas linhas de uma vez (máximo 5000). Divide o extrato." };
  for (const l of pedido.linhas) {
    if (lerData(l.data) !== l.data || !Number.isInteger(l.valor) || l.valor === 0 || typeof l.descricao !== "string" || !l.chave) return { erro: "O extrato tem linhas inválidas. Volta a carregá-lo." };
  }

  const { data: regras } = await s.from("regras").select("*");
  const { data: imp, error: e1 } = await s.from("importacoes").insert({ conta_id: conta.id, ficheiro: pedido.ficheiro.slice(0, 200), linhas: pedido.linhas.length }).select("id").single();
  if (e1 || !imp) return { erro: e1?.message ?? "Não foi possível registar a importação." };

  const linhas = pedido.linhas.map((l) => {
    const r = aplicarRegras(l.descricao, (regras ?? []) as Regra[]);
    return {
      conta_id: conta.id,
      data: l.data,
      descricao: l.descricao.slice(0, 500),
      valor: l.valor,
      categoria_id: r?.categoria_id ?? null,
      entidade_id: r?.entidade_id ?? null,
      subscricao_id: r?.subscricao_id ?? null,
      socio_id: conta.titular,
      reembolsavel: reembolsavelPorOmissao(conta),
      origem: "extrato",
      importacao_id: imp.id,
      hash: createHash("sha256").update(l.chave).digest("hex"),
    };
  });
  const { data: novas, error: e2 } = await s.from("movimentos").upsert(linhas, { onConflict: "conta_id,hash", ignoreDuplicates: true }).select("id");
  if (e2) return { erro: e2.message };
  const n = novas?.length ?? 0;
  await s.from("importacoes").update({ novas: n, duplicadas: linhas.length - n }).eq("id", imp.id);
  await s.from("contas").update({ modelo_extrato: { separador: pedido.separador, mapa: pedido.mapa } }).eq("id", conta.id);
  atualizar();
  return { novas: n, duplicadas: linhas.length - n };
}

// Débitos diretos ---------------------------------------------------------------------------------------------------

function camposSubscricao(f: FormData) {
  const v = txt(f, "valor_previsto");
  const valor = v ? paraCentimos(v) : null;
  return {
    nome: txt(f, "nome"),
    conta_id: opc(f, "conta_id"),
    categoria_id: opc(f, "categoria_id"),
    entidade_id: opc(f, "entidade_id"),
    valor_previsto: valor === null ? null : Math.abs(valor),
    moeda: txt(f, "moeda") || "EUR",
    periodicidade: (txt(f, "periodicidade") || "mensal") as Periodicidade,
    dia: Math.min(31, Math.max(1, Number(txt(f, "dia")) || 1)),
    inicio: lerData(txt(f, "inicio")) ?? new Date().toISOString().slice(0, 10),
    padrao: opc(f, "padrao"),
    debito_direto: txt(f, "debito_direto") !== "nao",
    ativa: txt(f, "ativa") !== "nao",
    notas: opc(f, "notas"),
  };
}

export async function criarSubscricao(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const c = camposSubscricao(f);
  if (!c.nome) return { erro: "Falta o nome." };
  const { error } = await s.from("subscricoes").insert(c);
  if (error) return erroDe(error)!;
  atualizar();
  return { ok: true, aviso: "Débito guardado." };
}

export async function guardarSubscricao(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const c = camposSubscricao(f);
  if (!c.nome) return { erro: "Falta o nome." };
  const { error } = await s.from("subscricoes").update(c).eq("id", txt(f, "id"));
  if (error) return erroDe(error)!;
  atualizar();
  return { ok: true, aviso: "Guardado." };
}

export async function apagarSubscricao(f: FormData) {
  const { s } = await exigirSocio();
  await s.from("subscricoes").delete().eq("id", txt(f, "id"));
  atualizar();
  redirect("/debitos");
}

/** Serviços que a Ace Labs já usa (docs/infraestrutura.md). Os valores ficam por confirmar. */
const LISTA_INICIAL: { nome: string; categoria: string; moeda: string; periodicidade: Periodicidade; notas?: string; valor?: number }[] = [
  { nome: "Vercel", categoria: "Alojamento e bases de dados", moeda: "EUR", periodicidade: "mensal", notas: "Equipa acelabs1 (plano Hobby)." },
  { nome: "Supabase", categoria: "Alojamento e bases de dados", moeda: "EUR", periodicidade: "mensal" },
  { nome: "Anthropic (API)", categoria: "APIs de IA", moeda: "USD", periodicidade: "mensal", notas: "Pago em dólares; o valor em euros vem do extrato." },
  { nome: "Google Workspace", categoria: "Email e domínio", moeda: "EUR", periodicidade: "mensal", notas: "Caixas pedro@ e miguel@acelabs.pt." },
  { nome: "Resend", categoria: "Email e domínio", moeda: "USD", periodicidade: "mensal" },
  { nome: "Domínio acelabs.pt", categoria: "Email e domínio", moeda: "EUR", periodicidade: "anual" },
  { nome: "Apple Developer Program", categoria: "Software e subscrições", moeda: "USD", periodicidade: "anual" },
  { nome: "Firebase", categoria: "Alojamento e bases de dados", moeda: "EUR", periodicidade: "mensal", notas: "Plano Spark (grátis).", valor: 0 },
];

export async function juntarListaInicial() {
  const { s } = await exigirSocio();
  const { data: cats } = await s.from("categorias").select("id, nome");
  const cat = new Map((cats ?? []).map((c) => [c.nome, c.id]));
  const linhas = LISTA_INICIAL.map((x) => ({ nome: x.nome, categoria_id: cat.get(x.categoria) ?? null, moeda: x.moeda, periodicidade: x.periodicidade, notas: x.notas ?? null, valor_previsto: x.valor ?? null }));
  await s.from("subscricoes").upsert(linhas, { onConflict: "nome", ignoreDuplicates: true });
  atualizar();
}

/** Cria um débito direto a partir de pagamentos repetidos no extrato, liga-lhe esses pagamentos e cria a regra para os próximos. */
export async function criarDeRecorrente(f: FormData) {
  const { s } = await exigirSocio();
  const conta_id = opc(f, "conta_id");
  const chave = txt(f, "chave");
  const ultimo = lerData(txt(f, "ultimo")) ?? new Date().toISOString().slice(0, 10);
  const nome = txt(f, "nome").slice(0, 80) || chave;
  const { data: sub, error } = await s
    .from("subscricoes")
    .insert({ nome, conta_id, valor_previsto: Math.abs(Number(txt(f, "valor")) || 0), periodicidade: txt(f, "periodicidade") || "mensal", dia: Number(ultimo.slice(8, 10)), inicio: ultimo, padrao: chave })
    .select("id")
    .single();
  if (error || !sub) throw new Error(erroDe(error)?.erro ?? "Não foi possível criar o débito.");
  const consulta = s.from("movimentos").select("id, descricao");
  const { data: movs } = await (conta_id ? consulta.eq("conta_id", conta_id) : consulta.is("conta_id", null)).is("subscricao_id", null).lt("valor", 0);
  const ids = (movs ?? []).filter((m) => chaveDescricao(m.descricao) === chave).map((m) => m.id);
  if (ids.length) await s.from("movimentos").update({ subscricao_id: sub.id }).in("id", ids);
  await s.from("regras").upsert({ texto: chave, subscricao_id: sub.id }, { onConflict: "texto" });
  atualizar();
  redirect(`/debitos/${sub.id}`);
}

// Sócios ------------------------------------------------------------------------------------------------------------

export async function criarSocioMovimento(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const valor = paraCentimos(txt(f, "valor"));
  const data = lerData(txt(f, "data"));
  if (!valor || !data) return { erro: "Falta a data ou o valor." };
  const tipo = txt(f, "tipo");
  const { error } = await s.from("socios_movimentos").insert({ socio_id: txt(f, "socio_id"), tipo, data, valor: Math.abs(valor), conta_id: opc(f, "conta_id"), notas: opc(f, "notas") });
  if (error) return erroDe(error)!;
  atualizar();
  return { ok: true, aviso: tipo === "reembolso" ? "Devolução registada." : tipo === "capital" ? "Entrada de capital registada." : tipo === "suprimento" ? "Suprimento registado." : "Registado." };
}

export async function apagarSocioMovimento(f: FormData) {
  const { s } = await exigirSocio();
  await s.from("socios_movimentos").delete().eq("id", txt(f, "id"));
  atualizar();
}

// Definições --------------------------------------------------------------------------------------------------------

function camposConta(f: FormData) {
  const tipo = txt(f, "tipo") as Conta["tipo"];
  const saldo = paraCentimos(txt(f, "saldo_inicial") || "0") ?? 0;
  return {
    nome: txt(f, "nome"),
    tipo,
    titular: tipo === "conjunta" || tipo === "empresa" ? null : opc(f, "titular"),
    banco: opc(f, "banco"),
    ultimos4: opc(f, "ultimos4"),
    saldo_inicial: saldo,
    ativa: txt(f, "ativa") !== "nao",
  };
}

export async function criarConta(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const c = camposConta(f);
  if (!c.nome) return { erro: "Falta o nome." };
  if (c.tipo === "pessoal" && !c.titular) return { erro: "Uma conta pessoal tem de ter titular." };
  const { error } = await s.from("contas").insert(c);
  if (error) return erroDe(error)!;
  atualizar();
  return { ok: true, aviso: "Conta criada." };
}

export async function guardarConta(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const c = camposConta(f);
  if (!c.nome) return { erro: "Falta o nome." };
  if (c.tipo === "pessoal" && !c.titular) return { erro: "Uma conta pessoal tem de ter titular." };
  const { error } = await s.from("contas").update(c).eq("id", txt(f, "id"));
  if (error) return erroDe(error)!;
  atualizar();
  return { ok: true, aviso: "Guardado." };
}

export async function criarCategoria(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const nome = txt(f, "nome");
  if (!nome) return { erro: "Falta o nome." };
  const { error } = await s.from("categorias").insert({ nome, tipo: txt(f, "tipo"), grupo: txt(f, "grupo") || nome, ordem: 50 });
  if (error) return erroDe(error)!;
  atualizar();
  return { ok: true, aviso: "Categoria criada." };
}

export async function alternarCategoria(f: FormData) {
  const { s } = await exigirSocio();
  await s.from("categorias").update({ ativa: txt(f, "ativa") === "sim" }).eq("id", txt(f, "id"));
  atualizar();
}

export async function criarEntidade(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const nome = txt(f, "nome");
  if (!nome) return { erro: "Falta o nome." };
  const nif = opc(f, "nif");
  if (nif && !/^\d{9}$/.test(nif)) return { erro: "O NIF tem 9 algarismos." };
  const { error } = await s.from("entidades").insert({ nome, nif, email: opc(f, "email"), tipo: txt(f, "tipo") || "fornecedor" });
  if (error) return erroDe(error)!;
  atualizar();
  return { ok: true, aviso: "Guardado." };
}

export async function guardarEntidade(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const nome = txt(f, "nome");
  if (!nome) return { erro: "Falta o nome." };
  const nif = opc(f, "nif");
  if (nif && !/^\d{9}$/.test(nif)) return { erro: "O NIF tem 9 algarismos." };
  const { error } = await s.from("entidades").update({ nome, nif, email: opc(f, "email"), tipo: txt(f, "tipo") || "fornecedor" }).eq("id", txt(f, "id"));
  if (error) return erroDe(error)!;
  atualizar();
  return { ok: true, aviso: "Guardado." };
}

export async function apagarEntidade(f: FormData) {
  const { s } = await exigirSocio();
  const { error } = await s.from("entidades").delete().eq("id", txt(f, "id"));
  // Com contratos ligados a base de dados recusa (on delete restrict): fica onde está.
  if (!error) {
    atualizar();
    redirect("/contactos");
  }
}

// Acessos -----------------------------------------------------------------------------------------------------------

const CAMPOS_ACESSO = ["servico", "categoria", "para_que", "url", "conta", "dono", "onde_esta", "dois_fatores", "custo_mensal", "renovacao", "estado", "notas"];

function camposAcesso(f: FormData) {
  return lerAcesso(Object.fromEntries(CAMPOS_ACESSO.map((k) => [k, txt(f, k)])));
}

function erroAcesso(e: { message: string } | null): Resposta | null {
  if (e?.message.includes("acessos_servico_conta")) return { erro: "Já existe este serviço com esta conta." };
  return erroDe(e);
}

export async function criarAcesso(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const c = camposAcesso(f);
  if ("erro" in c) return { erro: c.erro };
  const { error } = await s.from("acessos").insert(c);
  if (error) return erroAcesso(error)!;
  atualizar();
  return { ok: true, aviso: "Acesso guardado." };
}

export async function guardarAcesso(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const c = camposAcesso(f);
  if ("erro" in c) return { erro: c.erro };
  const { error } = await s.from("acessos").update({ ...c, atualizado_em: new Date().toISOString() }).eq("id", txt(f, "id"));
  if (error) return erroAcesso(error)!;
  atualizar();
  return { ok: true, aviso: "Guardado." };
}

export async function apagarAcesso(f: FormData) {
  const { s } = await exigirSocio();
  await s.from("acessos").delete().eq("id", txt(f, "id"));
  atualizar();
}

// Contratos ---------------------------------------------------------------------------------------------------------

const PRODUTOS = ["diagnostico", "painel", "automacao", "formacao", "cpcv", "cockpit", "medida"];
const ESTADOS = ["proposta", "ativo", "pausado", "terminado"];

function camposContrato(f: FormData): { erro: string } | Record<string, unknown> {
  const produto = txt(f, "produto");
  const estado = txt(f, "estado") || "ativo";
  if (!PRODUTOS.includes(produto)) return { erro: "Escolhe o produto." };
  if (!ESTADOS.includes(estado)) return { erro: "Estado inválido." };
  const inicio = lerData(txt(f, "inicio"));
  if (!inicio) return { erro: "Falta a data de início." };
  const fim = txt(f, "fim") ? lerData(txt(f, "fim")) : null;
  if (txt(f, "fim") && !fim) return { erro: "Data de fim inválida." };
  if (fim && fim < inicio) return { erro: "O fim é antes do início." };
  const setup = txt(f, "setup") ? paraCentimos(txt(f, "setup")) : 0;
  const mensalidade = txt(f, "mensalidade") ? paraCentimos(txt(f, "mensalidade")) : 0;
  if (setup === null || setup < 0 || mensalidade === null || mensalidade < 0) return { erro: "Os valores não podem ser negativos." };
  if (!setup && !mensalidade) return { erro: "Põe o valor de arranque ou a mensalidade." };
  const dia = Number(txt(f, "dia") || "1");
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return { erro: "O dia da mensalidade vai de 1 a 31." };
  return { entidade_id: txt(f, "entidade_id"), produto, nome: opc(f, "nome"), estado, setup, mensalidade, inicio, fim, dia, notas: opc(f, "notas") };
}

export async function criarContrato(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const c = camposContrato(f);
  if ("erro" in c) return { erro: c.erro as string };
  const { error } = await s.from("contratos").insert(c);
  if (error) return erroDe(error)!;
  atualizar();
  return { ok: true, aviso: "Contrato guardado." };
}

export async function guardarContrato(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const c = camposContrato(f);
  if ("erro" in c) return { erro: c.erro as string };
  const { error } = await s.from("contratos").update(c).eq("id", txt(f, "id"));
  if (error) return erroDe(error)!;
  atualizar();
  return { ok: true, aviso: "Contrato guardado." };
}

export async function apagarContrato(f: FormData) {
  const { s } = await exigirSocio();
  await s.from("contratos").delete().eq("id", txt(f, "id"));
  atualizar();
}

export async function criarRegra(_: Resposta, f: FormData): Promise<Resposta> {
  const { s } = await exigirSocio();
  const texto = normalizar(txt(f, "texto"));
  if (texto.length < 3) return { erro: "A frase tem de ter pelo menos 3 letras." };
  const regra = { texto, categoria_id: opc(f, "categoria_id"), entidade_id: opc(f, "entidade_id"), subscricao_id: opc(f, "subscricao_id") };
  if (!regra.categoria_id && !regra.entidade_id && !regra.subscricao_id) return { erro: "Escolhe pelo menos uma categoria, entidade ou débito." };
  const { error } = await s.from("regras").upsert(regra, { onConflict: "texto" });
  if (error) return erroDe(error)!;
  atualizar();
  return { ok: true, aviso: "Regra guardada. Aplica-se às próximas importações e movimentos novos." };
}

export async function apagarRegra(f: FormData) {
  const { s } = await exigirSocio();
  await s.from("regras").delete().eq("id", txt(f, "id"));
  atualizar();
}
