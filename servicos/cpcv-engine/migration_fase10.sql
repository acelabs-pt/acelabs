-- =============================================================
-- CPCV com IA - Fase 10 (agente da angariacao e agente do comprador, quando os
-- dois lados do negocio sao da nossa agencia)
-- Migracao aditiva sobre o schema ja em producao.
-- =============================================================

-- Quando tipo_contrato = 'angariacao_nossa_comprador_nosso', os dois lados do negocio podem
-- ter sido trazidos por agentes diferentes da mesma agencia (ex.: um agente angariou o
-- imovel, outro trouxe o comprador) - criado_por continua a ser so o "dono" do processo para
-- efeitos de RLS/Storage, nao chega para representar isto. Ambas ficam null fora desse tipo
-- de contrato (um so lado interno, sem ambiguidade a resolver) ou quando o agente que cria o
-- processo e o mesmo nos dois lados (ver app/cpcv/novo/page.tsx).
alter table cpcv_processos add column if not exists agente_angariacao_id uuid references profiles(id);
alter table cpcv_processos add column if not exists agente_comprador_id uuid references profiles(id);

-- Um agente normal (nao so a gestora/admin) passa a poder escolher um colega para um destes
-- dois campos, por isso precisa de conseguir ver o nome dos colegas - antes so via o seu
-- proprio perfil. A tabela profiles nao tem nada sensivel (id/nome/role/criado_em, sem email
-- nem password), e todos os perfis de um projecto Supabase pertencem sempre a mesma agencia
-- (um projecto por cliente - ver CLAUDE.md da raiz), por isso isto equivale a um directorio
-- interno da empresa, nao a uma fuga de dados entre clientes.
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles
  for select using (true);
