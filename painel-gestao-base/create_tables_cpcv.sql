-- =============================================================
-- CPCV com IA - tabelas, RLS e storage
-- Colar no SQL Editor do Supabase e executar (Run)
-- =============================================================

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  role text not null check (role in ('agente','gestora')),
  criado_em timestamptz default now()
);

-- Função auxiliar para evitar recursão nas policies de RLS ao verificar o role.
-- (Tem de vir depois da tabela profiles existir.)
create or replace function is_gestora()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'gestora');
$$;

alter table profiles enable row level security;

create policy "profiles_select" on profiles
  for select using (auth.uid() = id or is_gestora());

create policy "profiles_insert" on profiles
  for insert with check (auth.uid() = id);

-- ---------------------------------------------------------------
-- cpcv_processos
-- ---------------------------------------------------------------
create table if not exists cpcv_processos (
  id uuid primary key default gen_random_uuid(),
  criado_por uuid references profiles(id) not null,
  estado text not null default 'em_preenchimento'
    check (estado in ('em_preenchimento','pronto_para_aprovacao','aprovado')),

  -- Tipo de contrato (do fluxo AS IS da Margarida)
  tipo_contrato text not null default 'angariacao_nossa_comprador_nosso'
    check (tipo_contrato in ('angariacao_nossa_comprador_nosso','angariacao_nossa_comprador_externo','comprador_nosso_angariacao_externa')),
  id_angariacao text,
  email_processual_agencia text,

  -- Imóvel
  imovel_morada text,
  imovel_freguesia text,
  imovel_concelho text,
  imovel_distrito text,
  imovel_tipologia text,
  imovel_artigo_matricial text,
  imovel_descricao_predial text,
  imovel_certificado_energetico text,
  imovel_licenca_utilizacao text,
  imovel_area numeric,
  imovel_anexos text,
  imovel_estado text,

  -- Negócio
  preco_total numeric,
  valor_sinal numeric,
  forma_pagamento_sinal text,
  prazo_pagamento_sinal text,
  prazo_escritura date,
  condicoes_suspensivas text,
  penalizacao_incumprimento text,

  -- Condições do negócio (campos estruturados - "os dropdowns")
  metodo_pagamento text check (metodo_pagamento in ('capital_proprio','financiamento','misto')),
  tem_fracoes_multiplas boolean default false,
  valor_fracao_principal numeric,
  valor_fracao_secundaria numeric,
  valor_mobilia numeric,
  reforco_sinal text,
  iban_sinal text,
  reserva boolean,
  valor_reserva numeric,
  condicionado_avaliacao boolean,
  valor_avaliacao_minimo numeric,
  condicionado_financiamento boolean,
  condicionado_outra_situacao text,
  dias_condicionamento integer,
  dias_condicionamento_tipo text check (dias_condicionamento_tipo in ('uteis','corridos')),
  comodato boolean,
  tempo_comodato text,
  incluidos_no_imovel text,
  email_proprietario_contrato text,
  email_comprador_contrato text,
  data_assinatura_contrato date,
  observacoes_adicionais text,

  campos_em_falta jsonb default '[]'::jsonb,
  docx_path text,
  pdf_path text,
  link_imovel text,

  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

alter table cpcv_processos enable row level security;

create policy "processos_select" on cpcv_processos
  for select using (criado_por = auth.uid() or is_gestora());

create policy "processos_insert" on cpcv_processos
  for insert with check (criado_por = auth.uid() or is_gestora());

create policy "processos_update" on cpcv_processos
  for update using (criado_por = auth.uid() or is_gestora());

create policy "processos_delete" on cpcv_processos
  for delete using (criado_por = auth.uid() or is_gestora());

-- ---------------------------------------------------------------
-- cpcv_partes (vendedores/compradores, N por processo)
-- ---------------------------------------------------------------
create table if not exists cpcv_partes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references cpcv_processos(id) on delete cascade,
  papel text not null check (papel in ('vendedor','comprador')),
  tipo_pessoa text not null default 'singular' check (tipo_pessoa in ('singular','coletiva')),
  nome text not null,
  estado_civil text,
  regime_bens text,
  nacionalidade text,
  naturalidade text,
  nif text,
  morada text,
  documento_tipo text,
  documento_numero text,
  documento_validade date,
  tem_procuracao boolean default false,
  procurador_nome text,
  procurador_documento text,
  representante_nome text,
  certidao_permanente text
);

alter table cpcv_partes enable row level security;

create policy "partes_select" on cpcv_partes
  for select using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora()))
  );

create policy "partes_insert" on cpcv_partes
  for insert with check (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora()))
  );

create policy "partes_update" on cpcv_partes
  for update using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora()))
  );

create policy "partes_delete" on cpcv_partes
  for delete using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora()))
  );

-- ---------------------------------------------------------------
-- cpcv_ficheiros (documentos despejados pelo agente)
-- ---------------------------------------------------------------
create table if not exists cpcv_ficheiros (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references cpcv_processos(id) on delete cascade,
  tipo text not null check (tipo in ('cc_vendedor','cc_comprador','caderneta_predial','certificado_energetico','outro')),
  storage_path text not null,
  nome_original text,
  criado_em timestamptz default now()
);

alter table cpcv_ficheiros enable row level security;

create policy "ficheiros_select" on cpcv_ficheiros
  for select using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora()))
  );

create policy "ficheiros_insert" on cpcv_ficheiros
  for insert with check (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora()))
  );

-- ---------------------------------------------------------------
-- cpcv_mensagens (conversa IA <-> agente)
-- ---------------------------------------------------------------
create table if not exists cpcv_mensagens (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references cpcv_processos(id) on delete cascade,
  autor text not null check (autor in ('agente','ia','gestora')),
  texto text not null,
  criado_em timestamptz default now()
);

alter table cpcv_mensagens enable row level security;

create policy "mensagens_select" on cpcv_mensagens
  for select using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora()))
  );

create policy "mensagens_insert" on cpcv_mensagens
  for insert with check (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora()))
  );

-- ---------------------------------------------------------------
-- Storage: bucket privado para ficheiros despejados e documentos gerados.
-- Convenção de caminho: {user_id}/{processo_id}/{nome_ficheiro}
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('cpcv-documentos', 'cpcv-documentos', false)
on conflict (id) do nothing;

create policy "cpcv_docs_select" on storage.objects
  for select using (
    bucket_id = 'cpcv-documentos' and (
      (storage.foldername(name))[1] = auth.uid()::text or is_gestora()
    )
  );

create policy "cpcv_docs_insert" on storage.objects
  for insert with check (
    bucket_id = 'cpcv-documentos' and (
      (storage.foldername(name))[1] = auth.uid()::text or is_gestora()
    )
  );

-- Necessária para o upload com upsert (regenerar cpcv.pdf/cpcv.docx sobre um já existente).
create policy "cpcv_docs_update" on storage.objects
  for update using (
    bucket_id = 'cpcv-documentos' and (
      (storage.foldername(name))[1] = auth.uid()::text or is_gestora()
    )
  );

-- Necessária para eliminar um processo (e limpar os ficheiros associados no Storage).
create policy "cpcv_docs_delete" on storage.objects
  for delete using (
    bucket_id = 'cpcv-documentos' and (
      (storage.foldername(name))[1] = auth.uid()::text or is_gestora()
    )
  );
