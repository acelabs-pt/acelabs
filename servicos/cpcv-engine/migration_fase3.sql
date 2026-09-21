-- =============================================================
-- CPCV com IA - Fase 3 (alinhamento com as minutas reais da agência)
-- Migração aditiva sobre o schema já em produção.
-- =============================================================

-- --- cpcv_partes: cargo do representante de uma pessoa colectiva ---
-- (ex.: "sócio gerente", "gerente único") - as minutas reais identificam sempre o
-- representante com o seu cargo, não só o nome. Ver lib/cpcv-clausulas.ts.
alter table cpcv_partes add column if not exists representante_cargo text;

-- --- cpcv_processos: mecanismo rico de avaliação bancária (Cláusula "Financiamento e
-- Avaliação Bancária") - prazo para comunicar o resultado da avaliação e email de contacto
-- para essa comunicação. Só usados quando condicionado_financiamento e condicionado_avaliacao
-- estão ambos activos - ver financiamentoAvaliacaoAtivo() em lib/cpcv-clausulas.ts.
alter table cpcv_processos add column if not exists avaliacao_prazo_data date;
alter table cpcv_processos add column if not exists avaliacao_contacto_email text;

-- --- cpcv_processos: imóvel em condomínio constituído (gatilha a Declaração de Condomínio) ---
alter table cpcv_processos add column if not exists imovel_condominio boolean default false;
