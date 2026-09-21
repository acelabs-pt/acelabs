"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnAccent, btnAccentOutline, btnGhost, btnPrimary, btnSecondary, Spinner } from "../ui";

export function GerarButton({
  processoId,
  temCamposEmFalta,
}: {
  processoId: string;
  temCamposEmFalta: boolean;
}) {
  const router = useRouter();
  const [aGerar, setAGerar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setAGerar(true);
    setErro(null);
    try {
      const res = await fetch("/api/cpcv/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processo_id: processoId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Erro desconhecido.");
        setAGerar(false);
        return;
      }
      router.refresh();
    } catch {
      setErro("Erro de rede ao gerar o documento.");
      setAGerar(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {temCamposEmFalta && (
        <p className="text-xs text-[#94A3B8]">
          Ainda há campos por preencher - ficam em branco no documento gerado.
        </p>
      )}
      <button onClick={gerar} disabled={aGerar} className={btnAccent}>
        {aGerar && <Spinner className="h-3.5 w-3.5" />}
        {aGerar ? "A aprovar e gerar..." : "Aprovar e gerar CPCV"}
      </button>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}

export function PedirAlteracoes({ processoId }: { processoId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState("");
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!nota.trim()) return;
    setAEnviar(true);
    setErro(null);
    try {
      const res = await fetch("/api/cpcv/pedir-alteracoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processo_id: processoId, nota }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Erro desconhecido.");
        setAEnviar(false);
        return;
      }
      setNota("");
      setAberto(false);
      router.refresh();
    } catch {
      setErro("Erro de rede ao enviar o pedido.");
      setAEnviar(false);
    }
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className={btnSecondary}>
        Pedir alterações
      </button>
    );
  }

  return (
    <div className="w-full flex flex-col items-end gap-2">
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={3}
        placeholder="O que falta ou precisa de ser corrigido antes de aprovar?"
        className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#0071e3]/30"
      />
      <div className="flex gap-2">
        <button onClick={() => setAberto(false)} disabled={aEnviar} className={btnGhost}>
          Cancelar
        </button>
        <button onClick={enviar} disabled={aEnviar || !nota.trim()} className={btnPrimary}>
          {aEnviar && <Spinner className="h-3.5 w-3.5" />}
          {aEnviar ? "A enviar..." : "Enviar à agente"}
        </button>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}

export function RascunhoLinks({ processoId }: { processoId: string }) {
  const [aGerar, setAGerar] = useState<"pdf" | "docx" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Usamos fetch + blob (em vez de <a href> directo) porque a geração demora vários
  // segundos (o PDF passa por um Chromium a correr no servidor) - sem feedback visual,
  // um clique a meio parece "não fazer nada" e tenta-se outra vez, o que pode interromper
  // o download a meio e produzir um ficheiro incompleto. Aqui o botão fica desactivado e
  // o download só é iniciado quando o ficheiro completo já está em memória no browser.
  async function gerar(tipo: "pdf" | "docx") {
    setAGerar(tipo);
    setErro(null);
    try {
      const res = await fetch(`/api/cpcv/${processoId}/rascunho?tipo=${tipo}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErro(data?.error ?? "Erro desconhecido ao gerar o rascunho.");
        setAGerar(null);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `cpcv-rascunho.${tipo}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setErro("Erro de rede ao gerar o rascunho.");
    } finally {
      setAGerar(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <p className="text-xs text-[#94A3B8]">Template com o que já está preenchido - o resto fica em branco.</p>
      <div className="flex gap-2">
        <button onClick={() => gerar("pdf")} disabled={aGerar !== null} className={btnSecondary}>
          {aGerar === "pdf" && <Spinner className="h-3.5 w-3.5" />}
          {aGerar === "pdf" ? "A gerar PDF..." : "Gerar PDF em branco"}
        </button>
        <button onClick={() => gerar("docx")} disabled={aGerar !== null} className={btnSecondary}>
          {aGerar === "docx" && <Spinner className="h-3.5 w-3.5" />}
          {aGerar === "docx" ? "A gerar Word..." : "Gerar Word em branco"}
        </button>
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}

export function DownloadLinks({ processoId }: { processoId: string }) {
  // Usamos <a href> real para a nossa própria rota, em vez de fetch+blob: URL - o Chrome/Edge
  // no Windows tem um bug conhecido em que, com "perguntar onde guardar cada ficheiro" activo,
  // a caixa "Guardar como" ignora o atributo download de um blob: URL e usa o UUID interno do
  // blob como nome. Com um URL normal da nossa própria origem, o nome vem sempre do
  // Content-Disposition que o servidor define, de forma fiável em qualquer browser/SO.
  return (
    <div className="mt-4 flex justify-end gap-2">
      <a href={`/api/cpcv/${processoId}/download?tipo=pdf`} className={btnAccentOutline}>
        Descarregar PDF
      </a>
      <a href={`/api/cpcv/${processoId}/download?tipo=docx`} className={btnAccentOutline}>
        Descarregar Word
      </a>
    </div>
  );
}
