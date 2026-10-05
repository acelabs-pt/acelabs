-- =============================================================
-- CPCV com IA - Fase 7 (reorganização das condições do negócio)
-- Migração aditiva sobre o schema já em produção.
-- =============================================================

-- Reforços de sinal deixam de ser um único texto livre e passam a ser uma lista
-- (pode haver vários, cada um com o seu valor e a data limite de pagamento). A coluna
-- antiga "reforco_sinal" fica por preencher a partir de agora (nunca apagada, só
-- deixa de ser usada pelo formulário e pelos geradores de documento).
alter table cpcv_processos add column if not exists reforcos_sinal jsonb not null default '[]'::jsonb;

-- Prazo específico da condição de avaliação bancária (em dias corridos, a contar da
-- assinatura do CPCV) - até agora só existia o prazo genérico partilhado por todas as
-- condições suspensivas (dias_condicionamento).
alter table cpcv_processos add column if not exists prazo_avaliacao_dias integer;

-- Data até à qual a reserva é válida (distinta da data de assinatura do contrato).
alter table cpcv_processos add column if not exists reserva_ate_data date;
