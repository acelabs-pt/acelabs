"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";
import { extensaoSuportada, nomeSemColisao } from "@/lib/cpcv-ficheiros";
import { btnPrimary, btnSecondary, Spinner } from "../ui";

const TIPOS = [
  { value: "cc_vendedor", label: "Cartão de Cidadão - Vendedor" },
  { value: "cc_comprador", label: "Cartão de Cidadão - Comprador" },
  { value: "caderneta_predial", label: "Caderneta Predial" },
  { value: "certificado_energetico", label: "Certificado Energético" },
  { value: "outro", label: "Outro" },
];

const TIPOS_CONTRATO = [
  { value: "angariacao_nossa_comprador_nosso", label: "Angariação nossa - comprador nosso" },
  { value: "angariacao_nossa_comprador_externo", label: "Angariação nossa - comprador de outra agência" },
  { value: "comprador_nosso_angariacao_externa", label: "Comprador nosso - angariação de outra agência" },
];

type FicheiroPendente = { file: File; tipo: string };
type Agente = { id: string; nome: string };

export default function NovoProcessoPage() {
  const [isGestora, setIsGestora] = useState(false);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [pesquisaAgente, setPesquisaAgente] = useState("");
  const [agenteSelecionado, setAgenteSelecionado] = useState<Agente | null>(null);
  const [listaAberta, setListaAberta] = useState(false);

  const [tipoContrato, setTipoContrato] = useState("angariacao_nossa_comprador_nosso");
  const [ficheiros, setFicheiros] = useState<FicheiroPendente[]>([]);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const angariacaoExterna = tipoContrato === "comprador_nosso_angariacao_externa";
  const tiposDisponiveis = angariacaoExterna ? TIPOS.filter((t) => t.value !== "cc_vendedor") : TIPOS;

  useEffect(() => {
    async function carregar() {
      const supabase = sbBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (perfil?.role !== "gestora") return;

      setIsGestora(true);
      const { data: perfis } = await supabase.from("profiles").select("id, nome").eq("role", "agente").order("nome");
      setAgentes(perfis ?? []);
    }
    carregar();
  }, []);

  const agentesFiltrados = agentes.filter((a) => a.nome.toLowerCase().includes(pesquisaAgente.toLowerCase()));

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
    setError(rejeitados.length > 0 ? `Formato não suportado (usa PDF, JPG ou PNG): ${rejeitados.join(", ")}` : "");
  }

  function setTipo(index: number, tipo: string) {
    setFicheiros((prev) => prev.map((f, i) => (i === index ? { ...f, tipo } : f)));
  }

  function removerFicheiro(index: number) {
    setFicheiros((prev) => prev.filter((_, i) => i !== index));
  }

  async function criarProcesso(supabase: ReturnType<typeof sbBrowser>, donoId: string) {
    return supabase.from("cpcv_processos").insert({ criado_por: donoId, tipo_contrato: tipoContrato }).select().single();
  }

  async function handleSubmit() {
    if (ficheiros.length === 0 && !texto.trim()) {
      setError("Junta pelo menos um documento ou escreve alguma informação.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = sbBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Sessão expirada - entra outra vez.");
        setLoading(false);
        return;
      }

      const donoId = isGestora && agenteSelecionado ? agenteSelecionado.id : user.id;

      setEtapa("A criar processo...");
      const { data: processo, error: processoError } = await criarProcesso(supabase, donoId);

      if (processoError || !processo) {
        setError(processoError?.message ?? "Não foi possível criar o processo.");
        setLoading(false);
        return;
      }

      setEtapa("A enviar documentos...");
      for (const { file, tipo } of ficheiros) {
        const path = `${donoId}/${processo.id}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("cpcv-documentos")
          .upload(path, file, { upsert: true });

        if (uploadError) {
          setError(`Erro a enviar ${file.name}: ${uploadError.message}`);
          setLoading(false);
          return;
        }

        await supabase.from("cpcv_ficheiros").insert({
          processo_id: processo.id,
          tipo,
          storage_path: path,
          nome_original: file.name,
        });
      }

      setEtapa("A analisar...");
      const res = await fetch("/api/cpcv/extrair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processo_id: processo.id, texto }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Erro ao analisar os documentos.");
        setLoading(false);
        return;
      }

      router.push(`/cpcv/${processo.id}`);
    } catch {
      setError("Erro de ligação. Confirma a internet e tenta outra vez.");
      setLoading(false);
    }
  }

  async function handleComecarDoZero() {
    setLoading(true);
    setError("");
    setEtapa("A criar processo...");

    try {
      const supabase = sbBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Sessão expirada - entra outra vez.");
        setLoading(false);
        return;
      }

      const donoId = isGestora && agenteSelecionado ? agenteSelecionado.id : user.id;

      const { data: processo, error: processoError } = await criarProcesso(supabase, donoId);

      if (processoError || !processo) {
        setError(processoError?.message ?? "Não foi possível criar o processo.");
        setLoading(false);
        return;
      }

      setEtapa("A preparar as perguntas...");
      const res = await fetch("/api/cpcv/extrair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processo_id: processo.id, texto: "" }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Erro ao iniciar o processo.");
        setLoading(false);
        return;
      }

      router.push(`/cpcv/${processo.id}`);
    } catch {
      setError("Erro de ligação. Confirma a internet e tenta outra vez.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A]">Novo CPCV</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          {angariacaoExterna
            ? "Angariação de outra agência - o CPCV vem de lá. Aqui só recolhemos os dados do nosso comprador e as condições negociadas."
            : "Junta os documentos que já tens (CC de ambas as partes, caderneta predial, certificado energético) e/ou escreve o que souberes. A IA trata do resto."}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 space-y-5">
        {isGestora && (
          <div className="relative">
            <label className="block text-xs font-semibold text-[#475569] mb-2">
              Atribuir a (opcional - fica contigo se não escolheres)
            </label>
            <input
              type="text"
              value={agenteSelecionado ? agenteSelecionado.nome : pesquisaAgente}
              onChange={(e) => {
                setAgenteSelecionado(null);
                setPesquisaAgente(e.target.value);
                setListaAberta(true);
              }}
              onFocus={() => setListaAberta(true)}
              onBlur={() => setTimeout(() => setListaAberta(false), 150)}
              placeholder="Escreve o nome do agente..."
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
            />
            {listaAberta && pesquisaAgente && !agenteSelecionado && (
              <ul className="absolute z-10 mt-1 w-full bg-white border border-[#E2E8F0] rounded-xl shadow-lg max-h-52 overflow-auto">
                {agentesFiltrados.length === 0 && (
                  <li className="px-4 py-2 text-xs text-[#94A3B8]">Nenhum agente encontrado.</li>
                )}
                {agentesFiltrados.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setAgenteSelecionado(a);
                        setPesquisaAgente("");
                        setListaAberta(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-[#F8FAFC]"
                    >
                      {a.nome}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#475569] mb-2">Tipo de contrato</label>
          <select
            value={tipoContrato}
            onChange={(e) => setTipoContrato(e.target.value)}
            className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
          >
            {TIPOS_CONTRATO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#475569] mb-2">Documentos</label>
          <input
            type="file"
            multiple
            onChange={handleFiles}
            accept="application/pdf,image/*"
            className="text-sm"
          />

          {ficheiros.length > 0 && (
            <ul className="mt-4 space-y-2">
              {ficheiros.map((f, i) => (
                <li key={i} className="flex items-center gap-3 text-sm bg-[#F8FAFC] rounded-lg px-3 py-2">
                  <span className="flex-1 truncate">{f.file.name}</span>
                  <select
                    value={f.tipo}
                    onChange={(e) => setTipo(i, e.target.value)}
                    className="border border-[#E2E8F0] rounded-lg px-2 py-1 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
                  >
                    {tiposDisponiveis.map((t) => (
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
          <label className="block text-xs font-semibold text-[#475569] mb-2">
            Informação solta (opcional)
          </label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            placeholder="Cola aqui qualquer informação que tenhas sobre o negócio - preço, sinal, prazos, o que for..."
            className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button onClick={handleSubmit} disabled={loading} className={`w-full ${btnPrimary} py-3`}>
          {loading && <Spinner className="h-4 w-4" />}
          {loading ? etapa || "A processar..." : "Enviar"}
        </button>

        <div className="flex items-center gap-3 text-xs text-[#94A3B8]">
          <div className="flex-1 h-px bg-[#E2E8F0]" />
          ou
          <div className="flex-1 h-px bg-[#E2E8F0]" />
        </div>

        <button onClick={handleComecarDoZero} disabled={loading} className={`w-full ${btnSecondary} py-3`}>
          {loading && <Spinner className="h-4 w-4" />}
          {loading ? etapa || "A processar..." : "Não tenho nada - começar do zero"}
        </button>
      </div>
    </div>
  );
}
