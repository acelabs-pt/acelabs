import type { Processo } from "./cpcv-types";
import { formatarDataCurta, formatarEuros } from "./cpcv-types";

// O CPCV gerado tem exactamente as 16 cláusulas do contrato de referência. Vários campos que a app
// continua a recolher (reforços, comodato, observações, ...) não entram em nenhuma delas - por
// decisão do Miguel ficam registados e são mostrados à gestora/solicitadora como alertas (na página
// do processo e no ecrã de confirmação antes de gerar), para ela decidir o que fazer com essa
// informação fora do documento gerado. Nunca acrescentam cláusulas. A reserva, a divisão do preço com
// a mobília e o condicionamento ao financiamento passaram a entrar em pontos das cláusulas existentes,
// porque a solicitadora os escreve assim nos contratos finais (31/10/2026).
function euros(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "-" : `${formatarEuros(valor)}€`;
}

export function informacaoForaDoContrato(processo: Processo): string[] {
  const alertas: string[] = [];

  // Comissão superior ao sinal não bloqueia a geração (a comissão nunca vai para o contrato) -
  // fica só como nota para a gestora/solicitadora.
  if (
    processo.destino_sinal === "agencia" &&
    typeof processo.comissao_valor === "number" &&
    typeof processo.valor_sinal === "number" &&
    processo.comissao_valor > processo.valor_sinal
  ) {
    alertas.push(
      `Comissão (${euros(processo.comissao_valor)}) superior ao sinal (${euros(processo.valor_sinal)}) - o sinal não cobre a comissão`
    );
  }

  // Reforços além do sinal (ex.: reforço pago aos vendedores depois de aprovado o financiamento): a
  // app não sabe para que conta vão, por isso não entram no texto - a solicitadora acrescenta o ponto.
  const reforcos = (processo.reforcos_sinal ?? []).filter((r) => r.valor);
  if (reforcos.length > 0) {
    alertas.push(
      `Reforços de sinal (acrescentar na Cláusula Segunda, com a conta de destino): ${reforcos
        .map((r) => `${euros(r.valor)}${r.data ? ` até ${formatarDataCurta(r.data)}` : ""}`)
        .join("; ")}`
    );
  }

  // O valor da mobília entra na Cláusula Segunda (divisão do preço) quando é menor do que o preço.
  const mobiliaNoContrato =
    typeof processo.valor_mobilia === "number" && typeof processo.preco_total === "number" && processo.valor_mobilia > 0 && processo.valor_mobilia < processo.preco_total;
  if (processo.valor_mobilia && !mobiliaNoContrato) alertas.push(`Valor atribuído à mobília: ${euros(processo.valor_mobilia)}`);

  if (processo.tem_fracoes_multiplas) {
    alertas.push(
      `Duas fracções: principal ${euros(processo.valor_fracao_principal)}, secundária ${euros(processo.valor_fracao_secundaria)}`
    );
  }

  // Condicionado ao financiamento entra na Cláusula de Avaliação Bancária (versão "aprovação do
  // financiamento") quando há financiamento e não há condição de avaliação; nos outros casos fica aqui.
  const financiamentoNoContrato =
    (processo.metodo_pagamento === "financiamento" || processo.metodo_pagamento === "misto") && !processo.condicionado_avaliacao;
  if (processo.condicionado_financiamento === true && !financiamentoNoContrato) {
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

  if (processo.imovel_estado) alertas.push(`Estado do imóvel: ${processo.imovel_estado}`);
  if (processo.imovel_anexos) alertas.push(`Anexos do imóvel: ${processo.imovel_anexos}`);
  if (processo.observacoes_adicionais) alertas.push(`Observações adicionais: ${processo.observacoes_adicionais}`);

  return alertas;
}
