create table if not exists alertas_match (
  comprador_id uuid not null references compradores(id) on delete cascade,
  proprietario_id uuid not null references proprietarios(id) on delete cascade,
  estado text not null check (estado in ('faz_sentido', 'nao_faz_sentido')),
  decidido_em timestamptz not null default now(),
  primary key (comprador_id, proprietario_id)
);

alter table alertas_match enable row level security;
create policy "autenticado total" on alertas_match for all to authenticated using (true) with check (true);
