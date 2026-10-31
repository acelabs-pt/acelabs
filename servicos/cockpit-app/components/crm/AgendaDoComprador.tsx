"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import { useToast } from "@/components/Toast";
import { marcarTarefa } from "@/lib/tarefas";
import { alternarGoogleCalendar } from "@/lib/googleCalendar";
import { formatarDia, formatarHora } from "@/lib/datas";
import type { ImovelComprador } from "@/lib/comprador";
import type { Tarefa } from "@/lib/types";

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

// Próximos passos do comprador: o que está por fazer com ele.
export default function AgendaDoComprador({ compradorId, nome }: { compradorId: string; nome: string }) {
  const { avisar } = useToast();
  const [tarefas, setTarefas] = useState<Tarefa[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data } = await sbBrowser()
      .from("tarefas")
      .select("*")
      .eq("comprador_id", compradorId)
      .eq("feita", false)
      .order("inicio", { ascending: true, nullsFirst: false })
      .limit(20);
    setTarefas((data ?? []) as Tarefa[]);
  }, [compradorId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function feita(t: Tarefa) {
    setTarefas((ts) => (ts ?? []).filter((x) => x.id !== t.id));
    const e = await marcarTarefa(t, true);
    if (e) {
      setErro(e);
      return carregar();
    }
    avisar("Tarefa feita.", {
      rotulo: "Desfazer",
      onAcao: async () => {
        await marcarTarefa({ ...t, feita: true }, false);
        await carregar();
      },
    });
  }

  async function alternarGoogle(t: Tarefa) {
    setErro(await alternarGoogleCalendar(t));
    await carregar();
  }

  const agora = new Date();
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

      {erro && (
        <p role="alert" className="text-sm text-red-700">
          {erro}
        </p>
      )}

      {tarefas === null ? (
        <p className="text-sm text-secundario">A carregar...</p>
      ) : tarefas.length === 0 ? (
        <p className="text-sm text-secundario">Nada por fazer com {nome.split(" ")[0]}.</p>
      ) : (
        <ul className="space-y-1">
          {tarefas.map((t) => {
            const atrasada = !!t.inicio && new Date(t.inicio) < agora;
            return (
              <li key={t.id} className="flex items-center gap-3 py-1">
                <button
                  onClick={() => feita(t)}
                  aria-label={`Marcar como feita: ${t.titulo}`}
                  className="h-6 w-6 shrink-0 rounded-full border-2 border-black/20 hover:border-verde"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-tinta">
                    {t.tipo === "evento" && <span className="mr-1.5 text-azul" aria-hidden="true">&#9679;</span>}
                    {t.titulo}
                  </p>
                  <p className={`text-xs ${atrasada ? "text-ambar-texto" : "text-secundario"}`}>
                    {t.inicio ? `${formatarDia(new Date(t.inicio))}${formatarHora(t.inicio) ? `, ${formatarHora(t.inicio)}` : ""}${atrasada ? ", em atraso" : ""}` : "Sem data"}
                  </p>
                  {t.inicio && (
                    <label className="mt-0.5 flex w-fit items-center gap-1.5 text-xs text-secundario">
                      <input type="checkbox" checked={!!t.google_calendar_em} onChange={() => alternarGoogle(t)} />
                      Google Calendar
                    </label>
                  )}
                </div>
                {t.inicio && !atrasada && (
                  <a
                    href={`/api/tarefas/${t.id}/calendario`}
                    aria-label={`Pôr no calendário do telemóvel: ${t.titulo}`}
                    title="Pôr no calendário do telemóvel"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-azul-suave text-azul-escuro hover:bg-azul hover:text-white"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4" />
                    </svg>
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
