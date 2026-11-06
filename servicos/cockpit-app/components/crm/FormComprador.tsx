"use client";

import { useState } from "react";
import { Campo, Escolha, Texto } from "@/components/crm/Campos";
import type { Localizacao } from "@/components/crm/SeletorLocalizacao";
import SeletorLocalizacao from "@/components/crm/SeletorLocalizacao";
import SeletorLocalizacoes from "@/components/crm/SeletorLocalizacoes";
import { atualizarPorProprietario } from "@/lib/oportunidades";
import { paraProprietario, type ValoresProprietario } from "@/components/crm/FormProprietario";
import type { Proprietario } from "@/lib/proprietario";
import { sbBrowser } from "@/lib/supabase-browser";
import {
  CANAIS_ORIGEM,
  FINANCIAMENTO,
  PREFIXOS,
  SIMULACAO_CREDITO,
  TIPOLOGIAS,
  TIPOS_NEGOCIO,
  tiposImovelPara,
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
  tipo_negocio: string;
  tipo_imovel: string;
  distrito: string;
  concelho: string;
  freguesia: string;
  // Zonas já escolhidas. distrito/concelho/freguesia acima são só a zona que está a ser escolhida.
  zonas: Localizacao[];
  tipologia_minima: string;
  expectativa_valor: string;
  financiamento: string;
  simulacao_credito: string;
  precisa_vender: string; // "", "sim", "nao"
  // Qualificação como proprietário (só se precisa de vender) e opção de o juntar ao CRM de proprietários.
  adicionar_proprietario: boolean;
  proprietario_id: string; // preenchido se o contacto já está no CRM de proprietários
  prop_link_imovel: string;
  prop_tipo_negocio: string;
  prop_tipo_imovel: string;
  prop_tipologia: string;
  prop_distrito: string;
  prop_concelho: string;
  prop_freguesia: string;
  prop_valor: string;
};

/** Preenche nome, telemóvel e email a partir de um contacto escolhido no telemóvel (o prefixo separa-se do número). */
export function comContacto(v: ValoresComprador, c: { nome: string; telemovel: string; email: string }): ValoresComprador {
  const tel = c.telemovel.replace(/[\s().-]/g, "");
  const prefixo = PREFIXOS.find((p) => tel.startsWith(p)) ?? v.prefixo;
  return { ...v, nome: c.nome || v.nome, prefixo, numero: tel.startsWith(prefixo) ? tel.slice(prefixo.length) : tel, email: c.email || v.email };
}

export function valoresIniciais(c?: Comprador, zonas?: Localizacao[], p?: Proprietario | null): ValoresComprador {
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
    tipo_negocio: c?.tipo_negocio ?? "",
    tipo_imovel: c?.tipo_imovel ?? "",
    distrito: "",
    concelho: "",
    freguesia: "",
    zonas: zonas ?? (c?.distrito ? [{ distrito: c.distrito, concelho: c.concelho ?? "", freguesia: c.freguesia ?? "" }] : []),
    tipologia_minima: c?.tipologia_minima ?? "",
    expectativa_valor: c?.expectativa_valor?.toString() ?? "",
    financiamento: c?.financiamento ?? "",
    simulacao_credito: c?.simulacao_credito ?? "",
    precisa_vender: c?.precisa_vender == null ? "" : c.precisa_vender ? "sim" : "nao",
    adicionar_proprietario: !!p,
    proprietario_id: p?.id ?? "",
    prop_link_imovel: p?.link_imovel ?? "",
    prop_tipo_negocio: p?.tipo_negocio ?? "",
    prop_tipo_imovel: p?.tipo_imovel ?? "",
    prop_tipologia: p?.tipologia ?? "",
    prop_distrito: p?.distrito ?? "",
    prop_concelho: p?.concelho ?? "",
    prop_freguesia: p?.freguesia ?? "",
    prop_valor: p?.valor?.toString() ?? "",
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

const mesmaZona = (a: Localizacao, b: Localizacao) => a.distrito === b.distrito && a.concelho === b.concelho && a.freguesia === b.freguesia;

/** Zonas escolhidas, mais a que ficou a meio no seletor (para não se perder se não carregar em "Juntar zona"). */
export function zonasFinais(v: ValoresComprador): Localizacao[] {
  const meio = { distrito: v.distrito, concelho: v.concelho, freguesia: v.freguesia };
  return meio.distrito && !v.zonas.some((z) => mesmaZona(z, meio)) ? [...v.zonas, meio] : v.zonas;
}

export const nomeZona = (z: Localizacao) => [z.distrito, z.concelho, z.freguesia].filter(Boolean).join(", ");

/** Grava as zonas do comprador (substitui as anteriores). Devolve erro em texto ou null. */
export async function guardarZonas(compradorId: string, v: ValoresComprador): Promise<string | null> {
  const sb = sbBrowser();
  const { error: e1 } = await sb.from("comprador_zonas").delete().eq("comprador_id", compradorId);
  if (e1) return "Não foi possível guardar as zonas.";
  const linhas = zonasFinais(v).map((z) => ({
    comprador_id: compradorId,
    distrito: z.distrito,
    concelho: z.concelho || null,
    freguesia: z.freguesia || null,
  }));
  if (linhas.length === 0) return null;
  const { error: e2 } = await sb.from("comprador_zonas").insert(linhas);
  return e2 ? "Não foi possível guardar as zonas." : null;
}

/** Se precisa de vender e a opção está marcada, cria (ou atualiza) a ficha do mesmo contacto no CRM de proprietários. Devolve erro em texto ou null. */
export async function guardarComoProprietario(contactoId: string, v: ValoresComprador): Promise<string | null> {
  if (v.precisa_vender !== "sim" || !v.adicionar_proprietario) return null;
  const sb = sbBrowser();
  const vp = {
    link_imovel: v.prop_link_imovel ?? "",
    tipo_negocio: v.prop_tipo_negocio ?? "",
    tipo_imovel: v.prop_tipo_imovel ?? "",
    tipologia: v.prop_tipologia ?? "",
    distrito: v.prop_distrito ?? "",
    concelho: v.prop_concelho ?? "",
    freguesia: v.prop_freguesia ?? "",
    valor: v.prop_valor ?? "",
  } as ValoresProprietario;
  const dados = paraProprietario(vp);
  let id = v.proprietario_id;
  if (id) {
    const { error } = await sb.from("proprietarios").update(dados).eq("id", id);
    if (error) return "Não foi possível guardar a ficha de proprietário.";
  } else {
    const { data, error } = await sb.from("proprietarios").insert({ contacto_id: contactoId, ...dados }).select("id").single();
    if (error || !data) return "Não foi possível adicionar ao CRM de proprietários.";
    id = data.id;
  }
  await atualizarPorProprietario(id);
  return null;
}

export function paraComprador(v: ValoresComprador) {
  // As colunas antigas ficam com a primeira zona, para as listas e filtros que ainda as usam.
  const primeira = zonasFinais(v)[0];
  return {
    motivacao: v.motivacao === "" ? null : Number(v.motivacao),
    referencia_imovel: vazio(v.referencia_imovel),
    tipo_negocio: vazio(v.tipo_negocio),
    tipo_imovel: vazio(v.tipo_imovel),
    distrito: primeira ? vazio(primeira.distrito) : null,
    concelho: primeira ? vazio(primeira.concelho) : null,
    freguesia: primeira ? vazio(primeira.freguesia) : null,
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
              className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-sm"
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
              className="min-w-0 flex-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-sm"
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
        <div className="grid grid-cols-3 gap-2 [&_select]:min-w-0 [&_select]:px-2">
          <Escolha label="Tipo de negócio" value={v.tipo_negocio} onChange={(n) => setV((x) => ({ ...x, tipo_negocio: n, tipo_imovel: tiposImovelPara(n).includes(x.tipo_imovel) ? x.tipo_imovel : "" }))} opcoes={TIPOS_NEGOCIO} />
          <Escolha label="Tipo de imóvel" value={v.tipo_imovel} onChange={set("tipo_imovel")} opcoes={tiposImovelPara(v.tipo_negocio)} />
          <Escolha label="Tipologia mínima" value={v.tipologia_minima} onChange={set("tipologia_minima")} opcoes={TIPOLOGIAS} />
        </div>
        {/* seletor do Miguel (várias freguesias de uma vez); grava em comprador_zonas via guardarZonas */}
        <SeletorLocalizacoes
          valor={v.zonas.map((z) => ({ distrito: z.distrito, concelho: z.concelho || undefined, freguesia: z.freguesia || undefined }))}
          onChange={(ls) => setV((x) => ({ ...x, zonas: ls.map((l) => ({ distrito: l.distrito, concelho: l.concelho ?? "", freguesia: l.freguesia ?? "" })) }))}
        />
        <Texto label="Expectativa de valor (EUR)" type="number" value={v.expectativa_valor} onChange={set("expectativa_valor")} />
        <Escolha label="Financiamento" value={v.financiamento} onChange={set("financiamento")} opcoes={FINANCIAMENTO} />
        <Escolha label="Simulação de crédito" value={v.simulacao_credito} onChange={set("simulacao_credito")} opcoes={SIMULACAO_CREDITO} />
        <Campo label="Precisa de vender?">
          <select
            value={v.precisa_vender}
            onChange={(e) => set("precisa_vender")(e.target.value)}
            className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm"
          >
            <option value="">-</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
          </select>
        </Campo>
        {v.precisa_vender === "sim" && (
          <div className="space-y-3 rounded-xl bg-black/[0.03] p-3">
            <h3 className="text-sm font-semibold text-tinta">Qualificação como proprietário</h3>
            <Texto label="Link ou referência do imóvel (opcional)" value={v.prop_link_imovel} onChange={set("prop_link_imovel")} />
            <div className="grid grid-cols-3 gap-2 [&_select]:min-w-0 [&_select]:px-2">
              <Escolha
                label="Tipo de negócio"
                value={v.prop_tipo_negocio}
                onChange={(n) => setV((x) => ({ ...x, prop_tipo_negocio: n, prop_tipo_imovel: tiposImovelPara(n).includes(x.prop_tipo_imovel) ? x.prop_tipo_imovel : "" }))}
                opcoes={TIPOS_NEGOCIO}
              />
              <Escolha label="Tipo de imóvel" value={v.prop_tipo_imovel} onChange={set("prop_tipo_imovel")} opcoes={tiposImovelPara(v.prop_tipo_negocio)} />
              <Escolha label="Tipologia" value={v.prop_tipologia} onChange={set("prop_tipologia")} opcoes={TIPOLOGIAS} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SeletorLocalizacao
                comRotulos
                valor={{ distrito: v.prop_distrito, concelho: v.prop_concelho, freguesia: v.prop_freguesia }}
                onChange={(l) => setV((x) => ({ ...x, prop_distrito: l.distrito, prop_concelho: l.concelho, prop_freguesia: l.freguesia }))}
                className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm"
              />
            </div>
            <Texto label="Valor pedido (EUR)" type="number" value={v.prop_valor} onChange={set("prop_valor")} />
            <label className="flex items-center gap-2 text-sm font-medium text-tinta">
              <input type="checkbox" checked={v.adicionar_proprietario} onChange={(e) => set("adicionar_proprietario")(e.target.checked)} className="h-4 w-4" />
              {v.proprietario_id ? "Já está no CRM de proprietários (atualizar ficha)" : "Adicionar ao CRM de proprietários"}
            </label>
          </div>
        )}
        <Campo label="Observações adicionais">
          <textarea
            value={v.observacoes}
            onChange={(e) => set("observacoes")(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-sm"
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
