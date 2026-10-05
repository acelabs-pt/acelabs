"use client";

import {
  DOCUMENTO_TIPO_OPCOES,
  ESTADO_CIVIL_OPCOES,
  ParteDraft,
  nifValido,
} from "@/lib/cpcv-partes-form";

const campoClass =
  "w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]";
const labelClass = "block text-[11px] text-[#94A3B8] mb-1";

// Bloco de campos de uma única parte (vendedor ou comprador), reutilizado em
// app/cpcv/novo/page.tsx (antes de o processo existir) e em app/cpcv/[id]/DadosPartes.tsx
// (depois de criado) - para os dois sítios nunca divergirem nos campos pedidos.
export default function ParteCampos({
  titulo,
  draft,
  onChange,
  onRemover,
  comUploadFicheiro,
}: {
  titulo: string;
  draft: ParteDraft;
  onChange: (next: ParteDraft) => void;
  onRemover?: () => void;
  comUploadFicheiro?: boolean;
}) {
  function set<K extends keyof ParteDraft>(chave: K, valor: ParteDraft[K]) {
    onChange({ ...draft, [chave]: valor });
  }

  const nifInvalido = draft.nif.trim().length > 0 && !nifValido(draft.nif);
  const mostraRegimeBens = /^casad/i.test(draft.estadoCivil);

  return (
    <div className="border border-[#E2E8F0] rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[#0F172A]">{titulo}</span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
            <input
              type="checkbox"
              checked={draft.tipoPessoa === "coletiva"}
              onChange={(e) => set("tipoPessoa", e.target.checked ? "coletiva" : "singular")}
            />
            Empresa
          </label>
          {onRemover && (
            <button
              type="button"
              onClick={onRemover}
              className="text-[#94A3B8] hover:text-red-500 text-xs font-medium transition-colors duration-150"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{draft.tipoPessoa === "coletiva" ? "Denominação social" : "Nome"}</label>
          <input value={draft.nome} onChange={(e) => set("nome", e.target.value)} className={campoClass} />
        </div>
        <div>
          <label className={labelClass}>{draft.tipoPessoa === "coletiva" ? "NIPC" : "NIF"}</label>
          <input
            value={draft.nif}
            onChange={(e) => set("nif", e.target.value)}
            className={`${campoClass} ${nifInvalido ? "border-red-400" : ""}`}
          />
          {nifInvalido && <p className="text-[11px] text-red-500 mt-1">NIF inválido.</p>}
        </div>
      </div>

      <div>
        <label className={labelClass}>Morada {draft.tipoPessoa === "coletiva" ? "da sede" : "fiscal"}</label>
        <input value={draft.morada} onChange={(e) => set("morada", e.target.value)} className={campoClass} />
      </div>

      {draft.tipoPessoa === "singular" ? (
        <>
          <div className={`grid gap-3 ${mostraRegimeBens ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <div>
              <label className={labelClass}>Estado civil</label>
              <select value={draft.estadoCivil} onChange={(e) => set("estadoCivil", e.target.value)} className={campoClass}>
                <option value="">-</option>
                {ESTADO_CIVIL_OPCOES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            {mostraRegimeBens && (
              <div>
                <label className={labelClass}>Regime de bens</label>
                <input value={draft.regimeBens} onChange={(e) => set("regimeBens", e.target.value)} className={campoClass} />
              </div>
            )}
            <div>
              <label className={labelClass}>Nacionalidade</label>
              <input value={draft.nacionalidade} onChange={(e) => set("nacionalidade", e.target.value)} className={campoClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Naturalidade (freguesia, concelho)</label>
            <input value={draft.naturalidade} onChange={(e) => set("naturalidade", e.target.value)} className={campoClass} />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Tipo de documento</label>
              <select value={draft.documentoTipo} onChange={(e) => set("documentoTipo", e.target.value)} className={campoClass}>
                {DOCUMENTO_TIPO_OPCOES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Número</label>
              <input value={draft.documentoNumero} onChange={(e) => set("documentoNumero", e.target.value)} className={campoClass} />
            </div>
            <div>
              <label className={labelClass}>Validade</label>
              <input
                type="date"
                value={draft.documentoValidade}
                onChange={(e) => set("documentoValidade", e.target.value)}
                className={campoClass}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Representante</label>
            <input value={draft.representanteNome} onChange={(e) => set("representanteNome", e.target.value)} className={campoClass} />
          </div>
          <div>
            <label className={labelClass}>Cargo do representante</label>
            <input value={draft.representanteCargo} onChange={(e) => set("representanteCargo", e.target.value)} className={campoClass} />
          </div>
          <div>
            <label className={labelClass}>Certidão permanente</label>
            <input
              value={draft.certidaoPermanente}
              onChange={(e) => set("certidaoPermanente", e.target.value)}
              className={campoClass}
            />
          </div>
        </div>
      )}

      {comUploadFicheiro && (
        <div className="flex items-center justify-between gap-3 border-t border-[#F1F5F9] pt-3">
          <span className="text-xs text-[#94A3B8]">
            {draft.ficheiro ? draft.ficheiro.name : "Documento de identificação (opcional)"}
          </span>
          <div className="flex items-center gap-3">
            {draft.ficheiro && (
              <button
                type="button"
                onClick={() => set("ficheiro", null)}
                className="text-[#94A3B8] hover:text-red-500 text-xs font-medium transition-colors duration-150"
              >
                Remover
              </button>
            )}
            <label className="shrink-0 cursor-pointer text-xs font-medium text-[#2E6DB4] hover:underline">
              + Adicionar
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  set("ficheiro", e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
