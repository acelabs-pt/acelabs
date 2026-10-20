"use client";

import { useState } from "react";
import { Campo, CampoTelemovel, Escolha, Texto } from "@/components/crm/Campos";
import SeletorLocalizacao from "@/components/crm/SeletorLocalizacao";
import { CANAIS_ORIGEM, PREFIXOS, TIPOLOGIAS, TIPOS_IMOVEL } from "@/lib/comprador";
import type { Proprietario } from "@/lib/proprietario";

export type ValoresProprietario = {
  nome: string;
  prefixo: string;
  numero: string;
  email: string;
  canal_origem: string;
  observacoes: string;
  link_imovel: string;
  tipo_imovel: string;
  tipologia: string;
  distrito: string;
  concelho: string;
  freguesia: string;
  valor: string;
};

export function valoresIniciaisProp(p?: Proprietario): ValoresProprietario {
  const tel = p?.contactos.telemovel ?? "";
  const prefixo = PREFIXOS.find((x) => tel.startsWith(x)) ?? "+351";
  return {
    nome: p?.contactos.nome ?? "",
    prefixo,
    numero: tel.startsWith(prefixo) ? tel.slice(prefixo.length) : tel,
    email: p?.contactos.email ?? "",
    canal_origem: p?.contactos.canal_origem ?? "",
    observacoes: p?.contactos.observacoes ?? "",
    link_imovel: p?.link_imovel ?? "",
    tipo_imovel: p?.tipo_imovel ?? "",
    tipologia: p?.tipologia ?? "",
    distrito: p?.distrito ?? "",
    concelho: p?.concelho ?? "",
    freguesia: p?.freguesia ?? "",
    valor: p?.valor?.toString() ?? "",
  };
}

const vazio = (v: string) => (v.trim() === "" ? null : v.trim());

export function paraContactoProp(v: ValoresProprietario) {
  const numero = v.numero.replace(/\s+/g, "");
  return {
    nome: v.nome.trim(),
    telemovel: numero ? `${v.prefixo}${numero}` : null,
    email: vazio(v.email),
    canal_origem: vazio(v.canal_origem),
    observacoes: vazio(v.observacoes),
  };
}

export function paraProprietario(v: ValoresProprietario) {
  return {
    link_imovel: vazio(v.link_imovel),
    tipo_imovel: vazio(v.tipo_imovel),
    tipologia: vazio(v.tipologia),
    distrito: vazio(v.distrito),
    concelho: vazio(v.concelho),
    freguesia: vazio(v.freguesia),
    valor: v.valor === "" ? null : Number(v.valor),
  };
}

export default function FormProprietario({
  inicial,
  textoBotao,
  aGuardar,
  onSubmit,
}: {
  inicial: ValoresProprietario;
  textoBotao: string;
  aGuardar: boolean;
  onSubmit: (v: ValoresProprietario) => void;
}) {
  const [v, setV] = useState(inicial);
  const set = <K extends keyof ValoresProprietario>(k: K) => (valor: string) =>
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
        <h2 className="text-sm font-semibold text-tinta">Proprietário</h2>
        <Texto label="Nome" value={v.nome} onChange={set("nome")} required />
        <CampoTelemovel prefixo={v.prefixo} numero={v.numero} onPrefixo={set("prefixo")} onNumero={set("numero")} />
        <Texto label="Email" type="email" value={v.email} onChange={set("email")} />
      </section>

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-tinta">Qualificação</h2>
        <Escolha label="Canal de origem" value={v.canal_origem} onChange={set("canal_origem")} opcoes={CANAIS_ORIGEM} />
        <Texto label="Link ou referência do imóvel" value={v.link_imovel} onChange={set("link_imovel")} />
        <Escolha label="Tipo de imóvel" value={v.tipo_imovel} onChange={set("tipo_imovel")} opcoes={TIPOS_IMOVEL} />
        <Escolha label="Tipologia" value={v.tipologia} onChange={set("tipologia")} opcoes={TIPOLOGIAS} />
        <div className="grid gap-3 sm:grid-cols-3">
          <SeletorLocalizacao
            comRotulos
            valor={{ distrito: v.distrito, concelho: v.concelho, freguesia: v.freguesia }}
            onChange={(l) => setV((x) => ({ ...x, ...l }))}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-3 text-base"
          />
        </div>
        <Texto label="Valor pedido (EUR)" type="number" value={v.valor} onChange={set("valor")} />
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
