export type Parte = {
  papel: string;
  tipo_pessoa?: string | null;
  nome: string;
  estado_civil: string | null;
  regime_bens: string | null;
  nacionalidade: string | null;
  naturalidade?: string | null;
  nif: string | null;
  morada: string | null;
  documento_tipo: string | null;
  documento_numero: string | null;
  documento_validade: string | null;
  representante_nome?: string | null;
  representante_cargo?: string | null;
  certidao_permanente?: string | null;
};

export type Processo = Record<string, unknown> & {
  imovel_morada: string | null;
  imovel_freguesia: string | null;
  imovel_concelho: string | null;
  imovel_distrito: string | null;
  imovel_tipologia: string | null;
  imovel_artigo_matricial: string | null;
  imovel_descricao_predial: string | null;
  imovel_certificado_energetico: string | null;
  imovel_licenca_utilizacao: string | null;
  imovel_area: number | null;
  imovel_anexos: string | null;
  imovel_estado: string | null;
  imovel_condominio: boolean | null;
  preco_total: number | null;
  valor_sinal: number | null;
  forma_pagamento_sinal: string | null;
  prazo_pagamento_sinal: string | null;
  prazo_escritura: string | null;
  condicoes_suspensivas: string | null;
  penalizacao_incumprimento: string | null;
  metodo_pagamento: string | null;
  tem_fracoes_multiplas: boolean | null;
  valor_fracao_principal: number | null;
  valor_fracao_secundaria: number | null;
  valor_mobilia: number | null;
  reforco_sinal: string | null;
  iban_sinal: string | null;
  reserva: boolean | null;
  valor_reserva: number | null;
  condicionado_avaliacao: boolean | null;
  valor_avaliacao_minimo: number | null;
  avaliacao_prazo_data: string | null;
  avaliacao_contacto_email: string | null;
  condicionado_financiamento: boolean | null;
  condicionado_outra_situacao: string | null;
  dias_condicionamento: number | null;
  dias_condicionamento_tipo: string | null;
  comodato: boolean | null;
  tempo_comodato: string | null;
  incluidos_no_imovel: string | null;
  email_proprietario_contrato: string | null;
  email_comprador_contrato: string | null;
  data_assinatura_contrato: string | null;
  observacoes_adicionais: string | null;
};

export const PARTE_EM_BRANCO: Parte = {
  papel: "",
  tipo_pessoa: "singular",
  nome: "",
  estado_civil: null,
  regime_bens: null,
  nacionalidade: null,
  naturalidade: null,
  nif: null,
  morada: null,
  documento_tipo: null,
  documento_numero: null,
  documento_validade: null,
  representante_nome: null,
  representante_cargo: null,
  certidao_permanente: null,
};

export const METODO_PAGAMENTO_LABEL: Record<string, string> = {
  capital_proprio: "capital próprio",
  financiamento: "recurso a financiamento bancário",
  misto: "capital próprio e recurso a financiamento bancário",
};

// Helpers de formatação de texto - cada gerador (HTML/PDF vs Word) passa a sua própria
// implementação de v()/euros()/dataPT() porque escapam (ou não) HTML de forma diferente;
// as funções de cláusula partilhadas em cpcv-clausulas.ts recebem este objecto em vez de
// importarem uma implementação fixa, para o texto legal não ficar duplicado nos dois ficheiros.
export type Helpers = {
  v: (value: unknown, fallback?: string) => string;
  euros: (value: number | null) => string;
  dataPT: (iso: string | null) => string;
};

export function regimeBensValido(regimeBens: string | null): boolean {
  if (!regimeBens) return false;
  return !/n[ãa]o\s*aplic[aá]vel|n\/a/i.test(regimeBens);
}

// Salvaguarda contra a IA confundir o número de descrição predial (o que este campo deve
// conter) com uma categoria do imóvel como "fracção autónoma" ou "prédio urbano" (testado:
// aconteceu, produzindo "descrito ... sob o n.º Fracção autónoma" no documento gerado) - um
// número de descrição predial real tem sempre pelo menos um dígito.
export function descricaoPredialValida(descricaoPredial: string | null): boolean {
  return !!descricaoPredial && /\d/.test(descricaoPredial);
}
