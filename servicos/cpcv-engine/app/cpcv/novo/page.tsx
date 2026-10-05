"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";
import { extensaoSuportada, nomeFicheiroSeguro, nomeSemColisao } from "@/lib/cpcv-ficheiros";
import { temGestaoTotal } from "@/lib/cpcv-auth";
import { ParteDraft, nifValido, parteDraftParaLinha, parteDraftVazia, parteDraftVazio } from "@/lib/cpcv-partes-form";
import ParteCampos from "../ParteCampos";
import { btnPrimary, btnSecondary, TextoShimmer } from "../ui";

const TIPOS_IMOVEL = [
  { value: "certidao_predial", label: "Certidão Predial" },
  { value: "caderneta_predial", label: "Caderneta Predial" },
  { value: "certificado_energetico", label: "Certificado Energético" },
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
  const [licencaUtilizacao, setLicencaUtilizacao] = useState("");
  const [certificadoEnergetico, setCertificadoEnergetico] = useState("");
  const [ficheiros, setFicheiros] = useState<FicheiroPendente[]>([]);
  const [vendedores, setVendedores] = useState<ParteDraft[]>([parteDraftVazia()]);
  const [compradores, setCompradores] = useState<ParteDraft[]>([parteDraftVazia()]);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const angariacaoExterna = tipoContrato === "comprador_nosso_angariacao_externa";

  useEffect(() => {
    async function carregar() {
      const supabase = sbBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!temGestaoTotal(perfil?.role)) return;

      setIsGestora(true);
      const { data: perfis } = await supabase.from("profiles").select("id, nome").eq("role", "agente").order("nome");
      setAgentes(perfis ?? []);
    }
    carregar();
  }, []);

  const agentesFiltrados = agentes.filter((a) => a.nome.toLowerCase().includes(pesquisaAgente.toLowerCase()));

  function handleFilesParaTipo(tipo: string, fileList: FileList | null) {
    const escolhidos = Array.from(fileList ?? []);

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
      aceites.push({ file: fileFinal, tipo });
    }

    setFicheiros((prev) => [...prev, ...aceites]);
    setError(rejeitados.length > 0 ? `Formato não suportado (usa PDF, JPG ou PNG): ${rejeitados.join(", ")}` : "");
  }

  function removerFicheiro(index: number) {
    setFicheiros((prev) => prev.filter((_, i) => i !== index));
  }

  function nifsInvalidos(): string[] {
    const todas = [...(!angariacaoExterna ? vendedores : []), ...compradores];
    return todas.filter((d) => d.nif.trim() && !nifValido(d.nif)).map((d) => d.nome || "(sem nome)");
  }

  async function criarProcesso(supabase: ReturnType<typeof sbBrowser>, donoId: string) {
    return supabase
      .from("cpcv_processos")
      .insert({
        criado_por: donoId,
        tipo_contrato: tipoContrato,
        imovel_licenca_utilizacao: licencaUtilizacao || null,
        imovel_certificado_energetico: certificadoEnergetico || null,
      })
      .select()
      .single();
  }

  // Grava as partes preenchidas e os documentos de identificação associados - chamado pelos
  // dois botões de submissão, já que os dados das partes são independentes de haver ou não
  // outros documentos/texto para a IA analisar.
  async function guardarPartesEFicheiros(
    supabase: ReturnType<typeof sbBrowser>,
    processoId: string,
    donoId: string
  ): Promise<string | null> {
    const grupos: { lista: ParteDraft[]; papel: "vendedor" | "comprador"; prefixo: string }[] = [
      ...(!angariacaoExterna ? [{ lista: vendedores, papel: "vendedor" as const, prefixo: "identificacao_vendedor" }] : []),
      { lista: compradores, papel: "comprador" as const, prefixo: "identificacao_comprador" },
    ];

    const linhas = grupos.flatMap(({ lista, papel }) =>
      lista.filter((d) => !parteDraftVazio(d)).map((d) => parteDraftParaLinha(papel, d, processoId))
    );

    if (linhas.length > 0) {
      const { error } = await supabase.from("cpcv_partes").insert(linhas);
      if (error) return `Erro ao gravar as partes: ${error.message}`;
    }

    for (const { lista, prefixo } of grupos) {
      for (let i = 0; i < lista.length; i++) {
        const file = lista[i].ficheiro;
        if (!file) continue;
        const tipo = i === 0 ? prefixo : `${prefixo}_${i + 1}`;
        const path = `${donoId}/${processoId}/${nomeFicheiroSeguro(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("cpcv-documentos").upload(path, file, { upsert: true });
        if (uploadError) return `Erro a enviar ${file.name}: ${uploadError.message}`;
        await supabase.from("cpcv_ficheiros").insert({ processo_id: processoId, tipo, storage_path: path, nome_original: file.name });
      }
    }

    return null;
  }

  async function handleSubmit() {
    const temAlgumaParte = [...vendedores, ...compradores].some((d) => !parteDraftVazio(d));
    if (ficheiros.length === 0 && !texto.trim() && !temAlgumaParte) {
      setError("Junta pelo menos um documento, escreve alguma informação, ou preenche os dados de uma parte.");
      return;
    }

    const invalidos = nifsInvalidos();
    if (invalidos.length > 0) {
      setError(`NIF inválido para: ${invalidos.join(", ")}`);
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
        const path = `${donoId}/${processo.id}/${nomeFicheiroSeguro(file.name)}`;
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

      const erroPartes = await guardarPartesEFicheiros(supabase, processo.id, donoId);
      if (erroPartes) {
        setError(erroPartes);
        setLoading(false);
        return;
      }

      setEtapa("A analisar...");
      const res = await fetch("/api/cpcv/extrair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processo_id: processo.id, texto: texto.trim() }),
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
    const invalidos = nifsInvalidos();
    if (invalidos.length > 0) {
      setError(`NIF inválido para: ${invalidos.join(", ")}`);
      return;
    }

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

      const erroPartes = await guardarPartesEFicheiros(supabase, processo.id, donoId);
      if (erroPartes) {
        setError(erroPartes);
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

  function blocoDocumentosImovel() {
    return (
      <div className="space-y-2">
        {TIPOS_IMOVEL.map((t) => {
          const docs = ficheiros.map((f, i) => ({ ...f, i })).filter((f) => f.tipo === t.value);
          return (
            <div key={t.value} className="border border-[#E2E8F0] rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#0F172A]">{t.label}</span>
                <label className="shrink-0 cursor-pointer text-xs font-medium text-[#2E6DB4] hover:underline">
                  + Adicionar
                  <input
                    type="file"
                    multiple
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleFilesParaTipo(t.value, e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {docs.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {docs.map((d) => (
                    <li key={d.i} className="flex items-center gap-3 text-xs bg-[#F8FAFC] rounded-lg px-3 py-1.5">
                      <span className="flex-1 truncate">{d.file.name}</span>
                      <button
                        onClick={() => removerFicheiro(d.i)}
                        className="text-[#94A3B8] hover:text-red-500 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 rounded px-1"
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A]">Novo CPCV</h1>
        <p className="text-sm text-[#94A3B8] mt-1">
          {angariacaoExterna
            ? "Angariação de outra agência - o CPCV vem de lá. Aqui só recolhemos os dados do nosso comprador e as condições negociadas."
            : "Preenche os dados de quem compra e vende, junta os documentos do imóvel que já tens, e escreve o resto. Podes completar mais tarde o que faltar."}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-6 space-y-5">
        {isGestora && (
          <div className="relative">
            <label htmlFor="atribuirA" className="block text-xs font-semibold text-[#475569] mb-2">
              Atribuir a (opcional - fica contigo se não escolheres)
            </label>
            <input
              id="atribuirA"
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
          <label htmlFor="tipoContrato" className="block text-xs font-semibold text-[#475569] mb-2">
            Tipo de contrato
          </label>
          <select
            id="tipoContrato"
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

        <div className="grid lg:grid-cols-2 gap-5">
          {!angariacaoExterna && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[#0F172A]">Documentos do imóvel e proprietário</h3>

              {blocoDocumentosImovel()}

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="licencaUtilizacao" className="block text-[11px] text-[#94A3B8] mb-1">
                    Licença de utilização <span className="text-[#9A5B00]">(obrigatória para gerar o CPCV)</span>
                  </label>
                  <input
                    id="licencaUtilizacao"
                    value={licencaUtilizacao}
                    onChange={(e) => setLicencaUtilizacao(e.target.value)}
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
                  />
                </div>
                <div>
                  <label htmlFor="certificadoEnergetico" className="block text-[11px] text-[#94A3B8] mb-1">
                    Certificado energético <span className="text-[#9A5B00]">(obrigatório para gerar o CPCV)</span>
                  </label>
                  <input
                    id="certificadoEnergetico"
                    value={certificadoEnergetico}
                    onChange={(e) => setCertificadoEnergetico(e.target.value)}
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
                  />
                </div>
              </div>

              {vendedores.map((v, i) => (
                <ParteCampos
                  key={i}
                  titulo={`Vendedor ${i + 1}`}
                  draft={v}
                  comUploadFicheiro
                  onChange={(next) => setVendedores((prev) => prev.map((d, idx) => (idx === i ? next : d)))}
                  onRemover={vendedores.length > 1 ? () => setVendedores((prev) => prev.filter((_, idx) => idx !== i)) : undefined}
                />
              ))}
              <button
                type="button"
                onClick={() => setVendedores((prev) => [...prev, parteDraftVazia()])}
                className="text-xs font-medium text-[#2E6DB4] hover:underline"
              >
                + Adicionar vendedor
              </button>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#0F172A]">Documentos Comprador</h3>

            {compradores.map((c, i) => (
              <ParteCampos
                key={i}
                titulo={`Comprador ${i + 1}`}
                draft={c}
                comUploadFicheiro
                onChange={(next) => setCompradores((prev) => prev.map((d, idx) => (idx === i ? next : d)))}
                onRemover={compradores.length > 1 ? () => setCompradores((prev) => prev.filter((_, idx) => idx !== i)) : undefined}
              />
            ))}
            <button
              type="button"
              onClick={() => setCompradores((prev) => [...prev, parteDraftVazia()])}
              className="text-xs font-medium text-[#2E6DB4] hover:underline"
            >
              + Adicionar comprador
            </button>
          </div>
        </div>

        <div className="border border-[#E2E8F0] rounded-xl px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[#0F172A]">Outros documentos</span>
            <label className="shrink-0 cursor-pointer text-xs font-medium text-[#2E6DB4] hover:underline">
              + Adicionar
              <input
                type="file"
                multiple
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  handleFilesParaTipo("outro", e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          {ficheiros.filter((f) => f.tipo === "outro").length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {ficheiros
                .map((f, i) => ({ ...f, i }))
                .filter((f) => f.tipo === "outro")
                .map((d) => (
                  <li key={d.i} className="flex items-center gap-3 text-xs bg-[#F8FAFC] rounded-lg px-3 py-1.5">
                    <span className="flex-1 truncate">{d.file.name}</span>
                    <button
                      onClick={() => removerFicheiro(d.i)}
                      className="text-[#94A3B8] hover:text-red-500 font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 rounded px-1"
                    >
                      Remover
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor="infoSolta" className="block text-xs font-semibold text-[#475569] mb-2">
            Informação solta (opcional)
          </label>
          <textarea
            id="infoSolta"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            placeholder="Cola aqui qualquer informação que tenhas sobre o negócio - preço, sinal, prazos, o que for..."
            className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button onClick={handleSubmit} disabled={loading} className={`w-full ${btnPrimary} py-3`}>
          {loading ? <TextoShimmer tom="escuro">{etapa || "A processar..."}</TextoShimmer> : "Enviar"}
        </button>

        <div className="flex items-center gap-3 text-xs text-[#94A3B8]">
          <div className="flex-1 h-px bg-[#E2E8F0]" />
          ou
          <div className="flex-1 h-px bg-[#E2E8F0]" />
        </div>

        <button onClick={handleComecarDoZero} disabled={loading} className={`w-full ${btnSecondary} py-3`}>
          {loading ? <TextoShimmer>{etapa || "A processar..."}</TextoShimmer> : "Não tenho nada - começar do zero"}
        </button>
      </div>
    </div>
  );
}
