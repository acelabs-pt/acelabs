-- Cockpit: totais por angariação calculados na base (em vez de descarregar todas as ações para o browser).
-- Com 1000 angariações em plano são 59 mil ações: o dashboard e a lista de angariações demoravam mais de 20 segundos.
-- Correr no SQL Editor do Supabase de cada cliente, uma vez. Só acrescenta uma função: não altera nem apaga dados.
-- A app continua a funcionar sem esta função (mais devagar), por isso pode ser corrida a qualquer momento.

create or replace function resumo_angariacoes()
returns table (
  angariacao_id uuid,
  total int,
  feitas int,
  em_atraso int,
  proxima_nome text,
  proxima_follow_up boolean
)
language sql
stable
as $$
  select
    a.id,
    count(x.id)::int,
    (count(x.id) filter (where x.feita))::int,
    -- ação em atraso: não feita e o bloco de 10 dias dela já terminou (mesma regra da app)
    (count(x.id) filter (
      where not x.feita
        and ((a.inicio + (((x.dia / 10) + 1) * 10))::timestamp at time zone 'Europe/Lisbon') < now()
    ))::int,
    p.nome,
    p.follow_up
  from angariacoes a
  left join angariacao_acoes x on x.angariacao_id = a.id
  left join lateral (
    select y.nome, y.follow_up
    from angariacao_acoes y
    where y.angariacao_id = a.id and not y.feita
    order by y.dia
    limit 1
  ) p on true
  group by a.id, p.nome, p.follow_up;
$$;

-- Índices que faltavam. O Postgres não indexa sozinho as colunas que apontam para outra tabela, e sem eles
-- apagar uma angariação com plano (ou um contacto) dá timeout: cada ação ou ficha apagada obriga a percorrer
-- todas as tarefas. Medido com 1000 angariações: apagar 20 já falhava.
create index if not exists tarefas_calendario_inicio on tarefas (no_calendario, inicio);
create index if not exists tarefas_angariacao_acao on tarefas (angariacao_acao_id);
create index if not exists tarefas_comprador on tarefas (comprador_id);
create index if not exists tarefas_contacto on tarefas (contacto_id);
create index if not exists compradores_contacto on compradores (contacto_id);
create index if not exists proprietarios_contacto on proprietarios (contacto_id);
create index if not exists angariacoes_proprietario on angariacoes (proprietario_id);
create index if not exists correspondencias_angariacao on correspondencias (angariacao_id);
create index if not exists correspondencias_proprietario on correspondencias (proprietario_id);
