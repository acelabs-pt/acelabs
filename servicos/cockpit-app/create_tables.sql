-- Cockpit (app nova) - schema de uma instalação.
-- Modelo: venda única, uma cópia isolada por consultor (um projeto Supabase por cliente).
-- Por isso não há organizacao_id: tudo o que existe nesta base pertence ao mesmo consultor.
-- RLS ligada em todas as tabelas, acesso só a utilizadores autenticados.
-- Correr no SQL Editor do Supabase do cliente.

create extension if not exists "pgcrypto";

-- Atualiza updated_at automaticamente
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- Contactos (pessoa base, partilhada por compradores e proprietários)
-- ---------------------------------------------------------------------------
create table contactos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telemovel text,            -- com indicativo, ex: +351912345678
  email text,
  canal_origem text,         -- Idealista, Meta, Site imobiliária, Placa, ...
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CRM - Compradores
-- ---------------------------------------------------------------------------
create table compradores (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references contactos(id) on delete cascade,

  -- qualificação (campos do desenho)
  motivacao smallint check (motivacao between 0 and 10),
  referencia_imovel text,
  tipo_imovel text,          -- Apartamento, Moradia, Terreno, Armazém, Loja, Prédio, ...
  distrito text,
  concelho text,
  freguesia text,
  tipologia_minima text,
  expectativa_valor numeric(12,2),
  financiamento text,
  simulacao_credito text,
  precisa_vender boolean,

  -- funil
  estado text not null default 'lead_qualificada' check (estado in (
    'lead_qualificada', 'imoveis_enviados', 'visitas_realizadas',
    'propostas_efetuadas', 'cpcv', 'escritura', 'negocio_concluido', 'perdido'
  )),
  estado_desde timestamptz not null default now(),   -- base dos alertas "X dias sem avançar"

  -- CPCV e escritura
  cpcv_fechado boolean not null default false,
  cpcv_data date,
  escritura_agendada boolean not null default false,
  escritura_data date,
  escritura_prazo date,      -- fim do prazo, para o countdown de dias

  -- negócio e comissão
  valor_negocio numeric(12,2),
  comissao_valor numeric(12,2),
  comissao_recebida boolean not null default false,   -- só então a transação conta como feita
  comissao_recebida_em date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on compradores (estado);

-- Imóveis ligados a um comprador (enviado -> visitado -> proposta)
create table comprador_imoveis (
  id uuid primary key default gen_random_uuid(),
  comprador_id uuid not null references compradores(id) on delete cascade,
  link text,
  descricao text,
  enviado_em date,
  visitado_em date,
  proposta_em date,
  created_at timestamptz not null default now()
);
create index on comprador_imoveis (comprador_id);

-- Checklist de documentos em falta para a escritura
create table comprador_documentos (
  id uuid primary key default gen_random_uuid(),
  comprador_id uuid not null references compradores(id) on delete cascade,
  nome text not null,
  entregue boolean not null default false,
  created_at timestamptz not null default now()
);
create index on comprador_documentos (comprador_id);

-- ---------------------------------------------------------------------------
-- CRM - Proprietários
-- ---------------------------------------------------------------------------
create table proprietarios (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references contactos(id) on delete cascade,

  link_imovel text,
  tipo_imovel text,
  distrito text,
  concelho text,
  freguesia text,
  tipologia text,
  valor numeric(12,2),

  estado text not null default 'fsbo' check (estado in (
    'fsbo', 'reuniao_marcada', 'reuniao_angariacao', 'dossier_enviado',
    'imovel_vendido_enviado', 'follow_up_1', 'follow_up_2', 'angariado', 'perdido'
  )),
  estado_desde timestamptz not null default now(),
  reuniao_em timestamptz,    -- base de todos os follow-ups automáticos (2h, 2d, 7d, 14d, 22d, 30d)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on proprietarios (estado);

-- Registo de chamadas (qualquer contacto)
create table chamadas (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references contactos(id) on delete cascade,
  ocorreu_em timestamptz not null default now(),
  observacoes text
);
create index on chamadas (contacto_id, ocorreu_em desc);

-- ---------------------------------------------------------------------------
-- Gestor de Angariações
-- ---------------------------------------------------------------------------
create table angariacoes (
  id uuid primary key default gen_random_uuid(),
  proprietario_id uuid references proprietarios(id) on delete set null,
  titulo text not null,      -- morada ou referência do imóvel
  duracao_dias smallint not null default 180 check (duracao_dias in (120, 180)),
  regime text check (regime in ('exclusivo', 'nao_exclusivo')),   -- contrato em exclusivo ou não
  inicio date not null default current_date,
  vendido_em date,           -- "Vendido" pode ser marcado em qualquer ponto do cronograma
  valor_negocio numeric(12,2),
  comissao_valor numeric(12,2),
  comissao_recebida boolean not null default false,   -- só então a transação conta como feita
  comissao_recebida_em date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ações do plano. dia = dia do contrato em que a ação deve acontecer (0..duracao).
create table angariacao_acoes (
  id uuid primary key default gen_random_uuid(),
  angariacao_id uuid not null references angariacoes(id) on delete cascade,
  nome text not null,        -- Fotografias/Vídeo, Placa de Venda, Open House, ...
  dia smallint not null check (dia >= 0),
  follow_up boolean not null default false,   -- bandeira vermelha
  feita boolean not null default false,
  feita_em timestamptz,
  feedback text,
  created_at timestamptz not null default now()
);
create index on angariacao_acoes (angariacao_id, dia);

-- ---------------------------------------------------------------------------
-- Tarefas e calendário (tudo o que as automações geram acaba aqui)
-- ---------------------------------------------------------------------------
create table tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  tipo text not null default 'tarefa' check (tipo in ('tarefa', 'evento')),
  inicio timestamptz,        -- prazo da tarefa ou início do evento
  fim timestamptz,
  feita boolean not null default false,
  feita_em timestamptz,
  no_calendario boolean not null default true,   -- o agente pode escolher não pôr no calendário
  -- de onde veio
  origem text not null default 'manual' check (origem in (
    'manual', 'meta', 'comprador', 'proprietario', 'angariacao'
  )),
  contacto_id uuid references contactos(id) on delete cascade,
  comprador_id uuid references compradores(id) on delete cascade,
  proprietario_id uuid references proprietarios(id) on delete cascade,
  angariacao_acao_id uuid references angariacao_acoes(id) on delete cascade,
  chave_automacao text,      -- evita duplicar a mesma tarefa automática
  google_event_id text,      -- para a sincronização com Google Calendar (fase posterior)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index on tarefas (chave_automacao) where chave_automacao is not null;
create index on tarefas (inicio) where feita = false;

-- ---------------------------------------------------------------------------
-- Métricas: metas e taxas de conversão
-- ---------------------------------------------------------------------------
create table metas (
  id uuid primary key default gen_random_uuid(),
  ano smallint not null,
  metrica text not null check (metrica in (
    'visitas', 'reunioes_angariacao', 'angariacoes', 'transacoes'
  )),
  valor_anual integer not null default 0,
  -- rácio de conversão (não é percentagem): na linha "visitas" = visitas por transação,
  -- na linha "reunioes_angariacao" = reuniões por angariação
  taxa_conversao numeric(6,2),
  unique (ano, metrica)
);

-- Semanas de trabalho por ano (a meta semanal = meta anual / semanas úteis)
create table metas_config (
  ano smallint primary key,
  semanas_uteis smallint not null default 52 check (semanas_uteis between 1 and 52),
  faturacao_anual numeric(12,2)   -- objetivo máximo do ano: faturação em euros
);

-- Decisão semanal "pôr as metas desta semana no calendário?" (semana = 2026-W42)
create table metas_semanas (
  semana text primary key,
  decisao text not null check (decisao in ('colocada', 'ignorada'))
);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
create trigger t_contactos_updated before update on contactos for each row execute function set_updated_at();
create trigger t_compradores_updated before update on compradores for each row execute function set_updated_at();
create trigger t_proprietarios_updated before update on proprietarios for each row execute function set_updated_at();
create trigger t_angariacoes_updated before update on angariacoes for each row execute function set_updated_at();
create trigger t_tarefas_updated before update on tarefas for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: utilizador autenticado tem acesso total (instalação de um só consultor)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'contactos', 'compradores', 'comprador_imoveis', 'comprador_documentos',
    'proprietarios', 'chamadas', 'angariacoes', 'angariacao_acoes', 'tarefas', 'metas',
    'metas_config', 'metas_semanas'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "autenticado total" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
