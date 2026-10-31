"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";
import BarraProgresso from "@/components/BarraProgresso";
import { blocoAtual, diaDeHoje, type Acao, type Angariacao } from "@/lib/angariacao";
import { hojeISO } from "@/lib/datas";
import { CampoTelemovel, Escolha, Texto } from "@/components/crm/Campos";
import SeletorLocalizacao from "@/components/crm/SeletorLocalizacao";
import { paraContactoProp, paraProprietario, valoresIniciaisProp, type ValoresProprietario } from "@/components/crm/FormProprietario";
import { TIPOLOGIAS, TIPOS_IMOVEL } from "@/lib/comprador";
import { concluirTarefasDaFase } from "@/lib/proprietario";

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
      sb.from("angariacoes").select("*, proprietarios(contactos(nome))").order("created_at", { ascending: false }),
      sb.from("angariacao_acoes").select("*"),
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
                      <BarraProgresso valor={feitas} objetivo={as.length} className="mt-3 h-2" />
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
  const [titulo, setTitulo] = useState("");
  const [duracao, setDuracao] = useState<120 | 180>(180);
  const [regime, setRegime] = useState<"" | "exclusivo" | "nao_exclusivo">("");
  const [inicio, setInicio] = useState(hojeISO());
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

        const { error } = await sb.from("angariacoes").insert({
          titulo: titulo.trim(),
          duracao_dias: duracao,
          regime: regime || null,
          inicio,
          proprietario_id: proprietarioId,
        });
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
        disabled={aGuardar || !titulo.trim() || !donoValido}
        className="w-full rounded-xl bg-azul py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        Criar angariação
      </button>
    </form>
  );
}
