// Leitura de ficheiros de importação: CSV (Google Sheets, Excel) e Excel (.xlsx).
// Devolve uma matriz de texto: a primeira linha com dados é o cabeçalho.

/** Separador mais provável: o Excel em português guarda CSV com ";", o Google Sheets com ",". */
function detetarSeparador(texto: string): string {
  const amostra = texto.split(/\r?\n/).slice(0, 5).join("\n");
  const conta = (c: string) => (amostra.match(new RegExp(c === "\t" ? "\t" : `\\${c}`, "g")) ?? []).length;
  const opcoes = [";", ",", "\t"];
  return opcoes.sort((a, b) => conta(b) - conta(a))[0];
}

export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, "");
  const sep = detetarSeparador(t);
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      campo = "";
      linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo !== "" || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

const textoDe = (v: unknown): string => {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
};

export async function lerFicheiro(f: File): Promise<string[][]> {
  const nome = f.name.toLowerCase();
  if (nome.endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file");
    const linhas = await readXlsxFile(f);
    return linhas.map((l) => l.map(textoDe)).filter((l) => l.some((c) => c.trim() !== ""));
  }
  if (nome.endsWith(".xls")) {
    throw new Error("Os ficheiros .xls antigos não são lidos. No Excel, escolhe Guardar como e depois .xlsx ou CSV.");
  }
  if (nome.endsWith(".csv") || nome.endsWith(".txt") || nome.endsWith(".tsv")) {
    const buf = await f.arrayBuffer();
    let texto = new TextDecoder("utf-8").decode(buf);
    // CSV do Excel em português vem muitas vezes em Windows-1252: com UTF-8 aparecem caracteres inválidos
    if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(buf);
    return lerCsv(texto);
  }
  throw new Error("Formato não suportado. Usa um ficheiro .xlsx ou .csv (no Google Sheets: Ficheiro, Transferir, CSV).");
}
