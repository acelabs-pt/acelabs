"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";
import { extensaoSuportada, nomeSemColisao } from "@/lib/cpcv-ficheiros";
import { btnGhost, btnPrimary, Spinner } from "../ui";

const TIPOS = [
  { value: "cc_vendedor", label: "Cartão de Cidadão - Vendedor" },
  { value: "cc_comprador", label: "Cartão de Cidadão - Comprador" },
  { value: "caderneta_predial", label: "Caderneta Predial" },
  { value: "certificado_energetico", label: "Certificado Energético" },
  { value: "outro", label: "Outro" },
];

type FicheiroPendente = { file: File; tipo: string };

export default function AdicionarInformacao({
  processoId,
  donoId,
  linkAtual,
}: {
  processoId: string;
  donoId: string;
  linkAtual: string | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [ficheiros, setFicheiros] = useState<FicheiroPendente[]>([]);
  const [texto, setTexto] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [erro, setErro] = useState("");

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const escolhidos = Array.from(e.target.files ?? []);
    e.target.value = "";

    const nomesExistentes = ficheiros.map((f) => f.file.name);
    const rejeitados: string[] = [];
    const aceites: FicheiroPendente[] = [];

    for (const file of escolhidos) {
      if (!extensaoSuportada(file.name)) {
        rejeitados.push(file.name);
        continue;
      }
      const nomeFinal = nomeSemColisao(file.name, [...nomesExistentes, ...aceites.map((f) => f.file.name)]);
      const fileFinal = nomeFinal === file.name ? file : new File([file], nomeFinal, { type: file.type });
      aceites.push({ file: fileFinal, tipo: "outro" });
    }

    setFicheiros((prev) => [...prev, ...aceites]);
    setErro(rejeitados.length > 0 ? `Formato não suportado (usa PDF, JPG ou PNG): ${rejeitados.join(", ")}` : "");
  }

  function setTipo(index: number, tipo: string) {
    setFicheiros((prev) => prev.map((f, i) => (i === index ? { ...f, tipo } : f)));
  }

  function removerFicheiro(index: number) {
    setFicheiros((prev) => prev.filter((_, i) => i !== index));
  }

  async function enviar() {
    if (ficheiros.length === 0 && !texto.trim() && !link.trim()) {
      setErro("Junta pelo menos um documento, texto, ou um link do imóvel.");
      return;
    }

    setLoading(true);
    setErro("");

    try {
      const supabase = sbBrowser();

      setEtapa("A enviar documentos...");
      for (const { file, tipo } of ficheiros) {
        const path = `${donoId}/${processoId}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("cpcv-documentos")
          .upload(path, file, { upsert: true });

        if (uploadError) {
          setErro(`Erro a enviar ${file.name}: ${uploadError.message}`);
          setLoading(false);
          return;
        }

        const { error: ficheiroError } = await supabase.from("cpcv_ficheiros").insert({
          processo_id: processoId,
          tipo,
          storage_path: path,
          nome_original: file.name,
        });

        if (ficheiroError) {
          setErro(`Erro a registar ${file.name}: ${ficheiroError.message}`);
          setLoading(false);
          return;
        }
      }

      setEtapa("A analisar com IA...");
      const res = await fetch("/api/cpcv/extrair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processo_id: processoId, texto, link_imovel: link }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro(body.error ?? "Erro ao analisar a nova informação.");
        setLoading(false);
        return;
      }

      setFicheiros([]);
      setTexto("");
      setLink("");
      setLoading(false);
      setAberto(false);
      router.refresh();
    } catch {
      setErro("Erro de ligação. Confirma a internet e tenta outra vez.");
      setLoading(false);
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="mt-4 text-sm text-[#2E6DB4] font-medium hover:text-[#0059B3] hover:underline underline-offset-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6DB4]/30 rounded"
      >
        + Adicionar documentos, texto ou link do imóvel
      </button>
    );
  }

  return (
    <div className="mt-4 border border-[#E2E8F0] rounded-xl p-4 space-y-4">
      <div>
        <label className="block text-xs font-semibold text-[#475569] mb-2">Documentos</label>
        <input
          type="file"
          multiple
          onChange={handleFiles}
          accept="application/pdf,image/*"
          className="text-sm text-[#94A3B8] file:mr-4 file:cursor-pointer file:rounded-xl file:border file:border-[#E2E8F0] file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-[#475569] hover:file:bg-[#F8FAFC] hover:file:border-[#CBD5E1]"
        />
        {ficheiros.length > 0 && (
          <ul className="mt-3 space-y-2">
            {ficheiros.map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-sm bg-[#F8FAFC] rounded-lg px-3 py-2">
                <span className="flex-1 truncate">{f.file.name}</span>
                <select
                  value={f.tipo}
                  onChange={(e) => setTipo(i, e.target.value)}
                  className="border border-[#E2E8F0] rounded-lg px-2 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
                >
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removerFicheiro(i)}
                  className="text-[#94A3B8] hover:text-red-500 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 rounded px-1"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#475569] mb-2">Link do imóvel (opcional)</label>
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder={linkAtual || "https://..."}
          className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
        />
        {linkAtual && !link && (
          <p className="text-xs text-[#94A3B8] mt-1">
            Já tens um link guardado:{" "}
            <a href={linkAtual} target="_blank" rel="noopener noreferrer" className="text-[#2E6DB4]">
              {linkAtual}
            </a>
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-[#475569] mb-2">Informação solta (opcional)</label>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          placeholder="Mais alguma coisa que saibas sobre o negócio..."
          className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
        />
      </div>

      {erro && <p className="text-xs text-red-500">{erro}</p>}

      <div className="flex justify-end gap-2">
        <button onClick={() => setAberto(false)} disabled={loading} className={btnGhost}>
          Cancelar
        </button>
        <button onClick={enviar} disabled={loading} className={btnPrimary}>
          {loading && <Spinner className="h-3.5 w-3.5" />}
          {loading ? etapa || "A processar..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}
