-- Cockpit: só os membros convidados veem dados (segunda camada de segurança).
--
-- PORQUÊ: as regras atuais dizem "qualquer utilizador com sessão vê tudo". Se o registo público do Supabase
-- estiver ligado (vem ligado por defeito), qualquer pessoa com a chave pública pode criar conta e, com o SMTP
-- ligado, confirmar o email e entrar. A defesa principal é desligar o registo (Authentication, Sign In /
-- Providers, "Allow new users to sign up" desligado). Esta migração é a segunda camada: mesmo com o registo
-- ligado por engano, uma conta que não esteja em `membros` não vê nada.
--
-- ANTES DE CORRER: em Authentication, Users, confirmar que todos os utilizadores da lista são pessoas
-- convidadas. Todos os que existirem agora passam a membros (passo 2).
-- DEPOIS: novos utilizadores só veem dados quando o script de convite os junta a `membros`
-- (scripts/convidar.mjs já o faz).
-- Correr uma vez no SQL Editor do Supabase de cada cliente. Pode correr-se outra vez sem estragar nada.

-- 1. Lista de membros
create table if not exists membros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table membros enable row level security;
drop policy if exists "ver o proprio registo" on membros;
create policy "ver o proprio registo" on membros for select to authenticated using (user_id = auth.uid());

-- 2. Quem já existe passa a membro (rever a lista de utilizadores antes, ver acima)
insert into membros (user_id) select id from auth.users on conflict do nothing;

-- 3. "Esta sessão é de um membro?" (security definer: lê membros sem depender das regras dessa tabela)
create or replace function e_membro() returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from membros where user_id = auth.uid()) $$;

-- 4. Trocar as regras de todas as tabelas: de "autenticado total" para "só membros"
do $$
declare t text;
begin
  foreach t in array array[
    'contactos', 'compradores', 'comprador_imoveis', 'comprador_documentos', 'comprador_zonas',
    'proprietarios', 'chamadas', 'angariacoes', 'angariacao_acoes', 'tarefas', 'correspondencias',
    'metas', 'metas_config', 'metas_semanas'
  ] loop
    if to_regclass(t) is not null then
      execute format('alter table %I enable row level security', t);
      execute format('drop policy if exists "autenticado total" on %I', t);
      execute format('drop policy if exists "so membros" on %I', t);
      execute format('create policy "so membros" on %I for all to authenticated using (e_membro()) with check (e_membro())', t);
    end if;
  end loop;
end $$;

-- Verificação: deve devolver uma linha por tabela, todas com a regra "so membros".
select tablename, policyname from pg_policies where schemaname = 'public' order by tablename;
