"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";
import { removerCamposPreenchidosNoFormulario } from "@/lib/cpcv-perguntas-filtro";
import { btnPrimary, CabecalhoSecao, CORES_SECAO, grupoClass, IconesSecao, Spinner, subTituloClass } from "../ui";

type Processo = {
  id: string;
  estado: string;
  campos_em_falta: { campo: string; pergunta: string }[] | null;
  tipo_contrato: string;
  id_angariacao: string | null;
  email_processual_agencia: string | null;
  imovel_licenca_utilizacao: string | null;
  imovel_certificado_energetico: string | null;
};

// Separado de "Condições do negócio" de propósito - licença/certificado e as referências
// internas não são condições do negócio em si (não entram em nenhuma cláusula a negociar),
// por isso ficam sempre visíveis aqui em vez de escondidos dentro daquele formulário maior.
export default function DadosApoio({ processo }: { processo: Processo }) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [erro, setErro] = useState("");

  const [idAngariacao, setIdAngariacao] = useState(processo.id_angariacao ?? "");
  const [emailProcessual, setEmailProcessual] = useState(processo.email_processual_agencia ?? "");
  const [licencaUtilizacao, setLicencaUtilizacao] = useState(processo.imovel_licenca_utilizacao ?? "");
  const [certificadoEnergetico, setCertificadoEnergetico] = useState(processo.imovel_certificado_energetico ?? "");

  const angariacaoExterna = processo.tipo_contrato === "comprador_nosso_angariacao_externa";

  async function guardar() {
    setGuardando(true);
    setGuardado(false);
    setErro("");

    const camposEmFaltaActualizados = removerCamposPreenchidosNoFormulario(processo.campos_em_falta ?? [], {
      licencaUtilizacao,
      certificadoEnergetico,
    });
    const estadoActualizado =
      processo.estado === "em_preenchimento" && camposEmFaltaActualizados.length === 0
        ? "pronto_para_aprovacao"
        : processo.estado;

    const supabase = sbBrowser();
    const { error } = await supabase
      .from("cpcv_processos")
      .update({
        id_angariacao: idAngariacao || null,
        email_processual_agencia: emailProcessual || null,
        imovel_licenca_utilizacao: licencaUtilizacao || null,
        imovel_certificado_energetico: certificadoEnergetico || null,
        campos_em_falta: camposEmFaltaActualizados,
        estado: estadoActualizado,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", processo.id);

    if (error) {
      setErro(error.message);
      setGuardando(false);
      return;
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
      <CabecalhoSecao cor="azul" icone={IconesSecao.predio} titulo="Documentos obrigatórios" subtitulo="Licença e certificado energético do imóvel" />

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="licencaUtilizacao" className={labelClass}>
            Licença de utilização <span className="text-[#9A5B00]">(obrigatória para gerar o CPCV)</span>
          </label>
          <input
            id="licencaUtilizacao"
            value={licencaUtilizacao}
            onChange={(e) => setLicencaUtilizacao(e.target.value)}
            className={campoClass}
          />
        </div>
        <div>
          <label htmlFor="certificadoEnergetico" className={labelClass}>
            Certificado energético <span className="text-[#9A5B00]">(obrigatório para gerar o CPCV)</span>
          </label>
          <input
            id="certificadoEnergetico"
            value={certificadoEnergetico}
            onChange={(e) => setCertificadoEnergetico(e.target.value)}
            className={campoClass}
          />
        </div>
      </div>

      <div className={grupoClass}>
        <p className={subTituloClass}>Referência interna</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="idAngariacao" className={labelClass}>
              {angariacaoExterna ? "ID/referência da angariação externa" : "ID da angariação (maxwork)"}
            </label>
            <input id="idAngariacao" value={idAngariacao} onChange={(e) => setIdAngariacao(e.target.value)} className={campoClass} />
          </div>
          {angariacaoExterna && (
            <div>
              <label htmlFor="emailProcessual" className={labelClass}>Email processual da agência externa</label>
              <input id="emailProcessual" value={emailProcessual} onChange={(e) => setEmailProcessual(e.target.value)} className={campoClass} />
            </div>
          )}
        </div>
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
