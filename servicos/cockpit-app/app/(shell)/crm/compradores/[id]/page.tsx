"use client";

import { EsqueletoLista } from "@/components/Esqueleto";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";
import FormComprador, { guardarZonas, nomeZona, paraComprador, paraContacto, valoresIniciais } from "@/components/crm/FormComprador";
import type { Localizacao } from "@/components/crm/SeletorLocalizacao";
import SwipeLinha from "@/components/gestos/SwipeLinha";
import ListaCorrespondencias from "@/components/oportunidades/ListaCorrespondencias";
import ContactosRegistados from "@/components/crm/ContactosRegistados";
import { atualizarPorComprador, carregarDoComprador, responder, type Correspondencia } from "@/lib/oportunidades";
import {
  DOCUMENTOS_ESCRITURA,
  FUNIL,
  OBJETIVOS,
  alertaLaranja,
  contar,
  corProgresso,
  indiceFunil,
  labelEstado,
  type Comprador,
  type EstadoComprador,
  type ImovelComprador,
} from "@/lib/comprador";
import CampoData from "@/components/crm/CampoData";
import Comissao from "@/components/crm/Comissao";
import { diasAte, hojeISO } from "@/lib/datas";

type Documento = { id: string; nome: string; entregue: boolean };

export default function FichaComprador() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [c, setC] = useState<Comprador | null>(null);
  const [imoveis, setImoveis] = useState<ImovelComprador[]>([]);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [zonas, setZonas] = useState<Localizacao[]>([]);
  const [corresp, setCorresp] = useState<Correspondencia[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [editar, setEditar] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);
  const [novoImovel, setNovoImovel] = useState("");
  const [novoDoc, setNovoDoc] = useState("");

  const carregar = useCallback(async () => {
    const sb = sbBrowser();
    const [r1, r2, r3, r4, cs] = await Promise.all([
      sb.from("compradores").select("*, contactos(*)").eq("id", id).single(),
      sb.from("comprador_imoveis").select("*").eq("comprador_id", id).order("created_at"),
      sb.from("comprador_documentos").select("*").eq("comprador_id", id).order("created_at"),
      sb.from("comprador_zonas").select("distrito, concelho, freguesia").eq("comprador_id", id).order("created_at"),
      carregarDoComprador(id),
    ]);
    if (r1.error || !r1.data) {
      setErro("Comprador não encontrado.");
      return;
    }
    setC(r1.data as unknown as Comprador);
    setImoveis((r2.data ?? []) as ImovelComprador[]);
    setDocs((r3.data ?? []) as Documento[]);
    setZonas(((r4.data ?? []) as { distrito: string; concelho: string | null; freguesia: string | null }[]).map((z) => ({ distrito: z.distrito, concelho: z.concelho ?? "", freguesia: z.freguesia ?? "" })));
    setCorresp(cs);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function atualizar(campos: Record<string, unknown>) {
    setErro(null);
    const { error } = await sbBrowser().from("compradores").update(campos).eq("id", id);
    if (error) setErro("Não foi possível guardar. Tenta outra vez.");
    await carregar();
  }

  // O funil só avança sozinho (nunca recua). Recuar é feito à mão no seletor de estado.
  async function avancarPara(estado: EstadoComprador, atual: EstadoComprador) {
    if (indiceFunil(estado) > indiceFunil(atual) && atual !== "perdido") {
      await atualizar({ estado, estado_desde: new Date().toISOString() });
    }
  }

  async function mudarEstado(estado: EstadoComprador) {
    if (!c || estado === c.estado) return;
    if (estado === "negocio_concluido") return concluir();
    await atualizar({ estado, estado_desde: new Date().toISOString() });
  }

  // Escritura efetuada: aviso para ligar ao cliente 6 meses depois (desenho do funil).
  async function concluir() {
    if (!c) return;
    const sb = sbBrowser();
    await atualizar({ estado: "negocio_concluido", estado_desde: new Date().toISOString() });
    const em6meses = new Date();
    em6meses.setMonth(em6meses.getMonth() + 6);
    em6meses.setHours(9, 0, 0, 0);
    const chave = `comprador:${c.id}:pos-escritura`;
    const { data } = await sb.from("tarefas").select("id").eq("chave_automacao", chave);
    if (!data || data.length === 0) {
      await sb.from("tarefas").insert({
        titulo: `Ligar a ${c.contactos.nome} (6 meses após a escritura)`,
        inicio: em6meses.toISOString(),
        origem: "comprador",
        comprador_id: c.id,
        contacto_id: c.contacto_id,
        chave_automacao: chave,
      });
    }
  }

  async function adicionarImovel(e: React.FormEvent) {
    e.preventDefault();
    if (!novoImovel.trim() || !c) return;
    const texto = novoImovel.trim();
    const eLink = /^https?:\/\//i.test(texto);
    const { error } = await sbBrowser()
      .from("comprador_imoveis")
      .insert({
        comprador_id: id,
        link: eLink ? texto : null,
        descricao: eLink ? null : texto,
        enviado_em: hojeISO(),
      });
    if (error) return setErro("Não foi possível adicionar o imóvel.");
    setNovoImovel("");
    await avancarPara("imoveis_enviados", c.estado);
    await carregar();
  }

  async function alternarMarco(i: ImovelComprador, campo: "enviado_em" | "visitado_em" | "proposta_em") {
    if (!c) return;
    const novo = i[campo] ? null : hojeISO();
    const { error } = await sbBrowser().from("comprador_imoveis").update({ [campo]: novo }).eq("id", i.id);
    if (error) return setErro("Não foi possível guardar.");
    if (novo) {
      if (campo === "visitado_em") await avancarPara("visitas_realizadas", c.estado);
      if (campo === "proposta_em") await avancarPara("propostas_efetuadas", c.estado);
    }
    await carregar();
  }

  async function apagarImovel(i: ImovelComprador) {
    if (!window.confirm("Remover este imóvel do comprador?")) return;
    await sbBrowser().from("comprador_imoveis").delete().eq("id", i.id);
    await carregar();
  }

  async function adicionarDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!novoDoc.trim()) return;
    await sbBrowser().from("comprador_documentos").insert({ comprador_id: id, nome: novoDoc.trim() });
    setNovoDoc("");
    await carregar();
  }

  // Junta a lista habitual, sem repetir os que já existem (ignora maiúsculas)
  async function usarListaPadrao() {
    const existentes = new Set(docs.map((d) => d.nome.trim().toLowerCase()));
    const novos = DOCUMENTOS_ESCRITURA.filter((n) => !existentes.has(n.toLowerCase()));
    if (novos.length === 0) return;
    const { error } = await sbBrowser().from("comprador_documentos").insert(novos.map((nome) => ({ comprador_id: id, nome })));
    if (error) return setErro("Não foi possível juntar a lista de documentos.");
    await carregar();
  }

  async function alternarDoc(d: Documento) {
    setDocs((ds) => ds.map((x) => (x.id === d.id ? { ...x, entregue: !x.entregue } : x)));
    await sbBrowser().from("comprador_documentos").update({ entregue: !d.entregue }).eq("id", d.id);
  }

  async function apagarComprador() {
    if (!c) return;
    if (!window.confirm(`Apagar ${c.contactos.nome} e todo o histórico? Não dá para desfazer.`)) return;
    await sbBrowser().from("contactos").delete().eq("id", c.contacto_id);
    router.push("/crm/compradores");
  }

  if (erro && !c) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>;
  if (!c) return <EsqueletoLista n={3} />;

  const n = contar(imoveis);
  const alerta = alertaLaranja(c);
  const tel = c.contactos.telemovel;
  const diasEscritura = c.escritura_prazo ? diasAte(c.escritura_prazo) : null;
  const cartao = "space-y-3 rounded-2xl bg-white p-4 shadow-sm";

  if (editar) {
    return (
      <div className="space-y-4">
        <button onClick={() => setEditar(false)} className="text-sm text-azul">&larr; Cancelar</button>
        <FormComprador
          inicial={valoresIniciais(c, zonas)}
          textoBotao="Guardar alterações"
          aGuardar={aGuardar}
          onSubmit={async (v) => {
            setAGuardar(true);
            const sb = sbBrowser();
            const r1 = await sb.from("contactos").update(paraContacto(v)).eq("id", c.contacto_id);
            const r2 = await sb.from("compradores").update(paraComprador(v)).eq("id", c.id);
            const eZonas = await guardarZonas(c.id, v);
            if (!r1.error && !r2.error && !eZonas) await atualizarPorComprador(c.id);
            setAGuardar(false);
            if (r1.error || r2.error || eZonas) return setErro(eZonas ?? "Não foi possível guardar.");
            setEditar(false);
            await carregar();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/crm/compradores" className="text-sm text-azul">&larr; Compradores</Link>
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <section className={cartao}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-tinta">{c.contactos.nome}</h2>
            <p className="text-sm text-secundario">
              {[c.tipo_imovel, c.tipologia_minima, zonas.length > 0 ? zonas.map(nomeZona).join(" / ") : c.concelho || c.distrito].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={() => setEditar(true)} className="shrink-0 rounded-xl bg-black/5 px-3 py-1.5 text-sm font-medium">
            Editar
          </button>
        </div>
        {tel && (
          <div className="flex gap-2">
            <a href={`tel:${tel}`} className="flex-1 rounded-xl bg-azul py-2.5 text-center text-sm font-semibold text-white">Ligar</a>
            <a
              href={`https://wa.me/${tel.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl bg-verde py-2.5 text-center text-sm font-semibold text-white"
            >
              WhatsApp
            </a>
          </div>
        )}
        {alerta && <p className="rounded-lg bg-ambar-fundo px-3 py-2 text-sm font-medium text-ambar-texto">{alerta}</p>}
      </section>

      <ContactosRegistados contactoId={c.contacto_id} />

      {corresp.length > 0 && (
        <section className={cartao}>
          <h3 className="text-sm font-semibold text-tinta">Imóveis que podem servir ({corresp.filter((x) => x.estado === "nova").length} por rever)</h3>
          <ListaCorrespondencias
            itens={corresp}
            mostrar="imovel"
            onResponder={async (x, estado) => {
              await responder(x.id, estado);
              await carregar();
            }}
          />
        </section>
      )}

      <section className={cartao}>
        <h3 className="text-sm font-semibold text-tinta">Funil</h3>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {FUNIL.map((f, i) => {
            const ativo = c.estado === f.id;
            const passado = c.estado !== "perdido" && i < indiceFunil(c.estado);
            return (
              <button
                key={f.id}
                onClick={() => mudarEstado(f.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  ativo ? "bg-azul text-white" : passado ? "bg-azul/15 text-azul" : "bg-black/5 text-secundario"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-secundario">
          Estado atual: {labelEstado(c.estado)}.{" "}
          {c.estado !== "perdido" ? (
            <button onClick={() => mudarEstado("perdido")} className="underline">Marcar como perdido</button>
          ) : (
            <button onClick={() => mudarEstado("lead_qualificada")} className="underline">Reativar</button>
          )}
        </p>
      </section>

      <section className={cartao}>
        <h3 className="text-sm font-semibold text-tinta">Imóveis</h3>
        {([
          ["Enviados", n.enviados, OBJETIVOS.enviados],
          ["Visitas", n.visitas, OBJETIVOS.visitas],
          ["Propostas", n.propostas, OBJETIVOS.propostas],
        ] as const).map(([rotulo, valor, objetivo]) => (
          <div key={rotulo}>
            <div className="flex justify-between text-xs text-secundario">
              <span>{rotulo}</span>
              <span>{valor}/{objetivo}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/5">
              <div
                className={`h-full rounded-full ${corProgresso(valor, objetivo)}`}
                style={{ width: `${Math.min(100, (valor / objetivo) * 100)}%` }}
              />
            </div>
          </div>
        ))}

        <ul className="space-y-2 pt-1">
          {imoveis.map((i) => (
            <li key={i.id}>
              <SwipeLinha
                className="rounded-xl"
                direita={
                  !i.visitado_em
                    ? { rotulo: "Visitado", classe: "bg-verde text-white", onAcao: () => alternarMarco(i, "visitado_em") }
                    : !i.proposta_em
                    ? { rotulo: "Proposta", classe: "bg-verde text-white", onAcao: () => alternarMarco(i, "proposta_em") }
                    : undefined
                }
                esquerda={{ rotulo: "Remover", classe: "bg-red-600 text-white", onAcao: () => apagarImovel(i) }}
              >
              <div className="rounded-xl border border-black/10 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                {i.link ? (
                  <a href={i.link} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sm text-azul">{i.link}</a>
                ) : (
                  <p className="min-w-0 truncate text-sm text-tinta">{i.descricao}</p>
                )}
                <button onClick={() => apagarImovel(i)} aria-label="Remover" className="text-secundario">&times;</button>
              </div>
              <div className="mt-2 flex gap-1.5">
                {([
                  ["enviado_em", "Enviado"],
                  ["visitado_em", "Visitado"],
                  ["proposta_em", "Proposta"],
                ] as const).map(([campo, rotulo]) => (
                  <button
                    key={campo}
                    onClick={() => alternarMarco(i, campo)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${i[campo] ? "bg-verde text-white" : "bg-black/5 text-secundario"}`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              </div>
              </SwipeLinha>
            </li>
          ))}
        </ul>
        <form onSubmit={adicionarImovel} className="flex gap-2">
          <input
            value={novoImovel}
            onChange={(e) => setNovoImovel(e.target.value)}
            placeholder="Link ou descrição do imóvel enviado"
            className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm"
          />
          <button type="submit" disabled={!novoImovel.trim()} className="rounded-xl bg-azul px-4 text-sm font-semibold text-white disabled:opacity-50">
            Juntar
          </button>
        </form>
      </section>

      <section className={cartao}>
        <h3 className="text-sm font-semibold text-tinta">CPCV</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={c.cpcv_fechado}
            onChange={async (e) => {
              await atualizar({ cpcv_fechado: e.target.checked, cpcv_data: e.target.checked ? c.cpcv_data ?? hojeISO() : null });
              if (e.target.checked) await avancarPara("cpcv", c.estado);
            }}
          />
          CPCV fechado
        </label>
        {c.cpcv_fechado && (
          <CampoData label="Data do CPCV" value={c.cpcv_data} onCommit={(v) => atualizar({ cpcv_data: v })} />
        )}
        {c.cpcv_fechado && <Comissao dados={c} onChange={atualizar} />}
      </section>

      {c.cpcv_fechado && (
        <section className={cartao}>
          <h3 className="text-sm font-semibold text-tinta">Escritura</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={c.escritura_agendada}
              onChange={async (e) => {
                await atualizar({ escritura_agendada: e.target.checked });
                if (e.target.checked) await avancarPara("escritura", c.estado);
              }}
            />
            Escritura agendada
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {c.escritura_agendada && (
              <CampoData label="Data da escritura" value={c.escritura_data} onCommit={(v) => atualizar({ escritura_data: v })} />
            )}
            <CampoData label="Prazo da escritura" value={c.escritura_prazo} onCommit={(v) => atualizar({ escritura_prazo: v })} />
          </div>
          {diasEscritura !== null && (
            <p
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                diasEscritura < 0 ? "bg-red-50 text-red-700" : diasEscritura <= 15 ? "bg-ambar-fundo text-ambar-texto" : "bg-black/5 text-tinta"
              }`}
            >
              {diasEscritura < 0
                ? `Prazo ultrapassado há ${-diasEscritura} dias`
                : diasEscritura === 0
                ? "O prazo termina hoje"
                : `Faltam ${diasEscritura} dias para terminar o prazo`}
            </p>
          )}

          <Comissao dados={c} onChange={atualizar} soRecebida />

          <h4 className="pt-1 text-xs font-semibold text-secundario">
            Documentos em falta ({docs.filter((d) => !d.entregue).length})
          </h4>
          <ul className="space-y-1.5">
            {docs.map((d) => (
              <li key={d.id}>
                <SwipeLinha
                  className="rounded-lg"
                  direita={{ rotulo: d.entregue ? "Por entregar" : "Entregue", classe: d.entregue ? "bg-secundario text-white" : "bg-verde text-white", onAcao: () => alternarDoc(d) }}
                >
                  <label className="flex items-center gap-2 bg-white py-1 text-sm">
                    <input type="checkbox" checked={d.entregue} onChange={() => alternarDoc(d)} />
                    <span className={d.entregue ? "text-secundario line-through" : "text-tinta"}>{d.nome}</span>
                  </label>
                </SwipeLinha>
              </li>
            ))}
          </ul>
          {DOCUMENTOS_ESCRITURA.some((n) => !docs.some((d) => d.nome.trim().toLowerCase() === n.toLowerCase())) && (
            <button type="button" onClick={usarListaPadrao} className="rounded-full bg-black/5 px-4 py-2 text-sm font-medium text-tinta">
              {docs.length === 0 ? "Usar a lista habitual" : "Juntar os que faltam da lista habitual"}
            </button>
          )}
          <form onSubmit={adicionarDoc} className="flex gap-2">
            <input
              value={novoDoc}
              onChange={(e) => setNovoDoc(e.target.value)}
              placeholder="Adicionar documento"
              className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm"
            />
            <button type="submit" disabled={!novoDoc.trim()} className="rounded-xl bg-azul px-4 text-sm font-semibold text-white disabled:opacity-50">
              Juntar
            </button>
          </form>

          {c.estado === "escritura" && (
            <button onClick={concluir} className="w-full rounded-xl bg-verde py-3 text-sm font-semibold text-white">
              Escritura feita: concluir negócio
            </button>
          )}
        </section>
      )}

      <button onClick={apagarComprador} className="w-full py-2 text-sm text-red-600">
        Apagar comprador
      </button>
    </div>
  );
}
