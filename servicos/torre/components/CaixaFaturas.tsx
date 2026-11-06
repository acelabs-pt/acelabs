"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { lerFatura, type ResultadoLeitura } from "@/app/acoes-faturas";
import { euros } from "@/lib/dinheiro";
import { esvaziarFaturas } from "@/lib/fila-faturas";
import { data as dataPt } from "@/lib/texto";

type Item = {
  chave: string;
  nome: string;
  fase: "qr" | "ia" | "pronta" | "erro";
  qr?: boolean;
  r?: ResultadoLeitura;
  erro?: string;
};

const FASE: Record<Item["fase"], string> = {
  qr: "A procurar o código QR",
  ia: "A ler a fatura",
  pronta: "",
  erro: "",
};

function valor(total: number | null | undefined, moeda: string | undefined) {
  if (total === null || total === undefined) return "Sem total";
  if (!moeda || moeda === "EUR") return euros(total);
  return `${(total / 100).toLocaleString("pt-PT", { minimumFractionDigits: 2 })} ${moeda}`;
}

/**
 * Caixa de entrada de faturas: larga-se PDFs ou fotografias (várias de uma vez). Cada ficheiro passa por duas leituras,
 * o código QR da AT aqui no browser e a IA no servidor, e aparece logo como cartão com o que se leu e de onde veio.
 */
export default function CaixaFaturas({ movimentoId, compacta = false }: { movimentoId?: string; compacta?: boolean }) {
  const [itens, setItens] = useState<Item[]>([]);
  const escolher = useRef<HTMLInputElement>(null);
  const fotografar = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const mudar = (chave: string, m: Partial<Item>) => setItens((l) => l.map((x) => (x.chave === chave ? { ...x, ...m } : x)));

  async function tratar(f: File, chave: string) {
    try {
      const { prepararImagem, qrDePdf } = await import("@/lib/ler-no-browser");
      let enviar = f;
      let qr: string | null = null;
      if (f.type === "application/pdf") {
        if (f.size > 4 * 1024 * 1024) throw new Error("PDF maior que 4 MB.");
        qr = await qrDePdf(f).catch(() => null);
      } else if (f.type.startsWith("image/")) {
        const p = await prepararImagem(f);
        enviar = p.ficheiro;
        qr = p.qr;
      } else throw new Error("Só PDF ou fotografia.");
      mudar(chave, { fase: "ia", qr: Boolean(qr) });
      const fd = new FormData();
      fd.set("ficheiro", enviar);
      if (qr) fd.set("qr", qr);
      if (movimentoId) fd.set("movimento_id", movimentoId);
      const r = await lerFatura(fd);
      if (r.erro) mudar(chave, { fase: "erro", erro: r.erro });
      else mudar(chave, { fase: "pronta", r });
    } catch (e) {
      mudar(chave, { fase: "erro", erro: e instanceof Error ? e.message : "Não foi possível ler." });
    }
  }

  async function receber(lista: FileList | File[] | null) {
    if (!lista?.length) return;
    // Na ficha de um movimento só cabe uma fatura.
    const ficheiros = Array.from(lista).slice(0, movimentoId ? 1 : undefined);
    const novos = ficheiros.map((f, i) => ({ f, chave: `${Date.now()}-${i}-${f.name}` }));
    setItens((l) => [...novos.map(({ f, chave }) => ({ chave, nome: f.name, fase: "qr" as const })), ...l]);
    // Duas de cada vez: rápido sem encher o servidor.
    const fila = [...novos];
    await Promise.all(
      [0, 1].map(async () => {
        for (let x = fila.shift(); x; x = fila.shift()) await tratar(x.f, x.chave);
      }),
    );
    router.refresh();
  }

  // Faturas largadas noutro ecrã (LargarFaturas) ficam numa fila e são apanhadas aqui, ao abrir ou quando chegam.
  useEffect(() => {
    const apanhar = () => {
      const f = esvaziarFaturas();
      if (f.length) receber(f);
    };
    apanhar();
    window.addEventListener("torre:faturas", apanhar);
    return () => window.removeEventListener("torre:faturas", apanhar);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- receber só usa o estado através de setItens
  }, []);

  const aDecorrer = itens.some((i) => i.fase === "qr" || i.fase === "ia");

  return (
    <div className="space-y-3" data-caixa-faturas>
      <div className={`quadro-glossy rounded-3xl border-2 border-dashed border-azul/25 ${compacta ? "p-4" : "p-6 sm:p-8"}`}>
        <div className={`flex flex-col gap-4 ${compacta ? "sm:flex-row sm:items-center sm:justify-between" : "items-start sm:flex-row sm:items-center sm:justify-between"}`}>
          <div>
            <p className={`${compacta ? "text-base" : "text-xl"} font-semibold text-tinta`}>{movimentoId ? "Juntar a fatura deste movimento" : "Larga aqui as faturas"}</p>
            <p className="mt-1 text-sm text-secundario">
              PDF ou fotografia, várias de uma vez, e podes largá-las em qualquer ecrã da Torre. O código QR da AT e a IA preenchem tudo; só tens de rever.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={() => fotografar.current?.click()} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-azul px-5 text-base font-semibold text-white hover:bg-azul-escuro sm:hidden">
              Fotografar
            </button>
            <button type="button" onClick={() => escolher.current?.click()} className="inline-flex min-h-[44px] items-center rounded-full border border-linha bg-white px-5 text-base font-semibold text-tinta hover:bg-black/5">
              Escolher ficheiros
            </button>
          </div>
        </div>
        <input ref={escolher} type="file" multiple={!movimentoId} accept="application/pdf,image/*" className="hidden" onChange={(e) => { receber(e.target.files); e.target.value = ""; }} />
        <input ref={fotografar} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { receber(e.target.files); e.target.value = ""; }} />
      </div>

      {itens.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {itens.map((i) => (
            <li key={i.chave} className="anim-entrada rounded-2xl border border-linha bg-white px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${i.fase === "pronta" ? (i.r?.duplicada ? "bg-secundario" : "bg-verde") : i.fase === "erro" ? "bg-ambar" : "anim-respirar bg-azul"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium text-tinta">{i.r?.emitente || i.nome}</p>
                  <p className="text-sm text-secundario">
                    {i.fase === "erro" ? (
                      <span className="text-ambar-texto">{i.erro}</span>
                    ) : i.fase !== "pronta" ? (
                      FASE[i.fase] + "..."
                    ) : i.r?.duplicada ? (
                      "Já estava na Torre."
                    ) : (
                      <>
                        {i.r?.data ? dataPt(i.r.data) : "Sem data"}
                        {i.r?.duvidas ? <span className="text-ambar-texto">{`, ${i.r.duvidas} ${i.r.duvidas === 1 ? "dúvida" : "dúvidas"}`}</span> : null}
                      </>
                    )}
                  </p>
                </div>
                {i.fase === "pronta" && i.r && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="numero text-base font-semibold text-tinta">{valor(i.r.total, i.r.moeda)}</span>
                    <span className="flex gap-1">
                      {(i.r.origem === "qr" || i.r.origem === "qr+ia") && <Fonte cor="verde">QR da AT</Fonte>}
                      {(i.r.origem === "ia" || i.r.origem === "qr+ia") && <Fonte cor="azul">IA</Fonte>}
                      {i.r.ligada && <Fonte cor="tinta">Ligada ao banco</Fonte>}
                    </span>
                  </div>
                )}
              </div>
              {i.fase === "pronta" && i.r?.id && (
                <div className="mt-2 flex justify-end">
                  <Link href={`/faturas/${i.r.id}`} className="text-sm font-semibold text-azul">
                    {i.r.duplicada ? "Abrir" : "Rever"}
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {itens.length > 0 && !aDecorrer && !movimentoId && (
        <div className="flex justify-between gap-3 text-sm">
          <button type="button" onClick={() => setItens([])} className="font-medium text-secundario hover:text-tinta">
            Limpar lista
          </button>
          <Link href="/faturas?ver=rever" className="font-semibold text-azul">
            Rever todas por ordem
          </Link>
        </div>
      )}
    </div>
  );
}

function Fonte({ children, cor }: { children: React.ReactNode; cor: "verde" | "azul" | "tinta" }) {
  const c = { verde: "bg-verde-suave text-tinta", azul: "bg-azul-suave text-azul-escuro", tinta: "bg-black/5 text-tinta" }[cor];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c}`}>{children}</span>;
}
