// Extratos em Excel (.xlsx, .xls, .ods): a primeira folha com dados vira uma tabela de texto, igual à que sai de um CSV, e
// segue o mesmo caminho (cabeçalho, colunas, valores). Corre no browser e nos testes.
//
// As datas do Excel são números de série com um formato de data. Lê-se o número diretamente (parse_date_code), e não o texto
// formatado, que pode sair à americana (mês/dia). Os valores ficam como "1234.5", que paraCentimos lê.

import * as XLSX from "xlsx";

const dois = (n: number) => String(n).padStart(2, "0");

function texto(c: XLSX.CellObject | undefined): string {
  if (!c || c.v === undefined || c.v === null) return "";
  if (c.t === "d" && c.v instanceof Date) return `${c.v.getFullYear()}-${dois(c.v.getMonth() + 1)}-${dois(c.v.getDate())}`;
  if (c.t === "n" && typeof c.v === "number") {
    if (c.z && XLSX.SSF.is_date(String(c.z))) {
      const p = XLSX.SSF.parse_date_code(c.v);
      if (p) return `${p.y}-${dois(p.m)}-${dois(p.d)}`;
    }
    // Sem notação científica e sem lixo de vírgula flutuante (0.1 + 0.2).
    return String(Math.round(c.v * 1e6) / 1e6);
  }
  if (c.t === "b") return c.v ? "sim" : "";
  return String(c.w ?? c.v).trim();
}

export function eFolha(nome: string): boolean {
  return /\.(xlsx|xlsm|xls|ods)$/i.test(nome);
}

/** Linhas da primeira folha com conteúdo (as linhas vazias ficam de fora). */
export function linhasDaFolha(dados: ArrayBuffer | Uint8Array): string[][] {
  // raw: nos "xls" que são HTML ou texto, o SheetJS adivinharia os tipos à americana ("05-10-2026" como data m/d,
  // "-40,90" como -4090). Assim fica o texto tal e qual e são lerData e paraCentimos a interpretá-lo. Nos .xlsx e .xls
  // verdadeiros os tipos vêm do próprio ficheiro e não mudam.
  const livro = XLSX.read(dados, { type: "array", cellNF: true, cellDates: false, raw: true });
  for (const nome of livro.SheetNames) {
    const folha = livro.Sheets[nome];
    if (!folha?.["!ref"]) continue;
    const r = XLSX.utils.decode_range(folha["!ref"]);
    const linhas: string[][] = [];
    for (let i = r.s.r; i <= r.e.r; i++) {
      const linha: string[] = [];
      for (let j = r.s.c; j <= r.e.c; j++) linha.push(texto(folha[XLSX.utils.encode_cell({ r: i, c: j })]));
      // Corta as colunas vazias do fim e salta as linhas sem nada.
      while (linha.length && linha[linha.length - 1] === "") linha.pop();
      if (linha.length) linhas.push(linha);
    }
    if (linhas.length) return linhas;
  }
  return [];
}
