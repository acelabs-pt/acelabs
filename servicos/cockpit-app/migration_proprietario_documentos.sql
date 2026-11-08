-- Documentos do proprietário (lista de documentos a entregar), já ligada ao isolamento por empresa.
-- Pode correr-se mais do que uma vez. Correr DEPOIS de migracao_multiempresa.sql.
create table if not exists proprietario_documentos (
  id uuid primary key default gen_random_uuid(),
  proprietario_id uuid not null references proprietarios(id) on delete cascade,
  nome text not null,
  entregue boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists proprietario_documentos_proprietario on proprietario_documentos (proprietario_id);

do $$
declare t text := 'proprietario_documentos';
begin
  execute format('alter table %I add column if not exists empresa_id uuid references empresas(id) on delete cascade', t);
  execute format('update %I set empresa_id = unica_empresa() where empresa_id is null', t);
  execute format('alter table %I alter column empresa_id set not null', t);
  execute format('create index if not exists %I on %I (empresa_id)', t || '_empresa', t);
  execute format('drop trigger if exists t_empresa on %I', t);
  execute format('create trigger t_empresa before insert on %I for each row execute function definir_empresa()', t);
  execute format('alter table %I enable row level security', t);
  execute format('drop policy if exists "autenticado total" on %I', t);
  execute format('drop policy if exists "so membros" on %I', t);
  execute format('drop policy if exists "da minha empresa" on %I', t);
  execute format(
    'create policy "da minha empresa" on %I for all to authenticated using (empresa_id = (select empresa_atual())) with check (empresa_id = (select empresa_atual()))',
    t
  );
end $$;
