"use client";

import { useState } from "react";
import { btnSecondary } from "../ui";

type Parte = { papel: string; nome: string };

type Processo = {
  imovel_morada: string | null;
  preco_total: number | null;
  valor_sinal: number | null;
  prazo_escritura: string | null;
  estado: string;
  campos_em_falta: { campo: string; pergunta: string }[] | null;
};

function euros(v: number | null): string {
  if (v === null || v === undefined) return "____________";
  return `${v.toLocaleString("pt-PT")} €`;
}

function dataPT(iso: string | null): string {
  if (!iso) return "____________";
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

// Texto pensado para ser colado directamente numa conversa de WhatsApp com o
// vendedor/comprador ou entre agente e gestora - não é o documento legal, é um
// resumo humano do estado do negócio. Não usa nenhuma API do WhatsApp (isso é a
// integração futura) - só gera texto e copia para a área de transferência.
function gerarResumo(processo: Processo, partes: Parte[]): string {
  const vendedores = partes.filter((p) => p.papel === "vendedor").map((p) => p.nome);
  const compradores = partes.filter((p) => p.papel === "comprador").map((p) => p.nome);

  const linhas: string[] = [];
  linhas.push(`*CPCV - ${processo.imovel_morada || "imóvel a confirmar"}*`);
  if (vendedores.length > 0) linhas.push(`Vendedor(a/es): ${vendedores.join(" e ")}`);
  if (compradores.length > 0) linhas.push(`Comprador(a/es): ${compradores.join(" e ")}`);
  if (processo.preco_total) linhas.push(`Preço: ${euros(processo.preco_total)}`);
  if (processo.valor_sinal) linhas.push(`Sinal: ${euros(processo.valor_sinal)}`);
  if (processo.prazo_escritura) linhas.push(`Escritura até: ${dataPT(processo.prazo_escritura)}`);

  linhas.push("");

  const camposEmFalta = processo.campos_em_falta ?? [];
  if (processo.estado === "aprovado") {
    linhas.push("✅ CPCV aprovado e gerado - já disponível para revisão e assinatura.");
  } else if (camposEmFalta.length > 0) {
    linhas.push("Ainda falta confirmar:");
    camposEmFalta.forEach((c, i) => linhas.push(`${i + 1}. ${c.pergunta}`));
  } else {
    linhas.push("Todos os dados reunidos - à espera da aprovação da gestora.");
  }

  return linhas.join("\n");
}

export default function ResumoWhatsApp({ processo, partes }: { processo: Processo; partes: Parte[] }) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const texto = gerarResumo(processo, partes);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard API pode falhar (contexto não-HTTPS, permissão negada) - o texto
      // continua visível na textarea para copiar à mão, por isso não é bloqueante.
    }
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className={btnSecondary}>
        Resumo para WhatsApp
      </button>
    );
  }

  return (
    <div className="w-full sm:w-96 border border-[#E2E8F0] rounded-xl p-4 bg-[#F8FAFC] space-y-3">
      <textarea
        readOnly
        value={texto}
        rows={8}
        className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-xs bg-white text-[#0F172A]"
      />
      <div className="flex items-center justify-end gap-2">
        {copiado && <p className="text-xs font-medium text-[#1FAE5A]">Copiado!</p>}
        <button
          onClick={() => setAberto(false)}
          className="text-xs font-medium text-[#94A3B8] hover:text-[#475569] px-3 py-2 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A]/20"
        >
          Fechar
        </button>
        <button onClick={copiar} className={btnSecondary}>
          Copiar texto
        </button>
      </div>
    </div>
  );
}
