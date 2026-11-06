"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { guardarFatura } from "@/app/acoes-faturas";
import { paraCentimos } from "@/lib/dinheiro";
import { data as dataPt } from "@/lib/texto";
import type { Categoria, Entidade, Fatura, OrigemDado } from "@/lib/tipos";
import { Mensagem } from "./Formulario";
import { campo, emMoeda, rotulo } from "./ui";

export type OpcaoMovimento = { id: string; data: string; descricao: string; conta: string; valor: number; motivos: string[]; pontos?: number; atual?: boolean };

const FONTE: Record<OrigemDado, { texto: string; classe: string }> = {
  qr: { texto: "QR da AT", classe: "bg-verde-suave text-tinta" },
  ia: { texto: "IA", classe: "bg-azul-suave text-azul-escuro" },
  historico: { texto: "Do histórico", classe: "bg-black/5 text-secundario" },
  manual: { texto: "À mão", classe: "bg-black/5 text-secundario" },
};

function Rotulo({ para, texto, fonte }: { para: string; texto: string; fonte?: OrigemDado }) {
  return (
    <label htmlFor={para} className={`${rotulo} flex items-center justify-between gap-2`}>
      <span>{texto}</span>
      {fonte && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${FONTE[fonte].classe}`}>{FONTE[fonte].texto}</span>}
    </label>
  );
}

const dinheiroTexto = (c: number | null) => (c === null || c === undefined ? "" : (c / 100).toFixed(2).replace(".", ","));

function Botoes() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="submit" name="acao" value="confirmar" disabled={pending} className="min-h-[48px] flex-1 rounded-full bg-azul px-6 text-base font-semibold text-white hover:bg-azul-escuro disabled:opacity-60 sm:flex-none">
        {pending ? "A guardar..." : "Confirmar e seguir"}
      </button>
      <button type="submit" name="acao" value="guardar" disabled={pending} className="min-h-[48px] rounded-full border border-linha bg-white px-5 text-base font-semibold text-tinta hover:bg-black/5 disabled:opacity-60">
        Guardar rascunho
      </button>
    </div>
  );
}

/** Revisão de uma fatura: tudo vem preenchido, com a origem de cada campo à vista. Mudar o fornecedor sugere a categoria. */
export default function FormFatura({
  f,
  entidades,
  categorias,
  categoriaPorEntidade,
  movimentos,
}: {
  f: Fatura;
  entidades: Entidade[];
  categorias: Categoria[];
  categoriaPorEntidade: Record<string, string>;
  movimentos: OpcaoMovimento[];
}) {
  const [r, enviar] = useFormState(guardarFatura, {});
  const [sentido, setSentido] = useState(f.sentido);
  const [entidade, setEntidade] = useState(f.entidade_id ?? "");
  const [nome, setNome] = useState(f.emitente_nome ?? "");
  const [nif, setNif] = useState(f.emitente_nif ?? "");
  const [categoria, setCategoria] = useState(f.categoria_id ?? "");
  const [moeda, setMoeda] = useState(f.moeda);
  const [base, setBase] = useState(dinheiroTexto(f.base));
  const [iva, setIva] = useState(dinheiroTexto(f.iva));
  const [total, setTotal] = useState(dinheiroTexto(f.total));
  const [mov, setMov] = useState(f.movimento_id ?? movimentos.find((m) => (m.pontos ?? 0) >= 90)?.id ?? "");
  const fontes = f.fontes ?? {};

  const contas = useMemo(() => {
    const b = paraCentimos(base) ?? 0;
    const i = paraCentimos(iva) ?? 0;
    const t = paraCentimos(total);
    if (!t || (!b && !i)) return null;
    return Math.abs(b + i - t) > 2 ? `Base + IVA dá ${emMoeda(b + i, moeda)}, o total diz ${emMoeda(t, moeda)}.` : null;
  }, [base, iva, total, moeda]);

  const cats = categorias.filter((c) => c.ativa && c.tipo === (sentido === "emitida" ? "proveito" : "custo"));

  return (
    <form action={enviar} className="space-y-5">
      <input type="hidden" name="id" value={f.id} />

      {f.duvidas.length > 0 && f.estado === "rever" && (
        <div className="rounded-2xl bg-ambar-fundo px-4 py-3 text-sm text-ambar-texto">
          <p className="font-semibold">A confirmar</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {f.duvidas.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      <fieldset className="min-w-0">
        <legend className={rotulo}>Esta fatura é</legend>
        <div className="flex gap-1 rounded-2xl bg-black/5 p-1">
          {(["recebida", "emitida"] as const).map((v) => (
            <label key={v} className={`flex min-h-[40px] flex-1 cursor-pointer items-center justify-center rounded-xl text-sm font-semibold ${sentido === v ? "bg-white text-tinta shadow-sm" : "text-secundario"}`}>
              <input type="radio" name="sentido" value={v} checked={sentido === v} onChange={() => { setSentido(v); setCategoria(""); }} className="sr-only" />
              {v === "recebida" ? "Recebida (despesa)" : "Emitida (receita)"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div className="sm:col-span-2">
          <Rotulo para="entidade_id" texto={sentido === "emitida" ? "Cliente" : "Fornecedor"} fonte={f.entidade_id && entidade === f.entidade_id ? "historico" : undefined} />
          <select
            id="entidade_id"
            name="entidade_id"
            value={entidade}
            onChange={(e) => {
              const id = e.target.value;
              setEntidade(id);
              const ent = entidades.find((x) => x.id === id);
              if (ent) {
                setNome(ent.nome);
                if (ent.nif) setNif(ent.nif);
                if (categoriaPorEntidade[id]) setCategoria(categoriaPorEntidade[id]);
              }
            }}
            className={campo}
          >
            <option value="">{nome ? `Novo: ${nome} (fica guardado ao confirmar)` : "Novo"}</option>
            {entidades.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}{e.nif ? ` (${e.nif})` : ""}</option>
            ))}
          </select>
        </div>
        <div>
          <Rotulo para="emitente_nome" texto="Nome no documento" fonte={fontes.emitente_nome} />
          <input id="emitente_nome" name="emitente_nome" value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
        </div>
        <div>
          <Rotulo para="emitente_nif" texto="NIF" fonte={fontes.emitente_nif} />
          <input id="emitente_nif" name="emitente_nif" value={nif} onChange={(e) => setNif(e.target.value)} inputMode="numeric" className={`${campo} numero`} />
        </div>
        <div className="sm:col-span-2">
          <Rotulo para="numero" texto="Número" fonte={fontes.numero} />
          <input id="numero" name="numero" defaultValue={f.numero ?? ""} className={campo} />
        </div>
        <div>
          <Rotulo para="data" texto="Data" fonte={fontes.data} />
          <input id="data" name="data" type="date" defaultValue={f.data ?? ""} className={campo} />
        </div>
        <div>
          <Rotulo para="vencimento" texto="Vence" fonte={fontes.vencimento} />
          <input id="vencimento" name="vencimento" type="date" defaultValue={f.vencimento ?? ""} className={campo} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 [&>*]:min-w-0">
        <div>
          <Rotulo para="base" texto="Sem IVA" fonte={fontes.base} />
          <input id="base" name="base" value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal" className={`${campo} numero`} />
        </div>
        <div>
          <Rotulo para="iva" texto="IVA" fonte={fontes.iva} />
          <input id="iva" name="iva" value={iva} onChange={(e) => setIva(e.target.value)} inputMode="decimal" className={`${campo} numero`} />
        </div>
        <div>
          <Rotulo para="total" texto="Total" fonte={fontes.total} />
          <input id="total" name="total" value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" className={`${campo} numero font-semibold`} required />
        </div>
        <div>
          <label htmlFor="moeda" className={rotulo}>Moeda</label>
          <select id="moeda" name="moeda" value={moeda} onChange={(e) => setMoeda(e.target.value)} className={campo}>
            {[...new Set(["EUR", "USD", "GBP", moeda])].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>
      {contas && <p className="-mt-2 text-sm text-ambar-texto">{contas}</p>}
      {moeda !== "EUR" && (
        <div className="max-w-xs">
          <label htmlFor="total_eur" className={rotulo}>Total pago em euros</label>
          <input id="total_eur" name="total_eur" defaultValue={dinheiroTexto(f.total_eur)} inputMode="decimal" placeholder="Vem do movimento ligado" className={`${campo} numero`} />
        </div>
      )}

      <div className="grid gap-4 [&>*]:min-w-0">
        <div>
          <Rotulo para="categoria_id" texto="Categoria" fonte={categoria && categoria === f.categoria_id ? fontes.categoria_id : undefined} />
          <select id="categoria_id" name="categoria_id" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={campo}>
            <option value="">Escolher</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <Rotulo para="descricao" texto="O que é" fonte={fontes.descricao} />
          <input id="descricao" name="descricao" defaultValue={f.descricao ?? ""} className={campo} />
        </div>
      </div>

      <fieldset className="min-w-0">
        <legend className={`${rotulo} mb-2`}>Movimento do banco que {sentido === "emitida" ? "a recebeu" : "a pagou"}</legend>
        <ul className="space-y-2">
          {movimentos.map((m) => (
            <li key={m.id}>
              <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 ${mov === m.id ? "border-azul bg-azul-suave" : "border-linha bg-white hover:border-azul/30"}`}>
                <input type="radio" name="movimento_id" value={m.id} checked={mov === m.id} onChange={() => setMov(m.id)} className="h-5 w-5 shrink-0 accent-[#0071e3]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base text-tinta">{m.descricao}</span>
                  <span className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-secundario">
                    <span>{dataPt(m.data)}</span>
                    <span>{m.conta}</span>
                    {m.atual && <span className="font-semibold text-tinta">ligado agora</span>}
                    {m.motivos.map((x) => (
                      <span key={x} className="rounded-full bg-white px-1.5 font-medium text-azul-escuro">{x}</span>
                    ))}
                  </span>
                </span>
                <span className="numero shrink-0 text-base font-semibold text-tinta">{emMoeda(m.valor, "EUR")}</span>
              </label>
            </li>
          ))}
          <li>
            <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 ${mov === "" ? "border-azul bg-azul-suave" : "border-linha bg-white"}`}>
              <input type="radio" name="movimento_id" value="" checked={mov === ""} onChange={() => setMov("")} className="h-5 w-5 shrink-0 accent-[#0071e3]" />
              <span className="text-base text-tinta">{movimentos.length ? "Nenhum destes (ainda não paga, ou o extrato ainda não entrou)" : "Ainda sem movimento: não encontrei nenhum pagamento parecido"}</span>
            </label>
          </li>
        </ul>
      </fieldset>

      <div>
        <label htmlFor="notas" className={rotulo}>Notas</label>
        <textarea id="notas" name="notas" defaultValue={f.notas ?? ""} rows={2} className={campo} />
      </div>

      <Mensagem r={r} />
      <Botoes />
    </form>
  );
}
