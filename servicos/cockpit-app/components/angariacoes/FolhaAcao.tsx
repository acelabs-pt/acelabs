"use client";

import { useState } from "react";
import { blocoDeDia, dataDoDia, dataLocal, DIAS_POR_BLOCO, type Acao, type Angariacao } from "@/lib/angariacao";
import { formatarDia, inicioDoDia, isoDataLocal } from "@/lib/datas";

// Detalhe de uma ação: marcar como feita, feedback e retirar do plano.
export default function FolhaAcao({
  ang,
  acao,
  onFechar,
  onAlternar,
  onFeedback,
  onMudarDia,
  onRetirar,
}: {
  ang: Angariacao;
  acao: Acao;
  onFechar: () => void;
  onAlternar: () => void;
  onFeedback: (texto: string) => void;
  onMudarDia: (dia: number) => void;
  onRetirar: () => void;
}) {
  const [texto, setTexto] = useState(acao.feedback ?? "");
  const bloco = blocoDeDia(acao.dia);
  const de = dataDoDia(ang.inicio, (bloco - 1) * DIAS_POR_BLOCO);
  const ate = dataDoDia(ang.inicio, bloco * DIAS_POR_BLOCO - 1);
  const prevista = dataDoDia(ang.inicio, acao.dia);
  const primeiroDia = dataDoDia(ang.inicio, 0);
  const minimo = new Date(Math.max(inicioDoDia(new Date()).getTime(), primeiroDia.getTime()));
  const maximo = dataDoDia(ang.inicio, ang.duracao_dias - 1);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 md:items-center" onClick={onFechar}>
      <div
        className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-tinta">{acao.follow_up ? "Follow up com o proprietário" : acao.nome}</h3>
            <p className="text-sm text-secundario">
              Dias {(bloco - 1) * DIAS_POR_BLOCO + 1} a {bloco * DIAS_POR_BLOCO} ({formatarDia(de)} a {formatarDia(ate)})
            </p>
            <p className="text-sm text-secundario">Prevista para {formatarDia(prevista)}</p>
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="p-1 text-2xl leading-none text-secundario">&times;</button>
        </div>

        <button
          onClick={onAlternar}
          className={`w-full rounded-xl py-3 text-base font-semibold ${acao.feita ? "bg-black/5 text-tinta" : "bg-verde text-white"}`}
        >
          {acao.feita ? "Desmarcar (voltar a por fazer)" : "Marcar como feita"}
        </button>

        {!acao.feita && (
          <label className="block text-xs text-secundario">
            Mudar para outro dia
            <input
              type="date"
              value={isoDataLocal(prevista)}
              min={isoDataLocal(minimo)}
              max={isoDataLocal(maximo)}
              onChange={(e) => {
                if (!e.target.value) return;
                const dia = Math.round((dataLocal(e.target.value).getTime() - primeiroDia.getTime()) / 86400000);
                if (dia !== acao.dia && dia >= 0 && dia < ang.duracao_dias) onMudarDia(dia);
              }}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-base text-tinta"
            />
          </label>
        )}

        <label className="block text-xs text-secundario">
          Feedback
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={() => texto !== (acao.feedback ?? "") && onFeedback(texto)}
            rows={3}
            placeholder="O que aconteceu? Fica no relatório."
            className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2.5 text-base text-tinta"
          />
        </label>

        <button onClick={onRetirar} className="w-full py-1 text-sm text-red-600">
          Retirar do plano
        </button>
      </div>
    </div>
  );
}
