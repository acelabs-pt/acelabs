"use client";

import { useState } from "react";
import Link from "next/link";
import DeleteProcessoButton from "./DeleteProcessoButton";
import { btnLink } from "./ui";

const ESTADO_LABEL: Record<string, string> = {
  em_preenchimento: "Em preenchimento",
  pronto_para_aprovacao: "Pronto para aprovação",
  aprovado: "Aprovado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const ESTADO_COR: Record<string, string> = {
  em_preenchimento: "bg-[#FFF4E5] text-[#9A5B00]",
  pronto_para_aprovacao: "bg-[#E8F1FC] text-[#0059B3]",
  aprovado: "bg-[#EAF7EF] text-[#1FAE5A]",
  concluido: "bg-[#EAF7EF] text-[#1FAE5A]",
  cancelado: "bg-[#F1F5F9] text-[#64748B]",
};

const FILTROS = [
  { value: "todos", label: "Todos" },
  { value: "em_preenchimento", label: "Em preenchimento" },
  { value: "pronto_para_aprovacao", label: "Pronto para aprovação" },
  { value: "aprovado", label: "Aprovado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

type Processo = {
  id: string;
  criado_por: string;
  estado: string;
  imovel_morada: string | null;
  criado_em: string;
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ListaProcessos({
  lista,
  isGestora,
  nomesPorAgente,
}: {
  lista: Processo[];
  isGestora: boolean;
  nomesPorAgente: Record<string, string>;
}) {
  const [filtro, setFiltro] = useState("todos");

  const listaFiltrada = filtro === "todos" ? lista : lista.filter((p) => p.estado === filtro);

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="flex flex-wrap gap-2 p-4 border-b border-[#F1F5F9]">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A]/20 ${
              filtro === f.value
                ? "bg-[#0F172A] text-white shadow-sm"
                : "bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9]"
            }`}
          >
            {f.label}
            {f.value !== "todos" && ` (${lista.filter((p) => p.estado === f.value).length})`}
          </button>
        ))}
      </div>

      {listaFiltrada.length === 0 ? (
        <p className="text-sm text-[#94A3B8] p-6">Nenhum processo neste estado.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[#94A3B8] border-b border-[#F1F5F9]">
              {isGestora && <th className="px-5 py-3 font-medium">Agente</th>}
              <th className="px-5 py-3 font-medium">Imóvel</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium">Criado em</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((p) => (
              <tr key={p.id} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors">
                {isGestora && (
                  <td className="px-5 py-3 text-[#475569]">{nomesPorAgente[p.criado_por] ?? "-"}</td>
                )}
                <td className="px-5 py-3 text-[#0F172A] font-medium">{p.imovel_morada || "Sem morada ainda"}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${ESTADO_COR[p.estado] ?? ""}`}>
                    {ESTADO_LABEL[p.estado] ?? p.estado}
                  </span>
                </td>
                <td className="px-5 py-3 text-[#94A3B8]">{formatarData(p.criado_em)}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/cpcv/${p.id}`} className={btnLink}>
                      Abrir
                    </Link>
                    <DeleteProcessoButton id={p.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
