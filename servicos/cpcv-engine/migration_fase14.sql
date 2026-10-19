-- =============================================================
-- CPCV com IA - Fase 14 (entrega de documentos pelo comprador/vendedor, por link privado)
-- Migracao aditiva sobre o schema ja em producao.
-- =============================================================

-- Links de entrega: o agente gera um por parte (comprador ou vendedor). Guarda-se so o hash do
-- token (SHA-256), nunca o token em claro. A pagina publica /cpcv/entrega/<token> valida o hash,
-- a validade e a revogacao. As rotas publicas usam o cliente de servico, por isso a tabela nao
-- precisa de policies para anonimos.
create table if not exists cpcv_links_cliente (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references cpcv_processos(id) on delete cascade,
  papel text not null check (papel in ('comprador','vendedor')),
  token_hash text not null unique,
  expira_em timestamptz not null,
  revogado boolean not null default false,
  criado_por uuid references profiles(id),
  criado_em timestamptz default now(),
  ultimo_uso_em timestamptz
);

alter table cpcv_links_cliente enable row level security;

drop policy if exists "links_cliente_select" on cpcv_links_cliente;
create policy "links_cliente_select" on cpcv_links_cliente
  for select using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );

drop policy if exists "links_cliente_update" on cpcv_links_cliente;
create policy "links_cliente_update" on cpcv_links_cliente
  for update using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );

-- Origem e estado de revisao dos ficheiros. Os existentes ficam como entregues pelo agente e
-- ja aceites; so os que vem do cliente entram como 'pendente' ate o agente os rever.
alter table cpcv_ficheiros add column if not exists origem text not null default 'agente'
  check (origem in ('agente','cliente'));
alter table cpcv_ficheiros add column if not exists estado_revisao text not null default 'aceite'
  check (estado_revisao in ('pendente','aceite','rejeitado'));
alter table cpcv_ficheiros add column if not exists link_id uuid references cpcv_links_cliente(id) on delete set null;

-- Aceitar/rejeitar ficheiros do cliente (antes so havia select e insert).
drop policy if exists "ficheiros_update" on cpcv_ficheiros;
create policy "ficheiros_update" on cpcv_ficheiros
  for update using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );
