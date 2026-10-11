import type { Processo } from "./cpcv-types";
import { formatarDataCurta, formatarEuros } from "./cpcv-types";

// O CPCV gerado tem exactamente as 16 cláusulas do contrato de referência. Vários campos que a app
// continua a recolher (reserva, reforços, mobília, comodato, observações, ...) não entram em
// nenhuma delas - por decisão do Miguel ficam registados e são mostrados à gestora/solicitadora
// como alertas (na página do processo e no ecrã de confirmação antes de gerar), para ela decidir
// o que fazer com essa informação fora do documento gerado. Nunca acrescentam cláusulas.
function euros(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "-" : `${formatarEuros(valor)}€`;
}

export function informacaoForaDoContrato(processo: Processo): string[] {
  const alertas: string[] = [];

  if (processo.reserva === true) {
    const data = processo.reserva_ate_data ? `, paga até ${formatarDataCurta(processo.reserva_ate_data)}` : "";
    alertas.push(`Reserva: ${euros(processo.valor_reserva)}${data}`);
  }

  const reforcos = (processo.reforcos_sinal ?? []).filter((r) => r.valor);
  if (reforcos.length > 0) {
    alertas.push(
      `Reforços de sinal: ${reforcos
        .map((r) => `${euros(r.valor)}${r.data ? ` até ${formatarDataCurta(r.data)}` : ""}`)
        .join("; ")}`
    );
  }

  if (processo.valor_mobilia) alertas.push(`Valor atribuído à mobília: ${euros(processo.valor_mobilia)}`);

  if (processo.tem_fracoes_multiplas) {
    alertas.push(
      `Duas fracções: principal ${euros(processo.valor_fracao_principal)}, secundária ${euros(processo.valor_fracao_secundaria)}`
    );
  }

  if (processo.condicionado_financiamento === true) {
    const prazo = processo.prazo_financiamento_dias ? `, prazo de ${processo.prazo_financiamento_dias} dias` : "";
    alertas.push(`Condicionado ao financiamento: igual ou superior a ${euros(processo.valor_financiamento_minimo)}${prazo}`);
  }

  if (processo.condicionado_avaliacao && processo.prazo_avaliacao_dias) {
    alertas.push(
      `Prazo da avaliação em dias (campo antigo): ${processo.prazo_avaliacao_dias} - a cláusula usa a data-limite, não os dias`
    );
  }

  if (processo.condicionado_outra_situacao) {
    const prazo = processo.prazo_outra_situacao_dias ? ` (prazo de ${processo.prazo_outra_situacao_dias} dias)` : "";
    alertas.push(`Condicionado a outra situação: ${processo.condicionado_outra_situacao}${prazo}`);
  }

  if (processo.condicoes_suspensivas) alertas.push(`Condições suspensivas (texto livre): ${processo.condicoes_suspensivas}`);
  if (processo.penalizacao_incumprimento) {
    alertas.push(`Penalização de incumprimento (texto livre): ${processo.penalizacao_incumprimento}`);
  }
  if (processo.prazo_pagamento_sinal) alertas.push(`Prazo de pagamento do sinal (texto da IA): ${processo.prazo_pagamento_sinal}`);

  if (processo.comodato === true) alertas.push(`Comodato: ${processo.tempo_comodato || "duração por indicar"}`);

  if (processo.email_proprietario_contrato || processo.email_comprador_contrato) {
    alertas.push(
      `Emails para o contrato: proprietário ${processo.email_proprietario_contrato || "-"}; comprador ${processo.email_comprador_contrato || "-"}`
    );
  }

  if (processo.imovel_estado) alertas.push(`Estado do imóvel: ${processo.imovel_estado}`);
  if (processo.imovel_anexos) alertas.push(`Anexos do imóvel: ${processo.imovel_anexos}`);
  if (processo.observacoes_adicionais) alertas.push(`Observações adicionais: ${processo.observacoes_adicionais}`);

  return alertas;
}
