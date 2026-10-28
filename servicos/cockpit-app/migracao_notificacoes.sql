-- Cockpit: notificações push (iPhone e Android, com a app instalada no ecrã inicial).
-- Correr uma vez no SQL Editor do Supabase de cada cliente, depois de migracao_seguranca.sql
-- (usa a função e_membro()). Só acrescenta tabelas; não mexe em dados existentes.

-- 1. Um registo por telemóvel/browser que aceitou notificações. O endpoint é o endereço do
--    serviço de push da Apple/Google para esse aparelho; p256dh e auth são as chaves para cifrar.
create table if not exists push_subscricoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  aparelho text,
  created_at timestamptz not null default now()
);
alter table push_subscricoes enable row level security;
drop policy if exists "o proprio aparelho" on push_subscricoes;
-- Cada membro só vê e gere os seus próprios aparelhos.
create policy "o proprio aparelho" on push_subscricoes for all to authenticated
  using (e_membro() and user_id = auth.uid())
  with check (e_membro() and user_id = auth.uid());

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
