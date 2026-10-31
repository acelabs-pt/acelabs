"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { sbBrowser } from "@/lib/supabase-browser";
import EditorVisita from "@/components/crm/EditorVisita";
import { CampoTelemovel } from "@/components/crm/Campos";
import { registarProposta, registarVisita, type ImovelComprador } from "@/lib/comprador";
import { formatarDia, hojeISO } from "@/lib/datas";
import type { Angariacao } from "@/lib/angariacao";

type Tipo = "visita" | "proposta";
type RegistoMeu = ImovelComprador & { compradores: { id: string; contactos: { nome: string } } };
type RegistoExterno = { id: string; consultor: string; data: string; obs: string | null };
type Opcao = { id: string; contactos: { nome: string } };
type Modo = "meu" | "novo" | "externo";

const MODOS: [Modo, string][] = [
  ["meu", "Cliente meu"],
  ["novo", "Cliente meu, ainda não inserido"],
  ["externo", "Cliente de outro consultor"],
];

// O que muda entre visitas e propostas: colunas, tabela dos clientes de outros consultores e textos.
const CFG = {
  visita: {
    titulo: "Visitas",
    campoData: "visitado_em",
    campoObs: "visita_obs",
    externas: "visitas_externas",
    registar: registarVisita,
    nome: "visita",
    vazio: "Ainda sem visitas registadas.",
    estadoNovo: "Visitas realizadas",
    obsPlaceholder: "Observações da visita",
  },
  proposta: {
    titulo: "Propostas",
    campoData: "proposta_em",
    campoObs: "proposta_obs",
    externas: "propostas_externas",
    registar: registarProposta,
    nome: "proposta",
    vazio: "Ainda sem propostas registadas.",
    estadoNovo: "Propostas efetuadas",
    obsPlaceholder: "Observações da proposta",
  },
} as const;

const campo = "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm";

// Visitas ou propostas a esta angariação. As de clientes meus são as mesmas que aparecem na ficha de cada
// comprador (é o mesmo registo). As de clientes de outro consultor guardam só o nome do consultor.
function Registos({
  ang,
  tipo,
  aberto,
  onFechar,
  onAlterado,
}: {
  ang: Angariacao;
  tipo: Tipo;
  aberto: boolean;
  onFechar: () => void;
  onAlterado?: () => void;
}) {
  const cfg = CFG[tipo];
  const [minhas, setMinhas] = useState<RegistoMeu[]>([]);
  const [externas, setExternas] = useState<RegistoExterno[]>([]);
  const [compradores, setCompradores] = useState<Opcao[]>([]);
  const [modo, setModo] = useState<Modo>("meu");
  const [compradorId, setCompradorId] = useState("");
  const [nome, setNome] = useState("");
  const [prefixo, setPrefixo] = useState("+351");
  const [numero, setNumero] = useState("");
  const [consultor, setConsultor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [obs, setObs] = useState("");
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const sb = sbBrowser();
    const [r1, r2, r3] = await Promise.all([
      sb
        .from("comprador_imoveis")
        .select("*, compradores(id, contactos(nome))")
        .eq("angariacao_id", ang.id)
        .not(cfg.campoData, "is", null),
      sb.from("compradores").select("id, contactos(nome)").neq("estado", "perdido"),
      sb.from(cfg.externas).select("*").eq("angariacao_id", ang.id),
    ]);
    setMinhas((r1.data ?? []) as unknown as RegistoMeu[]);
    setCompradores(((r2.data ?? []) as unknown as Opcao[]).sort((a, b) => a.contactos.nome.localeCompare(b.contactos.nome)));
    setExternas((r3.data ?? []) as RegistoExterno[]);
  }, [ang.id, cfg.campoData, cfg.externas]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function guardar(op: PromiseLike<{ error: unknown }>) {
    setErro(null);
    const { error } = await op;
    if (error) setErro("Não foi possível guardar.");
    await carregar();
    onAlterado?.();
  }

  const podeRegistar =
    (modo === "meu" && compradorId !== "") || (modo === "novo" && nome.trim() !== "") || (modo === "externo" && consultor.trim() !== "");

  async function registar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeRegistar) return;
    setAGuardar(true);
    setErro(null);
    const sb = sbBrowser();
    let e1: string | null = null;

    if (modo === "externo") {
      const { error } = await sb
        .from(cfg.externas)
        .insert({ angariacao_id: ang.id, consultor: consultor.trim(), data, obs: obs.trim() || null });
      if (error) e1 = `Não foi possível registar a ${cfg.nome}.`;
    } else {
      let idComprador = compradorId;
      if (modo === "novo") {
        // cliente meu que ainda não estava na plataforma: cria o contacto e o comprador e regista a visita
        const tel = numero.replace(/\s+/g, "");
        const { data: contacto, error: ec } = await sb
          .from("contactos")
          .insert({ nome: nome.trim(), telemovel: tel ? `${prefixo}${tel}` : null })
          .select("id")
          .single();
        if (ec || !contacto) e1 = "Não foi possível criar o cliente.";
        else {
          const { data: comprador, error: ep } = await sb
            .from("compradores")
            .insert({ contacto_id: contacto.id })
            .select("id")
            .single();
          if (ep || !comprador) {
            await sb.from("contactos").delete().eq("id", contacto.id);
            e1 = "Não foi possível criar o cliente.";
          } else idComprador = comprador.id;
        }
      }
      if (!e1) e1 = await cfg.registar({ compradorId: idComprador, angariacaoId: ang.id, descricao: ang.titulo, data, obs });
    }

    setAGuardar(false);
    if (e1) return setErro(e1);
    setCompradorId("");
    setNome("");
    setNumero("");
    setConsultor("");
    setObs("");
    setData(hojeISO());
    await carregar();
    onAlterado?.();
    onFechar();
  }

  const itens = [
    ...minhas.map((v) => ({ chave: v.id, data: (v as unknown as Record<string, string>)[cfg.campoData], v, x: null })),
    ...externas.map((x) => ({ chave: x.id, data: x.data, v: null, x })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  if (itens.length === 0 && !aberto) return null;

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-tinta">
        {cfg.titulo} <span className="font-normal text-secundario">({itens.length})</span>
      </h2>
      {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      {itens.length > 0 && (
        <ul className="space-y-2">
          {itens.map(({ chave, data: d, v, x }) => (
            <li key={chave} className="space-y-2 rounded-xl border border-black/10 p-3">
              <div className="flex items-baseline justify-between gap-2">
                {v ? (
                  <Link href={`/crm/compradores/${v.compradores.id}`} className="min-w-0 truncate text-sm font-semibold text-azul">
                    {v.compradores.contactos.nome}
                  </Link>
                ) : (
                  <p className="min-w-0 truncate text-sm font-semibold text-tinta">Cliente de {x!.consultor}</p>
                )}
                <span className="shrink-0 text-xs text-secundario">
                  {v?.sem_interesse_em && <span className="mr-1.5 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700">Sem interesse</span>}
                  {formatarDia(new Date(d + "T00:00:00"))}
                </span>
              </div>
              {v ? (
                <EditorVisita
                  tipo={tipo}
                  data={d}
                  obs={(v as unknown as Record<string, string | null>)[cfg.campoObs]}
                  onData={(nd) => guardar(sbBrowser().from("comprador_imoveis").update({ [cfg.campoData]: nd }).eq("id", v.id))}
                  onObs={(t) => guardar(sbBrowser().from("comprador_imoveis").update({ [cfg.campoObs]: t.trim() || null }).eq("id", v.id))}
                />
              ) : (
                <>
                  <EditorVisita
                    tipo={tipo}
                    data={d}
                    obs={x!.obs}
                    onData={(nd) => guardar(sbBrowser().from(cfg.externas).update({ data: nd }).eq("id", x!.id))}
                    onObs={(t) => guardar(sbBrowser().from(cfg.externas).update({ obs: t.trim() || null }).eq("id", x!.id))}
                  />
                  <button
                    onClick={() => {
                      if (window.confirm(`Remover esta ${cfg.nome}?`)) guardar(sbBrowser().from(cfg.externas).delete().eq("id", x!.id));
                    }}
                    className="text-xs text-red-600"
                  >
                    Remover {cfg.nome}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {aberto && (
      <form onSubmit={registar} className={`space-y-2 ${itens.length > 0 ? "border-t border-black/10 pt-3" : ""}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-secundario">Registar {cfg.nome}</h3>
          <button type="button" onClick={onFechar} className="text-xs font-medium text-secundario">
            Fechar
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MODOS.map(([m, rotulo]) => (
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

        {modo === "meu" && (
          <select value={compradorId} onChange={(e) => setCompradorId(e.target.value)} className={campo}>
            <option value="">Escolhe o comprador</option>
            {compradores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.contactos.nome}
              </option>
            ))}
          </select>
        )}
        {modo === "novo" && (
          <>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" className={campo} />
            <CampoTelemovel prefixo={prefixo} numero={numero} onPrefixo={setPrefixo} onNumero={setNumero} />
            <p className="text-[11px] text-secundario">O cliente fica criado em Compradores, no estado &ldquo;{cfg.estadoNovo}&rdquo;.</p>
          </>
        )}
        {modo === "externo" && (
          <input
            value={consultor}
            onChange={(e) => setConsultor(e.target.value)}
            placeholder="Nome do consultor (sem dados do cliente)"
            className={campo}
          />
        )}

        <input type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)} className={campo} />
        <textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          rows={2}
          placeholder={cfg.obsPlaceholder}
          className="w-full rounded-xl border border-black/10 px-3 py-2.5 text-sm"
        />
        <button
          type="submit"
          disabled={!podeRegistar || aGuardar}
          className="w-full rounded-xl bg-azul py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {aGuardar ? "A guardar..." : `Registar ${cfg.nome}`}
        </button>
      </form>
      )}
    </section>
  );
}

// Dois botões pequenos ("Visita +" e "Proposta +"); o formulário só abre ao carregar no +.
export default function RegistosAngariacao({ ang, onAlterado }: { ang: Angariacao; onAlterado?: () => void }) {
  const [aberto, setAberto] = useState<Tipo | null>(null);
  const botao = (t: Tipo, rotulo: string) => (
    <button
      type="button"
      onClick={() => setAberto((a) => (a === t ? null : t))}
      aria-expanded={aberto === t}
      aria-label={`Adicionar ${rotulo.toLowerCase()}`}
      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold ${
        aberto === t ? "bg-azul text-white" : "bg-azul/10 text-azul-escuro"
      }`}
    >
      {rotulo}
      <span aria-hidden className="text-base leading-none">{aberto === t ? "\u2212" : "+"}</span>
    </button>
  );
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {botao("visita", "Visita")}
        {botao("proposta", "Proposta")}
      </div>
      <Registos ang={ang} tipo="visita" aberto={aberto === "visita"} onFechar={() => setAberto(null)} onAlterado={onAlterado} />
      <Registos ang={ang} tipo="proposta" aberto={aberto === "proposta"} onFechar={() => setAberto(null)} onAlterado={onAlterado} />
    </div>
  );
}
