-- Testers do Cockpit: quem está a experimentar a app até ao fim do ano. Pode correr-se mais de uma vez.
create table if not exists public.testers (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  agencia text,
  email text,
  telemovel text,
  estado text not null default 'convidado' check (estado in ('convidado', 'a_testar', 'a_avaliar', 'convertido', 'desistiu')),
  inicio date not null default current_date,
  fim date not null default date '2026-12-31',
  feedback text,
  entidade_id uuid references public.entidades (id) on delete set null,   -- preenchido quando passa a cliente
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index if not exists testers_estado on public.testers (estado);

alter table public.testers enable row level security;
drop policy if exists socios_tudo on public.testers;
create policy socios_tudo on public.testers for all to authenticated using (public.e_socio()) with check (public.e_socio());
drop trigger if exists auditoria on public.testers;
create trigger auditoria after insert or update or delete on public.testers for each row execute function public.registar_auditoria();
