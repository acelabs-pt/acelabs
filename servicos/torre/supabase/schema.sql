-- Torre: schema da fase 1 (contas, categorias, entidades, débitos diretos, movimentos, importações, regras, sócios).
-- Projeto Supabase próprio da Torre (nunca o de um cliente nem o Demo do Cockpit).
-- Pode correr-se duas vezes sem erro. Valores em cêntimos (bigint); datas em date.
--
-- Acesso: só contas na tabela `socios`, ativas e com sessão iniciada (email e password). Sem isto, nada se lê nem se escreve.
-- A chave anon não tem acesso a nenhuma tabela. A service_role (scripts locais) passa ao lado das regras, como sempre.

create extension if not exists pgcrypto;

-- Sócios ------------------------------------------------------------------------------------------------------------
create table if not exists public.socios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nome text not null,
  email text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- PIN temporário: o sócio acabou de ser criado (ou o PIN foi reposto) e tem de escolher o seu antes de usar a Torre.
alter table public.socios add column if not exists pin_temporario boolean not null default false;

-- Quem pode entrar: sócio ativo com sessão iniciada (sem 2FA, decisão do Pedro, 2026-11-06).
create or replace function public.e_socio() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.socios where user_id = (select auth.uid()) and ativo);
$$;
revoke all on function public.e_socio() from public, anon;
grant execute on function public.e_socio() to authenticated;

-- Contas --------------------------------------------------------------------------------------------------------------
create table if not exists public.contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('empresa', 'conjunta', 'pessoal', 'cartao')),
  titular uuid references public.socios (id) on delete restrict,
  banco text,
  ultimos4 text check (ultimos4 is null or ultimos4 ~ '^[0-9]{4}$'),
  saldo_inicial bigint not null default 0,
  modelo_extrato jsonb,
  ativa boolean not null default true,
  criada_em timestamptz not null default now(),
  constraint pessoal_tem_titular check (tipo <> 'pessoal' or titular is not null),
  constraint conjunta_sem_titular check (tipo <> 'conjunta' or titular is null)
);

create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null check (tipo in ('custo', 'proveito', 'interno')),
  grupo text not null,
  codigo_snc text,
  ordem int not null default 0,
  ativa boolean not null default true,
  unique (nome, tipo)
);

create table if not exists public.entidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  nif text,
  email text,
  tipo text not null default 'fornecedor' check (tipo in ('fornecedor', 'cliente', 'ambos')),
  notas text,
  criada_em timestamptz not null default now()
);

-- Débitos diretos e outras despesas recorrentes ----------------------------------------------------------------------
create table if not exists public.subscricoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  entidade_id uuid references public.entidades (id) on delete set null,
  categoria_id uuid references public.categorias (id) on delete set null,
  conta_id uuid references public.contas (id) on delete set null,
  valor_previsto bigint check (valor_previsto is null or valor_previsto >= 0),
  moeda text not null default 'EUR',
  periodicidade text not null default 'mensal' check (periodicidade in ('mensal', 'trimestral', 'anual')),
  dia smallint not null default 1 check (dia between 1 and 31),
  inicio date not null default current_date,
  padrao text,
  debito_direto boolean not null default true,
  ativa boolean not null default true,
  notas text,
  criada_em timestamptz not null default now()
);

-- Movimentos ----------------------------------------------------------------------------------------------------------
create table if not exists public.importacoes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas (id) on delete cascade,
  ficheiro text,
  linhas int not null default 0,
  novas int not null default 0,
  duplicadas int not null default 0,
  criada_por uuid default auth.uid(),
  criada_em timestamptz not null default now()
);

create table if not exists public.movimentos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas (id) on delete restrict,
  data date not null,
  descricao text not null,
  valor bigint not null check (valor <> 0),
  categoria_id uuid references public.categorias (id) on delete set null,
  entidade_id uuid references public.entidades (id) on delete set null,
  subscricao_id uuid references public.subscricoes (id) on delete set null,
  socio_id uuid references public.socios (id) on delete set null,
  reembolsavel boolean not null default false,
  origem text not null default 'manual' check (origem in ('manual', 'extrato')),
  importacao_id uuid references public.importacoes (id) on delete set null,
  hash text,
  notas text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (conta_id, hash)
);
create index if not exists movimentos_data on public.movimentos (data desc);
create index if not exists movimentos_conta on public.movimentos (conta_id, data desc);

create table if not exists public.regras (
  id uuid primary key default gen_random_uuid(),
  texto text not null unique,
  categoria_id uuid references public.categorias (id) on delete cascade,
  entidade_id uuid references public.entidades (id) on delete cascade,
  subscricao_id uuid references public.subscricoes (id) on delete cascade,
  criada_em timestamptz not null default now()
);

-- Faturas (fase 2) ----------------------------------------------------------------------------------------------------
-- A Torre não emite faturas (isso é do software certificado): guarda as recebidas e as emitidas, com o ficheiro, e liga
-- cada uma ao movimento do banco que a pagou. Os dados vêm do código QR da AT (exatos) e/ou da leitura por IA.
create table if not exists public.faturas (
  id uuid primary key default gen_random_uuid(),
  sentido text not null default 'recebida' check (sentido in ('recebida', 'emitida')),
  estado text not null default 'rever' check (estado in ('rever', 'confirmada', 'anulada')),
  entidade_id uuid references public.entidades (id) on delete set null,
  emitente_nome text,
  emitente_nif text,
  adquirente_nif text,
  numero text,
  atcud text,
  tipo_doc text,
  data date,
  vencimento date,
  moeda text not null default 'EUR',
  base bigint,
  iva bigint,
  total bigint,
  -- Total em EUR (cêntimos) quando a fatura vem noutra moeda; preenchido pelo movimento ligado ou à mão.
  total_eur bigint,
  descricao text,
  categoria_id uuid references public.categorias (id) on delete set null,
  movimento_id uuid unique references public.movimentos (id) on delete set null,
  origem_dados text not null default 'manual' check (origem_dados in ('qr', 'ia', 'qr+ia', 'manual')),
  -- O que veio de onde ({"total":"qr","descricao":"ia"...}) e as dúvidas da leitura, para a revisão.
  fontes jsonb not null default '{}'::jsonb,
  duvidas text[] not null default '{}',
  ficheiro text,
  ficheiro_nome text,
  ficheiro_tipo text,
  ficheiro_hash text unique,
  notas text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists faturas_data on public.faturas (data desc);
create unique index if not exists faturas_emitente_numero on public.faturas (emitente_nif, numero) where emitente_nif is not null and numero is not null;

-- Contratos com clientes (fase 3) -------------------------------------------------------------------------------------
-- O que se vendeu a cada cliente: valor de arranque (uma vez, em `inicio`) e mensalidade (todos os meses, no `dia`, até ao
-- `fim`). Alimenta a mensalidade recorrente (MRR) e a previsão de caixa. Não é a fatura: essa vem do software certificado.
create table if not exists public.contratos (
  id uuid primary key default gen_random_uuid(),
  entidade_id uuid not null references public.entidades (id) on delete restrict,
  produto text not null check (produto in ('diagnostico', 'painel', 'automacao', 'formacao', 'cpcv', 'cockpit', 'medida')),
  nome text,
  estado text not null default 'ativo' check (estado in ('proposta', 'ativo', 'pausado', 'terminado')),
  setup bigint not null default 0 check (setup >= 0),
  mensalidade bigint not null default 0 check (mensalidade >= 0),
  inicio date not null,
  fim date,
  dia int not null default 1 check (dia between 1 and 31),
  notas text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create index if not exists contratos_entidade on public.contratos (entidade_id);

-- Capital, suprimentos e reembolsos entre cada sócio e a empresa ----------------------------------------------------
create table if not exists public.socios_movimentos (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references public.socios (id) on delete restrict,
  tipo text not null check (tipo in ('capital', 'suprimento', 'reembolso')),
  data date not null,
  valor bigint not null check (valor > 0),
  conta_id uuid references public.contas (id) on delete set null,
  notas text,
  criado_em timestamptz not null default now()
);

-- Registo de ações ----------------------------------------------------------------------------------------------------
create table if not exists public.auditoria (
  id bigserial primary key,
  quando timestamptz not null default now(),
  quem text not null,
  tabela text not null,
  operacao text not null,
  registo uuid,
  resumo text
);
create index if not exists auditoria_quando on public.auditoria (quando desc);

create or replace function public.registar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  q text;
begin
  -- Linhas importadas de um extrato não se registam uma a uma: fica a importação.
  -- (lê-se do jsonb: as outras tabelas não têm a coluna `origem`.)
  if tg_table_name = 'movimentos' and tg_op = 'INSERT' and r ->> 'origem' = 'extrato' then
    return null;
  end if;
  select nome into q from public.socios where user_id = auth.uid();
  insert into public.auditoria (quem, tabela, operacao, registo, resumo)
  values (
    coalesce(q, case when auth.uid() is null then 'sistema' else 'desconhecido' end),
    tg_table_name,
    lower(tg_op),
    (r ->> 'id')::uuid,
    left(coalesce(r ->> 'descricao', r ->> 'nome', r ->> 'texto', r ->> 'emitente_nome', r ->> 'ficheiro_nome', r ->> 'ficheiro', r ->> 'tipo', r ->> 'produto', ''), 120)
  );
  return null;
end $$;
revoke all on function public.registar_auditoria() from public, anon, authenticated;

-- Regras de acesso ----------------------------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['contas', 'categorias', 'entidades', 'subscricoes', 'importacoes', 'movimentos', 'regras', 'socios_movimentos', 'faturas', 'contratos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists socios_tudo on public.%I', t);
    execute format('create policy socios_tudo on public.%I for all to authenticated using (public.e_socio()) with check (public.e_socio())', t);
    execute format('drop trigger if exists auditoria on public.%I', t);
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registar_auditoria()', t);
  end loop;
end $$;

-- Sócios e registo: só leitura (escrevem-se pelo script `npm run socio` e pelo gatilho).
alter table public.socios enable row level security;
drop policy if exists socios_ler on public.socios;
create policy socios_ler on public.socios for select to authenticated using (public.e_socio());

alter table public.auditoria enable row level security;
drop policy if exists auditoria_ler on public.auditoria;
create policy auditoria_ler on public.auditoria for select to authenticated using (public.e_socio());

-- Ficheiros das faturas: armazenamento privado, só sócios (a app lê-os pelo servidor, nunca por endereço público).
insert into storage.buckets (id, name, public, file_size_limit)
values ('faturas', 'faturas', false, 10485760)
on conflict (id) do update set public = false;
drop policy if exists faturas_socios on storage.objects;
create policy faturas_socios on storage.objects for all to authenticated
  using (bucket_id = 'faturas' and public.e_socio())
  with check (bucket_id = 'faturas' and public.e_socio());

-- Entrar com PIN: falhas por email (10 em 30 minutos bloqueiam esse email durante 30 minutos). Ninguém lê a tabela; só
-- estas funções mexem nela. O PIN em si nunca chega aqui: a password do Supabase deriva do PIN com um segredo do servidor.
create table if not exists public.pin_falhas (
  email text primary key,
  n int not null default 0,
  ultima timestamptz not null default now()
);
alter table public.pin_falhas enable row level security;

create or replace function public.pin_bloqueado(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select n >= 10 and ultima > now() - interval '30 minutes' from public.pin_falhas where email = lower(p_email)), false);
$$;
create or replace function public.pin_falhou(p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.pin_falhas (email, n, ultima) values (lower(p_email), 1, now())
  on conflict (email) do update
    set n = case when public.pin_falhas.ultima < now() - interval '30 minutes' then 1 else public.pin_falhas.n + 1 end,
        ultima = now();
end $$;
-- Só quem acabou de entrar limpa as suas próprias falhas.
create or replace function public.pin_ok() returns void
language sql security definer set search_path = public as $$
  delete from public.pin_falhas where email = lower((select email from auth.users where id = (select auth.uid())));
$$;
-- O ecrã de entrar mostra uma lista com os nomes dos sócios ativos (sem emails); quem escolhe um nome entra com o PIN.
create or replace function public.socios_para_entrar() returns table (id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select s.id, s.nome from public.socios s where s.ativo order by s.nome;
$$;
create or replace function public.email_do_socio(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select s.email from public.socios s where s.id = p_id and s.ativo;
$$;
revoke all on function public.socios_para_entrar() from public;
revoke all on function public.email_do_socio(uuid) from public;
grant execute on function public.socios_para_entrar() to anon, authenticated;
grant execute on function public.email_do_socio(uuid) to anon, authenticated;

-- O próprio sócio marca que já escolheu o seu PIN (a tabela `socios` é só de leitura para a app).
create or replace function public.pin_escolhido() returns void
language sql security definer set search_path = public as $$
  update public.socios set pin_temporario = false where user_id = (select auth.uid());
$$;
revoke all on function public.pin_escolhido() from public, anon;
grant execute on function public.pin_escolhido() to authenticated;

revoke all on function public.pin_bloqueado(text) from public;
revoke all on function public.pin_falhou(text) from public;
revoke all on function public.pin_ok() from public, anon;
grant execute on function public.pin_bloqueado(text) to anon, authenticated;
grant execute on function public.pin_falhou(text) to anon, authenticated;
grant execute on function public.pin_ok() to authenticated;

-- A chave anon (pública) não toca em nada.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Categorias iniciais (podem mudar-se nas Definições) -------------------------------------------------------------
insert into public.categorias (nome, tipo, grupo, ordem) values
  ('Alojamento e bases de dados', 'custo', 'Software e alojamento', 10),
  ('Software e subscrições', 'custo', 'Software e alojamento', 11),
  ('Email e domínio', 'custo', 'Software e alojamento', 12),
  ('APIs de IA', 'custo', 'Inteligência artificial', 20),
  ('Publicidade', 'custo', 'Marketing e vendas', 30),
  ('Prospeção', 'custo', 'Marketing e vendas', 31),
  ('Deslocações e combustível', 'custo', 'Deslocações', 40),
  ('Refeições', 'custo', 'Deslocações', 41),
  ('Contabilidade', 'custo', 'Serviços externos', 50),
  ('Jurídico e notariado', 'custo', 'Serviços externos', 51),
  ('Taxas bancárias', 'custo', 'Taxas e impostos', 60),
  ('Impostos e taxas', 'custo', 'Taxas e impostos', 61),
  ('Equipamento informático', 'custo', 'Equipamento', 70),
  ('Formação e livros', 'custo', 'Formação', 80),
  ('Despesas de constituição', 'custo', 'Constituição', 90),
  ('Outros custos', 'custo', 'Outros custos', 99),
  ('Diagnóstico', 'proveito', 'Projetos', 10),
  ('Implementação', 'proveito', 'Projetos', 11),
  ('Mensalidades', 'proveito', 'Mensalidades', 20),
  ('Formação a clientes', 'proveito', 'Formação', 30),
  ('Outros proveitos', 'proveito', 'Outros proveitos', 99),
  ('Transferência entre contas', 'interno', 'Movimentos internos', 10),
  ('Entrada de capital', 'interno', 'Movimentos internos', 11),
  ('Suprimentos', 'interno', 'Movimentos internos', 12),
  ('Reembolso a sócio', 'interno', 'Movimentos internos', 13),
  ('Entrega de IVA', 'interno', 'Movimentos internos', 14)
on conflict (nome, tipo) do nothing;

-- Despesas sem conta de banco (ainda não há conta da empresa): o movimento fica só com o sócio que pagou.
alter table public.movimentos alter column conta_id drop not null;
