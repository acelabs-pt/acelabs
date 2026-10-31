"use client";

import { EsqueletoLista } from "@/components/Esqueleto";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";
import { atualizarPorProprietario, carregarDoProprietario, responder, type Correspondencia } from "@/lib/oportunidades";
import ListaCorrespondencias from "@/components/oportunidades/ListaCorrespondencias";
import BotaoExportar from "@/components/crm/BotaoExportar";
import ContactosRegistados from "@/components/crm/ContactosRegistados";
import FormProprietario, { paraContactoProp, paraProprietario, valoresIniciaisProp } from "@/components/crm/FormProprietario";
import {
  FUNIL_PROP,
  agendarFollowUps,
  concluirTarefasDaFase,
  ESTADO_POR_TAREFA,
  indiceFunilProp,
  labelEstadoProp,
  tipoDaTarefa,
  type EstadoProprietario,
  type Proprietario,
} from "@/lib/proprietario";
import { formatarDia, formatarHora, hojeISO, isoParaLocal, localParaISO } from "@/lib/datas";
import type { Tarefa } from "@/lib/types";
import { linkWhatsapp } from "@/lib/whatsapp";
import { eur } from "@/lib/graficos";

export default function FichaProprietario() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<Proprietario | null>(null);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [corresp, setCorresp] = useState<Correspondencia[]>([]);
  const [temAngariacao, setTemAngariacao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editar, setEditar] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);

  const [reuniao, setReuniao] = useState("");
  const [fechar, setFechar] = useState(false);
  const [angTitulo, setAngTitulo] = useState("");
  const [angDuracao, setAngDuracao] = useState<120 | 180>(180);
  const [angInicio, setAngInicio] = useState(hojeISO());
  const [angRegime, setAngRegime] = useState<"" | "exclusivo" | "nao_exclusivo">("");
  const [regimeGuardado, setRegimeGuardado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const sb = sbBrowser();
    const r1 = await sb.from("proprietarios").select("*, contactos(*)").eq("id", id).single();
    if (r1.error || !r1.data) {
      setErro("Proprietário não encontrado.");
      return;
    }
    const prop = r1.data as unknown as Proprietario;
    const [r3, r4, cs] = await Promise.all([
      sb.from("tarefas").select("*").eq("proprietario_id", id).order("inicio", { ascending: true }),
      sb.from("angariacoes").select("id, regime").eq("proprietario_id", id),
      carregarDoProprietario(id),
    ]);
    setCorresp(cs);
    setP(prop);
    setTarefas((r3.data ?? []) as Tarefa[]);
    setTemAngariacao((r4.data ?? []).length > 0);
    setRegimeGuardado(r4.data?.[0]?.regime ?? null);
    setReuniao((r) => r || (prop.reuniao_em ? isoParaLocal(prop.reuniao_em) : ""));
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function atualizar(campos: Record<string, unknown>) {
    setErro(null);
    const { error } = await sbBrowser().from("proprietarios").update(campos).eq("id", id);
    if (error) setErro("Não foi possível guardar. Tenta outra vez.");
    await carregar();
  }

  async function mudarEstado(estado: EstadoProprietario) {
    if (!p || estado === p.estado) return;
    if (estado === "angariado") {
      setAngTitulo(angTitulo || [p.tipo_imovel, p.tipologia, p.freguesia || p.concelho].filter(Boolean).join(" ") || p.contactos.nome);
      setFechar(true);
      return;
    }
    await atualizar({ estado, estado_desde: new Date().toISOString() });
    // só marca como feitas as tarefas das fases ultrapassadas ao avançar
    if (estado !== "perdido" && indiceFunilProp(estado) > indiceFunilProp(p.estado)) {
      await concluirTarefasDaFase(p.id, estado);
      await carregar();
    }
  }

  const tReuniao = p ? tarefas.find((t) => t.chave_automacao === `proprietario:${p.id}:reuniao` && !t.feita) : undefined;

  async function marcarReuniao(e: React.FormEvent) {
    e.preventDefault();
    if (!p || !reuniao) return;
    const quando = new Date(localParaISO(reuniao));
    const campos: Record<string, unknown> = { reuniao_em: quando.toISOString() };
    if (p.estado === "fsbo") {
      campos.estado = "reuniao_marcada";
      campos.estado_desde = new Date().toISOString();
    }
    await atualizar(campos);
    await agendarFollowUps({ id: p.id, contacto_id: p.contacto_id, nome: p.contactos.nome }, quando);
    await carregar();
  }

  // Fechar angariação: obriga a preencher o que o Gestor de Angariações precisa e cria a angariação.
  async function fecharAngariacao(e: React.FormEvent) {
    e.preventDefault();
    if (!p || !angTitulo.trim() || !angRegime) return;
    const sb = sbBrowser();
    if (!temAngariacao) {
      const { error } = await sb.from("angariacoes").insert({
        proprietario_id: p.id,
        titulo: angTitulo.trim(),
        duracao_dias: angDuracao,
        regime: angRegime || null,
        inicio: angInicio,
      });
      if (error) return setErro("Não foi possível criar a angariação.");
    }
    setFechar(false);
    await atualizar({ estado: "angariado", estado_desde: new Date().toISOString() });
    await concluirTarefasDaFase(p.id, "angariado");
    await carregar();
  }

  // A chamada de angariação foi feita mas o proprietário não angariou: fica como perdido
  // (pode ser reativado no funil) e a tarefa da chamada fica feita.
  async function naoAngariado() {
    if (!p) return;
    setFechar(false);
    await atualizar({ estado: "perdido", estado_desde: new Date().toISOString() });
    await concluirTarefasDaFase(p.id, "angariado");
    await carregar();
  }

  // Marcar uma tarefa do plano como feita leva o proprietário para a fase correspondente do funil
  // (só avança, nunca recua). "Chamada de angariação" abre antes o formulário de fechar angariação.
  async function alternarTarefa(t: Tarefa) {
    if (!p) return;
    const feita = !t.feita;
    const tipo = tipoDaTarefa(t.chave_automacao);
    const alvo = tipo ? ESTADO_POR_TAREFA[tipo] : undefined;

    if (feita && alvo === "angariado" && p.estado !== "perdido") {
      await mudarEstado("angariado");
      return;
    }

    setTarefas((ts) => ts.map((x) => (x.id === t.id ? { ...x, feita } : x)));
    const { error } = await sbBrowser()
      .from("tarefas")
      .update({ feita, feita_em: feita ? new Date().toISOString() : null })
      .eq("id", t.id);
    if (error) {
      setErro("Não foi possível guardar. Tenta outra vez.");
      return carregar();
    }
    if (feita && alvo && p.estado !== "perdido" && indiceFunilProp(alvo) > indiceFunilProp(p.estado)) {
      await atualizar({ estado: alvo, estado_desde: new Date().toISOString() });
    }
  }

  async function apagar() {
    if (!p) return;
    if (!window.confirm(`Apagar ${p.contactos.nome} e todo o histórico? Não dá para desfazer.`)) return;
    await sbBrowser().from("contactos").delete().eq("id", p.contacto_id);
    router.push("/crm/proprietarios");
  }

  if (erro && !p) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>;
  if (!p) return <EsqueletoLista n={3} />;

  const tel = p.contactos.telemovel;
  const cartao = "space-y-3 rounded-3xl border border-linha bg-white p-5";
  const campo = "w-full rounded-xl border border-black/10 px-3 py-2.5 text-base";

  if (editar) {
    return (
      <div className="space-y-4">
        <button onClick={() => setEditar(false)} className="text-sm font-medium text-azul-escuro">&larr; Cancelar</button>
        <FormProprietario
          inicial={valoresIniciaisProp(p)}
          textoBotao="Guardar alterações"
          aGuardar={aGuardar}
          onSubmit={async (v) => {
            setAGuardar(true);
            const sb = sbBrowser();
            const r1 = await sb.from("contactos").update(paraContactoProp(v)).eq("id", p.contacto_id);
            const r2 = await sb.from("proprietarios").update(paraProprietario(v)).eq("id", p.id);
            if (!r1.error && !r2.error) await atualizarPorProprietario(p.id);
            setAGuardar(false);
            if (r1.error || r2.error) return setErro("Não foi possível guardar.");
            setEditar(false);
            await carregar();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/crm/proprietarios" className="text-sm font-medium text-azul-escuro">&larr; Proprietários</Link>
      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      <section className="space-y-4 rounded-3xl border border-linha bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-tinta">{p.contactos.nome}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.estado === "perdido" ? "bg-black/5 text-secundario" : "bg-azul-suave text-azul-escuro"}`}>
                {labelEstadoProp(p.estado)}
              </span>
              {p.estado === "angariado" && regimeGuardado && (
                <span className="rounded-full bg-verde-suave px-2.5 py-1 text-xs font-semibold text-tinta">
                  {regimeGuardado === "exclusivo" ? "Em exclusivo" : "Não exclusivo"}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => setEditar(true)} className="shrink-0 rounded-full bg-black/5 px-4 py-2 text-sm font-medium text-tinta">
            Editar
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {(
            [
              ["Imóvel", [p.tipo_imovel, p.tipologia].filter(Boolean).join(", ")],
              ["Preço pedido", p.valor != null ? eur(Number(p.valor)) : ""],
              ["Zona", [p.freguesia, p.concelho, p.distrito].filter(Boolean).join(", ")],
              ["Origem", p.contactos.canal_origem ?? ""],
              ["Telemóvel", p.contactos.telemovel ?? ""],
              ["Email", p.contactos.email ?? ""],
              ["Notas", p.contactos.observacoes ?? ""],
            ] as [string, string][]
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className={k === "Zona" || k === "Email" || k === "Notas" ? "col-span-2" : ""}>
                <dt className="text-xs text-secundario">{k}</dt>
                <dd className="break-words font-medium text-tinta">{v}</dd>
              </div>
            ))}
        </dl>
        {p.link_imovel && /^https?:\/\//i.test(p.link_imovel) && (
          <a href={p.link_imovel} target="_blank" rel="noreferrer" className="inline-block text-sm font-medium text-azul-escuro">
            Ver o anúncio
          </a>
        )}

        {tel && (
          <div className="flex gap-2">
            <a href={`tel:${tel}`} className="flex-1 rounded-full bg-azul py-3 text-center text-base font-semibold text-white">
              Ligar
            </a>
            <a href={linkWhatsapp(tel)} target="_blank" rel="noreferrer" className="flex-1 rounded-full bg-verde py-3 text-center text-base font-semibold text-tinta">
              WhatsApp
            </a>
          </div>
        )}
      </section>

      {/* compradores cujo perfil serve este imóvel (ideia do Miguel, sobre os alertas de correspondência) */}
      {corresp.length > 0 && (
        <section className={cartao}>
          <h3 className="text-sm font-semibold text-tinta">
            Compradores com interesse ({corresp.filter((x) => x.estado === "nova").length} por rever)
          </h3>
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


      <section className={cartao}>
        <h3 className="text-sm font-semibold text-tinta">Funil</h3>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {FUNIL_PROP.map((f, i) => {
            const ativo = p.estado === f.id;
            const passado = p.estado !== "perdido" && i < indiceFunilProp(p.estado);
            return (
              <button
                key={f.id}
                onClick={() => mudarEstado(f.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                  ativo ? "bg-azul text-white" : passado ? "bg-azul/15 text-azul-escuro" : "bg-black/5 text-secundario"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-secundario">
          Estado atual: {labelEstadoProp(p.estado)}.{" "}
          {p.estado !== "perdido" ? (
            <button onClick={() => mudarEstado("perdido")} className="underline">Marcar como perdido</button>
          ) : (
            <button onClick={() => mudarEstado("fsbo")} className="underline">Reativar</button>
          )}
        </p>
      </section>

      {fechar && (
        <form onSubmit={fecharAngariacao} className={`${cartao} border-2 border-azul/30`}>
          <h3 className="text-sm font-semibold text-tinta">Fechar angariação</h3>
          <p className="text-xs text-secundario">Estes dados passam para o Gestor de Angariações.</p>
          <label className="block text-xs text-secundario">
            Imóvel (morada ou referência)
            <input value={angTitulo} onChange={(e) => setAngTitulo(e.target.value)} required className={`${campo} mt-1 text-tinta`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-secundario">
              Duração do contrato
              <select value={angDuracao} onChange={(e) => setAngDuracao(Number(e.target.value) as 120 | 180)} className={`${campo} mt-1 bg-white text-tinta`}>
                <option value={180}>180 dias</option>
                <option value={120}>120 dias</option>
              </select>
            </label>
            <label className="block text-xs text-secundario">
              Início do contrato
              <input type="date" value={angInicio} onChange={(e) => setAngInicio(e.target.value)} required className={`${campo} mt-1 text-tinta`} />
            </label>
          </div>
          <div>
            <p className="mb-1 text-xs text-secundario">Regime do contrato</p>
            <div className="flex rounded-xl bg-black/5 p-1 text-sm font-medium">
              {([["exclusivo", "Em exclusivo"], ["nao_exclusivo", "Não exclusivo"]] as const).map(([v, rotulo]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAngRegime(v)}
                  className={`flex-1 rounded-lg py-2 ${angRegime === v ? "bg-white text-tinta shadow-sm" : "text-tinta/70"}`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={naoAngariado}
              className="flex-1 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-semibold text-red-700"
            >
              Não angariado
            </button>
            <button type="submit" disabled={!angRegime} className="flex-1 rounded-xl bg-verde py-2.5 text-sm font-semibold text-tinta disabled:opacity-50">
              Angariado
            </button>
          </div>
          {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          <button type="button" onClick={() => setFechar(false)} className="w-full text-xs text-secundario underline">
            Cancelar (decidir mais tarde)
          </button>
        </form>
      )}

      <section className={cartao}>
        <h3 className="text-sm font-semibold text-tinta">Reunião de angariação</h3>
        {p.reuniao_em && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-tinta">
              {formatarDia(new Date(p.reuniao_em))} às {formatarHora(p.reuniao_em) || "00:00"}
            </p>
            {tReuniao && (
              // o telemóvel avisa 30 minutos antes, com notificação própria
              <a href={`/api/tarefas/${tReuniao.id}/calendario`} className="rounded-full bg-azul-suave px-3 py-1.5 text-xs font-semibold text-azul-escuro">
                Pôr no calendário do telemóvel
              </a>
            )}
          </div>
        )}
        <form onSubmit={marcarReuniao} className="flex flex-wrap gap-2">
          <input type="datetime-local" aria-label="Data e hora da reunião" value={reuniao} onChange={(e) => setReuniao(e.target.value)} className={`${campo} min-w-0 flex-1`} />
          <button type="submit" disabled={!reuniao} className="rounded-xl bg-azul px-4 text-sm font-semibold text-white disabled:opacity-50">
            {p.reuniao_em ? "Reagendar" : "Marcar reunião"}
          </button>
        </form>
        <p className="text-xs text-secundario">
          Ao marcar, o calendário recebe a reunião, o aviso 2 horas antes e os follow-ups (2h, 2, 7, 14, 22 e 30 dias depois).
        </p>
      </section>

      <section className={cartao}>
        <h3 className="text-sm font-semibold text-tinta">Próximos passos</h3>
        {tarefas.length === 0 ? (
          <p className="text-sm text-secundario">Sem tarefas. Marca a reunião para gerar o plano de follow up.</p>
        ) : (
          <ul className="space-y-1.5">
            {tarefas.map((t) => (
              <li key={t.id}>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={t.feita} onChange={() => alternarTarefa(t)} className="mt-1" />
                  <span className={t.feita ? "text-secundario line-through" : "text-tinta"}>
                    {t.titulo}
                    {t.inicio && (
                      <span className={`block text-xs ${!t.feita && new Date(t.inicio) < new Date() ? "text-ambar-texto" : "text-secundario"}`}>
                        {formatarDia(new Date(t.inicio))} {formatarHora(t.inicio)}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ContactosRegistados contactoId={p.contacto_id} />

      <BotaoExportar contactoId={p.contacto_id} nome={p.contactos.nome} />

      <button onClick={apagar} className="w-full py-2 text-sm font-medium text-red-700">Apagar proprietário</button>
    </div>
  );
}
