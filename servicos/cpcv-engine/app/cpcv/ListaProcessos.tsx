"use client";

import { useEffect, useState } from "react";
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

const TAMANHO_PAGINA = 20;

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
  atualizado_em: string;
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

function tempoDesde(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = ms / 1000 / 60;
  if (min < 60) return `${Math.max(0, Math.round(min))} min`;
  const horas = min / 60;
  if (horas < 24) return `${horas.toFixed(1)} h`;
  return `${(horas / 24).toFixed(1)} dias`;
}

export default function ListaProcessos({
  lista,
  isGestora,
  nomesPorAgente,
  filtroInicial,
}: {
  lista: Processo[];
  isGestora: boolean;
  nomesPorAgente: Record<string, string>;
  filtroInicial?: string;
}) {
  const [filtro, setFiltro] = useState(
    filtroInicial && FILTROS.some((f) => f.value === filtroInicial) ? filtroInicial : "todos"
  );
  const [pesquisa, setPesquisa] = useState("");
  const [visiveis, setVisiveis] = useState(TAMANHO_PAGINA);

  useEffect(() => {
    if (filtroInicial && FILTROS.some((f) => f.value === filtroInicial)) {
      setFiltro(filtroInicial);
    }
  }, [filtroInicial]);

  // Volta a mostrar só a primeira página sempre que o filtro/pesquisa muda - sem isto, trocar
  // de separador com "carregar mais" já usado deixava a tabela a mostrar uma mistura confusa
  // de quantos itens tinham sido "carregados" no filtro anterior.
  useEffect(() => {
    setVisiveis(TAMANHO_PAGINA);
  }, [filtro, pesquisa]);

  const listaFiltrada = (filtro === "todos" ? lista : lista.filter((p) => p.estado === filtro))
    .filter((p) => {
      if (!pesquisa.trim()) return true;
      const termo = pesquisa.toLowerCase();
      const morada = (p.imovel_morada ?? "").toLowerCase();
      const agente = (nomesPorAgente[p.criado_por] ?? "").toLowerCase();
      return morada.includes(termo) || agente.includes(termo);
    })
    .sort((a, b) => {
      // Na fila "pronto para aprovação" mostra os mais antigos primeiro (os mais urgentes).
      if (filtro === "pronto_para_aprovacao") {
        return new Date(a.atualizado_em).getTime() - new Date(b.atualizado_em).getTime();
      }
      return 0;
    });

  const listaVisivel = listaFiltrada.slice(0, visiveis);
  const temMais = listaFiltrada.length > visiveis;

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-4 border-b border-[#F1F5F9]">
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
        <input
          type="text"
          value={pesquisa}
          onChange={(e) => setPesquisa(e.target.value)}
          placeholder={isGestora ? "Pesquisar por morada ou agente..." : "Pesquisar por morada..."}
          className="ml-auto w-full sm:w-56 border border-[#E2E8F0] rounded-full px-4 py-1.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
        />
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
              {isGestora && <th className="px-5 py-3 font-medium">À espera há</th>}
              <th className="px-5 py-3 font-medium">Criado em</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {listaVisivel.map((p) => (
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
                {isGestora && (
                  <td className="px-5 py-3 text-[#94A3B8]">
                    {p.estado === "pronto_para_aprovacao" ? tempoDesde(p.atualizado_em) : "-"}
                  </td>
                )}
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

      {temMais && (
        <div className="flex flex-col items-center gap-1 p-4 border-t border-[#F1F5F9]">
          <button
            onClick={() => setVisiveis((v) => v + TAMANHO_PAGINA)}
            className="text-xs font-medium text-[#2E6DB4] hover:text-[#0059B3] px-3 py-1.5 rounded-full hover:bg-[#F8FAFC] transition-colors"
          >
            Carregar mais ({listaFiltrada.length - visiveis} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
