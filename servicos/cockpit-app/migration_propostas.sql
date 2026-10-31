-- Propostas por imóvel/angariação, com observações, e propostas de clientes de outro consultor.
alter table comprador_imoveis add column if not exists proposta_obs text;

create table if not exists propostas_externas (
  id uuid primary key default gen_random_uuid(),
  angariacao_id uuid not null references angariacoes(id) on delete cascade,
  consultor text not null,
  data date not null default current_date,
  obs text,
  created_at timestamptz not null default now()
);
create index if not exists propostas_externas_angariacao on propostas_externas (angariacao_id);

alter table propostas_externas enable row level security;
create policy "autenticado total" on propostas_externas for all to authenticated using (true) with check (true);
