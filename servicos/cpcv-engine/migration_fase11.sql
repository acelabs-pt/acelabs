-- =============================================================
-- CPCV com IA - Fase 11 (identificacao dos outorgantes, intro fixa e nova Clausula
-- Primeira para imoveis que sao fraccao autonoma, com hipotecas)
-- Migracao aditiva sobre o schema ja em producao.
-- =============================================================

-- O novo texto da Clausula Primeira (fraccao autonoma, andar, regime de propriedade
-- horizontal) so se aplica quando o imovel E mesmo uma fraccao - uma moradia ou um
-- terreno nao tem fraccao nem esta em regime de propriedade horizontal, por isso o texto
-- generico actual (app/cpcv/[id]/page.tsx chama lib/cpcv-clausulas.ts,
-- pontosClausulaPrimeira()) continua a ser usado sempre que este campo for null ou false -
-- cobre tambem todos os processos antigos, que nunca respondem a esta pergunta. Nunca
-- inferido pela IA - e sempre uma resposta explicita da gestora/agente em
-- app/cpcv/[id]/IdentificacaoImovel.tsx.
alter table cpcv_processos add column if not exists imovel_e_fracao_autonoma boolean;
alter table cpcv_processos add column if not exists imovel_fracao_letra text;
alter table cpcv_processos add column if not exists imovel_andar_fracao text;
alter table cpcv_processos add column if not exists imovel_orientacao text;
alter table cpcv_processos add column if not exists imovel_finalidade text;
alter table cpcv_processos add column if not exists imovel_conservatoria text;
alter table cpcv_processos add column if not exists imovel_licenca_data_emissao date;
alter table cpcv_processos add column if not exists imovel_licenca_entidade_emissora text;
alter table cpcv_processos add column if not exists imovel_certificado_validade date;
alter table cpcv_processos add column if not exists imovel_certificado_classe text;

-- Confirmacao explicita de que a certidao predial foi revista e as hipotecas (se as
-- houver) estao registadas em cpcv_hipotecas - sem isto nao ha forma de distinguir
-- "ninguem verificou ainda" de "verificou-se e nao ha hipotecas" (zero linhas significa
-- as duas coisas). Usado em app/api/cpcv/gerar/route.ts para mostrar um aviso (nao um
-- bloqueio) antes de gerar o documento se ainda nao tiver sido confirmado.
alter table cpcv_processos add column if not exists hipotecas_verificadas boolean not null default false;

-- Uma linha por hipoteca registada sobre o imovel. Nao e preenchida por delete-and-reinsert
-- automatico a cada analise da IA (ver app/api/cpcv/extrair-hipotecas/route.ts - essa rota
-- so sugere, nunca escreve na BD) - e sempre a gestora/agente a aceitar/editar/remover cada
-- linha, pela mesma razao que levou a tirar esse padrao de cpcv_partes (dado legal fragil
-- para ser reescrito silenciosamente a cada ronda).
create table if not exists cpcv_hipotecas (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references cpcv_processos(id) on delete cascade,
  entidade_credora text not null,
  natureza text,
  numero_apresentacao text,
  data_registo date,
  criado_em timestamptz default now()
);

-- Mesmo padrao de RLS de cpcv_partes (migration_fase6.sql) - visivel/editavel pelo agente
-- dono do processo, ou por qualquer gestora/admin.
alter table cpcv_hipotecas enable row level security;

create policy "hipotecas_select" on cpcv_hipotecas
  for select using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );

create policy "hipotecas_insert" on cpcv_hipotecas
  for insert with check (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );

create policy "hipotecas_update" on cpcv_hipotecas
  for update using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );

create policy "hipotecas_delete" on cpcv_hipotecas
  for delete using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );
