"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";
import { btnPrimary, Spinner } from "../ui";

type Processo = {
  id: string;
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

    const supabase = sbBrowser();
    const { error } = await supabase
      .from("cpcv_processos")
      .update({
        id_angariacao: idAngariacao || null,
        email_processual_agencia: emailProcessual || null,
        imovel_licenca_utilizacao: licencaUtilizacao || null,
        imovel_certificado_energetico: certificadoEnergetico || null,
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
        <div className="mt-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{angariacaoExterna ? "ID/referência da angariação externa" : "ID da angariação (maxwork)"}</label>
              <input value={idAngariacao} onChange={(e) => setIdAngariacao(e.target.value)} className={campoClass} />
            </div>
            {angariacaoExterna && (
              <div>
                <label className={labelClass}>Email processual da agência externa</label>
                <input value={emailProcessual} onChange={(e) => setEmailProcessual(e.target.value)} className={campoClass} />
              </div>
            )}
            <div>
              <label className={labelClass}>Método de pagamento</label>
              <select value={metodoPagamento} onChange={(e) => setMetodoPagamento(e.target.value)} className={campoClass}>
                <option value="">-</option>
                <option value="capital_proprio">Capital próprio</option>
                <option value="financiamento">Financiamento</option>
                <option value="misto">Misto</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Valor atribuído à mobília</label>
              <input type="number" value={valorMobilia} onChange={(e) => setValorMobilia(e.target.value)} className={campoClass} />
            </div>
            <div>
              <label className={labelClass}>Licença de utilização (obrigatória para gerar o CPCV)</label>
              <input
                value={licencaUtilizacao}
                onChange={(e) => setLicencaUtilizacao(e.target.value)}
                className={campoClass}
              />
            </div>
            <div>
              <label className={labelClass}>Certificado energético (obrigatório para gerar o CPCV)</label>
              <input
                value={certificadoEnergetico}
                onChange={(e) => setCertificadoEnergetico(e.target.value)}
                className={campoClass}
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#475569]">
              <input type="checkbox" checked={temFracoes} onChange={(e) => setTemFracoes(e.target.checked)} />
              Há 2 fracções (ex.: apartamento + garagem)
            </label>
            {temFracoes && (
              <div className="grid sm:grid-cols-2 gap-4 mt-2">
                <div>
                  <label className={labelClass}>Valor da fracção principal</label>
                  <input type="number" value={valorFracaoPrincipal} onChange={(e) => setValorFracaoPrincipal(e.target.value)} className={campoClass} />
                </div>
                <div>
                  <label className={labelClass}>Valor da 2ª fracção (garagem, etc.)</label>
                  <input type="number" value={valorFracaoSecundaria} onChange={(e) => setValorFracaoSecundaria(e.target.value)} className={campoClass} />
                </div>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Reforço de sinal (opcional)</label>
              <input value={reforcoSinal} onChange={(e) => setReforcoSinal(e.target.value)} className={campoClass} />
            </div>
            <div>
              <label className={labelClass}>IBAN para envio do sinal</label>
              <input value={ibanSinal} onChange={(e) => setIbanSinal(e.target.value)} className={campoClass} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Reserva</label>
              <select value={reserva} onChange={(e) => setReserva(e.target.value)} className={campoClass}>
                <option value="">-</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
            {reserva === "sim" && (
              <div>
                <label className={labelClass}>Valor da reserva</label>
                <input type="number" value={valorReserva} onChange={(e) => setValorReserva(e.target.value)} className={campoClass} />
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Condicionado à avaliação</label>
              <select value={condAvaliacao} onChange={(e) => setCondAvaliacao(e.target.value)} className={campoClass}>
                <option value="">-</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
            {condAvaliacao === "sim" && (
              <div>
                <label className={labelClass}>Igual ou superior a que valor?</label>
                <input type="number" value={valorAvaliacaoMinimo} onChange={(e) => setValorAvaliacaoMinimo(e.target.value)} className={campoClass} />
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Condicionado ao financiamento</label>
            <select value={condFinanciamento} onChange={(e) => setCondFinanciamento(e.target.value)} className={campoClass}>
              <option value="">-</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Condicionado a alguma outra situação? (opcional)</label>
            <textarea value={condOutraSituacao} onChange={(e) => setCondOutraSituacao(e.target.value)} rows={2} className={campoClass} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Dias de condicionamento</label>
              <input type="number" value={diasCondicionamento} onChange={(e) => setDiasCondicionamento(e.target.value)} className={campoClass} />
            </div>
            <div>
              <label className={labelClass}>Úteis ou corridos?</label>
              <select value={diasTipo} onChange={(e) => setDiasTipo(e.target.value)} className={campoClass}>
                <option value="uteis">Úteis</option>
                <option value="corridos">Corridos</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Necessidade de comodato</label>
              <select value={comodato} onChange={(e) => setComodato(e.target.value)} className={campoClass}>
                <option value="">-</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
            {comodato === "sim" && (
              <div>
                <label className={labelClass}>Quanto tempo o proprietário fica?</label>
                <input value={tempoComodato} onChange={(e) => setTempoComodato(e.target.value)} className={campoClass} />
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>O que fica incluído no imóvel</label>
            <textarea value={incluidos} onChange={(e) => setIncluidos(e.target.value)} rows={2} className={campoClass} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Email do proprietário (para o contrato)</label>
              <input value={emailProprietario} onChange={(e) => setEmailProprietario(e.target.value)} className={campoClass} />
            </div>
            <div>
              <label className={labelClass}>Email do comprador (para o contrato)</label>
              <input value={emailComprador} onChange={(e) => setEmailComprador(e.target.value)} className={campoClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Data de assinatura do contrato</label>
            <input type="date" value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} className={campoClass} />
          </div>

          <div>
            <label className={labelClass}>Observações adicionais</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className={campoClass} />
          </div>

          {erro && <p className="text-xs text-red-500">{erro}</p>}

          <div className="flex items-center justify-end gap-3">
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
