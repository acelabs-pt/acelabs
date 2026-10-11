import type { Parte, Processo, Helpers, Hipoteca } from "./cpcv-types";
import { formatarDataCurta, formatarDataLonga, formatarEuros } from "./cpcv-types";
import { euroPorExtenso, paginasPorExtenso } from "./cpcv-clausulas";
import { montarContrato, TITULO_CONTRATO } from "./cpcv-contrato";
import { ARIMO_LATIN_WOFF2_BASE64 } from "./fonts/arimo";

// Todo o texto livre (extraído pela IA ou escrito pela gestora - morada, observações, nome das
// partes, etc.) acaba nesta string HTML que é passada directamente a page.setContent() do
// Playwright para gerar o PDF - sem escaping, uma morada com "<b>" ou "&" era interpretada como
// markup real (testado). v() é o ponto central por onde passa quase todo o texto.
function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function v(value: unknown, fallback = "____________"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return escapeHtml(String(value));
}

// "222.000,00€ (Duzentos e Vinte e Dois Mil Euros)" - formato do contrato de referência.
function euros(value: number | null): string {
  if (value === null || value === undefined) return "____________";
  return `${formatarEuros(value)}€ (${escapeHtml(euroPorExtenso(value))})`;
}

function dataPT(iso: string | null): string {
  return v(formatarDataCurta(iso));
}

function dataLongaPT(iso: string | null): string {
  return v(formatarDataLonga(iso));
}

const helpers: Helpers = { v, euros, dataPT, dataLongaPT };

// A fonte do contrato é a Arial (regra de formatação aprovada). O Chromium que gera o PDF usa a
// Arial instalada quando existe (Mac/Windows); onde não existe (ex.: @sparticuz/chromium no
// Vercel) cai para a Arimo embutida - metricamente idêntica à Arial, por isso a paginação (e o
// número de páginas escrito no contrato) não muda de um ambiente para o outro. O ficheiro é um
// woff2 variável (pesos 400-700), por isso serve as duas declarações.
export const FONT_FACE_CSS = `
  @font-face {
    font-family: "Arial";
    font-weight: 400;
    src: local("Arial"), local("ArialMT"), url(data:font/woff2;base64,${ARIMO_LATIN_WOFF2_BASE64}) format("woff2");
  }
  @font-face {
    font-family: "Arial";
    font-weight: 700;
    src: local("Arial Bold"), local("Arial-BoldMT"), url(data:font/woff2;base64,${ARIMO_LATIN_WOFF2_BASE64}) format("woff2");
  }
`;

// `paginas` é o número real de páginas do PDF já gerado - null na primeira passagem (ver
// lib/cpcv-pdf.ts, que gera, conta e volta a gerar com o número certo).
export function gerarHtmlCpcv(
  processo: Processo,
  partes: Parte[],
  hipotecas: Hipoteca[] = [],
  paginas: number | null = null
): string {
  const contrato = montarContrato(helpers, processo, partes, hipotecas);
  const { outorgantes, assinaturas } = contrato;

  const clausulasHtml = contrato.clausulas
    .map(
      (c) =>
        `<p class="titulo">Cláusula ${c.ordinal}</p>\n<p class="designacao">(${c.titulo})</p>\n${c.pontos
          .map((p, i) => `<p class="${i === 0 ? "ponto primeiro-ponto" : "ponto"}">${p}</p>`)
          .join("\n")}`
    )
    .join("\n\n");

  const linhas = (n: number) =>
    Array.from({ length: n }, () => `<p class="linha-assinatura">__________________________________________________________________</p>`).join("\n");

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>${TITULO_CONTRATO}</title>
<style>
  ${FONT_FACE_CSS}
  /* Formatação aprovada: Arial 11pt, justificado, espaçamento 1,5; títulos centrados a negrito.
     As margens da página são definidas em lib/cpcv-pdf.ts (page.pdf), porque o rodapé com o
     número de página só aparece com margens passadas por aí, não via @page. */
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; margin: 0; }
  p { text-align: justify; margin: 0 0 3mm 0; }
  .titulo-principal { text-align: center; font-size: 12pt; font-weight: bold; margin: 0 0 4mm 0; }
  .cabecalho-outorgantes { font-weight: bold; margin-top: 4mm; }
  .intro { font-weight: bold; margin-top: 4mm; }
  .titulo { text-align: center; font-weight: bold; margin: 6mm 0 0 0; break-after: avoid; page-break-after: avoid; }
  .designacao { text-align: center; font-weight: bold; margin: 0 0 2mm 0; break-after: avoid; page-break-after: avoid; }
  .primeiro-ponto { break-before: avoid; page-break-before: avoid; }
  .texto-final { font-weight: bold; margin-top: 8mm; }
  .local-data { text-align: left; margin-top: 10mm; }
  .titulo-assinatura { text-align: left; font-weight: bold; margin: 8mm 0 0 0; break-after: avoid; page-break-after: avoid; }
  .linha-assinatura { text-align: left; margin: 10mm 0 0 0; }
</style>
</head>
<body>
  <p class="titulo-principal">${TITULO_CONTRATO}</p>
  <p class="cabecalho-outorgantes">OUTORGANTES:</p>
  <p class="cabecalho-outorgantes">${outorgantes.cabecalhoVendedores}</p>
  ${outorgantes.identificacoesVendedores.map((texto) => `<p>${texto}.</p>`).join("\n  ")}
  <p class="cabecalho-outorgantes">${outorgantes.cabecalhoCompradores}</p>
  ${outorgantes.identificacoesCompradores.map((texto) => `<p>${texto}.</p>`).join("\n  ")}

  <p class="intro">${contrato.introBoaFe}</p>

${clausulasHtml}

  <p class="texto-final">${contrato.textoFinal.antes}${paginasPorExtenso(paginas)}${contrato.textoFinal.depois}</p>

  <p class="local-data">${contrato.localData}</p>

  <p class="titulo-assinatura">${assinaturas.tituloVendedores}</p>
${linhas(assinaturas.linhasVendedores)}
  <p class="titulo-assinatura">${assinaturas.tituloCompradores}</p>
${linhas(assinaturas.linhasCompradores)}
</body>
</html>`;
}
