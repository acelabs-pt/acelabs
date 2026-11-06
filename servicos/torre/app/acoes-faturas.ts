"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { paraCentimos } from "@/lib/dinheiro";
import { lerData } from "@/lib/extrato";
import { lerQrFatura, nifValido } from "@/lib/qr-fatura";
import { iaDisponivel, lerComIa, type LeituraIa } from "@/lib/ia-fatura";
import { encontrarEntidade, ligacaoSegura, sugerirCategoria, sugerirMovimentos } from "@/lib/ligar";
import type { Entidade, Fatura, OrigemDado } from "@/lib/tipos";

export type ResultadoLeitura = {
  erro?: string;
  id?: string;
  duplicada?: boolean;
  emitente?: string | null;
  total?: number | null;
  moeda?: string;
  data?: string | null;
  origem?: Fatura["origem_dados"];
  ligada?: boolean;
  duvidas?: number;
};

const TIPOS_ACEITES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"]);
const LIMITE = 4 * 1024 * 1024; // a Vercel recusa pedidos acima de ~4,5 MB; as fotos já vêm comprimidas do browser

function atualizar() {
  revalidatePath("/", "layout");
}

function soDigitos(v: string | null | undefined): string | null {
  const x = (v ?? "").replace(/^PT/i, "").replace(/[^0-9A-Za-z]/g, "");
  return x || null;
}

function centimos(n: number | null | undefined): number | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Recebe um ficheiro (PDF ou foto) e o texto do código QR que o browser leu (se houver). Guarda o ficheiro, junta o QR
 * (exato) com a leitura por IA (o resto: nome, descrição, faturas estrangeiras), encontra o fornecedor e a categoria, e
 * liga logo ao movimento do banco quando a ligação é inequívoca. Fica "por rever".
 */
export async function lerFatura(f: FormData): Promise<ResultadoLeitura> {
  const { s } = await exigirSocio();
  const ficheiro = f.get("ficheiro");
  if (!(ficheiro instanceof File) || !ficheiro.size) return { erro: "Falta o ficheiro." };
  if (!TIPOS_ACEITES.has(ficheiro.type)) return { erro: "Só PDF ou fotografia (JPG, PNG)." };
  if (ficheiro.size > LIMITE) return { erro: "Ficheiro maior que 4 MB. Exporta o PDF outra vez ou tira a fotografia com menos qualidade." };

  const bytes = Buffer.from(await ficheiro.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  const { data: jaExiste } = await s.from("faturas").select("id, emitente_nome, total, moeda, data, origem_dados").eq("ficheiro_hash", hash).maybeSingle();
  if (jaExiste) return { duplicada: true, id: jaExiste.id, emitente: jaExiste.emitente_nome, total: jaExiste.total, moeda: jaExiste.moeda, data: jaExiste.data, origem: jaExiste.origem_dados };

  const t = await carregar(s);
  const qr = lerQrFatura(String(f.get("qr") ?? ""));
  const sentido: Fatura["sentido"] = f.get("sentido") === "emitida" ? "emitida" : "recebida";

  // Leitura por IA: sempre que houver chave (dá o nome, a descrição e as faturas estrangeiras, que não têm QR).
  let ia: LeituraIa | null = null;
  const duvidas: string[] = [];
  if (iaDisponivel()) {
    try {
      ia = await lerComIa(bytes, ficheiro.type, t.categorias.filter((c) => c.ativa && c.tipo !== "interno").map((c) => c.nome));
      if (!ia.e_fatura) duvidas.push("Não parece uma fatura ou recibo.");
      duvidas.push(...ia.duvidas);
    } catch (e) {
      duvidas.push(`Leitura automática falhou (${e instanceof Error ? e.message.slice(0, 80) : "erro"}). Preenche à mão.`);
    }
  } else if (!qr) duvidas.push("Sem código QR e sem leitura por IA configurada: preenche à mão.");

  // Juntar: o QR ganha sempre (é o que foi comunicado à AT).
  const fontes: Record<string, OrigemDado> = {};
  function escolher<T>(campo: string, deQr: T | null | undefined, deIa: T | null | undefined): T | null {
    if (deQr !== null && deQr !== undefined && deQr !== "") {
      fontes[campo] = "qr";
      return deQr;
    }
    if (deIa !== null && deIa !== undefined && deIa !== "") {
      fontes[campo] = "ia";
      return deIa;
    }
    return null;
  }
  const emitenteNif = escolher("emitente_nif", qr?.emitente_nif, soDigitos(ia?.emitente_nif));
  const emitenteNome = escolher("emitente_nome", null, ia?.emitente_nome?.trim());
  const moeda = qr ? "EUR" : (ia?.moeda || "EUR").toUpperCase().slice(0, 3);
  if (qr && qr.estado_doc === "A") duvidas.push("O código QR diz que este documento foi anulado.");
  if (qr && ia?.total && Math.abs(Math.round(ia.total * 100) - qr.total) > 1) duvidas.push("O total lido no papel é diferente do código QR; ficou o do QR.");
  if (emitenteNif && /^\d{9}$/.test(emitenteNif) && !nifValido(emitenteNif)) duvidas.push("O NIF do fornecedor não é válido.");

  const entidade = encontrarEntidade(emitenteNif, emitenteNome, t.entidades);
  const catHistorico = sugerirCategoria(entidade?.id ?? null, null, t.faturas, t.movimentos, t.categorias);
  const catIa = catHistorico ? null : sugerirCategoria(null, ia?.categoria ?? null, t.faturas, t.movimentos, t.categorias);
  if (catHistorico) fontes.categoria_id = "historico";
  else if (catIa) fontes.categoria_id = "ia";
  if (entidade) fontes.entidade_id = "historico";
  const linha = {
    sentido,
    estado: "rever" as const,
    entidade_id: entidade?.id ?? null,
    emitente_nome: emitenteNome ?? entidade?.nome ?? null,
    emitente_nif: emitenteNif,
    adquirente_nif: escolher("adquirente_nif", qr?.adquirente_nif, soDigitos(ia?.adquirente_nif)),
    numero: escolher("numero", qr?.numero, ia?.numero?.trim()),
    atcud: qr?.atcud ?? null,
    tipo_doc: qr?.tipo_doc ?? (ia?.tipo === "nota de crédito" ? "NC" : ia?.tipo === "fatura-recibo" ? "FR" : ia?.tipo === "fatura simplificada" ? "FS" : ia?.tipo === "recibo" ? "RG" : "FT"),
    data: escolher("data", qr?.data, ia?.data ? lerData(ia.data) : null),
    vencimento: escolher("vencimento", null, ia?.vencimento ? lerData(ia.vencimento) : null),
    moeda,
    base: escolher("base", qr?.base, centimos(ia?.base)),
    iva: escolher("iva", qr?.iva, centimos(ia?.iva)),
    total: escolher("total", qr?.total, centimos(ia?.total)),
    total_eur: null as number | null,
    descricao: escolher("descricao", null, ia?.descricao?.slice(0, 200)),
    categoria_id: catHistorico ?? catIa,
    movimento_id: null as string | null,
    origem_dados: (qr && ia ? "qr+ia" : qr ? "qr" : ia ? "ia" : "manual") as Fatura["origem_dados"],
    fontes,
    duvidas: duvidas.slice(0, 8),
    ficheiro_nome: ficheiro.name.slice(0, 200),
    ficheiro_tipo: ficheiro.type,
    ficheiro_hash: hash,
  };

  // Ligar ao movimento: o que a pessoa escolheu (veio da página do movimento) ou uma ligação inequívoca.
  const ocupados = new Set(t.faturas.map((x) => x.movimento_id).filter(Boolean) as string[]);
  const pedido = String(f.get("movimento_id") ?? "");
  if (pedido && !ocupados.has(pedido) && t.movimentos.some((m) => m.id === pedido)) linha.movimento_id = pedido;
  else {
    const segura = ligacaoSegura(sugerirMovimentos(linha, t.movimentos, ocupados));
    if (segura) linha.movimento_id = segura.movimento.id;
  }
  const mov = linha.movimento_id ? t.movimentos.find((m) => m.id === linha.movimento_id) : null;
  if (mov && moeda !== "EUR") linha.total_eur = Math.abs(mov.valor);

  // Fatura repetida (outro ficheiro, mesmo número do mesmo fornecedor).
  if (linha.emitente_nif && linha.numero) {
    const igual = t.faturas.find((x) => x.emitente_nif === linha.emitente_nif && x.numero === linha.numero);
    if (igual) return { duplicada: true, id: igual.id, emitente: igual.emitente_nome, total: igual.total, moeda: igual.moeda, data: igual.data, origem: igual.origem_dados };
  }

  const ano = (linha.data ?? new Date().toISOString()).slice(0, 4);
  const ext = ficheiro.type === "application/pdf" ? "pdf" : ficheiro.type.split("/")[1];
  const caminho = `${ano}/${hash}.${ext}`;
  const { error: eUp } = await s.storage.from("faturas").upload(caminho, bytes, { contentType: ficheiro.type, upsert: true });
  if (eUp) return { erro: `Não foi possível guardar o ficheiro: ${eUp.message}` };

  const { data: nova, error } = await s.from("faturas").insert({ ...linha, ficheiro: caminho }).select("id").single();
  if (error || !nova) {
    await s.storage.from("faturas").remove([caminho]);
    return { erro: error?.message ?? "Não foi possível guardar a fatura." };
  }
  atualizar();
  return { id: nova.id, emitente: linha.emitente_nome, total: linha.total, moeda, data: linha.data, origem: linha.origem_dados, ligada: Boolean(linha.movimento_id), duvidas: linha.duvidas.length };
}

export type RespostaFatura = { ok?: boolean; erro?: string; aviso?: string };

/** Guarda a revisão. "confirmar" fecha a fatura: cria o fornecedor se for novo e passa categoria e fornecedor ao movimento. */
export async function guardarFatura(_: RespostaFatura, f: FormData): Promise<RespostaFatura> {
  const { s } = await exigirSocio();
  const id = String(f.get("id") ?? "");
  const txt = (k: string) => String(f.get(k) ?? "").trim();
  const opc = (k: string) => txt(k) || null;
  const dinheiro = (k: string) => (txt(k) ? paraCentimos(txt(k)) : null);
  const confirmar = txt("acao") === "confirmar";

  const { data: atual } = await s.from("faturas").select("*").eq("id", id).maybeSingle();
  if (!atual) return { erro: "Esta fatura já não existe." };

  const data = txt("data") ? lerData(txt("data")) : null;
  if (txt("data") && !data) return { erro: "Data inválida." };
  const total = dinheiro("total");
  if (confirmar && !total) return { erro: "Falta o total." };
  if (confirmar && !data) return { erro: "Falta a data." };
  const nif = soDigitos(opc("emitente_nif"));
  if (nif && /^\d{9}$/.test(nif) && !nifValido(nif)) return { erro: "O NIF não é válido (confirma os 9 algarismos)." };

  let entidadeId = opc("entidade_id");
  const nome = opc("emitente_nome");
  if (confirmar && !entidadeId && nome) {
    const { data: todas } = await s.from("entidades").select("*");
    const ent = encontrarEntidade(nif, nome, (todas ?? []) as Entidade[]);
    if (ent) entidadeId = ent.id;
    else {
      const sentido = txt("sentido") === "emitida" ? "cliente" : "fornecedor";
      const { data: nova, error } = await s.from("entidades").insert({ nome, nif, tipo: sentido }).select("id").single();
      if (error) return { erro: error.message };
      entidadeId = nova.id;
    }
  }

  const movimentoId = opc("movimento_id");
  const moeda = (opc("moeda") ?? "EUR").toUpperCase().slice(0, 3);
  let totalEur = dinheiro("total_eur");
  if (movimentoId) {
    const { data: m } = await s.from("movimentos").select("id, valor, categoria_id, entidade_id").eq("id", movimentoId).maybeSingle();
    if (m) {
      if (moeda !== "EUR" && !totalEur) totalEur = Math.abs(m.valor);
      // O movimento herda o que se sabe da fatura, sem apagar o que já lá estava.
      const muda: Record<string, string> = {};
      if (!m.categoria_id && opc("categoria_id")) muda.categoria_id = opc("categoria_id")!;
      if (!m.entidade_id && entidadeId) muda.entidade_id = entidadeId;
      if (Object.keys(muda).length) await s.from("movimentos").update(muda).eq("id", m.id);
    }
  }

  const linha = {
    sentido: txt("sentido") === "emitida" ? "emitida" : "recebida",
    estado: confirmar ? "confirmada" : txt("estado") === "anulada" ? "anulada" : atual.estado,
    entidade_id: entidadeId,
    emitente_nome: nome,
    emitente_nif: nif,
    numero: opc("numero"),
    data,
    vencimento: txt("vencimento") ? lerData(txt("vencimento")) : null,
    moeda,
    base: dinheiro("base"),
    iva: dinheiro("iva"),
    total,
    total_eur: moeda === "EUR" ? null : totalEur,
    descricao: opc("descricao"),
    categoria_id: opc("categoria_id"),
    movimento_id: movimentoId,
    notas: opc("notas"),
  };
  const { error } = await s.from("faturas").update(linha).eq("id", id);
  if (error) return { erro: error.message.includes("faturas_emitente_numero") ? "Já existe outra fatura com este número deste fornecedor." : error.message };
  atualizar();
  if (confirmar) {
    // Seguir para a próxima por rever, como uma caixa de entrada.
    const { data: proxima } = await s.from("faturas").select("id").eq("estado", "rever").neq("id", id).order("criado_em").limit(1).maybeSingle();
    redirect(proxima ? `/faturas/${proxima.id}?seguinte=1` : "/faturas?feito=1");
  }
  return { ok: true, aviso: "Guardado." };
}

export async function ligarFatura(f: FormData) {
  const { s } = await exigirSocio();
  const fatura = String(f.get("fatura_id") ?? "");
  const movimento = String(f.get("movimento_id") ?? "") || null;
  await s.from("faturas").update({ movimento_id: movimento }).eq("id", fatura);
  atualizar();
}

export async function apagarFatura(f: FormData) {
  const { s } = await exigirSocio();
  const id = String(f.get("id") ?? "");
  const { data } = await s.from("faturas").select("ficheiro").eq("id", id).maybeSingle();
  await s.from("faturas").delete().eq("id", id);
  if (data?.ficheiro) await s.storage.from("faturas").remove([data.ficheiro]);
  atualizar();
  redirect("/faturas");
}
