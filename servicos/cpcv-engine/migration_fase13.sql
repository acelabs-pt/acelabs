-- =============================================================
-- CPCV com IA - Fase 13 (contrato consolidado fiel ao modelo assinado: 16 clausulas)
-- Migracao aditiva sobre o schema ja em producao.
-- =============================================================

-- Clausula Quinta (Bens Moveis): "Existem bens moveis ou equipamentos incluidos na venda?"
-- null = por responder (o CPCV sai sem a clausula e a gestora e avisada antes de gerar); true
-- usa a lista ja existente em incluidos_no_imovel; false omite a clausula.
alter table cpcv_processos add column if not exists tem_bens_moveis boolean;

-- Clausula Decima Segunda (Condominio): a pergunta passa a ser obrigatoria e nunca inferida de o
-- imovel ser fraccao autonoma. A coluna existia com default false mas nenhum formulario a
-- escrevia (ver migration_fase3.sql) - todos os "false" actuais sao valores por omissao, nao
-- respostas, por isso voltam a null ("por responder") e o default desaparece.
alter table cpcv_processos alter column imovel_condominio drop default;
update cpcv_processos set imovel_condominio = null where imovel_condominio = false;
