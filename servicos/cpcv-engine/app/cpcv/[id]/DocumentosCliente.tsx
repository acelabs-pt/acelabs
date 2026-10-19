"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";
import { btnGhost, btnSecondary, btnDanger } from "../ui";

type LinkInfo = { id: string; papel: string; expira_em: string; revogado: boolean };
type Ficheiro = { id: string; nome_original: string | null; tipo: string; estado_revisao: string; origem: string };

const PAPEL_LABEL: Record<string, string> = { comprador: "Comprador", vendedor: "Vendedor" };

export default function DocumentosCliente({
  processoId,
  links,
  ficheiros,
  mostrarVendedor,
}: {
  processoId: string;
  links: LinkInfo[];
  ficheiros: Ficheiro[];
  mostrarVendedor: boolean;
}) {
  const router = useRouter();
  const [novo, setNovo] = useState<{ papel: string; link: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [loading, setLoading] = useState("");
  const [erro, setErro] = useState("");

  const pendentes = ficheiros.filter((f) => f.origem === "cliente" && f.estado_revisao === "pendente");
  const ativos = links.filter((l) => !l.revogado && new Date(l.expira_em).getTime() > Date.now());

  async function gerar(papel: "comprador" | "vendedor") {
    setLoading(papel);
    setErro("");
    try {
      const res = await fetch(`/api/cpcv/${processoId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ papel }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Erro ao gerar o link.");
      setNovo({ papel, link: body.link });
      setCopiado(false);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar o link.");
    } finally {
      setLoading("");
    }
  }

  async function revogar(linkId: string) {
    setLoading(linkId);
    setErro("");
    const res = await fetch(`/api/cpcv/${processoId}/links`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkId }),
    });
    if (!res.ok) setErro("Não foi possível revogar o link.");
    setLoading("");
    router.refresh();
  }

  async function rever(ficheiroId: string, estado: "aceite" | "rejeitado") {
    setLoading(ficheiroId);
    setErro("");
    const supabase = sbBrowser();
    // Um ficheiro rejeitado não serve para nada: apaga-se do Storage (só fica o registo).
    if (estado === "rejeitado") {
      const { data } = await supabase.from("cpcv_ficheiros").select("storage_path").eq("id", ficheiroId).single();
      if (data) await supabase.storage.from("cpcv-documentos").remove([data.storage_path]);
    }
    const { error } = await supabase.from("cpcv_ficheiros").update({ estado_revisao: estado }).eq("id", ficheiroId);
    if (error) setErro("Não foi possível atualizar o documento.");
    setLoading("");
    router.refresh();
  }

  async function abrir(ficheiroId: string) {
    const supabase = sbBrowser();
    const { data } = await supabase.from("cpcv_ficheiros").select("storage_path").eq("id", ficheiroId).single();
    if (!data) return;
    const { data: url } = await supabase.storage.from("cpcv-documentos").createSignedUrl(data.storage_path, 60);
    if (url?.signedUrl) window.open(url.signedUrl, "_blank", "noopener");
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
      <h2 className="text-sm font-semibold text-[#0F172A] mb-1">Documentos do cliente</h2>
      <p className="text-xs text-[#94A3B8] mb-3">
        Gere um link para o comprador ou o vendedor enviarem os documentos sem criar conta. Os ficheiros
        ficam pendentes até os aceitar.
      </p>

      <div className="flex flex-wrap gap-2">
        <button className={btnSecondary} disabled={!!loading} onClick={() => gerar("comprador")}>
          {loading === "comprador" ? "A gerar..." : "Gerar link do comprador"}
        </button>
        {mostrarVendedor && (
          <button className={btnSecondary} disabled={!!loading} onClick={() => gerar("vendedor")}>
            {loading === "vendedor" ? "A gerar..." : "Gerar link do vendedor"}
          </button>
        )}
      </div>

      {novo && (
        <div className="mt-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] p-3">
          <p className="text-xs text-[#0F172A] font-semibold mb-1">
            Link do {PAPEL_LABEL[novo.papel].toLowerCase()} (só aparece agora)
          </p>
          <p className="text-xs break-all text-[#475569]">{novo.link}</p>
          <button
            className={`${btnGhost} mt-1`}
            onClick={async () => {
              await navigator.clipboard.writeText(novo.link).catch(() => {});
              setCopiado(true);
            }}
          >
            {copiado ? "Copiado" : "Copiar link"}
          </button>
        </div>
      )}

      {ativos.length > 0 && (
        <ul className="mt-3 space-y-1">
          {ativos.map((l) => (
            <li key={l.id} className="text-xs flex items-center justify-between gap-3">
              <span>
                {PAPEL_LABEL[l.papel]} · válido até {new Date(l.expira_em).toLocaleDateString("pt-PT")}
              </span>
              <button className={btnDanger} disabled={!!loading} onClick={() => revogar(l.id)}>
                Revogar
              </button>
            </li>
          ))}
        </ul>
      )}

      {pendentes.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#F1F5F9]">
          <p className="text-xs font-semibold text-[#9A5B00] mb-2">Por rever ({pendentes.length})</p>
          <ul className="space-y-2">
            {pendentes.map((f) => (
              <li key={f.id} className="text-xs flex flex-wrap items-center justify-between gap-2">
                <span className="truncate">
                  {f.nome_original} <span className="text-[#94A3B8]">({f.tipo})</span>
                </span>
                <span className="flex items-center gap-1">
                  <button className={btnGhost} onClick={() => abrir(f.id)}>
                    Ver
                  </button>
                  <button className={btnSecondary} disabled={loading === f.id} onClick={() => rever(f.id, "aceite")}>
                    Aceitar
                  </button>
                  <button className={btnDanger} disabled={loading === f.id} onClick={() => rever(f.id, "rejeitado")}>
                    Rejeitar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {erro && <p className="text-xs text-red-500 mt-3">{erro}</p>}
    </div>
  );
}
