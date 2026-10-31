"use client";

import { EsqueletoLista } from "@/components/Esqueleto";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SwipeLinha from "@/components/gestos/SwipeLinha";
import { sbBrowser } from "@/lib/supabase-browser";
import { todas } from "@/lib/todas";
import BarraProgresso from "@/components/BarraProgresso";
import DadosImovel, { IMOVEL_VAZIO, imovelParaBd, type DadosImovelForm } from "@/components/angariacoes/DadosImovel";
import { atualizarPorAngariacao } from "@/lib/oportunidades";
import { blocoAtual, diaDeHoje, type Angariacao } from "@/lib/angariacao";
import { carregarResumo, type ResumoAng } from "@/lib/resumoAngariacoes";
import { hojeISO } from "@/lib/datas";
import { CampoTelemovel, Escolha, Texto } from "@/components/crm/Campos";
import SeletorLocalizacao from "@/components/crm/SeletorLocalizacao";
import { paraContactoProp, paraProprietario, valoresIniciaisProp, type ValoresProprietario } from "@/components/crm/FormProprietario";
import { TIPOLOGIAS, TIPOS_IMOVEL } from "@/lib/comprador";
import { concluirTarefasDaFase } from "@/lib/proprietario";

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
                      {a.referencia && <p className="truncate text-xs text-secundario">ID {a.referencia}</p>}
                      <p className="truncate text-xs text-secundario">
                        {a.proprietarios?.contactos.nome ?? "Sem proprietário ligado"}
                        {a.regime ? ` · ${REGIME[a.regime]}` : ""}
                      </p>
                    </div>
                    {a.vendido_em ? (
                      <span className="shrink-0 rounded-full bg-verde/15 px-2.5 py-1 text-xs font-medium text-tinta">Vendido</span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-azul/10 px-2.5 py-1 text-xs font-medium text-azul-escuro">
                        {dia < 1 ? "Ainda não começou" : dia > a.duracao_dias ? "Contrato terminado" : `Dia ${dia} de ${a.duracao_dias}`}
                      </span>
                    )}
                  </div>
                  {total > 0 ? (
                    <>
                      <BarraProgresso valor={feitas} objetivo={total} className="mt-3 h-2" />
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

type Dono = {
  id: string;
  estado: string;
  tipo_imovel: string | null;
  tipologia: string | null;
  distrito: string | null;
  concelho: string | null;
  freguesia: string | null;
  valor: number | null;
  contactos: { nome: string };
};

type ModoDono = "nenhum" | "existente" | "novo";

const resumoQualificacao = (d: Dono) =>
  [d.tipo_imovel, d.tipologia, d.freguesia || d.concelho || d.distrito, d.valor != null ? `${d.valor.toLocaleString("pt-PT")} EUR` : null]
    .filter(Boolean)
    .join(" · ");

function NovaAngariacao({ onCriada, onErro }: { onCriada: () => void; onErro: (m: string | null) => void }) {
  const [referencia, setReferencia] = useState("");
  const [duracao, setDuracao] = useState<120 | 180>(180);
  const [regime, setRegime] = useState<"" | "exclusivo" | "nao_exclusivo">("");
  const [inicio, setInicio] = useState(hojeISO());
  const [imovel, setImovel] = useState<DadosImovelForm>(IMOVEL_VAZIO);
  const [aGuardar, setAGuardar] = useState(false);
  const [modo, setModo] = useState<ModoDono>("nenhum");
  const [donos, setDonos] = useState<Dono[]>([]);
  const [donoId, setDonoId] = useState("");
  const [novo, setNovo] = useState<ValoresProprietario>(valoresIniciaisProp());
  const campo = "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-base";
  const setN = <K extends keyof ValoresProprietario>(k: K) => (v: string) => setNovo((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    sbBrowser()
      .from("proprietarios")
      .select("id, estado, tipo_imovel, tipologia, distrito, concelho, freguesia, valor, contactos(nome)")
      .neq("estado", "perdido")
      .then(({ data }) =>
        setDonos(((data ?? []) as unknown as Dono[]).sort((a, b) => a.contactos.nome.localeCompare(b.contactos.nome)))
      );
  }, []);

  const dono = donos.find((d) => d.id === donoId);
  const titulo = [imovel.tipologia, imovel.concelho, imovel.freguesia].map((x) => x.trim()).filter(Boolean).join(", ");
  const donoValido = modo === "nenhum" || (modo === "existente" && donoId !== "") || (modo === "novo" && novo.nome.trim() !== "");

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setAGuardar(true);
        onErro(null);
        const sb = sbBrowser();
        let proprietarioId: string | null = null;

        if (modo === "existente") {
          proprietarioId = donoId;
          if (dono && dono.estado !== "angariado") {
            await sb.from("proprietarios").update({ estado: "angariado", estado_desde: new Date().toISOString() }).eq("id", donoId);
            await concluirTarefasDaFase(donoId, "angariado");
          }
        } else if (modo === "novo") {
          const { data: contacto, error: e1 } = await sb.from("contactos").insert(paraContactoProp(novo)).select("id").single();
          if (e1 || !contacto) {
            setAGuardar(false);
            return onErro("Não foi possível guardar o proprietário.");
          }
          const { data: prop, error: e2 } = await sb
            .from("proprietarios")
            .insert({ contacto_id: contacto.id, ...paraProprietario(novo), estado: "angariado" })
            .select("id")
            .single();
          if (e2 || !prop) {
            await sb.from("contactos").delete().eq("id", contacto.id);
            setAGuardar(false);
            return onErro("Não foi possível guardar o proprietário.");
          }
          proprietarioId = prop.id;
        }

        const { data, error } = await sb.from("angariacoes").insert({
          titulo,
          referencia: referencia.trim() || null,
          duracao_dias: duracao,
          regime: regime || null,
          inicio,
          proprietario_id: proprietarioId,
          ...imovelParaBd(imovel),
        }).select("id").single();
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
        ID do imóvel
        <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className={`${campo} mt-1 text-tinta`} />
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
      <p className="text-xs text-secundario">
        Título da angariação: {titulo || "escolhe a tipologia e o concelho (e a freguesia)"}
      </p>
      <label className="block text-xs text-secundario">
        Regime
        <select value={regime} onChange={(e) => setRegime(e.target.value as typeof regime)} className={`${campo} mt-1 text-tinta`}>
          <option value="">-</option>
          <option value="exclusivo">Em exclusivo</option>
          <option value="nao_exclusivo">Não exclusivo</option>
        </select>
      </label>

      <div className="space-y-2 rounded-xl border border-black/10 p-3">
        <p className="text-xs font-semibold text-secundario">Proprietário e qualificação</p>
        <div className="flex flex-wrap gap-1.5">
          {([
            ["nenhum", "Sem proprietário"],
            ["existente", "Proprietário que já tenho"],
            ["novo", "Novo proprietário"],
          ] as const).map(([m, rotulo]) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${modo === m ? "bg-azul text-white" : "bg-black/5 text-secundario"}`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {modo === "existente" && (
          <>
            <select value={donoId} onChange={(e) => setDonoId(e.target.value)} className={`${campo} text-tinta`}>
              <option value="">Escolhe o proprietário</option>
              {donos.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.contactos.nome}
                </option>
              ))}
            </select>
            {dono && (
              <p className="text-xs text-secundario">
                Qualificação: {resumoQualificacao(dono) || "ainda por preencher"}.{" "}
                <Link href={`/crm/proprietarios/${dono.id}`} className="text-azul underline">
                  Editar na ficha
                </Link>
              </p>
            )}
          </>
        )}

        {modo === "novo" && (
          <div className="space-y-3">
            <Texto label="Nome" value={novo.nome} onChange={setN("nome")} />
            <CampoTelemovel prefixo={novo.prefixo} numero={novo.numero} onPrefixo={setN("prefixo")} onNumero={setN("numero")} />
            <Escolha label="Tipo de imóvel" value={novo.tipo_imovel} onChange={setN("tipo_imovel")} opcoes={TIPOS_IMOVEL} />
            <Escolha label="Tipologia" value={novo.tipologia} onChange={setN("tipologia")} opcoes={TIPOLOGIAS} />
            <div className="grid gap-3 sm:grid-cols-3">
              <SeletorLocalizacao
                comRotulos
                valor={{ distrito: novo.distrito, concelho: novo.concelho, freguesia: novo.freguesia }}
                onChange={(l) => setNovo((x) => ({ ...x, ...l }))}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base"
              />
            </div>
            <Texto label="Valor pedido (EUR)" type="number" value={novo.valor} onChange={setN("valor")} />
            <p className="text-[11px] text-secundario">O proprietário fica criado em Proprietários, no estado &ldquo;Angariado&rdquo;.</p>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={aGuardar || !titulo || !donoValido}
        className="w-full rounded-xl bg-azul py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        Criar angariação
      </button>
    </form>
  );
}
