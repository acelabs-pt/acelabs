-- Cockpit: várias empresas (clientes) no MESMO projeto Supabase, cada uma isolada das outras.
--
-- Antes: um projeto Supabase por cliente. Agora: um projeto partilhado; cada linha de dados leva `empresa_id` e as
-- regras de acesso (RLS) só deixam cada membro ver e mexer nas linhas da sua empresa.
--
-- COMO FUNCIONA
--   empresas        uma linha por cliente (codigo curto, nome, suspensa).
--   membros         agora liga o utilizador a UMA empresa (membros.empresa_id).
--   empresa_atual() devolve a empresa da sessão (ou null se não é membro, ou se a empresa está suspensa).
--   Cada tabela de dados: coluna empresa_id (obrigatória), preenchida sozinha no INSERT com a empresa da sessão, e uma
--   regra única "da minha empresa". A app não muda os pedidos: as listas já vêm filtradas pela base de dados.
--   Quem escreve com a chave de administrador (scripts, testes, plataforma de controlo) tem de indicar empresa_id quando
--   existe mais do que uma empresa. Com uma só empresa, a base usa essa (modo de um cliente, como antes).
--
-- SEGURANÇA
--   Uma sessão sem empresa (não é membro, ou empresa suspensa) não vê nada. Uma linha só pode ser criada na empresa da
--   sessão (with check). Apagar uma empresa apaga os seus dados (on delete cascade); os utilizadores de login
--   (auth.users) apaga-os a plataforma de controlo.
--
-- Correr no SQL Editor do Supabase, DEPOIS de todas as outras migrações (o ficheiro instalar_tudo.sql já o faz por ordem).
-- Pode correr-se outra vez sem estragar nada. Numa base que já tem dados e membros, cria a empresa "padrao" e passa tudo
-- para ela. Numa base nova e vazia, não cria empresa nenhuma: criar com scripts/empresa.mjs ou pela plataforma de controlo.

-- ---------------------------------------------------------------------------
-- 1. Empresas
-- ---------------------------------------------------------------------------
create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[a-z0-9-]+$'),
  nome text not null,
  suspensa boolean not null default false,   -- suspensa: os membros deixam de ver dados, nada é apagado
  criada_em timestamptz not null default now()
);
alter table empresas enable row level security;

alter table membros add column if not exists empresa_id uuid references empresas(id) on delete cascade;

-- Base que já existia (um cliente por projeto): cria a empresa "padrao" e passa os membros para ela.
do $$
begin
  if not exists (select 1 from empresas) and (exists (select 1 from membros) or exists (select 1 from contactos)) then
    insert into empresas (codigo, nome) values ('padrao', 'Empresa');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Funções
-- ---------------------------------------------------------------------------
-- A única empresa, se só existir uma (modo de um cliente por projeto). Com mais de uma devolve null.
create or replace function unica_empresa() returns uuid
language sql stable security definer set search_path = public
as $$ select id from empresas where (select count(*) from empresas) = 1 limit 1 $$;

-- A empresa desta sessão. Null se não é membro ou se a empresa está suspensa.
create or replace function empresa_atual() returns uuid
language sql stable security definer set search_path = public
as $$
  select m.empresa_id
  from membros m join empresas e on e.id = m.empresa_id
  where m.user_id = auth.uid() and not e.suspensa
$$;

-- "Esta sessão é de um membro (de uma empresa ativa)?" Mantém o nome usado pelas outras migrações.
create or replace function e_membro() returns boolean
language sql stable security definer set search_path = public
as $$ select empresa_atual() is not null $$;

-- Preenche empresa_id no INSERT: a da sessão; se não houver sessão (chave de administrador) e existir só uma empresa, essa.
-- Com várias empresas e sem empresa_id explícito o INSERT falha de propósito (nunca escolhe uma ao acaso).
create or replace function definir_empresa() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.empresa_id is null then
    new.empresa_id := coalesce(empresa_atual(), unica_empresa());
  end if;
  return new;
end $$;

revoke all on function unica_empresa(), empresa_atual(), e_membro(), definir_empresa() from public, anon;
grant execute on function empresa_atual(), e_membro() to authenticated, service_role;
grant execute on function unica_empresa(), definir_empresa() to service_role;

-- A empresa só pode ser lida pelos seus membros (por exemplo, para mostrar o nome em Conta).
drop policy if exists "a minha empresa" on empresas;
create policy "a minha empresa" on empresas for select to authenticated using (id = (select empresa_atual()));

-- ---------------------------------------------------------------------------
-- 3. Membros
-- ---------------------------------------------------------------------------
update membros set empresa_id = unica_empresa() where empresa_id is null;
do $$
begin
  if exists (select 1 from membros where empresa_id is null) then
    raise exception 'Há membros sem empresa e existe mais do que uma empresa: atribuir membros.empresa_id à mão antes de continuar.';
  end if;
end $$;
alter table membros alter column empresa_id set not null;
create index if not exists membros_empresa on membros (empresa_id);
drop trigger if exists t_membros_empresa on membros;
create trigger t_membros_empresa before insert on membros for each row execute function definir_empresa();

-- ---------------------------------------------------------------------------
-- 4. Tabelas de dados: empresa_id, preenchimento automático e regra "da minha empresa"
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'contactos', 'compradores', 'comprador_imoveis', 'comprador_documentos', 'comprador_zonas',
    'proprietarios', 'chamadas', 'angariacoes', 'angariacao_acoes', 'tarefas', 'correspondencias',
    'metas', 'metas_config', 'metas_semanas'
  ] loop
    execute format('alter table %I add column if not exists empresa_id uuid references empresas(id) on delete cascade', t);
    execute format('update %I set empresa_id = unica_empresa() where empresa_id is null', t);
  end loop;
end $$;

do $$
declare t text; sobra boolean;
begin
  foreach t in array array[
    'contactos', 'compradores', 'comprador_imoveis', 'comprador_documentos', 'comprador_zonas',
    'proprietarios', 'chamadas', 'angariacoes', 'angariacao_acoes', 'tarefas', 'correspondencias',
    'metas', 'metas_config', 'metas_semanas'
  ] loop
    execute format('select exists (select 1 from %I where empresa_id is null)', t) into sobra;
    if sobra then
      raise exception 'A tabela % tem linhas sem empresa e existe mais do que uma empresa: atribuir empresa_id à mão antes de continuar.', t;
    end if;
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

-- ---------------------------------------------------------------------------
-- 5. Chaves únicas que passam a ser por empresa (duas empresas podem ter a mesma meta, o mesmo ano, a mesma semana)
-- ---------------------------------------------------------------------------
drop index if exists tarefas_chave_automacao_idx;
create unique index if not exists tarefas_empresa_chave on tarefas (empresa_id, chave_automacao) where chave_automacao is not null;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'metas_ano_metrica_key') then
    alter table metas drop constraint metas_ano_metrica_key;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'metas_empresa_ano_metrica_key') then
    alter table metas add constraint metas_empresa_ano_metrica_key unique (empresa_id, ano, metrica);
  end if;
  if exists (select 1 from pg_constraint where conname = 'metas_config_pkey' and array_length(conkey, 1) = 1) then
    alter table metas_config drop constraint metas_config_pkey;
    alter table metas_config add primary key (empresa_id, ano);
  end if;
  if exists (select 1 from pg_constraint where conname = 'metas_semanas_pkey' and array_length(conkey, 1) = 1) then
    alter table metas_semanas drop constraint metas_semanas_pkey;
    alter table metas_semanas add primary key (empresa_id, semana);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Apagar a minha conta: o "último membro" passa a ser o último da MINHA empresa
-- ---------------------------------------------------------------------------
create or replace function apagar_minha_conta() returns void
language plpgsql security definer set search_path = public, auth
as $$
declare quem uuid := auth.uid();
declare emp uuid;
begin
  if quem is null then
    raise exception 'sem sessão' using errcode = '28000';
  end if;
  select empresa_id into emp from membros where user_id = quem;
  if emp is not null and (select count(*) from membros where empresa_id = emp) <= 1 then
    raise exception 'ultimo_membro' using errcode = 'P0001';
  end if;
  delete from auth.users where id = quem;
end $$;
revoke all on function apagar_minha_conta() from public, anon;
grant execute on function apagar_minha_conta() to authenticated;

-- Verificação: uma linha por tabela, todas com a regra "da minha empresa".
select tablename, policyname from pg_policies where schemaname = 'public' and policyname in ('da minha empresa', 'a minha empresa') order by tablename;
