-- "Reportar um problema" (beta): tabela feedback, já ligada ao isolamento por empresa, e bucket privado "feedback" no Storage.
-- Pode correr-se mais do que uma vez. Correr DEPOIS de migracao_multiempresa.sql.
-- Cada utilizador cria reportes só na sua empresa e vê só os seus; ninguém altera nem apaga. Os sócios leem com a chave de
-- administrador (função avisar-feedback, que manda o email com os links).

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  tipo text not null default 'erro' check (tipo in ('erro', 'sugestao')),
  texto text,
  pagina text,
  captura_path text,
  audio_path text,
  aparelho jsonb,
  versao text,
  estado text not null default 'novo' check (estado in ('novo', 'visto', 'resolvido')),
  check (coalesce(texto, '') <> '' or captura_path is not null or audio_path is not null)
);
create index if not exists feedback_criado_em on feedback (criado_em desc);

do $$
declare t text := 'feedback';
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
end $$;

drop policy if exists "feedback: inserir" on feedback;
drop policy if exists "feedback: ver os meus" on feedback;
create policy "feedback: inserir" on feedback for insert to authenticated
  with check (empresa_id = (select empresa_atual()) and user_id = (select auth.uid()));
create policy "feedback: ver os meus" on feedback for select to authenticated
  using (empresa_id = (select empresa_atual()) and user_id = (select auth.uid()));

-- Storage: bucket privado, 8 MB por ficheiro, só imagens e áudio. Ficheiros em <empresa_id>/<feedback_id>/captura.jpg|audio.<ext>.
-- Os utilizadores só podem CRIAR ficheiros dentro da pasta da sua empresa; não leem, não substituem, não apagam.
-- (Fica dentro de um bloco que só corre onde existe o Storage do Supabase, para o teste em memória continuar válido.)
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sem Storage (não é um projeto Supabase): bucket "feedback" não criado.';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('feedback', 'feedback', false, 8388608,
          array['image/jpeg', 'image/png', 'image/webp', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "feedback: enviar ficheiros da minha empresa" on storage.objects';
  execute $p$create policy "feedback: enviar ficheiros da minha empresa" on storage.objects for insert to authenticated
    with check (bucket_id = 'feedback' and (storage.foldername(name))[1] = (select empresa_atual())::text)$p$;
end $$;
