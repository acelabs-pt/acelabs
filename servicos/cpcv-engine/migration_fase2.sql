-- =============================================================
-- CPCV com IA - Fase 2 (fluxo real + gate de aprovação)
-- Migração aditiva sobre o schema já em produção.
-- =============================================================

-- --- cpcv_processos: novos campos ---
alter table cpcv_processos add column if not exists tipo_contrato text
  not null default 'angariacao_nossa_comprador_nosso'
  check (tipo_contrato in ('angariacao_nossa_comprador_nosso','angariacao_nossa_comprador_externo','comprador_nosso_angariacao_externa'));
alter table cpcv_processos add column if not exists id_angariacao text;
alter table cpcv_processos add column if not exists email_processual_agencia text;

alter table cpcv_processos add column if not exists metodo_pagamento text
  check (metodo_pagamento in ('capital_proprio','financiamento','misto'));
alter table cpcv_processos add column if not exists tem_fracoes_multiplas boolean default false;
alter table cpcv_processos add column if not exists valor_fracao_principal numeric;
alter table cpcv_processos add column if not exists valor_fracao_secundaria numeric;
alter table cpcv_processos add column if not exists valor_mobilia numeric;
alter table cpcv_processos add column if not exists reforco_sinal text;
alter table cpcv_processos add column if not exists iban_sinal text;
alter table cpcv_processos add column if not exists reserva boolean;
alter table cpcv_processos add column if not exists valor_reserva numeric;
alter table cpcv_processos add column if not exists condicionado_avaliacao boolean;
alter table cpcv_processos add column if not exists valor_avaliacao_minimo numeric;
alter table cpcv_processos add column if not exists condicionado_financiamento boolean;
alter table cpcv_processos add column if not exists condicionado_outra_situacao text;
alter table cpcv_processos add column if not exists dias_condicionamento integer;
alter table cpcv_processos add column if not exists dias_condicionamento_tipo text
  check (dias_condicionamento_tipo in ('uteis','corridos'));
alter table cpcv_processos add column if not exists comodato boolean;
alter table cpcv_processos add column if not exists tempo_comodato text;
alter table cpcv_processos add column if not exists incluidos_no_imovel text;
alter table cpcv_processos add column if not exists email_proprietario_contrato text;
alter table cpcv_processos add column if not exists email_comprador_contrato text;
alter table cpcv_processos add column if not exists data_assinatura_contrato date;
alter table cpcv_processos add column if not exists observacoes_adicionais text;

-- --- cpcv_processos: renomear estados e trocar o check constraint ---
-- (largar o constraint antigo ANTES do update - senão o update é rejeitado pelo
-- constraint velho, que ainda não conhece os novos valores)
alter table cpcv_processos drop constraint if exists cpcv_processos_estado_check;

update cpcv_processos set estado = 'pronto_para_aprovacao' where estado = 'pronto';
update cpcv_processos set estado = 'aprovado' where estado = 'concluido';

alter table cpcv_processos add constraint cpcv_processos_estado_check
  check (estado in ('em_preenchimento','pronto_para_aprovacao','aprovado'));

-- --- cpcv_partes: suporte a pessoa colectiva ---
alter table cpcv_partes add column if not exists tipo_pessoa text
  not null default 'singular' check (tipo_pessoa in ('singular','coletiva'));
alter table cpcv_partes add column if not exists naturalidade text;
alter table cpcv_partes add column if not exists tem_procuracao boolean default false;
alter table cpcv_partes add column if not exists procurador_nome text;
alter table cpcv_partes add column if not exists procurador_documento text;
alter table cpcv_partes add column if not exists representante_nome text;
alter table cpcv_partes add column if not exists certidao_permanente text;

-- --- cpcv_mensagens: autor "gestora" ---
alter table cpcv_mensagens drop constraint if exists cpcv_mensagens_autor_check;
alter table cpcv_mensagens add constraint cpcv_mensagens_autor_check
  check (autor in ('agente','ia','gestora'));
