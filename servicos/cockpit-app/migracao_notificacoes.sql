-- Cockpit: notificações push (iPhone e Android, com a app instalada no ecrã inicial).
-- Correr uma vez no SQL Editor do Supabase de cada cliente, depois de migracao_seguranca.sql
-- (usa a função e_membro()). Só acrescenta tabelas; não mexe em dados existentes.

-- 1. Um registo por aparelho que aceitou notificações.
--    tipo 'web': browser ou app instalada (PWA). O endpoint é o endereço do serviço de push desse aparelho;
--    p256dh e auth são as chaves para cifrar.
--    tipo 'ios': app da App Store. O token é o identificador do aparelho na Apple (APNs).
--    tipo 'android': app Android (APK ou Google Play). O token é o do Firebase Cloud Messaging (FCM).
create table if not exists push_subscricoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text not null default 'web' check (tipo in ('web', 'ios', 'android')),
  endpoint text unique,
  p256dh text,
  auth text,
  token text unique,
  aparelho text,
  created_at timestamptz not null default now(),
  check ((tipo = 'web' and endpoint is not null and p256dh is not null and auth is not null)
      or (tipo in ('ios', 'android') and token is not null))
);
-- Quem já correu a versão antiga (só web) passa a ter as colunas novas. Pode correr-se outra vez.
alter table push_subscricoes add column if not exists tipo text not null default 'web';
alter table push_subscricoes add column if not exists token text;
alter table push_subscricoes alter column endpoint drop not null;
alter table push_subscricoes alter column p256dh drop not null;
alter table push_subscricoes alter column auth drop not null;
create unique index if not exists push_subscricoes_token_key on push_subscricoes (token);
alter table push_subscricoes drop constraint if exists push_subscricoes_tipo_check;
alter table push_subscricoes add constraint push_subscricoes_tipo_check check (tipo in ('web', 'ios', 'android'));
alter table push_subscricoes drop constraint if exists push_subscricoes_check;
alter table push_subscricoes add constraint push_subscricoes_check check (
  (tipo = 'web' and endpoint is not null and p256dh is not null and auth is not null) or (tipo in ('ios', 'android') and token is not null));
alter table push_subscricoes enable row level security;
drop policy if exists "o proprio aparelho" on push_subscricoes;
-- Cada membro só vê e gere os seus próprios aparelhos.
create policy "o proprio aparelho" on push_subscricoes for all to authenticated
  using (e_membro() and user_id = auth.uid())
  with check (e_membro() and user_id = auth.uid());

-- Registo do aparelho nativo (iPhone ou Android). O mesmo telemóvel pode passar de um utilizador para outro (logout e
-- login de outra pessoa): o token fica ligado a quem se registou por último. Uma função (security definer) porque as
-- regras acima só deixam cada membro mexer nas suas linhas.
create or replace function registar_push_nativo(p_token text, p_tipo text, p_aparelho text default null) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not e_membro() then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_tipo not in ('ios', 'android') then
    raise exception 'tipo de aparelho inválido' using errcode = '22023';
  end if;
  insert into push_subscricoes (user_id, tipo, token, aparelho) values (auth.uid(), p_tipo, p_token, p_aparelho)
  on conflict (token) do update set user_id = auth.uid(), tipo = excluded.tipo, aparelho = excluded.aparelho;
end $$;
revoke all on function registar_push_nativo(text, text, text) from public, anon;
grant execute on function registar_push_nativo(text, text, text) to authenticated;

-- Mantida por compatibilidade com a app já publicada (TestFlight): regista como iOS.
create or replace function registar_push_ios(p_token text, p_aparelho text default null) returns void
language sql security definer set search_path = public
as $$ select registar_push_nativo(p_token, 'ios', p_aparelho) $$;
revoke all on function registar_push_ios(text, text) from public, anon;
grant execute on function registar_push_ios(text, text) to authenticated;

-- 2. O que já foi enviado, para o mesmo lembrete nunca sair duas vezes
--    (ex.: "evento-<id da tarefa>", "resumo-2026-10-26"). Só a função de envio escreve aqui.
create table if not exists notificacoes_enviadas (
  chave text primary key,
  enviada_em timestamptz not null default now()
);
alter table notificacoes_enviadas enable row level security;
-- Sem políticas: nenhuma sessão de utilizador lê nem escreve; só a função do servidor (service role).

-- 3. Lembretes automáticos (opcional, depois de publicar a função enviar-lembretes, ver LEIAME.md):
--    corre a função de 5 em 5 minutos. Trocar <PROJECT_REF> e <CRON_SECRET> antes de correr.
--    Precisa das extensões pg_cron e pg_net (Database, Extensions).
-- select cron.schedule(
--   'cockpit-lembretes',
--   '*/5 * * * *',
--   $$ select net.http_post(
--        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/enviar-lembretes',
--        headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET>', 'Content-Type', 'application/json'),
--        body := '{}'::jsonb
--      ) $$
-- );
