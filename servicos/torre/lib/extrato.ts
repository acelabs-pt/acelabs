import { paraCentimos } from "./dinheiro";
import { normalizar } from "./texto";

// Leitura de extratos bancários em CSV (cada banco exporta à sua maneira: separador, linhas de cabeçalho antes da tabela,
// valor numa coluna ou débito e crédito em duas). Corre no browser (pré-visualização) e no servidor (validação final).

export type Mapa = {
  data: number;
  descricao: number;
  /** Uma coluna com o valor já com sinal... */
  valor?: number;
  /** ...ou duas colunas: débito (saída) e crédito (entrada). */
  debito?: number;
  credito?: number;
};

export type LinhaExtrato = { data: string; descricao: string; valor: number };

export function detetarSeparador(texto: string): string {
  const amostra = texto.split(/\r?\n/).slice(0, 30).join("\n");
  const contar = (c: string) => amostra.split(c).length - 1;
  return [";", "\t", ","].reduce((melhor, c) => (contar(c) > contar(melhor) ? c : melhor), ";");
}

/** CSV com aspas (RFC 4180): campos entre aspas podem ter o separador, aspas duplas e quebras de linha. */
export function lerCsv(texto: string, sep = detetarSeparador(texto)): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  const t = texto.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.map((l) => l.map((x) => x.trim())).filter((l) => l.some((x) => x));
}

const PALAVRAS = ["data", "date", "descri", "movimento", "designa", "valor", "montante", "importancia", "debito", "credito", "saldo", "amount"];

/** Índice da linha de cabeçalho (os bancos põem nome, IBAN e período antes da tabela). */
export function encontrarCabecalho(linhas: string[][]): number {
  for (let i = 0; i < Math.min(linhas.length, 40); i++) {
    const n = linhas[i].filter((c) => PALAVRAS.some((p) => normalizar(c).includes(p))).length;
    if (n >= 2) return i;
  }
  return 0;
}

/** Proposta de colunas a partir dos nomes do cabeçalho. O Pedro ou o Miguel confirmam no ecrã. */
export function sugerirMapa(cabecalho: string[]): Partial<Mapa> {
  const h = cabecalho.map(normalizar);
  const achar = (...chaves: string[]) => {
    for (const k of chaves) {
      const i = h.findIndex((c) => c.includes(k));
      if (i >= 0) return i;
    }
    return undefined;
  };
  const debito = achar("debito", "debit");
  const credito = achar("credito", "credit");
  const colunas =
    debito !== undefined && credito !== undefined ? { debito, credito } : { valor: achar("montante", "valor", "importancia", "amount") };
  const mapa: Partial<Mapa> = {
    data: achar("data mov", "data lanc", "data operacao", "data", "date"),
    descricao: achar("descri", "designa", "movimento", "detalhe", "description"),
    ...colunas,
  };
  for (const k of Object.keys(mapa) as (keyof Mapa)[]) if (mapa[k] === undefined) delete mapa[k];
  return mapa;
}

/** "31/10/2026", "31-10-26", "31.10.2026", "2026-10-31" -> "2026-10-31". Null se não for uma data válida. */
export function lerData(texto: string): string | null {
  const s = texto.trim().slice(0, 10);
  let a: number, m: number, d: number;
  let r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (r) [a, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else {
    r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
    if (!r) return null;
    [d, m, a] = [Number(r[1]), Number(r[2]), Number(r[3])];
    if (a < 100) a += 2000;
  }
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Converte as linhas de dados (sem o cabeçalho) em movimentos. Linhas que não se percebem vão para `erros`, nunca se adivinham. */
export function interpretar(linhas: string[][], mapa: Mapa): { movimentos: LinhaExtrato[]; erros: { linha: number; motivo: string }[] } {
  const movimentos: LinhaExtrato[] = [];
  const erros: { linha: number; motivo: string }[] = [];
  linhas.forEach((l, i) => {
    const bruto = l[mapa.data] ?? "";
    const data = lerData(bruto);
    if (!data) {
      // Linhas de totais e rodapés têm a coluna da data vazia: ignoram-se em silêncio.
      if (bruto.trim()) erros.push({ linha: i + 1, motivo: "data ilegível" });
      return;
    }
    let valor: number | null;
    if (mapa.valor !== undefined) valor = paraCentimos(l[mapa.valor]);
    else {
      const deb = paraCentimos(l[mapa.debito ?? -1]);
      const cre = paraCentimos(l[mapa.credito ?? -1]);
      valor = deb === null && cre === null ? null : (cre ?? 0) - Math.abs(deb ?? 0);
    }
    if (valor === null) {
      erros.push({ linha: i + 1, motivo: "valor ilegível" });
      return;
    }
    if (valor === 0) return;
    const descricao = (l[mapa.descricao] ?? "").replace(/\s+/g, " ").trim() || "(sem descrição)";
    movimentos.push({ data, descricao, valor });
  });
  return { movimentos, erros };
}

/**
 * Chave de cada linha para não importar duas vezes o mesmo movimento. Duas linhas iguais no mesmo extrato (dois cafés
 * iguais no mesmo dia) ficam com ocorrência 0 e 1, e voltar a importar o mesmo ficheiro dá as mesmas chaves.
 */
export function chavesDeDuplicado(contaId: string, movimentos: LinhaExtrato[]): string[] {
  const vistas = new Map<string, number>();
  return movimentos.map((m) => {
    const base = `${contaId}|${m.data}|${m.valor}|${normalizar(m.descricao)}`;
    const n = vistas.get(base) ?? 0;
    vistas.set(base, n + 1);
    return `${base}|${n}`;
  });
}
