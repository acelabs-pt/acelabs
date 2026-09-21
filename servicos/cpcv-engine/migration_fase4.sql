-- =============================================================
-- CPCV com IA - Fase 4 (fecho do processo depois de aprovado)
-- Migração aditiva sobre o schema já em produção.
-- =============================================================

-- Até aqui "aprovado" era o estado final - sem forma de registar que a escritura se
-- realizou (negócio concluído) ou que o negócio caiu (comprador desistiu, financiamento
-- recusado, etc.), nem antes nem depois da aprovação. Ver app/api/cpcv/[id]/fechar/route.ts.
-- "concluido" só é alcançável a partir de "aprovado" (precisa do documento já gerado);
-- "cancelado" é alcançável a partir de qualquer estado não terminal.
alter table cpcv_processos drop constraint if exists cpcv_processos_estado_check;
alter table cpcv_processos add constraint cpcv_processos_estado_check
  check (estado in ('em_preenchimento','pronto_para_aprovacao','aprovado','concluido','cancelado'));

alter table cpcv_processos add column if not exists motivo_cancelamento text;
alter table cpcv_processos add column if not exists fechado_em timestamptz;
