"use client";

import { useEffect, useState } from "react";
import CampoData from "@/components/crm/CampoData";
import { hojeISO } from "@/lib/datas";

export type DadosComissao = {
  valor_negocio: number | null;
  comissao_valor: number | null;
  comissao_recebida: boolean;
  comissao_recebida_em: string | null;
};

// Número em euros que só grava ao sair do campo (escrever vários algarismos não pode gravar a meio).
function CampoEuros({ label, value, onCommit }: { label: string; value: number | null; onCommit: (v: number | null) => void }) {
  const [local, setLocal] = useState(value == null ? "" : String(value));
  useEffect(() => setLocal(value == null ? "" : String(value)), [value]);
  return (
    <label className="block text-xs text-secundario">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const n = local.trim() === "" || Number(local) < 0 ? null : Number(local);
          if (n !== value) onCommit(n);
        }}
        className="mt-1 block w-full rounded-xl border border-black/10 px-3 py-2.5 text-base text-tinta"
      />
    </label>
  );
}

/**
 * Valor do negócio e comissão. A comissão só conta para a faturação quando está recebida.
 * `soRecebida` mostra apenas a confirmação de receção (usado no cartão da escritura).
 */
export default function Comissao({
  dados,
  onChange,
  soRecebida = false,
}: {
  dados: DadosComissao;
  onChange: (campos: Partial<DadosComissao>) => void;
  soRecebida?: boolean;
}) {
  return (
    <div className="space-y-3">
      {!soRecebida && (
        <div className="grid gap-3 sm:grid-cols-2">
          <CampoEuros label="Valor do negócio (€)" value={dados.valor_negocio} onCommit={(v) => onChange({ valor_negocio: v })} />
          <CampoEuros label="Valor da comissão (€)" value={dados.comissao_valor} onCommit={(v) => onChange({ comissao_valor: v })} />
        </div>
      )}
      {soRecebida && dados.comissao_valor != null && (
        <p className="text-sm text-secundario">Comissão: {Math.round(dados.comissao_valor).toLocaleString("pt-PT")} €</p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={dados.comissao_recebida}
          onChange={(e) =>
            onChange({
              comissao_recebida: e.target.checked,
              comissao_recebida_em: e.target.checked ? dados.comissao_recebida_em ?? hojeISO() : null,
            })
          }
        />
        Comissão recebida
      </label>
      {dados.comissao_recebida && (
        <CampoData label="Recebida em" value={dados.comissao_recebida_em} onCommit={(v) => onChange({ comissao_recebida_em: v })} />
      )}
      {dados.comissao_recebida && <p className="text-xs text-verde">Conta para a faturação.</p>}
    </div>
  );
}
