-- Cockpit: várias zonas por comprador, dados do imóvel na angariação e alertas de correspondência.
-- NÃO ESTÁ APLICADA. Correr no SQL Editor do Supabase de cada cliente, uma vez, e só depois de
-- o código que a usa estar em produção (o código antigo continua a funcionar com esta migração,
-- porque só acrescenta tabelas e colunas e não apaga nada).

-- ---------------------------------------------------------------------------
-- Zonas do comprador (várias por comprador). concelho/freguesia vazios = "todo o distrito"
-- ou "todo o concelho".
-- ---------------------------------------------------------------------------
create table if not exists comprador_zonas (
  id uuid primary key default gen_random_uuid(),
  comprador_id uuid not null references compradores(id) on delete cascade,
  distrito text not null,
  concelho text,
  freguesia text,
  created_at timestamptz not null default now()
);
create index if not exists comprador_zonas_comprador on comprador_zonas (comprador_id);

-- Copia a zona única que cada comprador já tem (só se ainda não tiver zonas)
insert into comprador_zonas (comprador_id, distrito, concelho, freguesia)
select c.id, c.distrito, c.concelho, c.freguesia
from compradores c
where c.distrito is not null
  and not exists (select 1 from comprador_zonas z where z.comprador_id = c.id);

-- ---------------------------------------------------------------------------
-- Dados do imóvel na angariação (por defeito vêm do proprietário, mas podem ser editados)
-- ---------------------------------------------------------------------------
alter table angariacoes add column if not exists tipo_imovel text;
alter table angariacoes add column if not exists tipologia text;
alter table angariacoes add column if not exists distrito text;
alter table angariacoes add column if not exists concelho text;
alter table angariacoes add column if not exists freguesia text;
alter table angariacoes add column if not exists valor numeric(12,2);

update angariacoes a
set tipo_imovel = p.tipo_imovel, tipologia = p.tipologia, distrito = p.distrito,
    concelho = p.concelho, freguesia = p.freguesia, valor = p.valor
from proprietarios p
where a.proprietario_id = p.id and a.distrito is null and a.tipo_imovel is null;

-- ---------------------------------------------------------------------------
-- Alertas de correspondência comprador <-> angariação (ou proprietário, antes de haver angariação)
-- ---------------------------------------------------------------------------
create table if not exists correspondencias (
  id uuid primary key default gen_random_uuid(),
  comprador_id uuid not null references compradores(id) on delete cascade,
  angariacao_id uuid references angariacoes(id) on delete cascade,
  proprietario_id uuid references proprietarios(id) on delete cascade,
  estado text not null default 'nova' check (estado in ('nova', 'faz_sentido', 'descartada')),
  created_at timestamptz not null default now(),
  check (angariacao_id is not null or proprietario_id is not null)
);
-- um alerta por par, para não repetir
create unique index if not exists correspondencias_par
  on correspondencias (comprador_id, coalesce(angariacao_id, proprietario_id));
create index if not exists correspondencias_estado on correspondencias (estado);

-- ---------------------------------------------------------------------------
-- RLS, igual às restantes tabelas
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['comprador_zonas', 'correspondencias'] loop
    execute format('alter table %I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'autenticado total') then
      execute format(
        'create policy "autenticado total" on %I for all to authenticated using (true) with check (true)',
        t
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Índices em falta para listas grandes (ver plano: 1000 compradores/proprietários/angariações)
-- ---------------------------------------------------------------------------
create index if not exists angariacao_acoes_feita on angariacao_acoes (feita, angariacao_id);
create index if not exists tarefas_proprietario on tarefas (proprietario_id);
create index if not exists comprador_imoveis_visitado on comprador_imoveis (visitado_em);
