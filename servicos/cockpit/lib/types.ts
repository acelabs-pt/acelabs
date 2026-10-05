// Tipos de domínio do Cockpit, espelhando create_tables_cockpit.sql.
// Ver especificacao-produto.md para a justificação de cada entidade.

export type EstadoRelacao =
  | "lead_frio"
  | "lead_morno"
  | "lead_quente"
  | "cliente_comprador"
  | "cliente_proprietario";

export interface Contacto {
  id: string;
  organizacao_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  estado_relacao: EstadoRelacao;
  origem: string | null;
  ultimo_contacto_em: string | null;
  proxima_accao_em: string | null;
  criado_em: string;
}

export interface Imovel {
  id: string;
  organizacao_id: string;
  proprietario_contacto_id: string | null;
  tipologia: string | null;
  zona: string | null;
  preco_listagem: number | null;
  preco_expectativa_proprietario: number | null;
  motivo_venda: string | null;
  prazo_venda: string | null;
  cadencia_update_dias: number;
  proximo_update_em: string | null;
  estado: "disponivel" | "em_negociacao" | "vendido" | "retirado";
  criado_em: string;
}

export interface VisitaImovel {
  id: string;
  organizacao_id: string;
  imovel_id: string;
  comprador_contacto_id: string;
  data_visita: string;
  feedback: string | null;
  interesse: "sim" | "nao" | "talvez" | null;
  estado: "visitado" | "proposta_feita" | "recusado" | "standby";
}

export interface Proposta {
  id: string;
  organizacao_id: string;
  imovel_id: string;
  comprador_contacto_id: string;
  valor: number;
  condicoes: string | null;
  data_proposta: string;
  resposta: "pendente" | "aceite" | "recusada" | "contraproposta";
}

export interface Contraparte {
  id: string;
  organizacao_id: string;
  negocio_imovel_id: string;
  agencia: string;
  nome_agente: string;
  contacto: string | null;
  visita_feita: boolean;
  feedback_dado: boolean;
  proposta_pendente: boolean;
}

export type TipoAtividade = "chamada" | "visita" | "nota" | "mensagem" | "email";

export interface Atividade {
  id: string;
  organizacao_id: string;
  contacto_id: string | null;
  imovel_id: string | null;
  tipo: TipoAtividade;
  descricao: string;
  criado_por: string;
  criado_em: string;
}
