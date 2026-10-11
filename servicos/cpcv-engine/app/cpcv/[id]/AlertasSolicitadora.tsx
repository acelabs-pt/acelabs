import type { Processo } from "@/lib/cpcv-types";
import { informacaoForaDoContrato } from "@/lib/cpcv-alertas";

// Informação registada no processo que não entra em nenhuma das 16 cláusulas do CPCV gerado
// (ver lib/cpcv-alertas.ts). Fica visível à gestora para a passar à solicitadora - nunca é
// escrita no documento.
export default function AlertasSolicitadora({ processo }: { processo: Processo }) {
  const alertas = informacaoForaDoContrato(processo);
  if (alertas.length === 0) return null;

  return (
    <div className="bg-[#FFF4E5] rounded-2xl border border-[#F5D9A8] shadow-sm p-5">
      <h2 className="text-sm font-semibold text-[#9A5B00] mb-1">Informação que não entra no CPCV gerado</h2>
      <p className="text-xs text-[#9A5B00] mb-3">
        O contrato segue sempre as 16 cláusulas do modelo aprovado. O que está abaixo ficou registado no
        processo mas não gera nenhuma cláusula - é para a solicitadora decidir o que fazer com isto.
      </p>
      <ul className="space-y-1">
        {alertas.map((a) => (
          <li key={a} className="text-xs text-[#0F172A]">
            • {a}
          </li>
        ))}
      </ul>
    </div>
  );
}
