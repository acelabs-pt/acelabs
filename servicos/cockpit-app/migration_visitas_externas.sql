-- Visitas à angariação de clientes de outro consultor (só o nome do consultor, sem dados do cliente).
create table if not exists visitas_externas (
  id uuid primary key default gen_random_uuid(),
  angariacao_id uuid not null references angariacoes(id) on delete cascade,
  consultor text not null,
  data date not null default current_date,
  obs text,
  created_at timestamptz not null default now()
);
create index if not exists visitas_externas_angariacao on visitas_externas (angariacao_id);

alter table visitas_externas enable row level security;
create policy "autenticado total" on visitas_externas for all to authenticated using (true) with check (true);
