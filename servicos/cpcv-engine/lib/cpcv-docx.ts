import { AlignmentType, Document, Footer, LeaderType, Packer, PageNumber, Paragraph, SimpleField, Tab, TabStopType, TextRun } from "docx";
import type { Parte, Processo, Helpers, Hipoteca } from "./cpcv-types";
import { formatarDataCurta, formatarDataLonga, formatarEuros } from "./cpcv-types";
import { euroPorExtenso, paginasPorExtenso, neg, fimDeIdentificacao, NEG_ABRE, NEG_FECHA } from "./cpcv-clausulas";
import { montarContrato, TITULO_CONTRATO } from "./cpcv-contrato";

function v(value: unknown, fallback = "____________"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function euros(value: number | null): string {
  if (value === null || value === undefined) return "____________";
  return `${neg(formatarEuros(value))}€ (${euroPorExtenso(value)})`;
}

function dataPT(iso: string | null): string {
  return v(formatarDataCurta(iso));
}

function dataLongaPT(iso: string | null): string {
  return v(formatarDataLonga(iso));
}

const helpers: Helpers = { v, euros, dataPT, dataLongaPT };

// Formatação aprovada: Arial 11pt (size 22 - a unidade do docx é meio-ponto), espaçamento 1,5
// (line 360 com lineRule "auto"; 240 seria simples), texto corrido justificado.
const FONTE = "Arial";
const ESPACAMENTO = { line: 360, lineRule: "auto" as const };

type OpcoesParagrafo = {
  bold?: boolean;
  alinhamento?: (typeof AlignmentType)[keyof typeof AlignmentType];
  keepNext?: boolean;
  antes?: number;
  depois?: number;
  // Traço até à margem direita no fim do parágrafo (tabulação com preenchimento sublinhado).
  trancar?: boolean;
};

// Largura útil da página em twips (A4 11906 - margens de 1134 de cada lado).
const LARGURA_UTIL = 9638;

// Divide o texto nas marcas de negrito de cpcv-clausulas.ts (neg()) e devolve um run por pedaço.
function runsComNegrito(texto: string, negritoBase?: boolean): TextRun[] {
  const runs: TextRun[] = [];
  let negrito = false;
  let atual = "";
  const fechar = () => {
    if (atual) runs.push(new TextRun({ text: atual, bold: negrito || negritoBase, font: FONTE, size: 22, color: "000000" }));
    atual = "";
  };
  for (const c of texto) {
    if (c === NEG_ABRE) { fechar(); negrito = true; }
    else if (c === NEG_FECHA) { fechar(); negrito = false; }
    else atual += c;
  }
  fechar();
  return runs;
}

function paragrafo(texto: string, opcoes: OpcoesParagrafo = {}): Paragraph {
  return new Paragraph({
    alignment: opcoes.alinhamento ?? AlignmentType.JUSTIFIED,
    keepNext: opcoes.keepNext,
    spacing: { ...ESPACAMENTO, before: opcoes.antes ?? 0, after: opcoes.depois ?? 120 },
    tabStops: opcoes.trancar ? [{ type: TabStopType.RIGHT, position: LARGURA_UTIL, leader: LeaderType.UNDERSCORE }] : undefined,
    children: [
      ...runsComNegrito(texto, opcoes.bold),
      ...(opcoes.trancar ? [new TextRun({ children: [new Tab()], font: FONTE, size: 22, color: "000000" })] : []),
    ],
  });
}

// `paginasCache` é o número de páginas contado no PDF gerado com os mesmos dados (ver
// lib/cpcv-pdf.ts). No Word o número é um campo NUMPAGES que o próprio Word recalcula ao
// paginar, por isso este valor é só o que aparece até o campo ser actualizado.
export async function gerarDocxCpcv(
  processo: Processo,
  partes: Parte[],
  hipotecas: Hipoteca[] = [],
  paginasCache: number | null = null
): Promise<Buffer> {
  const contrato = montarContrato(helpers, processo, partes, hipotecas);
  const { outorgantes, assinaturas } = contrato;

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: TITULO_CONTRATO, bold: true, font: FONTE, size: 24, color: "000000" })],
    }),
    // Cabeçalhos e identificação das partes também "trancados" até à margem, como nos contratos finais.
    paragrafo("OUTORGANTES:", { bold: true, antes: 200, trancar: true }),
    paragrafo(outorgantes.cabecalhoVendedores, { bold: true, antes: 200, trancar: true }),
    ...outorgantes.identificacoesVendedores.map((texto) => paragrafo(fimDeIdentificacao(texto), { trancar: true })),
    paragrafo(outorgantes.cabecalhoCompradores, { bold: true, antes: 200, trancar: true }),
    ...outorgantes.identificacoesCompradores.map((texto) => paragrafo(fimDeIdentificacao(texto), { trancar: true })),
    paragrafo(contrato.introBoaFe, { bold: true, antes: 200 }),
  ];

  for (const c of contrato.clausulas) {
    children.push(
      paragrafo(`Cláusula ${c.ordinal}`, { bold: true, alinhamento: AlignmentType.CENTER, keepNext: true, antes: 300, depois: 0 }),
      paragrafo(`(${c.titulo})`, { bold: true, alinhamento: AlignmentType.CENTER, keepNext: true, depois: 80 })
    );
    c.pontos.forEach((p) => children.push(paragrafo(p, { trancar: true })));
  }

  // O estilo "TextoFinal" leva o negrito e a fonte ao nível do parágrafo, para o run interno do
  // campo NUMPAGES (que o `docx` não deixa formatar directamente) herdar a mesma formatação em
  // vez de aparecer a regular. "\* CardText \* Upper" pede ao Word o número por extenso em
  // maiúsculas, na língua do documento (pt-PT, definida nos estilos por omissão abaixo).
  children.push(
    new Paragraph({
      style: "TextoFinal",
      children: [
        new TextRun({ text: contrato.textoFinal.antes }),
        new SimpleField("NUMPAGES \\* CardText \\* Upper", paginasPorExtenso(paginasCache)),
        new TextRun({ text: contrato.textoFinal.depois }),
      ],
    })
  );

  children.push(paragrafo(contrato.localData, { alinhamento: AlignmentType.LEFT, antes: 400 }));

  const linhas = (n: number) =>
    Array.from({ length: n }, () =>
      paragrafo("__________________________________________________________________", { alinhamento: AlignmentType.LEFT, antes: 360 })
    );
  children.push(
    paragrafo(assinaturas.tituloVendedores, { bold: true, alinhamento: AlignmentType.LEFT, keepNext: true, antes: 300 }),
    ...linhas(assinaturas.linhasVendedores),
    paragrafo(assinaturas.tituloCompradores, { bold: true, alinhamento: AlignmentType.LEFT, keepNext: true, antes: 300 }),
    ...linhas(assinaturas.linhasCompradores)
  );

  // O título do contrato aparece só na primeira página (primeiro parágrafo do corpo); em todas as
  // páginas fica apenas "Página X de Y" no canto inferior direito, com campos PAGE/NUMPAGES.
  const rodape = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], font: FONTE, size: 20, color: "000000" }),
        ],
      }),
    ],
  });

  // O Word tem cor azul e fontes próprias embutidas como omissão dos estilos de título - por isso
  // a fonte, o tamanho e a cor ficam explícitos nos estilos por omissão e em cada run, para nunca
  // sair outra fonte (Vrinda/Arial Nova/Calibri) em nenhum elemento.
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONTE, size: 22, color: "000000", language: { value: "pt-PT" } },
          paragraph: { spacing: ESPACAMENTO },
        },
      },
      paragraphStyles: [
        {
          id: "TextoFinal",
          name: "Texto Final",
          basedOn: "Normal",
          next: "Normal",
          run: { bold: true, font: FONTE, size: 22, color: "000000" },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { ...ESPACAMENTO, before: 400, after: 120 } },
        },
      ],
    },
    sections: [
      {
        // Margens em twips (1 mm = 56,7): 25 mm em cima e em baixo, 20 mm aos lados - as mesmas
        // do PDF (lib/cpcv-pdf.ts).
        properties: { page: { margin: { top: 1417, bottom: 1417, left: 1134, right: 1134, footer: 567 } } },
        footers: { default: rodape },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
