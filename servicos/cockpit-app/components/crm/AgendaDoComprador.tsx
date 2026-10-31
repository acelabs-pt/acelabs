"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { sbBrowser } from "@/lib/supabase-browser";
import { useToast } from "@/components/Toast";
import { marcarTarefa } from "@/lib/tarefas";
import { formatarDia, formatarHora, localParaISO } from "@/lib/datas";
import type { ImovelComprador } from "@/lib/comprador";
import type { Tarefa } from "@/lib/types";
import { pontoNoCalendario } from "@/lib/nativo";

const campo = "w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base";

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

/** Amanhã às 10h, no formato do campo datetime-local. */
function amanhaAs10(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`;
}

// Próximos passos do comprador: o que está por fazer com ele e marcar uma visita ou uma tarefa sem sair da ficha.
export default function AgendaDoComprador({
  compradorId,
  contactoId,
  nome,
  imoveis,
}: {
  compradorId: string;
  contactoId: string;
  nome: string;
  imoveis: ImovelComprador[];
}) {
  const { avisar } = useToast();
  const [tarefas, setTarefas] = useState<Tarefa[] | null>(null);
  const [tipo, setTipo] = useState<"visita" | "tarefa">("visita");
  const [quando, setQuando] = useState(amanhaAs10);
  const [imovel, setImovel] = useState("");
  const [texto, setTexto] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
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

  async function marcar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!quando) return setErro("Escolhe o dia e a hora.");
    if (tipo === "tarefa" && !texto.trim()) return setErro("Escreve o que há para fazer.");
    const escolhido = imoveis.find((i) => i.id === imovel);
    const titulo = tipo === "visita" ? `Visita${escolhido ? ` a ${nomeImovel(escolhido)}` : ""} com ${nome}` : `${texto.trim()} (${nome})`;
    setAGuardar(true);
    const { data, error } = await sbBrowser()
      .from("tarefas")
      .insert({
        titulo,
        tipo: tipo === "visita" ? "evento" : "tarefa",
        inicio: localParaISO(quando),
        origem: "comprador",
        comprador_id: compradorId,
        contacto_id: contactoId,
      })
      .select("id")
      .single();
    setAGuardar(false);
    if (error || !data) return setErro("Não foi possível marcar. Tenta outra vez.");
    setTexto("");
    setImovel("");
    setQuando(amanhaAs10());
    const ics = `/api/tarefas/${data.id}/calendario`;
    avisar(tipo === "visita" ? "Visita marcada." : "Tarefa marcada.", { rotulo: "Pôr no telemóvel", onAcao: () => void pontoNoCalendario(ics) });
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

      {tarefas === null ? (
        <p className="text-sm text-secundario">A carregar...</p>
      ) : tarefas.length === 0 ? (
        <p className="text-sm text-secundario">Nada por fazer com {nome.split(" ")[0]}. Marca a próxima visita aqui em baixo.</p>
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

      <form onSubmit={marcar} className="space-y-2 border-t border-linha pt-3">
        <div className="flex rounded-xl bg-black/5 p-1 text-sm font-medium" role="group" aria-label="O que marcar">
          {(
            [
              ["visita", "Visita"],
              ["tarefa", "Tarefa"],
            ] as const
          ).map(([v, r]) => (
            <button
              key={v}
              type="button"
              aria-pressed={tipo === v}
              onClick={() => setTipo(v)}
              className={`flex-1 rounded-lg py-1.5 ${tipo === v ? "bg-white text-tinta shadow-sm" : "text-tinta/70"}`}
            >
              {r}
            </button>
          ))}
        </div>
        {tipo === "visita" ? (
          imoveis.length > 0 && (
            <select aria-label="Imóvel a visitar" value={imovel} onChange={(e) => setImovel(e.target.value)} className={campo}>
              <option value="">Imóvel (opcional)</option>
              {imoveis.map((i) => (
                <option key={i.id} value={i.id}>
                  {nomeImovel(i)}
                </option>
              ))}
            </select>
          )
        ) : (
          <input aria-label="O que há para fazer" placeholder="Ex.: enviar simulação do crédito" value={texto} onChange={(e) => setTexto(e.target.value)} className={campo} />
        )}
        <div className="flex gap-2">
          <input type="datetime-local" aria-label="Dia e hora" value={quando} onChange={(e) => setQuando(e.target.value)} className={`${campo} min-w-0 flex-1`} />
          <button type="submit" disabled={aGuardar} className="shrink-0 rounded-xl bg-azul px-4 text-sm font-semibold text-white disabled:opacity-50">
            {aGuardar ? "A marcar..." : "Marcar"}
          </button>
        </div>
        {erro && (
          <p role="alert" className="text-sm text-red-700">
            {erro}
          </p>
        )}
      </form>
    </section>
  );
}
