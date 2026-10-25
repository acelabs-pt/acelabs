"use client";

import { useState } from "react";
import { Campo, Escolha, Texto } from "@/components/crm/Campos";
import SeletorLocalizacoes from "@/components/crm/SeletorLocalizacoes";
import type { Local } from "@/lib/localizacoes";
import {
  CANAIS_ORIGEM,
  FINANCIAMENTO,
  PREFIXOS,
  SIMULACAO_CREDITO,
  TIPOLOGIAS,
  TIPOS_IMOVEL,
  type Comprador,
} from "@/lib/comprador";

export type ValoresComprador = {
  nome: string;
  prefixo: string;
  numero: string;
  email: string;
  canal_origem: string;
  observacoes: string;
  motivacao: string;
  referencia_imovel: string;
  tipo_imovel: string;
  localizacoes: Local[];
  tipologia_minima: string;
  expectativa_valor: string;
  financiamento: string;
  simulacao_credito: string;
  precisa_vender: string; // "", "sim", "nao"
};

export function valoresIniciais(c?: Comprador): ValoresComprador {
  const tel = c?.contactos.telemovel ?? "";
  const prefixo = PREFIXOS.find((p) => tel.startsWith(p)) ?? "+351";
  return {
    nome: c?.contactos.nome ?? "",
    prefixo,
    numero: tel.startsWith(prefixo) ? tel.slice(prefixo.length) : tel,
    email: c?.contactos.email ?? "",
    canal_origem: c?.contactos.canal_origem ?? "",
    observacoes: c?.contactos.observacoes ?? "",
    motivacao: c?.motivacao?.toString() ?? "",
    referencia_imovel: c?.referencia_imovel ?? "",
    tipo_imovel: c?.tipo_imovel ?? "",
    localizacoes: c?.localizacoes ?? [],
    tipologia_minima: c?.tipologia_minima ?? "",
    expectativa_valor: c?.expectativa_valor?.toString() ?? "",
    financiamento: c?.financiamento ?? "",
    simulacao_credito: c?.simulacao_credito ?? "",
    precisa_vender: c?.precisa_vender == null ? "" : c.precisa_vender ? "sim" : "nao",
  };
}

const vazio = (v: string) => (v.trim() === "" ? null : v.trim());

export function paraContacto(v: ValoresComprador) {
  const numero = v.numero.replace(/\s+/g, "");
  return {
    nome: v.nome.trim(),
    telemovel: numero ? `${v.prefixo}${numero}` : null,
    email: vazio(v.email),
    canal_origem: vazio(v.canal_origem),
    observacoes: vazio(v.observacoes),
  };
}

export function paraComprador(v: ValoresComprador) {
  return {
    motivacao: v.motivacao === "" ? null : Number(v.motivacao),
    referencia_imovel: vazio(v.referencia_imovel),
    tipo_imovel: vazio(v.tipo_imovel),
    localizacoes: v.localizacoes,
    tipologia_minima: vazio(v.tipologia_minima),
    expectativa_valor: v.expectativa_valor === "" ? null : Number(v.expectativa_valor),
    financiamento: vazio(v.financiamento),
    simulacao_credito: vazio(v.simulacao_credito),
    precisa_vender: v.precisa_vender === "" ? null : v.precisa_vender === "sim",
  };
}

export default function FormComprador({
  inicial,
  textoBotao,
  aGuardar,
  onSubmit,
}: {
  inicial: ValoresComprador;
  textoBotao: string;
  aGuardar: boolean;
  onSubmit: (v: ValoresComprador) => void;
}) {
  const [v, setV] = useState(inicial);
  const set = <K extends keyof ValoresComprador>(k: K) => (valor: ValoresComprador[K]) =>
    setV((x) => ({ ...x, [k]: valor }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
      className="space-y-6"
    >
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-tinta">Comprador</h2>
        <Texto label="Nome" value={v.nome} onChange={set("nome")} required />
        <Campo label="Telemóvel">
          <div className="flex gap-2">
            <select
              value={v.prefixo}
              onChange={(e) => set("prefixo")(e.target.value)}
              className="rounded-xl border border-black/10 bg-white px-2 py-3 text-base"
            >
              {PREFIXOS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="tel"
              value={v.numero}
              onChange={(e) => set("numero")(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-black/10 px-3 py-3 text-base"
            />
          </div>
        </Campo>
        <Texto label="Email" type="email" value={v.email} onChange={set("email")} />
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-tinta">Qualificação</h2>
        <Escolha label="Canal de origem" value={v.canal_origem} onChange={set("canal_origem")} opcoes={CANAIS_ORIGEM} />
        <Campo label="Motivação (0 a 10)">
          <input
            type="range"
            min={0}
            max={10}
            value={v.motivacao === "" ? 0 : v.motivacao}
            onChange={(e) => set("motivacao")(e.target.value)}
            className="w-full"
          />
          <span className="text-sm text-secundario">{v.motivacao === "" ? "Por definir" : v.motivacao}</span>
        </Campo>
        <Texto label="Referência do imóvel" value={v.referencia_imovel} onChange={set("referencia_imovel")} />
        <Escolha label="Tipo de imóvel" value={v.tipo_imovel} onChange={set("tipo_imovel")} opcoes={TIPOS_IMOVEL} />
        <Escolha label="Tipologia mínima" value={v.tipologia_minima} onChange={set("tipologia_minima")} opcoes={TIPOLOGIAS} />
        <SeletorLocalizacoes valor={v.localizacoes} onChange={set("localizacoes")} />
        <Texto label="Expectativa de valor (EUR)" type="number" value={v.expectativa_valor} onChange={set("expectativa_valor")} />
        <Escolha label="Financiamento" value={v.financiamento} onChange={set("financiamento")} opcoes={FINANCIAMENTO} />
        <Escolha label="Simulação de crédito" value={v.simulacao_credito} onChange={set("simulacao_credito")} opcoes={SIMULACAO_CREDITO} />
        <Campo label="Precisa de vender?">
          <select
            value={v.precisa_vender}
            onChange={(e) => set("precisa_vender")(e.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base"
          >
            <option value="">-</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </Campo>
        <Campo label="Observações adicionais">
          <textarea
            value={v.observacoes}
            onChange={(e) => set("observacoes")(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-black/10 px-3 py-3 text-base"
          />
        </Campo>
      </section>

      <button
        type="submit"
        disabled={aGuardar || !v.nome.trim()}
        className="w-full rounded-2xl bg-azul py-3.5 text-base font-semibold text-white disabled:opacity-50"
      >
        {aGuardar ? "A guardar..." : textoBotao}
      </button>
    </form>
  );
}
