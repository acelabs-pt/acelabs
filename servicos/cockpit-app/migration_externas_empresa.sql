-- Liga visitas_externas e propostas_externas ao isolamento por empresa (as duas tabelas foram criadas antes de
-- migracao_multiempresa.sql incluir estas tabelas). Pode correr-se mais do que uma vez.
do $$
declare
  t text;
  v_empresa uuid := (select empresa_id from contactos where email = 'iamjoaocarvalho@gmail.com');
begin
  if v_empresa is null then
    raise exception 'Não encontrei a empresa do João Carvalho. Nada foi alterado.';
  end if;
  foreach t in array array['visitas_externas', 'propostas_externas'] loop
    execute format('alter table %I add column if not exists empresa_id uuid references empresas(id) on delete cascade', t);
    execute format('update %I set empresa_id = $1 where empresa_id is null', t) using v_empresa;
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
  end loop;
end $$;
