"use client";

import { EsqueletoLista } from "@/components/Esqueleto";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SwipeLinha from "@/components/gestos/SwipeLinha";
import { sbBrowser } from "@/lib/supabase-browser";
import { todas } from "@/lib/todas";
import DadosImovel, { IMOVEL_VAZIO, imovelParaBd, type DadosImovelForm } from "@/components/angariacoes/DadosImovel";
import { atualizarPorAngariacao } from "@/lib/oportunidades";
import { blocoAtual, diaDeHoje, type Angariacao } from "@/lib/angariacao";
import { carregarResumo, type ResumoAng } from "@/lib/resumoAngariacoes";
import { hojeISO } from "@/lib/datas";

const REGIME = { exclusivo: "Em exclusivo", nao_exclusivo: "Não exclusivo" } as const;

export default function Angariacoes() {
  const router = useRouter();
  const [lista, setLista] = useState<Angariacao[]>([]);
  const [resumo, setResumo] = useState<Record<string, ResumoAng>>({});
  const [aCarregar, setACarregar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarVendidas, setMostrarVendidas] = useState(false);
  const [novo, setNovo] = useState(false);

  // "Nova angariação" do botão + vem com ?novo=1
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") === "1") {
      setNovo(true);
      window.history.replaceState(null, "", "/angariacoes");
    }
  }, []);

  async function carregar() {
    const sb = sbBrowser();
    const [r1, r2] = await Promise.all([
      todas((de, ate) =>
        sb.from("angariacoes").select("*, proprietarios(contactos(nome))").order("created_at", { ascending: false }).order("id").range(de, ate)
      ),
      carregarResumo(),
    ]);
    if (r1.error) {
      setErro("Não foi possível carregar as angariações.");
      setACarregar(false);
      return;
    }
    setLista(r1.data as unknown as Angariacao[]);
    setResumo(r2);
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
        <EsqueletoLista />
      ) : visiveis.length === 0 ? (
        <p className="py-8 text-center text-sm text-secundario">
          Ainda não há angariações. Fecha uma no CRM de proprietários ou cria uma aqui.
        </p>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((a) => {
            const r = resumo[a.id];
            const total = r?.total ?? 0;
            const feitas = r?.feitas ?? 0;
            const dia = diaDeHoje(a.inicio);
            const bloco = blocoAtual(a.inicio, a.duracao_dias);
            const proxima = r?.proximaNome ? { nome: r.proximaNome, follow_up: r.proximaFollowUp } : null;
            return (
              <li key={a.id}>
                <SwipeLinha
                  esquerda={total > 0 ? { rotulo: "Relatório", classe: "bg-azul text-white", onAcao: () => router.push(`/angariacoes/${a.id}/relatorio`) } : undefined}
                >
                <Link href={`/angariacoes/${a.id}`} className="block rounded-2xl border border-linha bg-white p-4">
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
                  {total > 0 ? (
                    <>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5">
                        <div className="h-full rounded-full bg-verde" style={{ width: `${(feitas / total) * 100}%` }} />
                      </div>
                      <p className="mt-1.5 text-xs text-secundario">
                        {feitas}/{total} ações feitas{bloco ? ` · bloco ${bloco} de ${a.duracao_dias / 10}` : ""}
                        {proxima && !a.vendido_em ? ` · a seguir: ${proxima.follow_up ? "Follow up" : proxima.nome}` : ""}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 rounded-lg bg-ambar-fundo px-2.5 py-1.5 text-xs font-medium text-ambar-texto">
                      Plano por montar
                    </p>
                  )}
                </Link>
                </SwipeLinha>
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
  const [imovel, setImovel] = useState<DadosImovelForm>(IMOVEL_VAZIO);
  const [aGuardar, setAGuardar] = useState(false);
  const campo = "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-base";

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setAGuardar(true);
        onErro(null);
        const { data, error } = await sbBrowser()
          .from("angariacoes")
          .insert({ titulo: titulo.trim(), duracao_dias: duracao, regime: regime || null, inicio, ...imovelParaBd(imovel) })
          .select("id")
          .single();
        if (error || !data) {
          setAGuardar(false);
          return onErro("Não foi possível criar a angariação.");
        }
        await atualizarPorAngariacao(data.id);
        setAGuardar(false);
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
      <DadosImovel valor={imovel} onChange={setImovel} />
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
