-- Caixa "Google Calendar" nas tarefas: guarda quando o agente levou a tarefa para o seu Google Calendar.
alter table tarefas add column if not exists google_calendar_em timestamptz;
