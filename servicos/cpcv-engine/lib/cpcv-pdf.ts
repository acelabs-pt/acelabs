import type { Hipoteca, Parte, Processo } from "./cpcv-types";
import { launchChromium } from "./cpcv-browser";
import { gerarHtmlCpcv, FONT_FACE_CSS } from "./cpcv-template";

// Margens iguais às do Word (lib/cpcv-docx.ts). Passadas aqui e não via @page porque o Chromium
// só desenha o cabeçalho/rodapé quando as margens vêm nas opções de page.pdf().
const MARGENS = { top: "25mm", bottom: "25mm", left: "20mm", right: "20mm" };

// O título do contrato aparece só na primeira página (no corpo do documento, ver
// lib/cpcv-template.ts); em todas as páginas fica apenas "Página X de Y" no canto inferior direito.
// O rodapé é um documento à parte no Chromium (não herda o CSS da página), por isso repete a
// @font-face e precisa do tamanho de letra explícito. pageNumber/totalPages são as classes
// especiais que o Chromium preenche em cada página.
const RODAPE_HTML = `
<style>${FONT_FACE_CSS}</style>
<div style="font-family: Arial, sans-serif; font-size: 10pt; width: 100%; box-sizing: border-box; text-align: right; color: #000; padding: 0 20mm 6mm 20mm;">
  Página <span class="pageNumber"></span> de <span class="totalPages"></span>
</div>`;

// Conta as páginas de um PDF a partir dos objectos /Type /Page (o Chromium escreve-os em texto
// plano, um por página) - evita trazer uma biblioteca de PDF só para isto. Confirmado também
// contra o PDF do contrato de referência (9 páginas).
export function contarPaginasPdf(pdf: Buffer): number {
  const texto = pdf.toString("latin1");
  const porObjecto = (texto.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
  if (porObjecto > 0) return porObjecto;
  const porCount = texto.match(/\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)/);
  return porCount ? Number(porCount[1]) : 0;
}

// O texto final do contrato diz quantas páginas tem, por extenso - e esse número só se sabe
// depois de paginar. Gera uma primeira vez com o número em branco, conta, e volta a gerar com o
// número certo (repete se a própria alteração mudar a paginação, até estabilizar).
export async function gerarPdfCpcv(
  processo: Processo,
  partes: Parte[],
  hipotecas: Hipoteca[]
): Promise<{ pdf: Buffer; paginas: number }> {
  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    let paginas: number | null = null;
    let pdf: Buffer = Buffer.alloc(0);
    let contadas = 0;
    for (let passagem = 0; passagem < 3; passagem++) {
      await page.setContent(gerarHtmlCpcv(processo, partes, hipotecas, paginas), { waitUntil: "networkidle" });
      pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: RODAPE_HTML,
        margin: MARGENS,
      });
      contadas = contarPaginasPdf(pdf);
      if (contadas === 0 || contadas === paginas) break;
      paginas = contadas;
    }
    return { pdf, paginas: contadas };
  } finally {
    await browser.close();
  }
}
