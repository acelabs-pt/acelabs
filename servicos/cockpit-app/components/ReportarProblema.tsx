"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useArrastarParaFechar } from "@/components/gestos/useGestos";
import {
  AUDIO_MAX_SEGUNDOS,
  abrirReportar,
  EVENTO_REPORTAR,
  capturarEcra,
  enviarReporte,
  formatoAudio,
  reduzirImagem,
  type Audio,
  type TipoReporte,
} from "@/lib/reportar";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Botão de ajuda (canto inferior esquerdo; o "+" está à direita). Ao tocar tira uma captura do ecrã e só depois abre a folha,
// para a captura mostrar o ecrã onde estava o problema e não a própria folha.
export default function ReportarProblema() {
  const [aberto, setAberto] = useState(false);
  const [aCapturar, setACapturar] = useState(false);
  const [captura, setCaptura] = useState<Blob | null>(null);

  const abrir = useCallback(async () => {
    if (aCapturar) return;
    setACapturar(true);
    setCaptura(await capturarEcra());
    setACapturar(false);
    setAberto(true);
  }, [aCapturar]);

  useEffect(() => {
    const ouvir = () => void abrir();
    window.addEventListener(EVENTO_REPORTAR, ouvir);
    return () => window.removeEventListener(EVENTO_REPORTAR, ouvir);
  }, [abrir]);

  return (
    <>
      <button
        type="button"
        data-sem-captura=""
        onClick={() => void abrir()}
        aria-label="Reportar um problema ou sugestão"
        title="Reportar um problema ou sugestão"
        className="print:hidden fixed bottom-[calc(5.125rem+env(safe-area-inset-bottom))] left-4 z-20 flex h-[44px] w-[44px] items-center justify-center rounded-full border border-linha bg-white text-azul shadow-md shadow-black/10 hover:bg-azul-suave md:bottom-6 md:left-[15.5rem]"
      >
        {aCapturar ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-azul border-t-transparent" aria-hidden="true" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.5-5.6A8.5 8.5 0 1 1 21 12z" />
            <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.4" />
            <path d="M12 16.6h.01" />
          </svg>
        )}
      </button>
      {aberto && <Folha capturaInicial={captura} onFechar={() => setAberto(false)} />}
    </>
  );
}

function Folha({ capturaInicial, onFechar }: { capturaInicial: Blob | null; onFechar: () => void }) {
  const arrasto = useArrastarParaFechar(onFechar);
  const [tipo, setTipo] = useState<TipoReporte>("erro");
  const [texto, setTexto] = useState("");
  const [imagem, setImagem] = useState<Blob | null>(capturaInicial);
  const [audio, setAudio] = useState<Audio | null>(null);
  const [estado, setEstado] = useState<"edicao" | "a enviar" | "enviado">("edicao");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  const urlImagem = useObjectUrl(imagem);

  useEffect(() => {
    titulo.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const podeEnviar = estado === "edicao" && (texto.trim() !== "" || !!imagem || !!audio);

  async function enviar() {
    if (!podeEnviar) return;
    setEstado("a enviar");
    setErro(null);
    const r = await enviarReporte({ tipo, texto, captura: imagem, audio });
    if ("erro" in r) {
      setErro(r.erro);
      setEstado("edicao");
      return;
    }
    if (r.semFicheiros.length) setAviso(`Não foi possível enviar ${r.semFicheiros.join(" nem ")}, mas o resto chegou.`);
    setEstado("enviado");
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center" onClick={onFechar} data-sem-captura="">
      <div
        {...arrasto.painel}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reportar-titulo"
      >
        <div {...arrasto.pega} className="-mt-2 flex justify-center py-2 md:hidden" aria-hidden="true">
          <span className="h-1.5 w-10 rounded-full bg-black/15" />
        </div>
        <div className="flex items-start justify-between gap-3">
          <h3 id="reportar-titulo" ref={titulo} tabIndex={-1} className="text-lg font-semibold text-tinta outline-none">
            {estado === "enviado" ? "Obrigado!" : "Reportar um problema ou sugestão"}
          </h3>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="-mr-2 -mt-1 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-2xl leading-none text-secundario hover:bg-black/5">
            ×
          </button>
        </div>

        {estado === "enviado" ? (
          <div className="space-y-4 pt-2">
            <p className="text-base text-tinta">Recebemos o teu reporte. Vamos ver o que se passa e dizemos-te quando estiver resolvido.</p>
            {aviso && <p className="text-sm text-secundario">{aviso}</p>}
            <button type="button" onClick={onFechar} className="w-full rounded-full bg-tinta py-3.5 text-base font-semibold text-white">
              Fechar
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-secundario">Estamos em fase de testes: tudo o que nos disseres ajuda. Escreve, junta a captura do ecrã ou grava um áudio.</p>

            <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-1 rounded-full bg-black/5 p-1">
              {(["erro", "sugestao"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tipo === t}
                  onClick={() => setTipo(t)}
                  className={`min-h-[44px] rounded-full text-sm font-semibold ${tipo === t ? "bg-white text-tinta shadow-sm" : "text-secundario"}`}
                >
                  {t === "erro" ? "Algo não funciona" : "Uma sugestão"}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm font-medium text-tinta">O que se passou?</span>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={6}
                  maxLength={4000}
                  placeholder={tipo === "erro" ? "Ex.: carreguei em Guardar e não aconteceu nada." : "Ex.: dava jeito ver o telefone na lista."}
                  className="w-full flex-1 resize-none rounded-2xl border border-linha bg-white px-3 py-2.5 text-base text-tinta placeholder:text-secundario/70 focus:border-azul focus:outline-none"
                />
              </label>

              <div className="flex w-24 shrink-0 flex-col gap-1">
                <span className="text-sm font-medium text-tinta">Ecrã</span>
                {urlImagem ? (
                  <>
                    <a href={urlImagem} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-linha">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urlImagem} alt="Captura do ecrã que vai no reporte" className="h-36 w-full object-cover object-top" />
                    </a>
                    <div className="flex justify-between">
                      <button type="button" onClick={() => setImagem(null)} className="min-h-[44px] px-1 text-xs font-medium text-red-600">
                        Retirar
                      </button>
                      <button type="button" onClick={() => galeria.current?.click()} className="min-h-[44px] px-1 text-xs font-medium text-azul">
                        Trocar
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => galeria.current?.click()}
                    className="flex h-36 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-black/20 text-xs font-medium text-azul"
                  >
                    <span className="text-2xl leading-none" aria-hidden="true">+</span>
                    Juntar imagem
                  </button>
                )}
                <input
                  ref={galeria}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) setImagem(await reduzirImagem(f));
                  }}
                />
              </div>
            </div>

            <GravadorAudio audio={audio} onAudio={setAudio} />

            {erro && (
              <p role="alert" className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {erro}
              </p>
            )}

            <button
              type="button"
              onClick={enviar}
              disabled={!podeEnviar}
              className="w-full rounded-full bg-azul py-3.5 text-base font-semibold text-white disabled:opacity-40"
            >
              {estado === "a enviar" ? "A enviar..." : "Enviar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GravadorAudio({ audio, onAudio }: { audio: Audio | null; onAudio: (a: Audio | null) => void }) {
  const [formato] = useState(formatoAudio);
  const [segundos, setSegundos] = useState(0);
  const [aGravar, setAGravar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);
  const url = useObjectUrl(audio?.blob ?? null);

  const parar = useCallback(() => {
    if (relogio.current) clearInterval(relogio.current);
    relogio.current = null;
    if (gravador.current?.state === "recording") gravador.current.stop();
    setAGravar(false);
  }, []);

  useEffect(() => () => parar(), [parar]);

  if (!formato) return null;

  async function gravar() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const partes: Blob[] = [];
      const g = new MediaRecorder(stream, { mimeType: formato!.mime });
      g.ondataavailable = (e) => e.data.size && partes.push(e.data);
      g.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (partes.length) onAudio({ blob: new Blob(partes, { type: formato!.mime.split(";")[0] }), ext: formato!.ext });
      };
      gravador.current = g;
      g.start();
      setSegundos(0);
      setAGravar(true);
      relogio.current = setInterval(() => {
        setSegundos((s) => {
          if (s + 1 >= AUDIO_MAX_SEGUNDOS) parar();
          return s + 1;
        });
      }, 1000);
    } catch {
      setErro("Sem acesso ao microfone. Autoriza o microfone nas definições do telemóvel, ou escreve o que se passou.");
    }
  }

  return (
    <div className="space-y-2">
      {audio && url ? (
        <div className="flex items-center gap-2 rounded-2xl bg-black/5 p-2">
          <audio src={url} controls className="h-11 min-w-0 flex-1" />
          <button type="button" onClick={() => onAudio(null)} className="min-h-[44px] shrink-0 px-2 text-sm font-medium text-red-600">
            Apagar
          </button>
        </div>
      ) : aGravar ? (
        <button type="button" onClick={parar} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-red-50 text-base font-semibold text-red-700">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" aria-hidden="true" />
          A gravar {mmss(segundos)} de {mmss(AUDIO_MAX_SEGUNDOS)}. Tocar para parar
        </button>
      ) : (
        <button type="button" onClick={gravar} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-black/5 text-base font-semibold text-tinta">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-azul" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
          Gravar áudio (até 2 minutos)
        </button>
      )}
      {erro && <p className="text-sm text-red-700">{erro}</p>}
    </div>
  );
}

function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** Entrada "Reportar um problema" na página Ajuda (abre a mesma folha do botão redondo). */
export function BotaoAbrirReportar() {
  return (
    <button
      type="button"
      onClick={abrirReportar}
      className="block w-full rounded-full bg-black/5 py-3 text-center text-base font-medium text-tinta"
    >
      Reportar um problema
    </button>
  );
}
