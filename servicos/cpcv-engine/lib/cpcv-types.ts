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
  email?: string | null;
  // Número do casal (1, 2, ...) quando o formulário liga duas partes como cônjuges.
  casal?: number | null;
};

export type Processo = Record<string, unknown> & {
  imovel_morada: string | null;
  imovel_codigo_postal: string | null;
  imovel_localidade: string | null;
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
  imovel_e_fracao_autonoma: boolean | null;
  imovel_fracao_letra: string | null;
  imovel_andar_fracao: string | null;
  imovel_orientacao: string | null;
  imovel_finalidade: string | null;
  imovel_conservatoria: string | null;
  imovel_licenca_data_emissao: string | null;
  imovel_licenca_entidade_emissora: string | null;
  imovel_certificado_validade: string | null;
  imovel_certificado_classe: string | null;
  // "valido" (omissão), "isento" ou "em_execucao". Isento: imovel_certificado_energetico guarda o
  // número da isenção e imovel_certificado_data_emissao a data em que foi emitida.
  imovel_certificado_estado?: string | null;
  imovel_certificado_data_emissao?: string | null;
  imovel_certificado_isencao_numero?: string | null;
  // "Urbano situado em ..." e "Composição" tal como constam da certidão predial.
  imovel_situado_em?: string | null;
  imovel_composicao?: string | null;
  hipotecas_verificadas: boolean | null;
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
  reforcos_sinal: { valor: number | null; data: string | null }[] | null;
  iban_sinal: string | null;
  destino_sinal: string | null;
  conta_sinal_banco: string | null;
  conta_sinal_titular: string | null;
  comissao_modalidade: string | null;
  comissao_valor: number | null;
  reserva: boolean | null;
  valor_reserva: number | null;
  reserva_ate_data: string | null;
  condicionado_avaliacao: boolean | null;
  valor_avaliacao_minimo: number | null;
  prazo_avaliacao_dias: number | null;
  avaliacao_prazo_data: string | null;
  avaliacao_contacto_email: string | null;
  condicionado_financiamento: boolean | null;
  valor_financiamento_minimo: number | null;
  prazo_financiamento_dias: number | null;
  condicionado_outra_situacao: string | null;
  prazo_outra_situacao_dias: number | null;
  dias_condicionamento: number | null;
  dias_condicionamento_tipo: string | null;
  comodato: boolean | null;
  tempo_comodato: string | null;
  tem_bens_moveis: boolean | null;
  incluidos_no_imovel: string | null;
  email_proprietario_contrato: string | null;
  email_comprador_contrato: string | null;
  data_assinatura_contrato: string | null;
  observacoes_adicionais: string | null;
  // Fase 16 (contratos finais da solicitadora, 31/10/2026). Opcionais: numa instalação sem a migração
  // as colunas não existem e o contrato usa os valores por omissão (15 dias, sem agência parceira).
  // Dias de antecedência para avisar da escritura (Cláusula Terceira); omissão 15.
  escritura_aviso_dias?: number | null;
  // Outra mediadora que interveio no negócio (ex.: trouxe o comprador) - entra na Intervenção Imobiliária.
  agencia_parceira_nome?: string | null;
  agencia_parceira_ami?: string | null;
};

export type Hipoteca = {
  entidade_credora: string;
  natureza: string | null;
  numero_apresentacao: string | null;
  data_registo: string | null;
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
  email: null,
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
  dataLongaPT: (iso: string | null) => string;
};

// "2026-09-08" -> "08-09-2026" / "08 de setembro de 2026" - os dois formatos usados no contrato
// de referência (curto nas validades de documentos, longo nas datas de emissão/escritura/
// assinatura). Partilhados pelos dois geradores; o do PDF escapa HTML por cima destes.
const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// "222000" -> "222.000,00" (formato do contrato de referência). Feito à mão porque o
// toLocaleString("pt-PT") do Node separa os milhares com espaço ("222 000,00"), não com ponto.
export function formatarEuros(valor: number): string {
  const [inteiro, decimais] = valor.toFixed(2).split(".");
  return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimais}`;
}

export function formatarDataCurta(iso: string | null): string | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}-${mes}-${ano}`;
}

export function formatarDataLonga(iso: string | null): string | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split("-");
  const nomeMes = MESES_PT[Number(mes) - 1];
  if (!ano || !nomeMes || !dia) return iso;
  return `${dia} de ${nomeMes} de ${ano}`;
}

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

// Moradas no estrangeiro não têm código postal português (ex.: "Rue Exemple 4, 1530 Cidade, Suíça",
// compradores emigrados de um contrato real) - a exigência do código postal 0000-000 só se aplica a
// moradas em Portugal. Reconhece-se a morada estrangeira pelo país no fim ("..., Suíça"): só o último
// elemento conta, porque há muitas ruas portuguesas com nomes de países ("Avenida do Brasil").
const PAIS_ESTRANGEIRO =
  /^(su[íi][çc]a|switzerland|schweiz|suisse|fran[çc]a|france|luxemburgo|luxembourg|alemanha|germany|deutschland|espanha|spain|españa|reino unido|united kingdom|uk|inglaterra|england|esc[óo]cia|irlanda|ireland|b[ée]lgica|belgium|belgique|pa[íi]ses baixos|holanda|netherlands|it[áa]lia|italy|[áa]ustria|su[ée]cia|noruega|dinamarca|andorra|m[óo]naco|brasil|brazil|angola|mo[çc]ambique|cabo verde|s[ãa]o tom[ée] e pr[íi]ncipe|guin[ée]-bissau|estados unidos( da am[ée]rica)?|eua|usa|canad[áa]|venezuela|[áa]frica do sul|austr[áa]lia)$/i;

export function moradaNoEstrangeiro(morada: string | null | undefined): boolean {
  if (!morada) return false;
  const ultimo = morada.split(",").pop()?.trim().replace(/[.\s]+$/, "") ?? "";
  return PAIS_ESTRANGEIRO.test(ultimo);
}

export function moradaTemCodigoPostal(morada: string | null | undefined): boolean {
  return !!morada && (/\b\d{4}-\d{3}\b/.test(morada) || moradaNoEstrangeiro(morada));
}
