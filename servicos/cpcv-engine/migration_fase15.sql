-- =============================================================
-- CPCV com IA - Fase 15 (feedback da solicitadora, reuniao de 25/10/2026)
-- Migracao aditiva sobre o schema ja em producao. Correr no SQL Editor da Supabase
-- (um projeto por cliente: correr em cada um).
-- =============================================================

-- Email de cada parte: sai na identificacao dos outorgantes ("residente em ..., com o email ...")
-- e nas notificacoes por email da Clausula Terceira.
alter table cpcv_partes add column if not exists email text;

-- Certificado energetico: valido (omissao), isento ou em execucao. Quando isento,
-- imovel_certificado_energetico guarda o numero da isencao e imovel_certificado_data_emissao a
-- data em que foi emitida.
alter table cpcv_processos add column if not exists imovel_certificado_estado text not null default 'valido'
  check (imovel_certificado_estado in ('valido', 'isento', 'em_execucao'));
alter table cpcv_processos add column if not exists imovel_certificado_data_emissao date;

-- "Urbano situado em ..." e "Composicao" tal como constam da certidao predial - e isto que a
-- Clausula Primeira escreve, em vez da morada comercial do imovel.
alter table cpcv_processos add column if not exists imovel_situado_em text;
alter table cpcv_processos add column if not exists imovel_composicao text;

-- Numero da isencao de certificado energetico (campo proprio, para nao colidir com o numero do
-- certificado que se edita em "Documentos obrigatorios").
alter table cpcv_processos add column if not exists imovel_certificado_isencao_numero text;

-- Ligacao explicita entre conjuges do mesmo lado do negocio: duas partes com o mesmo numero em
-- "casal" (1, 2, ...) aparecem na mesma frase do contrato. Sem isto o programa adivinha pelo regime
-- de bens, o que falha quando a ordem das partes mistura casais.
alter table cpcv_partes add column if not exists casal smallint;
