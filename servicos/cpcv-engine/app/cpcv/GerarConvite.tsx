"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnSecondary, btnDanger, Spinner } from "./ui";

export type Convite = {
  id: string;
  codigo: string;
  role: "agente" | "gestora";
  criado_em: string;
  usado_em: string | null;
  usado_por_nome: string | null;
  expira_em: string | null;
  revogado: boolean;
};

const ROLE_LABEL: Record<"agente" | "gestora", string> = {
  agente: "agente",
  gestora: "gestora",
};

function estadoConvite(c: Convite): { texto: string; cor: string } {
  if (c.revogado) return { texto: "Revogado", cor: "bg-[#F1F5F9] text-[#64748B]" };
  if (c.usado_em) return { texto: `Usado por ${c.usado_por_nome ?? "-"}`, cor: "bg-[#EAF7EF] text-[#1FAE5A]" };
  if (c.expira_em && new Date(c.expira_em).getTime() < Date.now()) {
    return { texto: "Expirado", cor: "bg-[#F1F5F9] text-[#64748B]" };
  }
  return { texto: "Por usar", cor: "bg-[#E8F1FC] text-[#0059B3]" };
}

// Partilhado pelo dashboard (gestora - só convida agente) e por /cpcv/admin (admin - agente
// e gestora). Um botão por papel em vez de um selector genérico: convidar é raro, o botão já
// diz o que vai acontecer sem precisar de escolher nada primeiro.
export default function GerarConvite({
  papeisPermitidos,
  convites,
}: {
  papeisPermitidos: ("agente" | "gestora")[];
  convites: Convite[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [aGerar, setAGerar] = useState<"agente" | "gestora" | null>(null);
  const [resultado, setResultado] = useState<{ link: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");

  async function gerar(role: "agente" | "gestora") {
    setAGerar(role);
    setErro("");
    setResultado(null);
    try {
      const res = await fetch("/api/cpcv/convites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const body = await res.json();
      if (!res.ok) {
        setErro(body.error ?? "Erro ao gerar o convite.");
        return;
      }
      setResultado({ link: body.link });
      router.refresh();
    } catch {
      setErro("Erro de ligação. Tenta outra vez.");
    } finally {
      setAGerar(null);
    }
  }

  async function copiarLink() {
    if (!resultado) return;
    try {
      await navigator.clipboard.writeText(resultado.link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem Clipboard API - o link continua visível para copiar à mão.
    }
  }

  async function revogar(id: string) {
    const res = await fetch(`/api/cpcv/convites/${id}`, { method: "PATCH" });
    if (res.ok) router.refresh();
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className={btnSecondary}>
        Convidar alguém
      </button>
    );
  }

  const convitesRecentes = convites.slice(0, 8);

  return (
    <div className="w-full sm:w-[26rem] border border-[#E2E8F0] rounded-xl p-4 bg-[#F8FAFC] space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[#475569]">Convidar alguém</h3>
        <button onClick={() => setAberto(false)} className="text-xs text-[#94A3B8] hover:text-[#475569]">
          Fechar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {papeisPermitidos.map((role) => (
          <button
            key={role}
            onClick={() => gerar(role)}
            disabled={aGerar !== null}
            className={btnSecondary}
          >
            {aGerar === role && <Spinner className="h-3.5 w-3.5" />}
            + Convidar {ROLE_LABEL[role]}
          </button>
        ))}
      </div>

      {erro && <p className="text-xs text-red-500">{erro}</p>}

      {resultado && (
        <div className="border border-[#0071e3] rounded-lg p-3 bg-white space-y-2">
          <p className="text-xs text-[#475569]">
            Convite pronto - manda este link a quem vai criar a conta (WhatsApp, email, etc.):
          </p>
          <input
            readOnly
            value={resultado.link}
            onFocus={(e) => e.target.select()}
            className="w-full border border-[#E2E8F0] rounded-lg px-2.5 py-1.5 text-xs bg-[#F8FAFC] text-[#0F172A]"
          />
          <div className="flex items-center justify-end gap-2">
            {copiado && <p className="text-xs font-medium text-[#1FAE5A]">Copiado!</p>}
            <button onClick={copiarLink} className={btnSecondary}>
              Copiar link
            </button>
          </div>
        </div>
      )}

      {convitesRecentes.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {convitesRecentes.map((c) => {
            const estado = estadoConvite(c);
            const podeRevogar = !c.revogado && !c.usado_em;
            return (
              <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-[#475569]">
                  {ROLE_LABEL[c.role]} · {c.codigo}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${estado.cor}`}>{estado.texto}</span>
                  {podeRevogar && (
                    <button onClick={() => revogar(c.id)} className={btnDanger}>
                      Revogar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
