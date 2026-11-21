// Base dos PDFs que a app descarrega (relatório da angariação e, a seguir, ficha de cliente): A4 vertical, sempre claro
// (não depende do modo escuro), com quebras de página próprias e rodapé em todas as páginas. Gera-se no próprio aparelho com
// o jsPDF, carregado só quando se carrega no botão. A letra é a Helvetica do PDF, que tem os acentos do português.

type Cor = [number, number, number];
const TINTA: Cor = [29, 29, 31];
const SEC: Cor = [110, 110, 115];
const AZUL: Cor = [0, 89, 179];
const LINHA: Cor = [227, 227, 232];

const MARGEM = 18;
const LARGURA = 210 - MARGEM * 2;
const FUNDO = 297 - MARGEM - 6; // deixa espaço para o rodapé
const MM_POR_PT = 0.3528;

export type Pdf = {
  rotulo(texto: string): void;
  titulo(texto: string): void;
  texto(texto: string, o?: { cor?: "tinta" | "sec"; tamanho?: number; negrito?: boolean }): void;
  secao(titulo: string, aoLado?: string): void;
  item(titulo: string, data?: string | null, nota?: string | null): void;
  /** Pares rótulo e valor, um por linha (os vazios não aparecem). */
  campos(pares: [string, string | null | undefined][]): void;
  linha(): void;
  espaco(mm: number): void;
  guardar(nomeFicheiro: string): void;
};

export async function novoPdf(rodape: string): Promise<Pdf> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  let y = MARGEM;

  const altura = (tamanho: number, linhas: number) => linhas * tamanho * MM_POR_PT * 1.45;
  const partir = (texto: string, tamanho: number, largura = LARGURA): string[] => {
    doc.setFontSize(tamanho);
    return doc.splitTextToSize(texto, largura) as string[];
  };
  // Se o que vem a seguir não cabe, passa para a página seguinte.
  const caber = (mm: number) => {
    if (y + mm > FUNDO) {
      doc.addPage();
      y = MARGEM;
    }
  };
  const escrever = (linhas: string[], tamanho: number, cor: Cor, negrito = false, x = MARGEM) => {
    doc.setFont("helvetica", negrito ? "bold" : "normal");
    doc.setFontSize(tamanho);
    doc.setTextColor(...cor);
    for (const l of linhas) {
      caber(altura(tamanho, 1));
      y += tamanho * MM_POR_PT; // a linha escreve-se pela base
      doc.text(l, x, y);
      y += tamanho * MM_POR_PT * 0.45;
    }
  };

  return {
    rotulo(texto) {
      escrever([texto], 9, AZUL, true);
      y += 1;
    },
    titulo(texto) {
      escrever(partir(texto, 22), 22, TINTA, true);
      y += 2;
    },
    texto(texto, o = {}) {
      const t = o.tamanho ?? 10.5;
      escrever(partir(texto, t), t, o.cor === "sec" ? SEC : TINTA, o.negrito);
      y += 1.5;
    },
    secao(titulo, aoLado) {
      caber(26); // título e pelo menos o início do conteúdo na mesma página
      y += 3;
      doc.setDrawColor(...LINHA);
      doc.setLineWidth(0.3);
      doc.line(MARGEM, y, MARGEM + LARGURA, y);
      y += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...TINTA);
      y += 13 * MM_POR_PT;
      doc.text(titulo, MARGEM, y);
      if (aoLado) {
        const x = MARGEM + doc.getTextWidth(titulo) + 3;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...SEC);
        doc.text(aoLado, x, y);
      }
      y += 13 * MM_POR_PT * 0.45 + 2;
    },
    item(titulo, data, nota) {
      const recuo = 4;
      const lt = partir(titulo, 10.5, LARGURA - recuo);
      const ln = nota ? partir(nota, 10, LARGURA - recuo) : [];
      const h = altura(10.5, lt.length) + (data ? altura(8.5, 1) : 0) + altura(10, ln.length);
      caber(h + 3);
      const topo = y;
      escrever(lt, 10.5, TINTA, true, MARGEM + recuo);
      if (data) escrever([data], 8.5, SEC, false, MARGEM + recuo);
      if (ln.length) escrever(ln, 10, TINTA, false, MARGEM + recuo);
      doc.setDrawColor(...AZUL);
      doc.setLineWidth(0.6);
      doc.line(MARGEM + 0.3, topo + 0.5, MARGEM + 0.3, y);
      y += 3;
    },
    campos(pares) {
      const col = 48;
      for (const [rotulo, valor] of pares) {
        if (!valor) continue;
        const lv = partir(valor, 10.5, LARGURA - col);
        caber(altura(10.5, lv.length) + 1.5);
        const topo = y;
        escrever([rotulo], 9.5, SEC);
        y = topo;
        escrever(lv, 10.5, TINTA, false, MARGEM + col);
        y += 1.5;
      }
    },
    linha() {
      y += 2;
      doc.setDrawColor(...LINHA);
      doc.setLineWidth(0.3);
      doc.line(MARGEM, y, MARGEM + LARGURA, y);
      y += 4;
    },
    espaco(mm) {
      y += mm;
    },
    guardar(nomeFicheiro) {
      const n = doc.getNumberOfPages();
      for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...SEC);
        doc.text(rodape, MARGEM, 297 - MARGEM + 4);
        if (n > 1) doc.text(`Página ${i} de ${n}`, MARGEM + LARGURA, 297 - MARGEM + 4, { align: "right" });
      }
      doc.save(nomeFicheiro);
    },
  };
}

/** Nome de ficheiro sem acentos nem espaços. */
export function nomeFicheiro(base: string, extensao = "pdf"): string {
  const limpo = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${limpo || "documento"}-${new Date().toISOString().slice(0, 10)}.${extensao}`;
}
