-- =============================================================
-- CPCV com IA - Fase 6 (papel admin, convites dinâmicos, resumo por gestora)
-- Migração aditiva sobre o schema já em produção.
-- =============================================================

-- Novo papel "admin": acesso total (herda tudo o que a gestora tem) + gestão de
-- utilizadores e convites. Não se cria por convite dentro da app - só pelo código de
-- bootstrap CPCV_INVITE_ADMIN no .env (ver app/api/cpcv/registo/route.ts).
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('agente','gestora','admin'));

-- Mesmo padrão de is_gestora() (create_tables_cpcv.sql:18-25), security definer para não
-- entrar em recursão nas policies que a chamam.
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Alarga todas as policies que hoje só deixam a gestora ver/mexer em tudo, para o admin
-- também. Sem isto o admin fica sem ver nada nas páginas normais (sbUserServer() respeita
-- RLS) mesmo sendo "acesso total" ao nível da aplicação.
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles
  for select using (auth.uid() = id or is_gestora() or is_admin());

drop policy if exists "processos_select" on cpcv_processos;
create policy "processos_select" on cpcv_processos
  for select using (criado_por = auth.uid() or is_gestora() or is_admin());

drop policy if exists "processos_insert" on cpcv_processos;
create policy "processos_insert" on cpcv_processos
  for insert with check (criado_por = auth.uid() or is_gestora() or is_admin());

drop policy if exists "processos_update" on cpcv_processos;
create policy "processos_update" on cpcv_processos
  for update using (criado_por = auth.uid() or is_gestora() or is_admin());

drop policy if exists "processos_delete" on cpcv_processos;
create policy "processos_delete" on cpcv_processos
  for delete using (criado_por = auth.uid() or is_gestora() or is_admin());

drop policy if exists "partes_select" on cpcv_partes;
create policy "partes_select" on cpcv_partes
  for select using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );

drop policy if exists "partes_insert" on cpcv_partes;
create policy "partes_insert" on cpcv_partes
  for insert with check (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );

drop policy if exists "partes_update" on cpcv_partes;
create policy "partes_update" on cpcv_partes
  for update using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );

drop policy if exists "partes_delete" on cpcv_partes;
create policy "partes_delete" on cpcv_partes
  for delete using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );

drop policy if exists "ficheiros_select" on cpcv_ficheiros;
create policy "ficheiros_select" on cpcv_ficheiros
  for select using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );

drop policy if exists "ficheiros_insert" on cpcv_ficheiros;
create policy "ficheiros_insert" on cpcv_ficheiros
  for insert with check (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );

drop policy if exists "mensagens_select" on cpcv_mensagens;
create policy "mensagens_select" on cpcv_mensagens
  for select using (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );

drop policy if exists "mensagens_insert" on cpcv_mensagens;
create policy "mensagens_insert" on cpcv_mensagens
  for insert with check (
    exists (select 1 from cpcv_processos p where p.id = processo_id and (p.criado_por = auth.uid() or is_gestora() or is_admin()))
  );

drop policy if exists "cpcv_docs_select" on storage.objects;
create policy "cpcv_docs_select" on storage.objects
  for select using (
    bucket_id = 'cpcv-documentos' and (
      (storage.foldername(name))[1] = auth.uid()::text or is_gestora() or is_admin()
    )
  );

drop policy if exists "cpcv_docs_insert" on storage.objects;
create policy "cpcv_docs_insert" on storage.objects
  for insert with check (
    bucket_id = 'cpcv-documentos' and (
      (storage.foldername(name))[1] = auth.uid()::text or is_gestora() or is_admin()
    )
  );

drop policy if exists "cpcv_docs_update" on storage.objects;
create policy "cpcv_docs_update" on storage.objects
  for update using (
    bucket_id = 'cpcv-documentos' and (
      (storage.foldername(name))[1] = auth.uid()::text or is_gestora() or is_admin()
    )
  );

drop policy if exists "cpcv_docs_delete" on storage.objects;
create policy "cpcv_docs_delete" on storage.objects
  for delete using (
    bucket_id = 'cpcv-documentos' and (
      (storage.foldername(name))[1] = auth.uid()::text or is_gestora() or is_admin()
    )
  );

-- Quem aprovou/gerou o CPCV - só a partir de agora (processos já aprovados antes desta
-- migração ficam a null, mostrados como "sem gestora atribuída" no resumo por gestora).
alter table cpcv_processos add column if not exists aprovado_por uuid references profiles(id);

-- ---------------------------------------------------------------
-- cpcv_convites (convites dinâmicos - substituem os códigos fixos CPCV_INVITE_AGENTE/
-- CPCV_INVITE_GESTORA no .env). Sem "admin" no check de role de propósito - criar um admin
-- novo fica reservado ao código de bootstrap CPCV_INVITE_ADMIN, nunca por esta tabela.
-- ---------------------------------------------------------------
create table if not exists cpcv_convites (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  role text not null check (role in ('agente','gestora')),
  criado_por uuid not null references profiles(id),
  usado_por uuid references profiles(id),
  criado_em timestamptz default now(),
  usado_em timestamptz,
  expira_em timestamptz default (now() + interval '14 days'),
  revogado boolean not null default false
);

alter table cpcv_convites enable row level security;

create policy "convites_select" on cpcv_convites
  for select using (is_admin() or is_gestora());

-- A gestora só pode gerar convites de agente; o admin gera de agente ou gestora. Isto é a
-- rede de segurança ao nível da base de dados - a rota /api/cpcv/convites já força o role
-- certo no código, mas isto garante que um pedido directo à tabela não contorna a regra.
create policy "convites_insert" on cpcv_convites
  for insert with check (
    (is_admin() and role in ('agente','gestora'))
    or (is_gestora() and role = 'agente')
  );

-- Usado para revogar (marcar revogado = true) e para o registo marcar usado_por/usado_em.
-- Este último passa pelo cliente de service role (bypassa RLS), por isso esta policy só
-- é mesmo exercida quando a revogação acontece a partir da sessão de uma gestora/admin.
create policy "convites_update" on cpcv_convites
  for update using (is_admin() or (is_gestora() and criado_por = auth.uid() and role = 'agente'));
