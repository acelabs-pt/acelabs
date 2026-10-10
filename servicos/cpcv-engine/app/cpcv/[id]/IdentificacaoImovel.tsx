"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";
import { btnDanger, btnPrimary, btnSecondary, CabecalhoSecao, CORES_SECAO, grupoClass, IconesSecao, Spinner, subTituloClass } from "../ui";

// Campos da nova Cláusula Primeira (ver lib/cpcv-clausulas.ts, pontosClausulaPrimeira) - só
// usados quando o imóvel é mesmo uma fracção autónoma em regime de propriedade horizontal
// (nunca inferido pela IA, é sempre uma resposta explícita aqui). Para moradias/terrenos, a
// Cláusula Primeira mantém-se no texto genérico actual e estes campos ficam irrelevantes.
// Tudo 100% manual (sem sugestão por IA, ao contrário de app/cpcv/novo/page.tsx) de propósito -
// são dados juridicamente determinantes (mudam a redacção inteira da cláusula), não vale a pena
// arriscar a IA a lê-los mal.
type Processo = {
  id: string;
  imovel_e_fracao_autonoma: boolean | null;
  imovel_fracao_letra: string | null;
  imovel_andar_fracao: string | null;
  imovel_orientacao: string | null;
  imovel_finalidade: string | null;
  imovel_conservatoria: string | null;
  imovel_licenca_data_emissao: string | null;
  imovel_licenca_entidade_emissora: string | null;
  imovel_certificado_validade: string | null;
  imovel_certificado_classe: string | null;
  hipotecas_verificadas: boolean;
};

type HipotecaLinha = {
  id: string;
  entidade_credora: string;
  natureza: string | null;
  numero_apresentacao: string | null;
  data_registo: string | null;
};

type Ficheiro = { tipo: string; storage_path: string };

type HipotecaDraft = { id?: string; entidadeCredora: string; natureza: string; numeroApresentacao: string; dataRegisto: string };

function hipotecaDraftDeLinha(h: HipotecaLinha): HipotecaDraft {
  return {
    id: h.id,
    entidadeCredora: h.entidade_credora ?? "",
    natureza: h.natureza ?? "",
    numeroApresentacao: h.numero_apresentacao ?? "",
    dataRegisto: h.data_registo ?? "",
  };
}

function hipotecaDraftVazia(): HipotecaDraft {
  return { entidadeCredora: "", natureza: "", numeroApresentacao: "", dataRegisto: "" };
}

export default function IdentificacaoImovel({
  processo,
  ficheiros,
  hipotecasIniciais,
}: {
  processo: Processo;
  ficheiros: Ficheiro[];
  hipotecasIniciais: HipotecaLinha[];
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [erro, setErro] = useState("");

  const [eFracao, setEFracao] = useState<"" | "sim" | "nao">(
    processo.imovel_e_fracao_autonoma === true ? "sim" : processo.imovel_e_fracao_autonoma === false ? "nao" : ""
  );
  const [fracaoLetra, setFracaoLetra] = useState(processo.imovel_fracao_letra ?? "");
  const [andarFracao, setAndarFracao] = useState(processo.imovel_andar_fracao ?? "");
  const [orientacao, setOrientacao] = useState(processo.imovel_orientacao ?? "");
  const [finalidade, setFinalidade] = useState(processo.imovel_finalidade ?? "");
  const [conservatoria, setConservatoria] = useState(processo.imovel_conservatoria ?? "");
  const [licencaDataEmissao, setLicencaDataEmissao] = useState(processo.imovel_licenca_data_emissao ?? "");
  const [licencaEntidade, setLicencaEntidade] = useState(processo.imovel_licenca_entidade_emissora ?? "");
  const [certificadoValidade, setCertificadoValidade] = useState(processo.imovel_certificado_validade ?? "");
  const [certificadoClasse, setCertificadoClasse] = useState(processo.imovel_certificado_classe ?? "");

  const [hipotecas, setHipotecas] = useState<HipotecaDraft[]>(hipotecasIniciais.map(hipotecaDraftDeLinha));
  const [hipotecasVerificadas, setHipotecasVerificadas] = useState(processo.hipotecas_verificadas);
  const [aAnalisar, setAAnalisar] = useState(false);
  const [erroAnalise, setErroAnalise] = useState("");

  const certidoesPrediais = ficheiros.filter((f) => f.tipo === "certidao_predial");

  function atualizarHipoteca<K extends keyof HipotecaDraft>(i: number, campo: K, valor: HipotecaDraft[K]) {
    setHipotecas((atual) => atual.map((h, idx) => (idx === i ? { ...h, [campo]: valor } : h)));
    setHipotecasVerificadas(false);
  }

  function adicionarHipoteca() {
    setHipotecas((atual) => [...atual, hipotecaDraftVazia()]);
    setHipotecasVerificadas(false);
  }

  function removerHipoteca(i: number) {
    setHipotecas((atual) => atual.filter((_, idx) => idx !== i));
    setHipotecasVerificadas(false);
  }

  async function analisarCertidao() {
    if (certidoesPrediais.length === 0) return;
    setAAnalisar(true);
    setErroAnalise("");
    try {
      const res = await fetch("/api/cpcv/extrair-hipotecas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caminhos: certidoesPrediais.map((f) => f.storage_path) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroAnalise(data.error ?? "Erro ao analisar a certidão predial.");
        return;
      }
      if (data.estado !== "concluida") {
        setErroAnalise(
          data.estado === "sem_documento"
            ? "A IA não conseguiu identificar uma certidão predial legível nos documentos carregados."
            : "A IA não teve a certeza de ter lido a secção de ónus/encargos completa - confirma à mão antes de aprovar."
        );
      }
      const sugeridas: HipotecaDraft[] = (
        data.hipotecas as { entidade_credora: string; natureza: string | null; numero_apresentacao: string | null; data_registo: string | null }[]
      ).map((h) => ({
        entidadeCredora: h.entidade_credora ?? "",
        natureza: h.natureza ?? "",
        numeroApresentacao: h.numero_apresentacao ?? "",
        dataRegisto: h.data_registo ?? "",
      }));
      if (sugeridas.length > 0) {
        setHipotecas((atual) => [...atual, ...sugeridas]);
        setHipotecasVerificadas(false);
      }
    } catch {
      setErroAnalise("Erro de rede ao analisar a certidão predial.");
    } finally {
      setAAnalisar(false);
    }
  }

  async function guardar() {
    setGuardando(true);
    setGuardado(false);
    setErro("");

    const supabase = sbBrowser();

    const { error: processoError } = await supabase
      .from("cpcv_processos")
      .update({
        imovel_e_fracao_autonoma: eFracao === "" ? null : eFracao === "sim",
        imovel_fracao_letra: fracaoLetra.trim() || null,
        imovel_andar_fracao: andarFracao.trim() || null,
        imovel_orientacao: orientacao.trim() || null,
        imovel_finalidade: finalidade.trim() || null,
        imovel_conservatoria: conservatoria.trim() || null,
        imovel_licenca_data_emissao: licencaDataEmissao || null,
        imovel_licenca_entidade_emissora: licencaEntidade.trim() || null,
        imovel_certificado_validade: certificadoValidade || null,
        imovel_certificado_classe: certificadoClasse.trim() || null,
        hipotecas_verificadas: hipotecasVerificadas,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", processo.id);

    if (processoError) {
      setErro(processoError.message);
      setGuardando(false);
      return;
    }

    // Mesmo padrão de DadosPartes.tsx: compara a lista actual com os ids capturados na
    // montagem e faz update/insert/delete directo - nunca delete-and-reinsert cego de tudo,
    // que já se provou frágil para dados legais noutra tabela deste projecto (cpcv_partes).
    const idsAtuais = hipotecas.filter((h) => h.id).map((h) => h.id as string);
    const idsRemovidos = hipotecasIniciais.map((h) => h.id).filter((id) => !idsAtuais.includes(id));

    if (idsRemovidos.length > 0) {
      const { error } = await supabase.from("cpcv_hipotecas").delete().in("id", idsRemovidos);
      if (error) {
        setErro(error.message);
        setGuardando(false);
        return;
      }
    }

    for (const h of hipotecas) {
      if (!h.entidadeCredora.trim()) continue;
      const linha = {
        processo_id: processo.id,
        entidade_credora: h.entidadeCredora.trim(),
        natureza: h.natureza.trim() || null,
        numero_apresentacao: h.numeroApresentacao.trim() || null,
        data_registo: h.dataRegisto || null,
      };
      const { error } = h.id
        ? await supabase.from("cpcv_hipotecas").update(linha).eq("id", h.id)
        : await supabase.from("cpcv_hipotecas").insert(linha);
      if (error) {
        setErro(error.message);
        setGuardando(false);
        return;
      }
    }

    setGuardando(false);
    setGuardado(true);
    router.refresh();
    setTimeout(() => setGuardado(false), 2500);
  }

  const c = CORES_SECAO.azul;
  const campoClass = `w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 ${c.anel}`;
  const labelClass = "block text-xs font-semibold text-[#475569] mb-1";

  return (
    <div className={`bg-white rounded-2xl border border-[#E2E8F0] border-t-4 ${c.topo} shadow-sm p-5 space-y-4`}>
      <CabecalhoSecao
        cor="azul"
        icone={IconesSecao.predio}
        titulo="Identificação do imóvel"
        subtitulo="Fracção autónoma e hipotecas, para a Cláusula Primeira do CPCV"
      />

      <div>
        <label htmlFor="eFracao" className={labelClass}>
          É fracção autónoma (apartamento em regime de propriedade horizontal)?
        </label>
        <select
          id="eFracao"
          value={eFracao}
          onChange={(e) => setEFracao(e.target.value as "" | "sim" | "nao")}
          className={campoClass}
        >
          <option value="">Por responder</option>
          <option value="sim">Sim</option>
          <option value="nao">Não (moradia, terreno, prédio inteiro...)</option>
        </select>
      </div>

      {eFracao === "sim" && (
        <div className={grupoClass}>
          <p className={subTituloClass}>Fracção</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fracaoLetra" className={labelClass}>
                Letra da fracção
              </label>
              <input id="fracaoLetra" value={fracaoLetra} onChange={(e) => setFracaoLetra(e.target.value)} className={campoClass} />
            </div>
            <div>
              <label htmlFor="andarFracao" className={labelClass}>
                Andar / localização
              </label>
              <input
                id="andarFracao"
                value={andarFracao}
                onChange={(e) => setAndarFracao(e.target.value)}
                placeholder="quinto andar centro"
                className={campoClass}
              />
            </div>
            <div>
              <label htmlFor="orientacao" className={labelClass}>
                Orientação <span className="text-[#94A3B8] font-normal">(opcional)</span>
              </label>
              <input id="orientacao" value={orientacao} onChange={(e) => setOrientacao(e.target.value)} placeholder="nascente" className={campoClass} />
            </div>
            <div>
              <label htmlFor="finalidade" className={labelClass}>
                Finalidade
              </label>
              <input id="finalidade" value={finalidade} onChange={(e) => setFinalidade(e.target.value)} placeholder="habitação" className={campoClass} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="conservatoria" className={labelClass}>
                Conservatória do Registo Predial
              </label>
              <input id="conservatoria" value={conservatoria} onChange={(e) => setConservatoria(e.target.value)} className={campoClass} />
            </div>
          </div>

          <p className={`${subTituloClass} mt-4`}>Licença de utilização</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="licencaDataEmissao" className={labelClass}>
                Data de emissão
              </label>
              <input
                id="licencaDataEmissao"
                type="date"
                value={licencaDataEmissao}
                onChange={(e) => setLicencaDataEmissao(e.target.value)}
                className={campoClass}
              />
            </div>
            <div>
              <label htmlFor="licencaEntidade" className={labelClass}>
                Entidade emissora
              </label>
              <input id="licencaEntidade" value={licencaEntidade} onChange={(e) => setLicencaEntidade(e.target.value)} className={campoClass} />
            </div>
          </div>

          <p className={`${subTituloClass} mt-4`}>Certificado energético</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="certificadoValidade" className={labelClass}>
                Validade
              </label>
              <input
                id="certificadoValidade"
                type="date"
                value={certificadoValidade}
                onChange={(e) => setCertificadoValidade(e.target.value)}
                className={campoClass}
              />
            </div>
            <div>
              <label htmlFor="certificadoClasse" className={labelClass}>
                Classe energética
              </label>
              <input
                id="certificadoClasse"
                value={certificadoClasse}
                onChange={(e) => setCertificadoClasse(e.target.value)}
                placeholder="B-"
                className={campoClass}
              />
            </div>
          </div>
        </div>
      )}

      <div className={grupoClass}>
        <p className={subTituloClass}>Hipotecas sobre o imóvel</p>
        <div className="space-y-2">
          {hipotecas.map((h, i) => (
            <div key={h.id ?? `nova-${i}`} className="grid sm:grid-cols-[2fr_1.4fr_1fr_1fr_auto] gap-2 items-end">
              <div>
                <label className={labelClass}>Entidade credora</label>
                <input value={h.entidadeCredora} onChange={(e) => atualizarHipoteca(i, "entidadeCredora", e.target.value)} className={campoClass} />
              </div>
              <div>
                <label className={labelClass}>Natureza</label>
                <input
                  value={h.natureza}
                  onChange={(e) => atualizarHipoteca(i, "natureza", e.target.value)}
                  placeholder="Hipoteca voluntária"
                  className={campoClass}
                />
              </div>
              <div>
                <label className={labelClass}>Nº apresentação</label>
                <input
                  value={h.numeroApresentacao}
                  onChange={(e) => atualizarHipoteca(i, "numeroApresentacao", e.target.value)}
                  placeholder="AP.3661"
                  className={campoClass}
                />
              </div>
              <div>
                <label className={labelClass}>Data do registo</label>
                <input type="date" value={h.dataRegisto} onChange={(e) => atualizarHipoteca(i, "dataRegisto", e.target.value)} className={campoClass} />
              </div>
              <button type="button" onClick={() => removerHipoteca(i)} className={btnDanger}>
                Remover
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button type="button" onClick={adicionarHipoteca} className={btnSecondary}>
            + Adicionar hipoteca
          </button>
          {certidoesPrediais.length > 0 && (
            <button type="button" onClick={analisarCertidao} disabled={aAnalisar} className={btnSecondary}>
              {aAnalisar && <Spinner className="h-3.5 w-3.5" />}
              {aAnalisar ? "A analisar..." : "Analisar certidão predial"}
            </button>
          )}
        </div>
        {erroAnalise && <p className="text-xs text-[#9A5B00] mt-2">{erroAnalise}</p>}

        <label className="flex items-start gap-2 text-xs text-[#475569] mt-3">
          <input
            type="checkbox"
            checked={hipotecasVerificadas}
            onChange={(e) => setHipotecasVerificadas(e.target.checked)}
            className="mt-0.5"
          />
          Confirmo que revi a certidão predial e registei todas as hipotecas existentes (ou não existem).
        </label>
      </div>

      {erro && <p className="text-xs text-red-500">{erro}</p>}

      <div className="flex items-center justify-end gap-3">
        {guardado && <p className="text-xs font-medium text-[#1FAE5A]">Guardado.</p>}
        <button onClick={guardar} disabled={guardando} className={btnPrimary}>
          {guardando && <Spinner className="h-3.5 w-3.5" />}
          {guardando ? "A guardar..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
