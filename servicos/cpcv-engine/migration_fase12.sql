-- =============================================================
-- CPCV com IA - Fase 12 (Clausula Segunda: preco, sinal, fiel depositaria e
-- modalidade de pagamento da comissao)
-- Migracao aditiva sobre o schema ja em producao.
-- =============================================================

-- Quem fica com o sinal (vendedor directamente, ou a agencia como fiel depositaria) -
-- null cobre todos os processos anteriores a esta fase (e qualquer processo novo ate o
-- agente responder), e mantem a Clausula "Preco e Condicoes de Pagamento" exactamente como
-- estava antes desta fase (ver lib/cpcv-clausulas.ts, pontosClausulaSegunda()) - nunca
-- inferido, e sempre uma resposta explicita em app/cpcv/[id]/CondicoesNegocio.tsx.
alter table cpcv_processos add column if not exists destino_sinal text
  check (destino_sinal in ('vendedor','agencia'));

-- Banco e titular da conta de destino do sinal. iban_sinal ja existe e passa a ser
-- reutilizado como o IBAN dessa mesma conta nos dois casos (vendedor ou agencia) - nao criar
-- uma coluna de IBAN paralela. conta_sinal_titular so e relevante quando destino_sinal =
-- 'vendedor' - quando e a agencia, o titular e sempre CPCV_AGENCIA_NOME (variavel de
-- ambiente, tal como a conta bancaria da agencia - ver .env.example).
alter table cpcv_processos add column if not exists conta_sinal_banco text;
alter table cpcv_processos add column if not exists conta_sinal_titular text;

-- Quando a agencia recebe o sinal, o CPCV refere a possibilidade de deducao da comissao mas
-- nunca o valor/percentagem (ver pontosClausulaSegunda) - comissao_valor serve so para a
-- app validar que a comissao a reter nao excede o sinal disponivel antes de gerar o
-- documento (app/api/cpcv/gerar/route.ts), nunca para imprimir no contrato. Valor fixo em
-- euros, ja com IVA incluido - sem calculo automatico a partir de uma percentagem.
alter table cpcv_processos add column if not exists comissao_modalidade text
  check (comissao_modalidade in ('integral_cpcv','metade_cpcv','integral_escritura'));
alter table cpcv_processos add column if not exists comissao_valor numeric;
