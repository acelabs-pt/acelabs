"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import AgendarTarefa from "@/components/crm/AgendarTarefa";
import { formatarDia, formatarHora } from "@/lib/datas";
import type { ImovelComprador } from "@/lib/comprador";

/** Nome curto de um imóvel enviado: a descrição, ou o endereço do anúncio sem o "https://www.". */
export function nomeImovel(i: Pick<ImovelComprador, "descricao" | "link">): string {
  if (i.descricao) return i.descricao;
  if (!i.link) return "Imóvel";
  try {
    const u = new URL(i.link);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`.slice(0, 48);
  } catch {
    return i.link.slice(0, 48);
  }
}

// Próximos passos do comprador: "enviar novas opções de imóveis" (uma só linha, por muitas semanas que estejam por fazer) e "agendar escritura".
// A tarefa não se marca à mão: fecha quando se regista um imóvel como "Enviado" (as etiquetas de atraso estão no topo da ficha).
export default function AgendaDoComprador({
  compradorId,
  contactoId,
  nome,
  versao = 0,
}: {
  compradorId: string;
  contactoId: string;
  nome: string;
  versao?: number;
}) {
  type Linha = { id: string; titulo: string; chave_automacao: string | null; inicio: string | null };
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [recarregar, setRecarregar] = useState(0);
  const primeiro = nome.split(" ")[0];

  useEffect(() => {
    sbBrowser()
      .from("tarefas")
      .select("id, titulo, chave_automacao, inicio")
      .eq("comprador_id", compradorId)
      .eq("feita", false)
      .or("titulo.like.Enviar%,chave_automacao.like.%:agendar-escritura,chave_automacao.like.manual:comprador:%")
      .order("inicio", { ascending: true })
      .limit(100)
      .then(({ data }) => setLinhas((data ?? []) as Linha[]));
  }, [compradorId, versao, recarregar]);

  async function feita(t: Linha) {
    setLinhas((l) => (l ?? []).filter((x) => x.id !== t.id));
    await sbBrowser().from("tarefas").update({ feita: true, feita_em: new Date().toISOString() }).eq("id", t.id);
  }

  const enviar = (linhas ?? []).some((t) => t.titulo.startsWith("Enviar"));
  const escritura = (linhas ?? []).some((t) => t.chave_automacao?.endsWith(":agendar-escritura"));
  const agendadas = (linhas ?? []).filter((t) => t.chave_automacao?.startsWith("manual:comprador:"));

  const Passo = ({ titulo, nota }: { titulo: string; nota: string }) => (
    <div className="flex items-start gap-2.5">
      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-ambar" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-tinta">{titulo}</p>
        <p className="text-xs text-secundario">{nota}</p>
      </div>
    </div>
  );

  return (
    <section className="space-y-3 rounded-3xl border border-linha bg-white p-5" aria-labelledby="proximos-comprador">
      <div className="flex items-center justify-between">
        <h3 id="proximos-comprador" className="text-sm font-semibold text-tinta">
          Próximos passos
        </h3>
        <Link href="/calendario" className="text-sm font-medium text-azul-escuro">
          Calendário
        </Link>
      </div>

      {linhas === null ? (
        <p className="text-sm text-secundario">A carregar...</p>
      ) : !enviar && !escritura && agendadas.length === 0 ? (
        <p className="text-sm text-secundario">Nada por fazer com {primeiro}.</p>
      ) : (
        <div className="space-y-3">
          {escritura && <Passo titulo={`Agendar escritura com ${primeiro}`} nota="Fecha sozinho quando marcas a escritura como agendada." />}
          {enviar && <Passo titulo={`Enviar novas opções de imóveis a ${primeiro}`} nota="Fecha sozinho quando registas um imóvel como enviado." />}
          {agendadas.map((t) => (
            <label key={t.id} className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" onChange={() => feita(t)} className="mt-1" />
              <span className="text-tinta">
                {t.titulo}
                {t.inicio && (
                  <span className={`block text-xs ${new Date(t.inicio) < new Date() ? "text-ambar-texto" : "text-secundario"}`}>
                    {formatarDia(new Date(t.inicio))} {formatarHora(t.inicio)}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}

      <AgendarTarefa origem="comprador" clienteId={compradorId} contactoId={contactoId} aoCriar={() => setRecarregar((v) => v + 1)} />
    </section>
  );
}
