// Linhas das tabelas (supabase/schema.sql). Valores em cêntimos; datas em ISO (AAAA-MM-DD).

export type Socio = { id: string; user_id: string; nome: string; email: string | null; ativo: boolean; pin_temporario?: boolean };

export type TipoConta = "empresa" | "conjunta" | "pessoal" | "cartao";

export type Conta = {
  id: string;
  nome: string;
  tipo: TipoConta;
  /** Sócio dono da conta (pessoal, ou cartão pessoal). Null = da empresa, ou a conjunta dos sócios. */
  titular: string | null;
  banco: string | null;
  ultimos4: string | null;
  saldo_inicial: number;
  modelo_extrato: { separador?: string; mapa?: Record<string, number> } | null;
  ativa: boolean;
};

export type TipoCategoria = "custo" | "proveito" | "interno";

export type Categoria = { id: string; nome: string; tipo: TipoCategoria; grupo: string; ordem: number; ativa: boolean };

export type Entidade = { id: string; nome: string; nif: string | null; email: string | null; tipo: "fornecedor" | "cliente" | "ambos" };

export type Periodicidade = "mensal" | "trimestral" | "anual";

export type Subscricao = {
  id: string;
  nome: string;
  entidade_id: string | null;
  categoria_id: string | null;
  conta_id: string | null;
  /** Valor previsto em EUR (cêntimos). Null = ainda por confirmar. */
  valor_previsto: number | null;
  moeda: string;
  periodicidade: Periodicidade;
  dia: number;
  inicio: string;
  padrao: string | null;
  debito_direto: boolean;
  ativa: boolean;
  notas: string | null;
};

export type Movimento = {
  id: string;
  /** Vazio = despesa paga por um sócio, sem conta de banco (ainda não há conta da empresa). */
  conta_id: string | null;
  data: string;
  descricao: string;
  /** Negativo = saída. */
  valor: number;
  categoria_id: string | null;
  entidade_id: string | null;
  subscricao_id: string | null;
  /** Quem fez ou pagou (útil na conta da empresa e na conjunta). */
  socio_id: string | null;
  /** A empresa tem de devolver este dinheiro ao(s) sócio(s). */
  reembolsavel: boolean;
  origem: "manual" | "extrato";
  notas: string | null;
};

export type TipoSocioMovimento = "capital" | "suprimento" | "reembolso";

export type SocioMovimento = { id: string; socio_id: string; tipo: TipoSocioMovimento; data: string; valor: number; conta_id: string | null; notas: string | null };

export type Regra = { id: string; texto: string; categoria_id: string | null; entidade_id: string | null; subscricao_id: string | null };

export type Produto = "diagnostico" | "painel" | "automacao" | "formacao" | "cpcv" | "cockpit" | "medida";
export type EstadoContrato = "proposta" | "ativo" | "pausado" | "terminado";

export type Contrato = {
  id: string;
  entidade_id: string;
  produto: Produto;
  nome: string | null;
  estado: EstadoContrato;
  /** Valor de arranque, cobrado uma vez em `inicio` (cêntimos). */
  setup: number;
  /** Mensalidade (cêntimos). */
  mensalidade: number;
  inicio: string;
  fim: string | null;
  dia: number;
  notas: string | null;
};

export const ROTULO_PRODUTO: Record<Produto, string> = {
  diagnostico: "Diagnóstico",
  painel: "Painel de gestão",
  automacao: "Automação de processos",
  formacao: "Formação e estratégia",
  cpcv: "CPCV com IA",
  cockpit: "Cockpit",
  medida: "À medida",
};

/** De onde veio um campo da fatura: código QR da AT, leitura por IA, histórico do fornecedor, ou escrito à mão. */
export type OrigemDado = "qr" | "ia" | "historico" | "manual";

export type Fatura = {
  id: string;
  sentido: "recebida" | "emitida";
  estado: "rever" | "confirmada" | "anulada";
  entidade_id: string | null;
  emitente_nome: string | null;
  emitente_nif: string | null;
  adquirente_nif: string | null;
  numero: string | null;
  atcud: string | null;
  tipo_doc: string | null;
  data: string | null;
  vencimento: string | null;
  moeda: string;
  /** Cêntimos, na moeda da fatura. */
  base: number | null;
  iva: number | null;
  total: number | null;
  /** Total em EUR (cêntimos) quando a moeda não é EUR. */
  total_eur: number | null;
  descricao: string | null;
  categoria_id: string | null;
  movimento_id: string | null;
  origem_dados: "qr" | "ia" | "qr+ia" | "manual";
  fontes: Partial<Record<string, OrigemDado>>;
  duvidas: string[];
  ficheiro: string | null;
  ficheiro_nome: string | null;
  ficheiro_tipo: string | null;
  notas: string | null;
  criado_em: string;
};

export type EntradaAuditoria = { id: number; quando: string; quem: string; tabela: string; operacao: string; registo: string | null; resumo: string | null };
