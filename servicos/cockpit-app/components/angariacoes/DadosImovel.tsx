"use client";

import SeletorLocalizacao from "@/components/crm/SeletorLocalizacao";
import { TIPOLOGIAS, TIPOS_IMOVEL } from "@/lib/comprador";

// Dados do imóvel de uma angariação (servem para encontrar compradores com interesse).
export type DadosImovelForm = {
  tipo_imovel: string;
  tipologia: string;
  valor: string;
  distrito: string;
  concelho: string;
  freguesia: string;
};

export const IMOVEL_VAZIO: DadosImovelForm = { tipo_imovel: "", tipologia: "", valor: "", distrito: "", concelho: "", freguesia: "" };

type ComImovel = {
  tipo_imovel?: string | null;
  tipologia?: string | null;
  valor?: number | null;
  distrito?: string | null;
  concelho?: string | null;
  freguesia?: string | null;
};

export function imovelDe(a: ComImovel): DadosImovelForm {
  return {
    tipo_imovel: a.tipo_imovel ?? "",
    tipologia: a.tipologia ?? "",
    valor: a.valor != null ? String(a.valor) : "",
    distrito: a.distrito ?? "",
    concelho: a.concelho ?? "",
    freguesia: a.freguesia ?? "",
  };
}

const vazio = (s: string) => (s.trim() === "" ? null : s.trim());

export function imovelParaBd(d: DadosImovelForm) {
  return {
    tipo_imovel: vazio(d.tipo_imovel),
    tipologia: vazio(d.tipologia),
    valor: d.valor === "" ? null : Number(d.valor),
    distrito: vazio(d.distrito),
    concelho: vazio(d.concelho),
    freguesia: vazio(d.freguesia),
  };
}

export function resumoImovel(a: ComImovel): string {
  const eur = a.valor != null ? `${Math.round(a.valor).toLocaleString("pt-PT")} €` : "";
  return [a.tipo_imovel, a.tipologia, [a.freguesia, a.concelho, a.distrito].filter(Boolean).join(", "), eur].filter(Boolean).join(" · ");
}

const CAMPO = "mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-base text-tinta";

export default function DadosImovel({ valor, onChange }: { valor: DadosImovelForm; onChange: (v: DadosImovelForm) => void }) {
  const set = <K extends keyof DadosImovelForm>(k: K, v: string) => onChange({ ...valor, [k]: v });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-secundario">
          Tipo de imóvel
          <select value={valor.tipo_imovel} onChange={(e) => set("tipo_imovel", e.target.value)} className={CAMPO}>
            <option value="">-</option>
            {TIPOS_IMOVEL.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-secundario">
          Tipologia
          <select value={valor.tipologia} onChange={(e) => set("tipologia", e.target.value)} className={CAMPO}>
            <option value="">-</option>
            {TIPOLOGIAS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs text-secundario">
        Preço pedido (EUR)
        <input type="number" inputMode="numeric" value={valor.valor} onChange={(e) => set("valor", e.target.value)} className={CAMPO} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <SeletorLocalizacao
          comRotulos
          valor={{ distrito: valor.distrito, concelho: valor.concelho, freguesia: valor.freguesia }}
          onChange={(l) => onChange({ ...valor, ...l })}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-base"
        />
      </div>
    </div>
  );
}
