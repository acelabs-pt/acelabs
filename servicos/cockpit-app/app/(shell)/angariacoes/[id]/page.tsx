"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";
import Grelha, { type VistaGrelha } from "@/components/angariacoes/Grelha";
import FolhaAcao from "@/components/angariacoes/FolhaAcao";
import {
  ACOES_PADRAO,
  adicionarAcao,
  criarPlano,
  dataDoDia,
  diaDeHoje,
  marcarAcao,
  marcarVendido,
  moverAcao,
  nBlocos,
  NOME_FOLLOW_UP,
  type Acao,
  type AcaoExtra,
  type Angariacao,
} from "@/lib/angariacao";
import { formatarDia, hojeISO } from "@/lib/datas";
import Comissao from "@/components/crm/Comissao";
import DadosImovel, { imovelDe, imovelParaBd, resumoImovel, type DadosImovelForm } from "@/components/angariacoes/DadosImovel";
import ListaCorrespondencias from "@/components/oportunidades/ListaCorrespondencias";
import { atualizarPorAngariacao, carregarDaAngariacao, responder, type Correspondencia } from "@/lib/oportunidades";

const REGIME = { exclusivo: "Em exclusivo", nao_exclusivo: "Não exclusivo" } as const;

export default function PlanoAngariacao() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ang, setAng] = useState<Angariacao | null>(null);
  const [acoes, setAcoes] = useState<Acao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<Acao | null>(null);
  const [editar, setEditar] = useState(false);
  const [novaNome, setNovaNome] = useState("");
  const [novaBloco, setNovaBloco] = useState(1);

  // montagem do plano
  const [duracao, setDuracao] = useState<120 | 180>(180);
  const [escolhidas, setEscolhidas] = useState<string[]>(ACOES_PADRAO.map((a) => a.nome));
  const [followUps, setFollowUps] = useState(true);
  const [aCriar, setACriar] = useState(false);
  const [vista, setVista] = useState<VistaGrelha>("tudo");
  const [corresp, setCorresp] = useState<Correspondencia[]>([]);
  const [editarImovel, setEditarImovel] = useState(false);
  const [imovelForm, setImovelForm] = useState<DadosImovelForm | null>(null);
  const [extras, setExtras] = useState<AcaoExtra[]>([]);
  const [extraNome, setExtraNome] = useState("");
  const [extraBloco, setExtraBloco] = useState(1);

  const carregar = useCallback(async () => {
    const sb = sbBrowser();
    const [r1, r2, cs] = await Promise.all([
      sb.from("angariacoes").select("*, proprietarios(contactos(nome))").eq("id", id).single(),
      sb.from("angariacao_acoes").select("*").eq("angariacao_id", id).order("dia"),
      carregarDaAngariacao(id),
    ]);
    setCorresp(cs);
    if (r1.error || !r1.data) {
      setErro("Angariação não encontrada.");
      return;
    }
    const a = r1.data as unknown as Angariacao;
    setAng(a);
    setDuracao(a.duracao_dias);
    const lista = (r2.data ?? []) as Acao[];
    setAcoes(lista);
    setAberta((x) => (x ? lista.find((l) => l.id === x.id) ?? null : null));
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function correr(op: Promise<string | null>) {
    setErro(null);
    const e = await op;
    if (e) setErro(e);
    await carregar();
  }

  if (erro && !ang) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>;
  if (!ang) return <p className="text-sm text-secundario">A carregar...</p>;

  const dia = diaDeHoje(ang.inicio);
  const cartao = "space-y-3 rounded-2xl bg-white p-4 shadow-sm";
  const feitas = acoes.filter((a) => a.feita).length;

  return (
    <div className="space-y-4">
      <Link href="/angariacoes" className="text-sm text-azul">&larr; Angariações</Link>
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <section className={cartao}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-tinta">{ang.titulo}</h1>
            <p className="text-sm text-secundario">
              {ang.proprietarios?.contactos.nome ?? "Sem proprietário ligado"}
              {ang.regime ? ` · ${REGIME[ang.regime]}` : ""}
            </p>
            <p className="text-sm text-secundario">
              Início {formatarDia(dataDoDia(ang.inicio, 0))} · fim {formatarDia(dataDoDia(ang.inicio, ang.duracao_dias - 1))} ·{" "}
              {ang.vendido_em ? "vendido" : dia < 1 ? "ainda não começou" : dia > ang.duracao_dias ? "contrato terminado" : `dia ${dia} de ${ang.duracao_dias}`}
            </p>
          </div>
          {acoes.length > 0 && (
            <Link href={`/angariacoes/${ang.id}/relatorio`} className="shrink-0 rounded-xl bg-black/5 px-3 py-1.5 text-sm font-medium">
              Relatório
            </Link>
          )}
        </div>
      </section>

      <section className={cartao}>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-tinta">Imóvel</h2>
          {!editarImovel && (
            <button
              onClick={() => {
                setImovelForm(imovelDe(ang));
                setEditarImovel(true);
              }}
              className="shrink-0 rounded-xl bg-black/5 px-3 py-1.5 text-sm font-medium"
            >
              Editar
            </button>
          )}
        </div>
        {editarImovel && imovelForm ? (
          <>
            <DadosImovel valor={imovelForm} onChange={setImovelForm} />
            <button
              onClick={async () => {
                const { error } = await sbBrowser().from("angariacoes").update(imovelParaBd(imovelForm)).eq("id", ang.id);
                if (error) return setErro("Não foi possível guardar o imóvel.");
                await atualizarPorAngariacao(ang.id);
                setEditarImovel(false);
                await carregar();
              }}
              className="w-full rounded-xl bg-azul py-2.5 text-sm font-semibold text-white"
            >
              Guardar imóvel
            </button>
          </>
        ) : (
          <p className="text-sm text-secundario">
            {resumoImovel(ang) || "Sem dados do imóvel. Preenche para encontrarmos compradores com interesse."}
          </p>
        )}
      </section>

      {corresp.length > 0 && (
        <section className={cartao}>
          <h2 className="text-sm font-semibold text-tinta">
            Compradores com interesse ({corresp.filter((x) => x.estado === "nova").length} por rever)
          </h2>
          <ListaCorrespondencias
            itens={corresp}
            mostrar="comprador"
            onResponder={async (x, estado) => {
              await responder(x.id, estado);
              await carregar();
            }}
          />
        </section>
      )}

      {acoes.length === 0 ? (
        <section className={cartao}>
          <h2 className="text-sm font-semibold text-tinta">Montar o plano</h2>
          <p className="text-xs text-secundario">
            Escolhe as ações que queres neste plano. Cada uma entra nos blocos de 10 dias do desenho e vai para o calendário.
            Depois podes juntar ou retirar ações.
          </p>
          <div className="flex rounded-xl bg-black/5 p-1 text-sm font-medium">
            {([180, 120] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDuracao(d)}
                className={`flex-1 rounded-lg py-2 ${duracao === d ? "bg-white text-tinta shadow-sm" : "text-secundario"}`}
              >
                {d} dias
              </button>
            ))}
          </div>
          {duracao === 120 && (
            <p className="rounded-lg bg-ambar-fundo px-3 py-2 text-xs text-ambar-texto">
              O desenho só mostra a grelha de 180 dias. Nos 120 dias uso os primeiros 12 blocos e as ações dos blocos seguintes ficam de fora.
            </p>
          )}
          <ul className="space-y-1.5">
            {ACOES_PADRAO.map((a) => (
              <li key={a.nome}>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={escolhidas.includes(a.nome)}
                    onChange={(e) => setEscolhidas((x) => (e.target.checked ? [...x, a.nome] : x.filter((n) => n !== a.nome)))}
                  />
                  <span className="text-tinta">{a.nome}</span>
                  <span className="text-xs text-secundario">({a.blocos.filter((b) => b <= nBlocos(duracao)).length}x)</span>
                </label>
              </li>
            ))}
            <li>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={followUps} onChange={(e) => setFollowUps(e.target.checked)} />
                <span className="text-tinta">Follow ups ao proprietário (bandeiras)</span>
              </label>
            </li>
          </ul>
          <div className="space-y-2 rounded-xl border border-black/10 p-3">
            <h3 className="text-xs font-semibold text-secundario">Juntar outras ações</h3>
            {extras.length > 0 && (
              <ul className="space-y-1">
                {extras.map((e, i) => {
                  const fora = e.bloco > nBlocos(duracao);
                  return (
                    <li key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span className={fora ? "text-secundario line-through" : "text-tinta"}>
                        {e.nome}{" "}
                        <span className="text-xs text-secundario">
                          (dias {(e.bloco - 1) * 10 + 1} a {e.bloco * 10}{fora ? `, fora dos ${duracao} dias` : ""})
                        </span>
                      </span>
                      <button
                        onClick={() => setExtras((x) => x.filter((_, j) => j !== i))}
                        aria-label={`Tirar ${e.nome}`}
                        className="p-1 text-secundario"
                      >
                        &times;
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                value={extraNome}
                onChange={(e) => setExtraNome(e.target.value)}
                placeholder="Nome da ação (ex: Vídeo drone)"
                className="min-w-0 flex-1 basis-40 rounded-xl border border-black/10 px-3 py-2.5 text-sm"
              />
              <select
                value={Math.min(extraBloco, nBlocos(duracao))}
                onChange={(e) => setExtraBloco(Number(e.target.value))}
                className="rounded-xl border border-black/10 bg-white px-2 py-2.5 text-sm"
              >
                {Array.from({ length: nBlocos(duracao) }, (_, i) => i + 1).map((b) => (
                  <option key={b} value={b}>
                    Dias {(b - 1) * 10 + 1} a {b * 10}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!extraNome.trim()}
                onClick={() => {
                  setExtras((x) => [...x, { nome: extraNome.trim(), bloco: Math.min(extraBloco, nBlocos(duracao)) }]);
                  setExtraNome("");
                }}
                className="rounded-xl bg-black/5 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                Juntar
              </button>
            </div>
          </div>
          <button
            disabled={aCriar}
            onClick={async () => {
              setACriar(true);
              await correr(criarPlano(ang, escolhidas, followUps, duracao, extras));
              setACriar(false);
            }}
            className="w-full rounded-xl bg-azul py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {aCriar ? "A criar..." : "Criar plano"}
          </button>
        </section>
      ) : (
        <>
          <section className={cartao}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-tinta">
                Plano <span className="font-normal text-secundario">({feitas}/{acoes.length} feitas)</span>
              </h2>
              <button
                onClick={() => setEditar((x) => !x)}
                className={`rounded-xl px-3 py-1.5 text-sm font-medium ${editar ? "bg-azul text-white" : "bg-black/5"}`}
              >
                {editar ? "Concluir edição" : "Editar plano"}
              </button>
            </div>
            {editar && (
              <p className="text-xs text-secundario">
                Toca num quadrado vazio (+) para juntar a ação a esse bloco. Toca numa ação para a retirar ou mudar de dia.
              </p>
            )}
            <div className="flex rounded-xl bg-black/5 p-1 text-sm font-medium" role="group" aria-label="Período da grelha">
              {(
                [
                  ["tudo", "Contrato todo"],
                  ["mes", "Este mês"],
                  ["trimestre", "Este trimestre"],
                ] as const
              ).map(([v, rot]) => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  aria-pressed={vista === v}
                  className={`flex-1 rounded-lg py-1.5 ${vista === v ? "bg-white text-tinta" : "text-secundario"}`}
                >
                  {rot}
                </button>
              ))}
            </div>
            <Grelha
              ang={ang}
              acoes={acoes}
              editar={editar}
              vista={vista}
              onAbrir={setAberta}
              onVazia={(nome, bloco) => correr(adicionarAcao(ang, nome, bloco, nome === NOME_FOLLOW_UP))}
            />
            <p className="text-xs text-secundario">
              Cada quadrado são 10 dias. Verde = feita, laranja = bloco já passou sem estar feita, bandeira = follow up.
            </p>
          </section>

          {editar && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!novaNome.trim()) return;
                await correr(adicionarAcao(ang, novaNome.trim(), novaBloco));
                setNovaNome("");
              }}
              className={cartao}
            >
              <h3 className="text-sm font-semibold text-tinta">Juntar ação</h3>
              <input
                list="acoes-padrao"
                value={novaNome}
                onChange={(e) => setNovaNome(e.target.value)}
                placeholder="Escolhe uma ação ou escreve uma nova"
                className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-base"
              />
              <datalist id="acoes-padrao">
                {ACOES_PADRAO.map((a) => <option key={a.nome} value={a.nome} />)}
              </datalist>
              <select
                value={novaBloco}
                onChange={(e) => setNovaBloco(Number(e.target.value))}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-base"
              >
                {Array.from({ length: nBlocos(ang.duracao_dias) }, (_, i) => i + 1).map((b) => (
                  <option key={b} value={b}>
                    Dias {(b - 1) * 10 + 1} a {b * 10}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={!novaNome.trim()} className="w-full rounded-xl bg-azul py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                Juntar ao plano
              </button>
            </form>
          )}

          <section className={cartao}>
            <h2 className="text-sm font-semibold text-tinta">Vendido</h2>
            {ang.vendido_em ? (
              <>
                <p className="text-sm text-tinta">Vendido a {formatarDia(new Date(ang.vendido_em + "T00:00:00"))}. As ações por fazer saíram do calendário.</p>
                <Comissao
                  dados={ang}
                  onChange={async (campos) => {
                    const { error } = await sbBrowser().from("angariacoes").update(campos).eq("id", ang.id);
                    if (error) setErro("Não foi possível guardar.");
                    await carregar();
                  }}
                />
                <button onClick={() => correr(marcarVendido(ang, acoes, null))} className="text-sm text-azul underline">
                  Reabrir angariação
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  if (window.confirm("Marcar como vendido? As ações por fazer saem do calendário (podes reabrir).")) {
                    correr(marcarVendido(ang, acoes, hojeISO()));
                  }
                }}
                className="w-full rounded-xl bg-verde py-3 text-sm font-semibold text-white"
              >
                Marcar como vendido
              </button>
            )}
          </section>
        </>
      )}

      {aberta && (
        <FolhaAcao
          key={aberta.id}
          ang={ang}
          acao={aberta}
          onFechar={() => setAberta(null)}
          onAlternar={() => correr(marcarAcao(aberta, !aberta.feita))}
          onFeedback={async (texto) => {
            await sbBrowser().from("angariacao_acoes").update({ feedback: texto.trim() || null }).eq("id", aberta.id);
            await carregar();
          }}
          onMover={(novoDia) => correr(moverAcao(ang, aberta, acoes, novoDia))}
          onRetirar={async () => {
            if (!window.confirm("Retirar esta ação do plano?")) return;
            await sbBrowser().from("angariacao_acoes").delete().eq("id", aberta.id);
            setAberta(null);
            await carregar();
          }}
        />
      )}

      <button
        onClick={async () => {
          if (!window.confirm("Apagar esta angariação e todo o plano? Não dá para desfazer.")) return;
          await sbBrowser().from("angariacoes").delete().eq("id", ang.id);
          router.push("/angariacoes");
        }}
        className="w-full py-2 text-sm text-red-600"
      >
        Apagar angariação
      </button>
    </div>
  );
}
