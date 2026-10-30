-- Cockpit: administração das empresas (Pedro e Miguel) no projeto partilhado.
--
-- Acrescenta o que a página de administração precisa, SEM dar nada disto aos utilizadores dos clientes:
--   empresas_admin  dados internos de cada empresa (estado, contacto, responsável, notas, início). Fica numa tabela à parte,
--                   sem nenhuma regra de leitura, porque os membros leem a sua linha de `empresas` (nome) e não podem ver
--                   notas internas. Só a chave de administrador (plataforma de controlo) lê e escreve aqui.
--   auditoria       quem fez o quê (cada sócio assina os pedidos com a sua chave). Só a chave de administrador escreve e lê.
--   resumo_empresas()  uma linha por empresa para o Painel: utilizadores, último acesso, aparelhos com notificações e
--                   atividade dos últimos 7 dias. Só a chave de administrador a pode chamar.
--
-- Correr no SQL Editor do Supabase, DEPOIS de migracao_multiempresa.sql (o instalar_tudo.sql já o faz por ordem).
-- Pode correr-se outra vez sem estragar nada.

-- ---------------------------------------------------------------------------
-- 1. Dados internos da empresa
-- ---------------------------------------------------------------------------
create table if not exists empresas_admin (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  estado text not null default 'piloto' check (estado in ('piloto', 'ativa', 'suspensa', 'terminada')),
  contacto_nome text,
  contacto_email text,
  responsavel text,            -- quem da Ace Labs acompanha o cliente (pedro, miguel ou vazio)
  notas text,
  inicio date not null default current_date
);
alter table empresas_admin enable row level security;
-- Sem políticas de propósito: nenhuma sessão de utilizador lê nem escreve. Só a chave de administrador.
revoke all on empresas_admin from anon, authenticated;

-- Cada empresa tem sempre a sua linha de dados internos.
insert into empresas_admin (empresa_id, estado)
select e.id, case when e.suspensa then 'suspensa' else 'piloto' end from empresas e
on conflict (empresa_id) do nothing;

create or replace function criar_empresa_admin() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into empresas_admin (empresa_id, estado) values (new.id, case when new.suspensa then 'suspensa' else 'piloto' end)
  on conflict (empresa_id) do nothing;
  return new;
end $$;
revoke all on function criar_empresa_admin() from public, anon, authenticated;
drop trigger if exists t_empresa_admin on empresas;
create trigger t_empresa_admin after insert on empresas for each row execute function criar_empresa_admin();

-- Quem suspende ou reativa pelo script (empresas.suspensa) mantém o estado coerente.
create or replace function sincronizar_estado() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.suspensa is distinct from old.suspensa then
    if new.suspensa then
      update empresas_admin set estado = 'suspensa' where empresa_id = new.id and estado not in ('suspensa', 'terminada');
    else
      update empresas_admin set estado = 'ativa' where empresa_id = new.id and estado in ('suspensa', 'terminada');
    end if;
  end if;
  return new;
end $$;
revoke all on function sincronizar_estado() from public, anon, authenticated;
drop trigger if exists t_empresa_estado on empresas;
create trigger t_empresa_estado after update of suspensa on empresas for each row execute function sincronizar_estado();

-- ---------------------------------------------------------------------------
-- 2. Registo de ações
-- ---------------------------------------------------------------------------
create table if not exists auditoria (
  id bigint generated always as identity primary key,
  quando timestamptz not null default now(),
  quem text not null,                                   -- pedro, miguel (a chave que assinou o pedido)
  empresa_id uuid references empresas(id) on delete set null,
  empresa_codigo text,                                  -- fica mesmo depois de a empresa ser apagada
  acao text not null,
  detalhe jsonb not null default '{}'::jsonb
);
create index if not exists auditoria_quando on auditoria (quando desc);
create index if not exists auditoria_empresa on auditoria (empresa_codigo, quando desc);
alter table auditoria enable row level security;
revoke all on auditoria from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Resumo para o Painel
-- ---------------------------------------------------------------------------
create or replace function resumo_empresas()
returns table (
  id uuid, codigo text, nome text, estado text, suspensa boolean, criada_em timestamptz, inicio date,
  contacto_nome text, contacto_email text, responsavel text, notas text,
  utilizadores integer, convites_por_aceitar integer, ultimo_acesso timestamptz, aparelhos integer,
  compradores integer, proprietarios integer, angariacoes integer, tarefas integer, atividade_7d integer
)
language sql stable security definer set search_path = public
as $$
  select
    e.id, e.codigo, e.nome, a.estado, e.suspensa, e.criada_em, a.inicio,
    a.contacto_nome, a.contacto_email, a.responsavel, a.notas,
    (select count(*)::int from membros m where m.empresa_id = e.id),
    (select count(*)::int from membros m join auth.users u on u.id = m.user_id where m.empresa_id = e.id and u.last_sign_in_at is null),
    (select max(u.last_sign_in_at) from membros m join auth.users u on u.id = m.user_id where m.empresa_id = e.id),
    (select count(*)::int from push_subscricoes p join membros m on m.user_id = p.user_id where m.empresa_id = e.id),
    (select count(*)::int from compradores x where x.empresa_id = e.id),
    (select count(*)::int from proprietarios x where x.empresa_id = e.id),
    (select count(*)::int from angariacoes x where x.empresa_id = e.id),
    (select count(*)::int from tarefas x where x.empresa_id = e.id),
    (select count(*)::int from contactos x where x.empresa_id = e.id and x.created_at > now() - interval '7 days')
      + (select count(*)::int from compradores x where x.empresa_id = e.id and x.created_at > now() - interval '7 days')
      + (select count(*)::int from proprietarios x where x.empresa_id = e.id and x.created_at > now() - interval '7 days')
      + (select count(*)::int from angariacoes x where x.empresa_id = e.id and x.created_at > now() - interval '7 days')
      + (select count(*)::int from tarefas x where x.empresa_id = e.id and x.created_at > now() - interval '7 days')
  from empresas e join empresas_admin a on a.empresa_id = e.id
  order by e.criada_em
$$;
revoke all on function resumo_empresas() from public, anon, authenticated;
grant execute on function resumo_empresas() to service_role;

-- Contas sem empresa: entraram (ou foram convidadas) mas não estão em nenhuma lista de membros, por isso não veem dados.
create or replace function contas_sem_empresa() returns table (id uuid, email text, criado_em timestamptz, ultimo_acesso timestamptz)
language sql stable security definer set search_path = public
as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at from auth.users u
  where not exists (select 1 from membros m where m.user_id = u.id) order by u.created_at desc
$$;
revoke all on function contas_sem_empresa() from public, anon, authenticated;
grant execute on function contas_sem_empresa() to service_role;
