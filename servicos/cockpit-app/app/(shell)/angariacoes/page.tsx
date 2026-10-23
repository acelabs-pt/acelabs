"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";
import { todas } from "@/lib/todas";
import { blocoAtual, diaDeHoje, type Acao, type Angariacao } from "@/lib/angariacao";
import { hojeISO } from "@/lib/datas";

const REGIME = { exclusivo: "Em exclusivo", nao_exclusivo: "Não exclusivo" } as const;

export default function Angariacoes() {
  const [lista, setLista] = useState<Angariacao[]>([]);
  const [acoes, setAcoes] = useState<Record<string, Acao[]>>({});
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarVendidas, setMostrarVendidas] = useState(false);
  const [novo, setNovo] = useState(false);

  async function carregar() {
    const sb = sbBrowser();
    const [r1, r2] = await Promise.all([
      todas((de, ate) =>
        sb.from("angariacoes").select("*, proprietarios(contactos(nome))").order("created_at", { ascending: false }).order("id").range(de, ate)
      ),
      todas((de, ate) => sb.from("angariacao_acoes").select("*").order("id").range(de, ate)),
    ]);
    if (r1.error || r2.error) {
      setErro("Não foi possível carregar as angariações.");
      setACarregar(false);
      return;
    }
    const por: Record<string, Acao[]> = {};
    for (const a of (r2.data ?? []) as Acao[]) (por[a.angariacao_id] ??= []).push(a);
    setLista(r1.data as unknown as Angariacao[]);
    setAcoes(por);
    setACarregar(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const visiveis = lista.filter((a) => mostrarVendidas || !a.vendido_em);
  const nVendidas = lista.filter((a) => a.vendido_em).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-tinta">Angariações</h1>
        <button onClick={() => setNovo((x) => !x)} className="rounded-xl bg-azul px-4 py-2.5 text-sm font-semibold text-white">
          Nova angariação
        </button>
      </div>

      {novo && <NovaAngariacao onCriada={() => { setNovo(false); carregar(); }} onErro={setErro} />}
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {nVendidas > 0 && (
        <label className="flex items-center gap-2 text-sm text-secundario">
          <input type="checkbox" checked={mostrarVendidas} onChange={(e) => setMostrarVendidas(e.target.checked)} />
          Mostrar vendidas ({nVendidas})
        </label>
      )}

      {aCarregar ? (
        <p className="text-sm text-secundario">A carregar...</p>
      ) : visiveis.length === 0 ? (
        <p className="py-8 text-center text-sm text-secundario">
          Ainda não há angariações. Fecha uma no CRM de proprietários ou cria uma aqui.
        </p>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((a) => {
            const as = acoes[a.id] ?? [];
            const feitas = as.filter((x) => x.feita).length;
            const dia = diaDeHoje(a.inicio);
            const bloco = blocoAtual(a.inicio, a.duracao_dias);
            const proxima = as
              .filter((x) => !x.feita)
              .sort((x, y) => x.dia - y.dia)[0];
            return (
              <li key={a.id}>
                <Link href={`/angariacoes/${a.id}`} className="block rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-tinta">{a.titulo}</p>
                      <p className="truncate text-xs text-secundario">
                        {a.proprietarios?.contactos.nome ?? "Sem proprietário ligado"}
                        {a.regime ? ` · ${REGIME[a.regime]}` : ""}
                      </p>
                    </div>
                    {a.vendido_em ? (
                      <span className="shrink-0 rounded-full bg-verde/15 px-2.5 py-1 text-xs font-medium text-verde">Vendido</span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-azul/10 px-2.5 py-1 text-xs font-medium text-azul">
                        {dia < 1 ? "Ainda não começou" : dia > a.duracao_dias ? "Contrato terminado" : `Dia ${dia} de ${a.duracao_dias}`}
                      </span>
                    )}
                  </div>
                  {as.length > 0 ? (
                    <>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5">
                        <div className="h-full rounded-full bg-verde" style={{ width: `${(feitas / as.length) * 100}%` }} />
                      </div>
                      <p className="mt-1.5 text-xs text-secundario">
                        {feitas}/{as.length} ações feitas{bloco ? ` · bloco ${bloco} de ${a.duracao_dias / 10}` : ""}
                        {proxima && !a.vendido_em ? ` · a seguir: ${proxima.follow_up ? "Follow up" : proxima.nome}` : ""}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 rounded-lg bg-ambar-fundo px-2.5 py-1.5 text-xs font-medium text-ambar-texto">
                      Plano por montar
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NovaAngariacao({ onCriada, onErro }: { onCriada: () => void; onErro: (m: string | null) => void }) {
  const [titulo, setTitulo] = useState("");
  const [duracao, setDuracao] = useState<120 | 180>(180);
  const [regime, setRegime] = useState<"" | "exclusivo" | "nao_exclusivo">("");
  const [inicio, setInicio] = useState(hojeISO());
  const [aGuardar, setAGuardar] = useState(false);
  const campo = "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-base";

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setAGuardar(true);
        onErro(null);
        const { error } = await sbBrowser()
          .from("angariacoes")
          .insert({ titulo: titulo.trim(), duracao_dias: duracao, regime: regime || null, inicio });
        setAGuardar(false);
        if (error) return onErro("Não foi possível criar a angariação.");
        onCriada();
      }}
      className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
    >
      <label className="block text-xs text-secundario">
        Imóvel (morada ou referência)
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required className={`${campo} mt-1 text-tinta`} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-secundario">
          Duração
          <select value={duracao} onChange={(e) => setDuracao(Number(e.target.value) as 120 | 180)} className={`${campo} mt-1 text-tinta`}>
            <option value={180}>180 dias</option>
            <option value={120}>120 dias</option>
          </select>
        </label>
        <label className="block text-xs text-secundario">
          Início do contrato
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required className={`${campo} mt-1 text-tinta`} />
        </label>
      </div>
      <label className="block text-xs text-secundario">
        Regime
        <select value={regime} onChange={(e) => setRegime(e.target.value as typeof regime)} className={`${campo} mt-1 text-tinta`}>
          <option value="">-</option>
          <option value="exclusivo">Em exclusivo</option>
          <option value="nao_exclusivo">Não exclusivo</option>
        </select>
      </label>
      <button type="submit" disabled={aGuardar || !titulo.trim()} className="w-full rounded-xl bg-azul py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        Criar angariação
      </button>
    </form>
  );
}
