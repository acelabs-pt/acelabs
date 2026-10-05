-- =============================================================
-- CPCV com IA - Fase 9 (morada do imovel em varios campos, financiamento e
-- outra situacao com o mesmo formato de condicionado a avaliacao)
-- Migracao aditiva sobre o schema ja em producao.
-- =============================================================

-- Codigo postal e localidade do imovel - antes so existia um unico campo de morada
-- (rua + numero), sem estes dois. Passam a ser preenchidos num bloco estruturado em
-- /cpcv/novo (ver app/cpcv/novo/page.tsx) e a entrar na Clausula Primeira (Objecto).
alter table cpcv_processos add column if not exists imovel_codigo_postal text;
alter table cpcv_processos add column if not exists imovel_localidade text;

-- Condicionado ao financiamento passa a ter o mesmo formato de condicionado a avaliacao
-- (valor minimo + prazo em dias corridos), em vez do generico dias_condicionamento/
-- dias_condicionamento_tipo (uteis ou corridos) partilhado por todas as condicoes - ver
-- lib/cpcv-clausulas.ts, clausulaCondicoesSuspensivas(). dias_condicionamento e
-- dias_condicionamento_tipo ficam por preencher a partir de agora (nunca apagados, so
-- deixam de ser usados pelo formulario e pelo gerador de documento).
alter table cpcv_processos add column if not exists valor_financiamento_minimo numeric;
alter table cpcv_processos add column if not exists prazo_financiamento_dias integer;

-- Prazo (dias corridos) proprio para a condicao "outra situacao", opcional, mesmo formato
-- das duas anteriores.
alter table cpcv_processos add column if not exists prazo_outra_situacao_dias integer;
