"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";
import { removerCamposPreenchidosNoFormulario } from "@/lib/cpcv-perguntas-filtro";
import { btnPrimary, Spinner } from "../ui";

type Processo = {
  id: string;
  estado: string;
  campos_em_falta: { campo: string; pergunta: string }[] | null;
  tipo_contrato: string;
  id_angariacao: string | null;
  email_processual_agencia: string | null;
  imovel_licenca_utilizacao: string | null;
  imovel_certificado_energetico: string | null;
  metodo_pagamento: string | null;
  tem_fracoes_multiplas: boolean | null;
  valor_fracao_principal: number | null;
  valor_fracao_secundaria: number | null;
  valor_mobilia: number | null;
  reforco_sinal: string | null;
  iban_sinal: string | null;
  reserva: boolean | null;
  valor_reserva: number | null;
  condicionado_avaliacao: boolean | null;
  valor_avaliacao_minimo: number | null;
  condicionado_financiamento: boolean | null;
  condicionado_outra_situacao: string | null;
  dias_condicionamento: number | null;
  dias_condicionamento_tipo: string | null;
  comodato: boolean | null;
  tempo_comodato: string | null;
  incluidos_no_imovel: string | null;
  email_proprietario_contrato: string | null;
  email_comprador_contrato: string | null;
  data_assinatura_contrato: string | null;
  observacoes_adicionais: string | null;
};

function simNao(v: boolean | null): string {
  if (v === true) return "sim";
  if (v === false) return "nao";
  return "";
}

export default function CondicoesNegocio({ processo }: { processo: Processo }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [erro, setErro] = useState("");

  const [idAngariacao, setIdAngariacao] = useState(processo.id_angariacao ?? "");
  const [emailProcessual, setEmailProcessual] = useState(processo.email_processual_agencia ?? "");
  const [licencaUtilizacao, setLicencaUtilizacao] = useState(processo.imovel_licenca_utilizacao ?? "");
  const [certificadoEnergetico, setCertificadoEnergetico] = useState(processo.imovel_certificado_energetico ?? "");
  const [metodoPagamento, setMetodoPagamento] = useState(processo.metodo_pagamento ?? "");
  const [temFracoes, setTemFracoes] = useState(processo.tem_fracoes_multiplas ?? false);
  const [valorFracaoPrincipal, setValorFracaoPrincipal] = useState(processo.valor_fracao_principal?.toString() ?? "");
  const [valorFracaoSecundaria, setValorFracaoSecundaria] = useState(processo.valor_fracao_secundaria?.toString() ?? "");
  const [valorMobilia, setValorMobilia] = useState(processo.valor_mobilia?.toString() ?? "");
  const [reforcoSinal, setReforcoSinal] = useState(processo.reforco_sinal ?? "");
  const [ibanSinal, setIbanSinal] = useState(processo.iban_sinal ?? "");
  const [reserva, setReserva] = useState(simNao(processo.reserva));
  const [valorReserva, setValorReserva] = useState(processo.valor_reserva?.toString() ?? "");
  const [condAvaliacao, setCondAvaliacao] = useState(simNao(processo.condicionado_avaliacao));
  const [valorAvaliacaoMinimo, setValorAvaliacaoMinimo] = useState(processo.valor_avaliacao_minimo?.toString() ?? "");
  const [condFinanciamento, setCondFinanciamento] = useState(simNao(processo.condicionado_financiamento));
  const [condOutraSituacao, setCondOutraSituacao] = useState(processo.condicionado_outra_situacao ?? "");
  const [diasCondicionamento, setDiasCondicionamento] = useState(processo.dias_condicionamento?.toString() ?? "");
  const [diasTipo, setDiasTipo] = useState(processo.dias_condicionamento_tipo ?? "uteis");
  const [comodato, setComodato] = useState(simNao(processo.comodato));
  const [tempoComodato, setTempoComodato] = useState(processo.tempo_comodato ?? "");
  const [incluidos, setIncluidos] = useState(processo.incluidos_no_imovel ?? "");
  const [emailProprietario, setEmailProprietario] = useState(processo.email_proprietario_contrato ?? "");
  const [emailComprador, setEmailComprador] = useState(processo.email_comprador_contrato ?? "");
  const [dataAssinatura, setDataAssinatura] = useState(processo.data_assinatura_contrato ?? "");
  const [observacoes, setObservacoes] = useState(processo.observacoes_adicionais ?? "");

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
        metodo_pagamento: metodoPagamento || null,
        tem_fracoes_multiplas: temFracoes,
        valor_fracao_principal: temFracoes && valorFracaoPrincipal ? Number(valorFracaoPrincipal) : null,
        valor_fracao_secundaria: temFracoes && valorFracaoSecundaria ? Number(valorFracaoSecundaria) : null,
        valor_mobilia: valorMobilia ? Number(valorMobilia) : null,
        reforco_sinal: reforcoSinal || null,
        iban_sinal: ibanSinal || null,
        reserva: reserva ? reserva === "sim" : null,
        valor_reserva: reserva === "sim" && valorReserva ? Number(valorReserva) : null,
        condicionado_avaliacao: condAvaliacao ? condAvaliacao === "sim" : null,
        valor_avaliacao_minimo: condAvaliacao === "sim" && valorAvaliacaoMinimo ? Number(valorAvaliacaoMinimo) : null,
        condicionado_financiamento: condFinanciamento ? condFinanciamento === "sim" : null,
        condicionado_outra_situacao: condOutraSituacao || null,
        dias_condicionamento: diasCondicionamento ? Number(diasCondicionamento) : null,
        dias_condicionamento_tipo: diasCondicionamento ? diasTipo : null,
        comodato: comodato ? comodato === "sim" : null,
        tempo_comodato: comodato === "sim" ? tempoComodato || null : null,
        incluidos_no_imovel: incluidos || null,
        email_proprietario_contrato: emailProprietario || null,
        email_comprador_contrato: emailComprador || null,
        data_assinatura_contrato: dataAssinatura || null,
        observacoes_adicionais: observacoes || null,
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

  const campoClass =
    "w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#2E6DB4]";
  const labelClass = "block text-xs font-semibold text-[#475569] mb-1";
  // Secções só para orientação visual (nunca escondem nada) - o formulário tinha ~20 campos
  // numa grelha só, sem nenhuma pista de qual assunto cada um pertencia.
  const seccaoClass = "pt-4 mt-4 border-t border-[#F1F5F9] first:pt-0 first:mt-0 first:border-t-0";
  const tituloSeccaoClass = "text-[11px] font-bold uppercase tracking-wide text-[#94A3B8] mb-3";

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex items-center justify-between w-full text-left group"
      >
        <h2 className="text-sm font-semibold text-[#0F172A]">Condições do negócio</h2>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2E6DB4] group-hover:text-[#0059B3] transition-colors">
          {aberto ? "Fechar" : "Abrir"}
          <svg
            className={`h-3 w-3 transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}
            viewBox="0 0 12 12"
            fill="none"
          >
            <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {aberto && (
        <div className="mt-4">
          <p className="text-xs text-[#94A3B8] mb-4 -mt-1">
            Estes campos ficam sempre aqui, nunca no chat com a IA - método de pagamento, IBAN,
            reserva, condições suspensivas e comodato decidem cláusulas legais exactas do
            contrato, por isso são sempre confirmados directamente por ti, não adivinhados a
            partir de texto.
          </p>

          <div className={seccaoClass}>
            <h3 className={tituloSeccaoClass}>Documentos obrigatórios</h3>
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
          </div>

          <div className={seccaoClass}>
            <h3 className={tituloSeccaoClass}>Referência interna</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="idAngariacao" className={labelClass}>{angariacaoExterna ? "ID/referência da angariação externa" : "ID da angariação (maxwork)"}</label>
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

          <div className={seccaoClass}>
            <h3 className={tituloSeccaoClass}>Pagamento</h3>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="metodoPagamento" className={labelClass}>Método de pagamento</label>
                  <select id="metodoPagamento" value={metodoPagamento} onChange={(e) => setMetodoPagamento(e.target.value)} className={campoClass}>
                    <option value="">-</option>
                    <option value="capital_proprio">Capital próprio</option>
                    <option value="financiamento">Financiamento</option>
                    <option value="misto">Misto</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="valorMobilia" className={labelClass}>Valor atribuído à mobília</label>
                  <input id="valorMobilia" type="number" value={valorMobilia} onChange={(e) => setValorMobilia(e.target.value)} className={campoClass} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reforcoSinal" className={labelClass}>Reforço de sinal (opcional)</label>
                  <input id="reforcoSinal" value={reforcoSinal} onChange={(e) => setReforcoSinal(e.target.value)} className={campoClass} />
                </div>
                <div>
                  <label htmlFor="ibanSinal" className={labelClass}>IBAN para envio do sinal</label>
                  <input id="ibanSinal" value={ibanSinal} onChange={(e) => setIbanSinal(e.target.value)} className={campoClass} />
                </div>
              </div>
            </div>
          </div>

          <div className={seccaoClass}>
            <h3 className={tituloSeccaoClass}>Fracções</h3>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#475569]">
              <input type="checkbox" checked={temFracoes} onChange={(e) => setTemFracoes(e.target.checked)} />
              Há 2 fracções (ex.: apartamento + garagem)
            </label>
            {temFracoes && (
              <div className="grid sm:grid-cols-2 gap-4 mt-2">
                <div>
                  <label htmlFor="valorFracaoPrincipal" className={labelClass}>Valor da fracção principal</label>
                  <input id="valorFracaoPrincipal" type="number" value={valorFracaoPrincipal} onChange={(e) => setValorFracaoPrincipal(e.target.value)} className={campoClass} />
                </div>
                <div>
                  <label htmlFor="valorFracaoSecundaria" className={labelClass}>Valor da 2ª fracção (garagem, etc.)</label>
                  <input id="valorFracaoSecundaria" type="number" value={valorFracaoSecundaria} onChange={(e) => setValorFracaoSecundaria(e.target.value)} className={campoClass} />
                </div>
              </div>
            )}
          </div>

          <div className={seccaoClass}>
            <h3 className={tituloSeccaoClass}>Reserva</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="reserva" className={labelClass}>Reserva</label>
                <select id="reserva" value={reserva} onChange={(e) => setReserva(e.target.value)} className={campoClass}>
                  <option value="">-</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
              {reserva === "sim" && (
                <div>
                  <label htmlFor="valorReserva" className={labelClass}>Valor da reserva</label>
                  <input id="valorReserva" type="number" value={valorReserva} onChange={(e) => setValorReserva(e.target.value)} className={campoClass} />
                </div>
              )}
            </div>
          </div>

          <div className={seccaoClass}>
            <h3 className={tituloSeccaoClass}>Condições suspensivas</h3>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="condAvaliacao" className={labelClass}>Condicionado à avaliação</label>
                  <select id="condAvaliacao" value={condAvaliacao} onChange={(e) => setCondAvaliacao(e.target.value)} className={campoClass}>
                    <option value="">-</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </select>
                </div>
                {condAvaliacao === "sim" && (
                  <div>
                    <label htmlFor="valorAvaliacaoMinimo" className={labelClass}>Igual ou superior a que valor?</label>
                    <input id="valorAvaliacaoMinimo" type="number" value={valorAvaliacaoMinimo} onChange={(e) => setValorAvaliacaoMinimo(e.target.value)} className={campoClass} />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="condFinanciamento" className={labelClass}>Condicionado ao financiamento</label>
                <select id="condFinanciamento" value={condFinanciamento} onChange={(e) => setCondFinanciamento(e.target.value)} className={campoClass}>
                  <option value="">-</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>

              <div>
                <label htmlFor="condOutraSituacao" className={labelClass}>Condicionado a alguma outra situação? (opcional)</label>
                <textarea id="condOutraSituacao" value={condOutraSituacao} onChange={(e) => setCondOutraSituacao(e.target.value)} rows={2} className={campoClass} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="diasCondicionamento" className={labelClass}>Dias de condicionamento</label>
                  <input id="diasCondicionamento" type="number" value={diasCondicionamento} onChange={(e) => setDiasCondicionamento(e.target.value)} className={campoClass} />
                </div>
                <div>
                  <label htmlFor="diasTipo" className={labelClass}>Úteis ou corridos?</label>
                  <select id="diasTipo" value={diasTipo} onChange={(e) => setDiasTipo(e.target.value)} className={campoClass}>
                    <option value="uteis">Úteis</option>
                    <option value="corridos">Corridos</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className={seccaoClass}>
            <h3 className={tituloSeccaoClass}>Comodato</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="comodato" className={labelClass}>Necessidade de comodato</label>
                <select id="comodato" value={comodato} onChange={(e) => setComodato(e.target.value)} className={campoClass}>
                  <option value="">-</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                </select>
              </div>
              {comodato === "sim" && (
                <div>
                  <label htmlFor="tempoComodato" className={labelClass}>Quanto tempo o proprietário fica?</label>
                  <input id="tempoComodato" value={tempoComodato} onChange={(e) => setTempoComodato(e.target.value)} className={campoClass} />
                </div>
              )}
            </div>
          </div>

          <div className={seccaoClass}>
            <h3 className={tituloSeccaoClass}>Imóvel e contrato</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="incluidos" className={labelClass}>O que fica incluído no imóvel</label>
                <textarea id="incluidos" value={incluidos} onChange={(e) => setIncluidos(e.target.value)} rows={2} className={campoClass} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="emailProprietario" className={labelClass}>Email do proprietário (para o contrato)</label>
                  <input id="emailProprietario" value={emailProprietario} onChange={(e) => setEmailProprietario(e.target.value)} className={campoClass} />
                </div>
                <div>
                  <label htmlFor="emailComprador" className={labelClass}>Email do comprador (para o contrato)</label>
                  <input id="emailComprador" value={emailComprador} onChange={(e) => setEmailComprador(e.target.value)} className={campoClass} />
                </div>
              </div>

              <div>
                <label htmlFor="dataAssinatura" className={labelClass}>Data de assinatura do contrato</label>
                <input id="dataAssinatura" type="date" value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} className={campoClass} />
              </div>

              <div>
                <label htmlFor="observacoes" className={labelClass}>Observações adicionais</label>
                <textarea id="observacoes" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className={campoClass} />
              </div>
            </div>
          </div>

          {erro && <p className="text-xs text-red-500 mt-4">{erro}</p>}

          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-[#F1F5F9]">
            {guardado && <p className="text-xs font-medium text-[#1FAE5A]">Guardado.</p>}
            <button onClick={guardar} disabled={guardando} className={btnPrimary}>
              {guardando && <Spinner className="h-3.5 w-3.5" />}
              {guardando ? "A guardar..." : "Guardar condições"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
