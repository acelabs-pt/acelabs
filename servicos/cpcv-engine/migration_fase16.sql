-- =============================================================
-- CPCV com IA - Fase 16 (comparacao com os contratos finais da solicitadora, 31/10/2026)
-- Migracao aditiva sobre o schema ja em producao. Correr no SQL Editor da Supabase
-- (um projeto por cliente: correr em cada um). Pode correr mais do que uma vez.
-- Sem esta migracao a app continua a funcionar: o contrato usa 15 dias de aviso e nao mostra
-- agencia parceira, e o formulario esconde estes campos.
-- =============================================================

-- Dias de antecedencia para avisar da escritura (Clausula Terceira). Vazio = 15, como no modelo;
-- num contrato real foram 8.
alter table cpcv_processos add column if not exists escritura_aviso_dias smallint
  check (escritura_aviso_dias is null or escritura_aviso_dias between 1 and 90);

-- Outra mediadora que interveio no negocio (ex.: a agencia que trouxe o comprador): entra na
-- clausula da Intervencao Imobiliaria ("... e pela agencia X, titular da licenca AMI Y").
alter table cpcv_processos add column if not exists agencia_parceira_nome text;
alter table cpcv_processos add column if not exists agencia_parceira_ami text;
