"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sbBrowser } from "@/lib/supabase-browser";
import { removerCamposPreenchidosNoFormulario } from "@/lib/cpcv-perguntas-filtro";
import { btnPrimary, btnGhost, Spinner } from "../ui";

type Reforco = { valor: string; data: string };

type Processo = {
  id: string;
  estado: string;
  campos_em_falta: { campo: string; pergunta: string }[] | null;
  preco_total: number | null;
  valor_sinal: number | null;
  prazo_escritura: string | null;
  metodo_pagamento: string | null;
  tem_fracoes_multiplas: boolean | null;
  valor_fracao_principal: number | null;
  valor_fracao_secundaria: number | null;
  valor_mobilia: number | null;
  reforcos_sinal: { valor: number | null; data: string | null }[] | null;
  iban_sinal: string | null;
  reserva: boolean | null;
  valor_reserva: number | null;
  reserva_ate_data: string | null;
  condicionado_avaliacao: boolean | null;
  valor_avaliacao_minimo: number | null;
  prazo_avaliacao_dias: number | null;
  condicionado_financiamento: boolean | null;
  valor_financiamento_minimo: number | null;
  prazo_financiamento_dias: number | null;
  condicionado_outra_situacao: string | null;
  prazo_outra_situacao_dias: number | null;
  comodato: boolean | null;
  tempo_comodato: string | null;
  incluidos_no_imovel: string | null;
  email_proprietario_contrato: string | null;
  email_comprador_contrato: string | null;
  data_assinatura_contrato: string | null;
  observacoes_adicionais: string | null;
};

// Todos os valores monetários do formulário (preço, sinal, reforços, mobília, reserva,
// fracções, avaliação, financiamento) mostram "€" - eram inputs number sem qualquer indicação
// de moeda, o que deixava ambíguo se o número escrito era em euros ou noutra unidade.
function CampoEuros({
  id,
  value,
  onChange,
  placeholder,
  className,
  wrapperClassName = "",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className: string;
  wrapperClassName?: string;
}) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${className} pr-9`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">€</span>
    </div>
  );
}

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

  const [precoTotal, setPrecoTotal] = useState(processo.preco_total?.toString() ?? "");
  const [valorSinal, setValorSinal] = useState(processo.valor_sinal?.toString() ?? "");
  const [prazoEscritura, setPrazoEscritura] = useState(processo.prazo_escritura ?? "");
  const [reforcos, setReforcos] = useState<Reforco[]>(
    (processo.reforcos_sinal ?? []).map((r) => ({ valor: r.valor?.toString() ?? "", data: r.data ?? "" }))
  );
  const [valorMobilia, setValorMobilia] = useState(processo.valor_mobilia?.toString() ?? "");
  const [metodoPagamento, setMetodoPagamento] = useState(processo.metodo_pagamento ?? "");
  const [temFracoes, setTemFracoes] = useState(processo.tem_fracoes_multiplas ?? false);
  const [valorFracaoPrincipal, setValorFracaoPrincipal] = useState(processo.valor_fracao_principal?.toString() ?? "");
  const [valorFracaoSecundaria, setValorFracaoSecundaria] = useState(processo.valor_fracao_secundaria?.toString() ?? "");
  const [reserva, setReserva] = useState(simNao(processo.reserva));
  const [valorReserva, setValorReserva] = useState(processo.valor_reserva?.toString() ?? "");
  const [reservaAteData, setReservaAteData] = useState(processo.reserva_ate_data ?? "");
  const [condAvaliacao, setCondAvaliacao] = useState(simNao(processo.condicionado_avaliacao));
  const [valorAvaliacaoMinimo, setValorAvaliacaoMinimo] = useState(processo.valor_avaliacao_minimo?.toString() ?? "");
  const [prazoAvaliacaoDias, setPrazoAvaliacaoDias] = useState(processo.prazo_avaliacao_dias?.toString() ?? "");
  const [condFinanciamento, setCondFinanciamento] = useState(simNao(processo.condicionado_financiamento));
  const [valorFinanciamentoMinimo, setValorFinanciamentoMinimo] = useState(processo.valor_financiamento_minimo?.toString() ?? "");
  const [prazoFinanciamentoDias, setPrazoFinanciamentoDias] = useState(processo.prazo_financiamento_dias?.toString() ?? "");
  const [condOutraSituacao, setCondOutraSituacao] = useState(processo.condicionado_outra_situacao ?? "");
  const [prazoOutraSituacaoDias, setPrazoOutraSituacaoDias] = useState(processo.prazo_outra_situacao_dias?.toString() ?? "");
  const [ibanSinal, setIbanSinal] = useState(processo.iban_sinal ?? "");
  const [comodato, setComodato] = useState(simNao(processo.comodato));
  const [tempoComodato, setTempoComodato] = useState(processo.tempo_comodato ?? "");
  const [incluidos, setIncluidos] = useState(processo.incluidos_no_imovel ?? "");
  const [emailProprietario, setEmailProprietario] = useState(processo.email_proprietario_contrato ?? "");
  const [emailComprador, setEmailComprador] = useState(processo.email_comprador_contrato ?? "");
  const [dataAssinatura, setDataAssinatura] = useState(processo.data_assinatura_contrato ?? "");
  const [observacoes, setObservacoes] = useState(processo.observacoes_adicionais ?? "");

  function atualizarReforco(index: number, campo: keyof Reforco, valor: string) {
    setReforcos((prev) => prev.map((r, i) => (i === index ? { ...r, [campo]: valor } : r)));
  }

  function adicionarReforco() {
    setReforcos((prev) => [...prev, { valor: "", data: "" }]);
  }

  function removerReforco(index: number) {
    setReforcos((prev) => prev.filter((_, i) => i !== index));
  }

  async function guardar() {
    setGuardando(true);
    setGuardado(false);
    setErro("");

    const camposEmFaltaActualizados = removerCamposPreenchidosNoFormulario(processo.campos_em_falta ?? [], {
      precoTotal,
      valorSinal,
      prazoEscritura,
    });
    const estadoActualizado =
      processo.estado === "em_preenchimento" && camposEmFaltaActualizados.length === 0
        ? "pronto_para_aprovacao"
        : processo.estado;

    const reforcosValidos = reforcos
      .filter((r) => r.valor.trim())
      .map((r) => ({ valor: Number(r.valor), data: r.data || null }));

    const supabase = sbBrowser();
    const { error } = await supabase
      .from("cpcv_processos")
      .update({
        preco_total: precoTotal ? Number(precoTotal) : null,
        valor_sinal: valorSinal ? Number(valorSinal) : null,
        prazo_escritura: prazoEscritura || null,
        campos_em_falta: camposEmFaltaActualizados,
        estado: estadoActualizado,
        reforcos_sinal: reforcosValidos,
        valor_mobilia: valorMobilia ? Number(valorMobilia) : null,
        metodo_pagamento: metodoPagamento || null,
        tem_fracoes_multiplas: temFracoes,
        valor_fracao_principal: temFracoes && valorFracaoPrincipal ? Number(valorFracaoPrincipal) : null,
        valor_fracao_secundaria: temFracoes && valorFracaoSecundaria ? Number(valorFracaoSecundaria) : null,
        reserva: reserva ? reserva === "sim" : null,
        valor_reserva: reserva === "sim" && valorReserva ? Number(valorReserva) : null,
        reserva_ate_data: reserva === "sim" ? reservaAteData || null : null,
        condicionado_avaliacao: condAvaliacao ? condAvaliacao === "sim" : null,
        valor_avaliacao_minimo: condAvaliacao === "sim" && valorAvaliacaoMinimo ? Number(valorAvaliacaoMinimo) : null,
        prazo_avaliacao_dias: condAvaliacao === "sim" && prazoAvaliacaoDias ? Number(prazoAvaliacaoDias) : null,
        condicionado_financiamento: condFinanciamento ? condFinanciamento === "sim" : null,
        valor_financiamento_minimo: condFinanciamento === "sim" && valorFinanciamentoMinimo ? Number(valorFinanciamentoMinimo) : null,
        prazo_financiamento_dias: condFinanciamento === "sim" && prazoFinanciamentoDias ? Number(prazoFinanciamentoDias) : null,
        condicionado_outra_situacao: condOutraSituacao || null,
        prazo_outra_situacao_dias: condOutraSituacao.trim() && prazoOutraSituacaoDias ? Number(prazoOutraSituacaoDias) : null,
        dias_condicionamento: null,
        dias_condicionamento_tipo: null,
        iban_sinal: ibanSinal || null,
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
            <h3 className={tituloSeccaoClass}>Valor do negócio</h3>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="precoTotal" className={labelClass}>Valor de escritura (preço total)</label>
                  <CampoEuros id="precoTotal" value={precoTotal} onChange={setPrecoTotal} className={campoClass} />
                </div>
                <div>
                  <label htmlFor="valorSinal" className={labelClass}>Valor do sinal</label>
                  <CampoEuros id="valorSinal" value={valorSinal} onChange={setValorSinal} className={campoClass} />
                </div>
                <div>
                  <label htmlFor="prazoEscritura" className={labelClass}>Data prevista para a escritura</label>
                  <input id="prazoEscritura" type="date" value={prazoEscritura} onChange={(e) => setPrazoEscritura(e.target.value)} className={campoClass} />
                </div>
              </div>

              <div>
                <p className={labelClass}>Reforços de sinal (opcional, pode haver vários)</p>
                <div className="space-y-2">
                  {reforcos.map((r, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <CampoEuros
                        value={r.valor}
                        onChange={(v) => atualizarReforco(i, "valor", v)}
                        placeholder="Valor"
                        className={campoClass}
                        wrapperClassName="flex-1"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={r.data}
                          onChange={(e) => atualizarReforco(i, "data", e.target.value)}
                          title="Pagar até"
                          className={`${campoClass} flex-1`}
                        />
                        <button
                          type="button"
                          onClick={() => removerReforco(i)}
                          className="text-[#94A3B8] hover:text-red-500 text-xs font-medium transition-colors duration-150 whitespace-nowrap px-1"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={adicionarReforco} className={`${btnGhost} mt-2 text-xs`}>
                  + Adicionar reforço de sinal
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="valorMobilia" className={labelClass}>Valor atribuído à mobília</label>
                  <CampoEuros id="valorMobilia" value={valorMobilia} onChange={setValorMobilia} className={campoClass} />
                </div>
                <div>
                  <label htmlFor="metodoPagamento" className={labelClass}>Método de pagamento</label>
                  <select id="metodoPagamento" value={metodoPagamento} onChange={(e) => setMetodoPagamento(e.target.value)} className={campoClass}>
                    <option value="">-</option>
                    <option value="capital_proprio">Capital próprio</option>
                    <option value="financiamento">Financiamento</option>
                    <option value="misto">Misto</option>
                  </select>
                </div>
              </div>
            </div>
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
                  <CampoEuros id="valorReserva" value={valorReserva} onChange={setValorReserva} className={campoClass} />
                </div>
              )}
              {reserva === "sim" && (
                <div>
                  <label htmlFor="reservaAteData" className={labelClass}>Data de pagamento da reserva</label>
                  <input id="reservaAteData" type="date" value={reservaAteData} onChange={(e) => setReservaAteData(e.target.value)} className={campoClass} />
                </div>
              )}
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
                  <CampoEuros id="valorFracaoPrincipal" value={valorFracaoPrincipal} onChange={setValorFracaoPrincipal} className={campoClass} />
                </div>
                <div>
                  <label htmlFor="valorFracaoSecundaria" className={labelClass}>Valor da 2ª fracção (garagem, etc.)</label>
                  <CampoEuros id="valorFracaoSecundaria" value={valorFracaoSecundaria} onChange={setValorFracaoSecundaria} className={campoClass} />
                </div>
              </div>
            )}
          </div>

          <div className={seccaoClass}>
            <h3 className={tituloSeccaoClass}>Condições suspensivas</h3>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
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
                    <CampoEuros id="valorAvaliacaoMinimo" value={valorAvaliacaoMinimo} onChange={setValorAvaliacaoMinimo} className={campoClass} />
                  </div>
                )}
                {condAvaliacao === "sim" && (
                  <div>
                    <label htmlFor="prazoAvaliacaoDias" className={labelClass}>Prazo (dias corridos)</label>
                    <input id="prazoAvaliacaoDias" type="number" value={prazoAvaliacaoDias} onChange={(e) => setPrazoAvaliacaoDias(e.target.value)} className={campoClass} />
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="condFinanciamento" className={labelClass}>Condicionado ao financiamento</label>
                  <select id="condFinanciamento" value={condFinanciamento} onChange={(e) => setCondFinanciamento(e.target.value)} className={campoClass}>
                    <option value="">-</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </select>
                </div>
                {condFinanciamento === "sim" && (
                  <div>
                    <label htmlFor="valorFinanciamentoMinimo" className={labelClass}>Igual ou superior a que valor?</label>
                    <CampoEuros id="valorFinanciamentoMinimo" value={valorFinanciamentoMinimo} onChange={setValorFinanciamentoMinimo} className={campoClass} />
                  </div>
                )}
                {condFinanciamento === "sim" && (
                  <div>
                    <label htmlFor="prazoFinanciamentoDias" className={labelClass}>Prazo (dias corridos)</label>
                    <input id="prazoFinanciamentoDias" type="number" value={prazoFinanciamentoDias} onChange={(e) => setPrazoFinanciamentoDias(e.target.value)} className={campoClass} />
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="condOutraSituacao" className={labelClass}>Condicionado a alguma outra situação? (opcional)</label>
                  <textarea id="condOutraSituacao" value={condOutraSituacao} onChange={(e) => setCondOutraSituacao(e.target.value)} rows={2} className={campoClass} />
                </div>
                {condOutraSituacao.trim() && (
                  <div>
                    <label htmlFor="prazoOutraSituacaoDias" className={labelClass}>Prazo (dias corridos)</label>
                    <input id="prazoOutraSituacaoDias" type="number" value={prazoOutraSituacaoDias} onChange={(e) => setPrazoOutraSituacaoDias(e.target.value)} className={campoClass} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={seccaoClass}>
            <h3 className={tituloSeccaoClass}>IBAN</h3>
            <div>
              <label htmlFor="ibanSinal" className={labelClass}>IBAN para envio do sinal</label>
              <input id="ibanSinal" value={ibanSinal} onChange={(e) => setIbanSinal(e.target.value)} className={campoClass} />
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
                  <label htmlFor="tempoComodato" className={labelClass}>Quanto tempo o proprietário fica (após a escritura)?</label>
                  <input id="tempoComodato" value={tempoComodato} onChange={(e) => setTempoComodato(e.target.value)} className={campoClass} />
                </div>
              )}
            </div>
          </div>

          <div className={seccaoClass}>
            <h3 className={tituloSeccaoClass}>Imóvel e contrato</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="incluidos" className={labelClass}>O que fica incluído no imóvel (opcional)</label>
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
