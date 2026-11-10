import { sbBrowser } from "@/lib/supabase-browser";
import { empresaAtual } from "@/lib/empresa";

// "Reportar um problema" (beta): captura do ecrã, áudio e envio. A tabela e o bucket estão em migration_feedback.sql; o email aos
// sócios sai da função avisar-feedback. Os ficheiros sobem primeiro e o reporte grava-se depois, com o que tiver subido: um
// reporte nunca se perde por falhar a captura ou o áudio.

export const EVENTO_REPORTAR = "cockpit:reportar";
export const AUDIO_MAX_SEGUNDOS = 120;
const LARGURA_MAX = 1080;

/** Abre a folha de reportar a partir de qualquer sítio (ex.: página Ajuda). */
export function abrirReportar() {
  window.dispatchEvent(new Event(EVENTO_REPORTAR));
}

/** Captura do que está no ecrã agora (só a parte visível), em JPEG. Devolve null se o aparelho não o conseguir fazer. */
export async function capturarEcra(): Promise<Blob | null> {
  try {
    const { domToBlob } = await import("modern-screenshot");
    const largura = window.innerWidth;
    const altura = window.innerHeight;
    return await domToBlob(document.body, {
      type: "image/jpeg",
      quality: 0.8,
      width: largura,
      height: altura,
      scale: Math.min(window.devicePixelRatio || 1, LARGURA_MAX / largura),
      backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
      // O corpo da página sobe o que já se deslizou, para a captura mostrar o que a pessoa está a ver.
      style: { marginTop: `-${window.scrollY}px` },
      filter: (n) => !(n instanceof HTMLElement && n.dataset.semCaptura !== undefined),
      font: false,
      timeout: 4000,
    });
  } catch {
    return null;
  }
}

/** Reduz uma imagem escolhida da galeria (as fotos do telemóvel passam muitas vezes os 8 MB do bucket). */
export async function reduzirImagem(ficheiro: File): Promise<Blob> {
  const url = URL.createObjectURL(ficheiro);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = falha;
      i.src = url;
    });
    const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok) => c.toBlob((b) => ok(b ?? ficheiro), "image/jpeg", 0.8));
  } catch {
    return ficheiro;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Formato de áudio que este aparelho grava: mp4 no iPhone (Safari), webm no Android e no Chrome. */
export function formatoAudio(): { mime: string; ext: string } | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  const opcoes = [
    { mime: "audio/mp4", ext: "m4a" },
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  ];
  return opcoes.find((o) => MediaRecorder.isTypeSupported(o.mime)) ?? null;
}

export type TipoReporte = "erro" | "sugestao";
export type Audio = { blob: Blob; ext: string };

function aparelho() {
  return {
    userAgent: navigator.userAgent,
    ecra: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio || 1}`,
    nativa: document.documentElement.dataset.app === "nativa",
    tema: document.documentElement.dataset.tema ?? "claro",
    idioma: navigator.language,
  };
}

export async function enviarReporte(r: {
  tipo: TipoReporte;
  texto: string;
  captura: Blob | null;
  audio: Audio | null;
}): Promise<{ erro: string } | { ok: true; semFicheiros: string[] }> {
  const sb = sbBrowser();
  const { data } = await sb.auth.getUser();
  if (!data.user) return { erro: "A tua sessão terminou. Entra outra vez e volta a tentar." };
  const empresa = await empresaAtual(sb);
  const id = crypto.randomUUID();
  const semFicheiros: string[] = [];

  async function subir(nome: string, blob: Blob) {
    if (!empresa) return null;
    const caminho = `${empresa}/${id}/${nome}`;
    const { error } = await sb.storage.from("feedback").upload(caminho, blob, { contentType: blob.type.split(";")[0] || undefined, upsert: false });
    return error ? null : caminho;
  }
  const captura_path = r.captura ? await subir("captura.jpg", r.captura) : null;
  if (r.captura && !captura_path) semFicheiros.push("a captura");
  const audio_path = r.audio ? await subir(`audio.${r.audio.ext}`, r.audio.blob) : null;
  if (r.audio && !audio_path) semFicheiros.push("o áudio");

  const texto = r.texto.trim();
  if (!texto && !captura_path && !audio_path) return { erro: "Não foi possível enviar a captura nem o áudio. Escreve o que se passou e volta a tentar." };

  const sha = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
  const { error } = await sb.from("feedback").insert({
    id,
    tipo: r.tipo,
    texto: texto || null,
    pagina: window.location.pathname + window.location.search,
    captura_path,
    audio_path,
    aparelho: aparelho(),
    versao: sha ? sha.slice(0, 7) : "dev",
  });
  if (error) return { erro: "Não foi possível enviar o reporte. Confirma a ligação à internet e volta a tentar." };

  // O email aos sócios não bloqueia nada: se falhar, o reporte já está gravado.
  sb.functions.invoke("avisar-feedback", { body: { id } }).catch(() => {});
  return { ok: true, semFicheiros };
}
