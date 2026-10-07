"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";
import { analisarComUploadTemporario, extensaoSuportada, nomeFicheiroSeguro, nomeSemColisao } from "@/lib/cpcv-ficheiros";
import { temGestaoTotal } from "@/lib/cpcv-auth";
import {
  ParteDraft,
  enviarFicheirosDasPartes,
  nifValido,
  parteDraftParaLinha,
  parteDraftVazia,
  parteDraftVazio,
} from "@/lib/cpcv-partes-form";
import ParteCampos from "../ParteCampos";
import { btnPrimary, btnSecondary, CORES_SECAO, grupoClass, IconesSecao, PassoCard, Spinner, subTituloClass, TextoShimmer } from "../ui";

// Y do "Passo X de Y" em todo o fluxo de criação - não é o número de etapas nesta página (essa
// conta muda consoante o tipo de contrato), é a duração à vista do processo completo, incluindo
// o que acontece depois já na página do processo (condições do negócio, aprovação da gestora,
// geração do documento). Ver o comentário em PassoCard (app/cpcv/ui.tsx).
const TOTAL_PASSOS = 10;

const TIPOS_IMOVEL: { value: string; label: string; opcional?: boolean }[] = [
  { value: "caderneta_predial", label: "Caderneta Predial" },
  { value: "certidao_predial", label: "Certidão Predial" },
  { value: "licenca_utilizacao", label: "Licença de Utilização" },
  { value: "certificado_energetico", label: "Certificado Energético" },
  { value: "direito_preferencia", label: "Direito de Preferência", opcional: true },
];

const TIPOS_CONTRATO = [
  { value: "angariacao_nossa_comprador_nosso", label: "Angariação nossa - comprador nosso" },
  { value: "angariacao_nossa_comprador_externo", label: "Angariação nossa - comprador de outra agência" },
  { value: "comprador_nosso_angariacao_externa", label: "Comprador nosso - angariação de outra agência" },
];

type FicheiroPendente = { file: File; tipo: string };
type Agente = { id: string; nome: string };

// Usado só quando tipo_contrato é "angariacao_nossa_comprador_nosso" - os dois lados do
// negócio podem ter sido trazidos por agentes diferentes da mesma agência (ver
// migration_fase10.sql). `valorId: null` significa "o agente responsável pelo processo" (o
// dono, resolvido no submit - ver criarProcesso), nunca necessariamente quem está a preencher
// o formulário, já que uma gestora pode estar a criar o processo em nome de outro agente.
function SeletorAgente({
  label,
  agentes,
  valorId,
  onChange,
}: {
  label: string;
  agentes: Agente[];
  valorId: string | null;
  onChange: (id: string | null) => void;
}) {
  const [modoOutro, setModoOutro] = useState(valorId !== null);
  const [pesquisa, setPesquisa] = useState("");
  const [aberto, setAberto] = useState(false);

  const agenteSelecionado = agentes.find((a) => a.id === valorId) ?? null;
  const filtrados = agentes.filter((a) => a.nome.toLowerCase().includes(pesquisa.toLowerCase()));

  const botaoClass = (seleccionado: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
      seleccionado
        ? "border-[#0071e3] bg-[#EFF6FF] text-[#0F172A]"
        : "border-[#E2E8F0] bg-white text-[#475569] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
    }`;

  return (
    <div>
      <label className="block text-xs font-semibold text-[#475569] mb-2">{label}</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            setModoOutro(false);
            onChange(null);
            setPesquisa("");
          }}
          className={botaoClass(!modoOutro)}
        >
          O agente responsável
        </button>
        <button type="button" onClick={() => setModoOutro(true)} className={botaoClass(modoOutro)}>
          Outro colega
        </button>
      </div>
      {modoOutro && (
        <div className="relative mt-2">
          <input
            type="text"
            value={agenteSelecionado ? agenteSelecionado.nome : pesquisa}
            onChange={(e) => {
              onChange(null);
              setPesquisa(e.target.value);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            onBlur={() => setTimeout(() => setAberto(false), 150)}
            placeholder="Escreve o nome do colega..."
            className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
          />
          {aberto && pesquisa && !agenteSelecionado && (
            <ul className="absolute z-10 mt-1 w-full bg-white border border-[#E2E8F0] rounded-xl shadow-lg max-h-52 overflow-auto">
              {filtrados.length === 0 && <li className="px-4 py-2 text-xs text-[#94A3B8]">Nenhum colega encontrado.</li>}
              {filtrados.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(a.id);
                      setPesquisa("");
                      setAberto(false);
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
    </div>
  );
}

export default function NovoProcessoPage() {
  const [isGestora, setIsGestora] = useState(false);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [pesquisaAgente, setPesquisaAgente] = useState("");
  const [agenteSelecionado, setAgenteSelecionado] = useState<Agente | null>(null);
  const [listaAberta, setListaAberta] = useState(false);

  const [tipoContrato, setTipoContrato] = useState("angariacao_nossa_comprador_nosso");
  const [agenteAngariacaoId, setAgenteAngariacaoId] = useState<string | null>(null);
  const [agenteCompradorId, setAgenteCompradorId] = useState<string | null>(null);
  const [licencaUtilizacao, setLicencaUtilizacao] = useState("");
  const [certificadoEnergetico, setCertificadoEnergetico] = useState("");
  const [ruaImovel, setRuaImovel] = useState("");
  const [numeroImovel, setNumeroImovel] = useState("");
  const [andarImovel, setAndarImovel] = useState("");
  const [codigoPostalImovel, setCodigoPostalImovel] = useState("");
  const [localidadeImovel, setLocalidadeImovel] = useState("");
  const [freguesiaImovel, setFreguesiaImovel] = useState("");
  const [concelhoImovel, setConcelhoImovel] = useState("");
  const [distritoImovel, setDistritoImovel] = useState("");
  const [ficheiros, setFicheiros] = useState<FicheiroPendente[]>([]);
  const [vendedores, setVendedores] = useState<ParteDraft[]>([parteDraftVazia()]);
  const [compradores, setCompradores] = useState<ParteDraft[]>([parteDraftVazia()]);
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [error, setError] = useState("");
  const [aAnalisarImovel, setAAnalisarImovel] = useState(false);
  const [erroCampoImovel, setErroCampoImovel] = useState("");
  const router = useRouter();

  const angariacaoExterna = tipoContrato === "comprador_nosso_angariacao_externa";

  // Numeração sequencial das etapas visíveis - recalculada a cada render porque
  // "Documentos do imóvel"/"Documentos do proprietário" desaparecem quando angariacaoExterna
  // (ver o "!angariacaoExterna &&" à volta dos dois cartões, mais abaixo), e os números
  // seguintes não podem ficar com buracos.
  let proximoPasso = 1;
  const passoTipoContrato = proximoPasso++;
  const passoImovel = !angariacaoExterna ? proximoPasso++ : null;
  const passoProprietario = !angariacaoExterna ? proximoPasso++ : null;
  const passoComprador = proximoPasso++;
  const passoOutros = proximoPasso++;
  const passoInfo = proximoPasso++;

  useEffect(() => {
    async function carregar() {
      const supabase = sbBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // A lista de colegas (para "Outro colega" no agente da angariação/do comprador, mais
      // abaixo) é precisa para qualquer agente, não só para a gestora - por isso corre sempre,
      // independentemente do papel de quem está a preencher o formulário.
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("role", "agente")
        .neq("id", user.id)
        .order("nome");
      setAgentes(perfis ?? []);

      const { data: perfil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (temGestaoTotal(perfil?.role)) setIsGestora(true);
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

    if (aceites.length > 0) {
      analisarDocumentoImovel(aceites.map((a) => a.file));
    }
  }

  // Só sugere valores para os campos manuais do imóvel (morada, licença, certificado) - nunca
  // grava nada, o processo ainda nem existe nesta página. Qualquer documento desta secção pode
  // trazer a morada completa (caderneta predial, certidão predial e certificado energético
  // normalmente trazem todos), por isso corre sobre qualquer upload, não só sobre o tipo
  // "certo". Nunca substitui um campo que o agente já tenha escrito à mão - a verificação
  // funcional do setState protege mesmo contra o agente escrever enquanto a leitura decorre.
  async function analisarDocumentoImovel(novosFicheiros: File[]) {
    const suportados = novosFicheiros.filter((f) => extensaoSuportada(f.name));
    if (suportados.length === 0) return;

    setAAnalisarImovel(true);
    setErroCampoImovel("");
    try {
      const supabase = sbBrowser();
      const { dados } = await analisarComUploadTemporario<{ dados: Record<string, unknown> }>(
        supabase,
        suportados,
        "/api/cpcv/extrair-documento-imovel"
      );
      if (!dados) return;

      const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
      const preencher = (valor: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
        if (!valor) return;
        setter((atual) => (atual.trim() ? atual : valor));
      };

      preencher(str(dados.rua), setRuaImovel);
      preencher(str(dados.numero), setNumeroImovel);
      preencher(str(dados.andar_fracao), setAndarImovel);
      preencher(str(dados.codigo_postal), setCodigoPostalImovel);
      preencher(str(dados.localidade), setLocalidadeImovel);
      preencher(str(dados.freguesia), setFreguesiaImovel);
      preencher(str(dados.concelho), setConcelhoImovel);
      preencher(str(dados.distrito), setDistritoImovel);
      preencher(str(dados.licenca_utilizacao), setLicencaUtilizacao);
      preencher(str(dados.certificado_energetico), setCertificadoEnergetico);
    } catch (e) {
      setErroCampoImovel(e instanceof Error ? e.message : "Erro ao analisar o documento.");
    } finally {
      setAAnalisarImovel(false);
    }
  }

  function removerFicheiro(index: number) {
    setFicheiros((prev) => prev.filter((_, i) => i !== index));
  }

  function nifsInvalidos(): string[] {
    const todas = [...(!angariacaoExterna ? vendedores : []), ...compradores];
    return todas.filter((d) => d.nif.trim() && !nifValido(d.nif)).map((d) => d.nome || "(sem nome)");
  }

  function moradaImovelComposta(): string {
    return [ruaImovel, numeroImovel ? `n.º ${numeroImovel}` : "", andarImovel].filter(Boolean).join(", ");
  }

  async function criarProcesso(supabase: ReturnType<typeof sbBrowser>, donoId: string) {
    const doisLadosNossos = tipoContrato === "angariacao_nossa_comprador_nosso";
    return supabase
      .from("cpcv_processos")
      .insert({
        criado_por: donoId,
        tipo_contrato: tipoContrato,
        agente_angariacao_id: doisLadosNossos ? agenteAngariacaoId ?? donoId : null,
        agente_comprador_id: doisLadosNossos ? agenteCompradorId ?? donoId : null,
        imovel_licenca_utilizacao: licencaUtilizacao || null,
        imovel_certificado_energetico: certificadoEnergetico || null,
        imovel_morada: moradaImovelComposta() || null,
        imovel_codigo_postal: codigoPostalImovel || null,
        imovel_localidade: localidadeImovel || null,
        imovel_freguesia: freguesiaImovel || null,
        imovel_concelho: concelhoImovel || null,
        imovel_distrito: distritoImovel || null,
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

    return enviarFicheirosDasPartes(supabase, processoId, donoId, grupos);
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

        const { error: ficheiroError } = await supabase.from("cpcv_ficheiros").insert({
          processo_id: processo.id,
          tipo,
          storage_path: path,
          nome_original: file.name,
        });

        if (ficheiroError) {
          setError(`Erro a registar ${file.name}: ${ficheiroError.message}`);
          setLoading(false);
          return;
        }
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
    const c = CORES_SECAO.azul;
    return (
      <div className="space-y-2">
        {TIPOS_IMOVEL.map((t) => {
          const docs = ficheiros.map((f, i) => ({ ...f, i })).filter((f) => f.tipo === t.value);
          const tem = docs.length > 0;
          return (
            <div key={t.value} className="border border-[#E2E8F0] rounded-xl px-3 py-2.5 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${tem ? "bg-[#ECFDF3] text-[#15803D]" : `${c.chipBg} ${c.icone}`}`}>
                    {tem ? (
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                        <path d="M5 13l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                        <path d="M7 3.5h7l3.5 3.5V20a.5.5 0 01-.5.5H7a.5.5 0 01-.5-.5V4a.5.5 0 01.5-.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="text-sm text-[#0F172A] leading-tight">
                    {t.label}
                    {t.opcional && <span className="text-[#94A3B8] font-normal"> (opcional)</span>}
                  </span>
                </div>
                <label className={`shrink-0 cursor-pointer text-xs font-semibold hover:underline ${c.link}`}>
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

      <PassoCard numero={passoTipoContrato} total={TOTAL_PASSOS} cor="neutro" titulo="Tipo de contrato">
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
              className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
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

        <div className="space-y-2">
          {TIPOS_CONTRATO.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipoContrato(t.value)}
              className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-colors ${
                tipoContrato === t.value
                  ? "border-[#0071e3] bg-[#EFF6FF] text-[#0F172A] font-semibold"
                  : "border-[#E2E8F0] bg-white text-[#475569] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tipoContrato === "angariacao_nossa_comprador_nosso" && (
          <div className={`${grupoClass} space-y-4`}>
            <p className={subTituloClass}>Quem trouxe cada lado do negócio</p>
            <SeletorAgente label="Agente da angariação" agentes={agentes} valorId={agenteAngariacaoId} onChange={setAgenteAngariacaoId} />
            <SeletorAgente label="Agente do comprador" agentes={agentes} valorId={agenteCompradorId} onChange={setAgenteCompradorId} />
          </div>
        )}
      </PassoCard>

      {!angariacaoExterna && passoImovel && (
        <PassoCard numero={passoImovel} total={TOTAL_PASSOS} cor="azul" icone={IconesSecao.predio} titulo="Documentos do imóvel" subtitulo="Certidão, caderneta, energético">
          <div>
            <p className={subTituloClass}>Documentos</p>
            {blocoDocumentosImovel()}
            {aAnalisarImovel && (
              <p className={`text-xs mt-2 flex items-center gap-1.5 ${CORES_SECAO.azul.link}`}>
                <Spinner className="h-3.5 w-3.5" /> A ler o documento e a preencher a morada, a licença e o certificado...
              </p>
            )}
            {erroCampoImovel && <p className="text-xs text-red-500 mt-2">{erroCampoImovel}</p>}
          </div>

          <div className={grupoClass}>
            <p className={subTituloClass}>Morada do imóvel</p>
            <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-[#94A3B8] mb-1">Rua / Avenida</label>
                <input
                  value={ruaImovel}
                  onChange={(e) => setRuaImovel(e.target.value)}
                  className={`w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm bg-white transition-colors focus:outline-none focus:ring-2 ${CORES_SECAO.azul.anel}`}
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">Número</label>
                <input
                  value={numeroImovel}
                  onChange={(e) => setNumeroImovel(e.target.value)}
                  className={`w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm bg-white transition-colors focus:outline-none focus:ring-2 ${CORES_SECAO.azul.anel}`}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">Andar / Fração</label>
                <input
                  value={andarImovel}
                  onChange={(e) => setAndarImovel(e.target.value)}
                  className={`w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm bg-white transition-colors focus:outline-none focus:ring-2 ${CORES_SECAO.azul.anel}`}
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">Código postal</label>
                <input
                  value={codigoPostalImovel}
                  onChange={(e) => setCodigoPostalImovel(e.target.value)}
                  placeholder="0000-000"
                  className={`w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm bg-white transition-colors focus:outline-none focus:ring-2 ${CORES_SECAO.azul.anel}`}
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">Localidade</label>
                <input
                  value={localidadeImovel}
                  onChange={(e) => setLocalidadeImovel(e.target.value)}
                  className={`w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm bg-white transition-colors focus:outline-none focus:ring-2 ${CORES_SECAO.azul.anel}`}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">Freguesia</label>
                <input
                  value={freguesiaImovel}
                  onChange={(e) => setFreguesiaImovel(e.target.value)}
                  className={`w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm bg-white transition-colors focus:outline-none focus:ring-2 ${CORES_SECAO.azul.anel}`}
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">Concelho</label>
                <input
                  value={concelhoImovel}
                  onChange={(e) => setConcelhoImovel(e.target.value)}
                  className={`w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm bg-white transition-colors focus:outline-none focus:ring-2 ${CORES_SECAO.azul.anel}`}
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#94A3B8] mb-1">Distrito</label>
                <input
                  value={distritoImovel}
                  onChange={(e) => setDistritoImovel(e.target.value)}
                  className={`w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm bg-white transition-colors focus:outline-none focus:ring-2 ${CORES_SECAO.azul.anel}`}
                />
              </div>
            </div>
            </div>
          </div>

          <div className={grupoClass}>
            <p className={subTituloClass}>Documentos obrigatórios</p>
            <div className="space-y-3">
            <div>
              <label htmlFor="licencaUtilizacao" className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B] font-medium mb-1">
                Licença de utilização
                <span className="inline-flex items-center rounded-full bg-[#FFF4E5] text-[#9A5B00] text-[10px] font-semibold px-1.5 py-0.5">
                  Obrigatória
                </span>
              </label>
              <input
                id="licencaUtilizacao"
                value={licencaUtilizacao}
                onChange={(e) => setLicencaUtilizacao(e.target.value)}
                className={`w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white transition-colors focus:outline-none focus:ring-2 ${CORES_SECAO.azul.anel}`}
              />
            </div>
            <div>
              <label htmlFor="certificadoEnergetico" className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B] font-medium mb-1">
                Certificado energético
                <span className="inline-flex items-center rounded-full bg-[#FFF4E5] text-[#9A5B00] text-[10px] font-semibold px-1.5 py-0.5">
                  Obrigatório
                </span>
              </label>
              <input
                id="certificadoEnergetico"
                value={certificadoEnergetico}
                onChange={(e) => setCertificadoEnergetico(e.target.value)}
                className={`w-full border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-sm bg-white transition-colors focus:outline-none focus:ring-2 ${CORES_SECAO.azul.anel}`}
              />
            </div>
            </div>
          </div>
        </PassoCard>
      )}

      {!angariacaoExterna && passoProprietario && (
        <PassoCard numero={passoProprietario} total={TOTAL_PASSOS} cor="ambar" icone={IconesSecao.chave} titulo="Documentos do proprietário" subtitulo="Quem vende o imóvel">
          <div className="space-y-3">
            {vendedores.map((v, i) => (
              <ParteCampos
                key={i}
                titulo={`Vendedor ${i + 1}`}
                draft={v}
                cor="ambar"
                comUploadFicheiro
                estruturado
                onChange={(next) => setVendedores((prev) => prev.map((d, idx) => (idx === i ? next : d)))}
                onRemover={vendedores.length > 1 ? () => setVendedores((prev) => prev.filter((_, idx) => idx !== i)) : undefined}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setVendedores((prev) => [...prev, parteDraftVazia()])}
            className={`text-xs font-semibold hover:underline ${CORES_SECAO.ambar.link}`}
          >
            + Adicionar vendedor
          </button>
        </PassoCard>
      )}

      <PassoCard numero={passoComprador} total={TOTAL_PASSOS} cor="verde" icone={IconesSecao.carrinho} titulo="Documentos do comprador" subtitulo="Quem compra o imóvel">
        <div className="space-y-3">
          {compradores.map((c, i) => (
            <ParteCampos
              key={i}
              titulo={`Comprador ${i + 1}`}
              draft={c}
              cor="verde"
              comUploadFicheiro
              estruturado
              onChange={(next) => setCompradores((prev) => prev.map((d, idx) => (idx === i ? next : d)))}
              onRemover={compradores.length > 1 ? () => setCompradores((prev) => prev.filter((_, idx) => idx !== i)) : undefined}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCompradores((prev) => [...prev, parteDraftVazia()])}
          className={`text-xs font-semibold hover:underline ${CORES_SECAO.verde.link}`}
        >
          + Adicionar comprador
        </button>
      </PassoCard>

      <PassoCard numero={passoOutros} total={TOTAL_PASSOS} cor="neutro" icone={IconesSecao.caixa} titulo="Outros documentos">
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-[#0F172A] font-medium">Qualquer outro documento relevante</span>
            <label className={`shrink-0 cursor-pointer text-xs font-semibold hover:underline ${CORES_SECAO.neutro.link}`}>
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
      </PassoCard>

      <PassoCard numero={passoInfo} total={TOTAL_PASSOS} cor="neutro" titulo="Informação adicional">
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
            className="w-full border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]"
          />
        </div>
      </PassoCard>

      <div className="space-y-3">
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
