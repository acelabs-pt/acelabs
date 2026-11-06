// Só no browser: encontra o código QR da AT numa fotografia ou num PDF e reduz as fotografias antes de enviar.
// Ler o QR aqui é instantâneo e exato, e poupa o servidor de ter de desenhar PDFs.

import jsQR from "jsqr";
import { lerQrFatura } from "./qr-fatura";

const LADO_MAX = 2200;

function canvas(l: number, a: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = l;
  c.height = a;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("O browser não deixou desenhar a imagem.");
  return [c, ctx];
}

/** Procura um QR da AT na imagem inteira e, se não houver, nos quatro cantos ampliados (o QR costuma estar num canto). */
function qrEm(ctx: CanvasRenderingContext2D, l: number, a: number): string | null {
  const tentar = (x: number, y: number, w: number, h: number) => {
    const d = ctx.getImageData(x, y, w, h);
    const r = jsQR(d.data, w, h, { inversionAttempts: "dontInvert" });
    return r?.data && lerQrFatura(r.data) ? r.data : null;
  };
  const inteiro = tentar(0, 0, l, a);
  if (inteiro) return inteiro;
  const w = Math.round(l / 2);
  const h = Math.round(a / 2);
  for (const [x, y] of [[0, a - h], [l - w, a - h], [0, 0], [l - w, 0]]) {
    const r = tentar(x, y, w, h);
    if (r) return r;
  }
  return null;
}

async function imagemDe(f: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(f, { imageOrientation: "from-image" });
    } catch {
      /* Safari antigo: usa o <img> */
    }
  }
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error("Não foi possível abrir a imagem."));
    img.src = URL.createObjectURL(f);
  });
}

/** Fotografia: lê o QR e devolve uma versão JPEG com no máximo 2200 px de lado (fotos de telemóvel têm 5 a 12 MB). */
export async function prepararImagem(f: File): Promise<{ ficheiro: File; qr: string | null }> {
  const img = await imagemDe(f);
  const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
  const l = Math.round(img.width * escala);
  const a = Math.round(img.height * escala);
  const [c, ctx] = canvas(l, a);
  ctx.drawImage(img, 0, 0, l, a);
  const qr = qrEm(ctx, l, a);
  const blob: Blob = await new Promise((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error("Falhou a compressão."))), "image/jpeg", 0.85));
  const nome = f.name.replace(/\.[^.]+$/, "") + ".jpg";
  return { ficheiro: f.size < blob.size && f.type === "image/jpeg" ? f : new File([blob], nome, { type: "image/jpeg" }), qr };
}

/** PDF: desenha a primeira e a última página e procura o QR. */
export async function qrDePdf(f: File): Promise<string | null> {
  const pdfjs = await import("pdfjs-dist");
  // Servido de public/ (ver scripts/copiar-worker.mjs): o build não consegue empacotar este ficheiro.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
  try {
    const paginas = [...new Set([doc.numPages, 1])];
    for (const n of paginas) {
      const p = await doc.getPage(n);
      const vp = p.getViewport({ scale: 3 });
      const [c, ctx] = canvas(Math.round(vp.width), Math.round(vp.height));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      await p.render({ canvasContext: ctx, viewport: vp }).promise;
      const qr = qrEm(ctx, c.width, c.height);
      if (qr) return qr;
    }
    return null;
  } finally {
    await doc.destroy();
  }
}
