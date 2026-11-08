export type Tarefa = {
  id: string;
  titulo: string;
  tipo: "tarefa" | "evento";
  inicio: string | null;
  fim: string | null;
  feita: boolean;
  feita_em: string | null;
  no_calendario: boolean;
  origem: "manual" | "meta" | "comprador" | "proprietario" | "angariacao";
  contacto_id: string | null;
  comprador_id: string | null;
  proprietario_id: string | null;
  angariacao_acao_id: string | null;
  chave_automacao: string | null;
  nao_feita_em?: string | null; // dada como "não feita" (fica fechada, mas não conta como feita)
  google_calendar_em?: string | null; // quando o agente levou esta tarefa para o seu Google Calendar
};
