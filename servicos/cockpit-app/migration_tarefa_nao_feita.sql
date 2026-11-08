-- Tarefa dada como "não feita" (já não faz sentido executá-la): fica fechada, mas com a data em que foi descartada.
alter table tarefas add column if not exists nao_feita_em timestamptz;
