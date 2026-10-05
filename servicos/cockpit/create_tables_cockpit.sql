-- Schema inicial do Cockpit. Multi-tenant com schema partilhado e Row Level
-- Security por organizacao_id (ver pesquisa-boas-praticas.md, secção 3, e
-- especificacao-produto.md, secção 2) - diferente do modelo "um projeto
-- Supabase por cliente" usado no cpcv-engine, de propósito.
--
-- RLS ativado em todas as tabelas desde a primeira migração: nunca adicionar
-- depois de já haver dados (causa mais comum de fugas entre tenants).
-- organizacao_id vem do JWT do utilizador autenticado via uma função
-- auxiliar, para as policies não terem de fazer round-trip extra à BD.

create table organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

create table membros_organizacao (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'agente')),
  criado_em timestamptz not null default now(),
  unique (organizacao_id, user_id)
);

create table convites (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'agente')),
  token text not null unique,
  expira_em timestamptz not null default (now() + interval '7 days'),
  aceite_em timestamptz,
  criado_em timestamptz not null default now()
);

-- Função auxiliar: organizacao_id do utilizador autenticado, lida do JWT
-- (custom claim "organizacao_id") para evitar subqueries repetidas em cada
-- policy. Preencher o claim no momento do login/convite aceite.
create or replace function organizacao_atual()
returns uuid
language sql
stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'organizacao_id')::uuid;
$$;

create table contactos (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  estado_relacao text not null default 'lead_frio'
    check (estado_relacao in ('lead_frio', 'lead_morno', 'lead_quente', 'cliente_comprador', 'cliente_proprietario')),
  origem text,
  ultimo_contacto_em timestamptz,
  proxima_accao_em timestamptz,
  criado_em timestamptz not null default now()
);

create table imoveis (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  proprietario_contacto_id uuid references contactos(id) on delete set null,
  tipologia text,
  zona text,
  preco_listagem numeric,
  preco_expectativa_proprietario numeric,
  motivo_venda text,
  prazo_venda text,
  cadencia_update_dias int not null default 7,
  proximo_update_em timestamptz,
  estado text not null default 'disponivel'
    check (estado in ('disponivel', 'em_negociacao', 'vendido', 'retirado')),
  criado_em timestamptz not null default now()
);

create table visitas_imovel (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  imovel_id uuid not null references imoveis(id) on delete cascade,
  comprador_contacto_id uuid not null references contactos(id) on delete cascade,
  data_visita timestamptz not null default now(),
  feedback text,
  interesse text check (interesse in ('sim', 'nao', 'talvez')),
  estado text not null default 'visitado'
    check (estado in ('visitado', 'proposta_feita', 'recusado', 'standby'))
);

create table propostas (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  imovel_id uuid not null references imoveis(id) on delete cascade,
  comprador_contacto_id uuid not null references contactos(id) on delete cascade,
  valor numeric not null,
  condicoes text,
  data_proposta timestamptz not null default now(),
  resposta text not null default 'pendente'
    check (resposta in ('pendente', 'aceite', 'recusada', 'contraproposta'))
);

-- Contraparte: agente de outra agência numa transação com dois lados. Só
-- estado objetivo da cooperação, nunca opinião subjetiva do cliente (ver
-- especificacao-produto.md, secção 2).
create table contrapartes (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  negocio_imovel_id uuid not null references imoveis(id) on delete cascade,
  agencia text not null,
  nome_agente text not null,
  contacto text,
  visita_feita boolean not null default false,
  feedback_dado boolean not null default false,
  proposta_pendente boolean not null default false
);

-- Registo cronológico transversal - resolve o pain point "a quem já dei
-- seguimento esta semana" sem esforço extra do agente (ver
-- especificacao-produto.md, secção 1, pain point 6).
create table atividades (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes(id) on delete cascade,
  contacto_id uuid references contactos(id) on delete cascade,
  imovel_id uuid references imoveis(id) on delete cascade,
  tipo text not null check (tipo in ('chamada', 'visita', 'nota', 'mensagem', 'email')),
  descricao text not null,
  criado_por uuid not null references auth.users(id),
  criado_em timestamptz not null default now()
);

create index on membros_organizacao (organizacao_id);
create index on contactos (organizacao_id);
create index on imoveis (organizacao_id);
create index on imoveis (proprietario_contacto_id);
create index on visitas_imovel (organizacao_id);
create index on visitas_imovel (imovel_id);
create index on propostas (organizacao_id);
create index on contrapartes (organizacao_id);
create index on atividades (organizacao_id);
create index on atividades (contacto_id);

alter table organizacoes enable row level security;
alter table membros_organizacao enable row level security;
alter table convites enable row level security;
alter table contactos enable row level security;
alter table imoveis enable row level security;
alter table visitas_imovel enable row level security;
alter table propostas enable row level security;
alter table contrapartes enable row level security;
alter table atividades enable row level security;

create policy "membro ve a sua organizacao"
  on organizacoes for select
  using (id = organizacao_atual());

create policy "membro ve membros da sua organizacao"
  on membros_organizacao for select
  using (organizacao_id = organizacao_atual());

create policy "admin/owner gere convites da sua organizacao"
  on convites for all
  using (organizacao_id = organizacao_atual());

create policy "membro gere contactos da sua organizacao"
  on contactos for all
  using (organizacao_id = organizacao_atual());

create policy "membro gere imoveis da sua organizacao"
  on imoveis for all
  using (organizacao_id = organizacao_atual());

create policy "membro gere visitas da sua organizacao"
  on visitas_imovel for all
  using (organizacao_id = organizacao_atual());

create policy "membro gere propostas da sua organizacao"
  on propostas for all
  using (organizacao_id = organizacao_atual());

create policy "membro gere contrapartes da sua organizacao"
  on contrapartes for all
  using (organizacao_id = organizacao_atual());

create policy "membro gere atividades da sua organizacao"
  on atividades for all
  using (organizacao_id = organizacao_atual());
