// Dados de vendedor/comprador deixaram de ser extraídos pela IA (ver app/api/cpcv/extrair e
// app/api/cpcv/responder) - passaram a ser preenchidos num formulário manual, em blocos
// repetíveis por pessoa (app/cpcv/ParteCampos.tsx), usado tanto em /cpcv/novo (antes de o
// processo existir) como em app/cpcv/[id]/DadosPartes.tsx (depois de criado). Este ficheiro
// centraliza o tipo do rascunho e a conversão para a linha de `cpcv_partes`, para os dois
// sítios nunca divergirem.

export type ParteDraft = {
  id?: string;
  tipoPessoa: "singular" | "coletiva";
  nome: string;
  estadoCivil: string;
  regimeBens: string;
  nacionalidade: string;
  naturalidade: string;
  nif: string;
  morada: string;
  documentoTipo: string;
  documentoNumero: string;
  documentoValidade: string;
  representanteNome: string;
  representanteCargo: string;
  certidaoPermanente: string;
  // Só usado em /cpcv/novo, antes de o processo (e o Storage path) existirem.
  ficheiro?: File | null;
};

export const ESTADO_CIVIL_OPCOES = [
  "Solteiro",
  "Solteira",
  "Casado",
  "Casada",
  "Divorciado",
  "Divorciada",
  "Viúvo",
  "Viúva",
  "União de facto",
];

export const DOCUMENTO_TIPO_OPCOES = ["Cartão de Cidadão", "Passaporte", "Título de Residência", "Outro"];

export function parteDraftVazia(): ParteDraft {
  return {
    tipoPessoa: "singular",
    nome: "",
    estadoCivil: "",
    regimeBens: "",
    nacionalidade: "Portuguesa",
    naturalidade: "",
    nif: "",
    morada: "",
    documentoTipo: "Cartão de Cidadão",
    documentoNumero: "",
    documentoValidade: "",
    representanteNome: "",
    representanteCargo: "",
    certidaoPermanente: "",
    ficheiro: null,
  };
}

type LinhaParte = {
  id: string;
  tipo_pessoa: string | null;
  nome: string | null;
  estado_civil: string | null;
  regime_bens: string | null;
  nacionalidade: string | null;
  naturalidade: string | null;
  nif: string | null;
  morada: string | null;
  documento_tipo: string | null;
  documento_numero: string | null;
  documento_validade: string | null;
  representante_nome: string | null;
  representante_cargo: string | null;
  certidao_permanente: string | null;
};

export function parteDraftDeLinha(p: LinhaParte): ParteDraft {
  return {
    id: p.id,
    tipoPessoa: p.tipo_pessoa === "coletiva" ? "coletiva" : "singular",
    nome: p.nome ?? "",
    estadoCivil: p.estado_civil ?? "",
    regimeBens: p.regime_bens ?? "",
    nacionalidade: p.nacionalidade ?? "",
    naturalidade: p.naturalidade ?? "",
    nif: p.nif ?? "",
    morada: p.morada ?? "",
    documentoTipo: p.documento_tipo ?? "",
    documentoNumero: p.documento_numero ?? "",
    documentoValidade: p.documento_validade ?? "",
    representanteNome: p.representante_nome ?? "",
    representanteCargo: p.representante_cargo ?? "",
    certidaoPermanente: p.certidao_permanente ?? "",
    ficheiro: null,
  };
}

export function parteDraftVazio(d: ParteDraft): boolean {
  return !d.nome.trim();
}

export function parteDraftParaLinha(papel: "vendedor" | "comprador", d: ParteDraft, processoId: string) {
  const singular = d.tipoPessoa === "singular";
  return {
    processo_id: processoId,
    papel,
    tipo_pessoa: d.tipoPessoa,
    nome: d.nome.trim(),
    estado_civil: singular ? d.estadoCivil || null : null,
    regime_bens: singular && /^casad/i.test(d.estadoCivil) ? d.regimeBens || null : null,
    nacionalidade: singular ? d.nacionalidade || null : null,
    naturalidade: singular ? d.naturalidade || null : null,
    nif: d.nif.trim() || null,
    morada: d.morada.trim() || null,
    documento_tipo: singular ? d.documentoTipo || null : null,
    documento_numero: singular ? d.documentoNumero || null : null,
    documento_validade: singular ? d.documentoValidade || null : null,
    representante_nome: !singular ? d.representanteNome || null : null,
    representante_cargo: !singular ? d.representanteCargo || null : null,
    certidao_permanente: !singular ? d.certidaoPermanente || null : null,
  };
}

// Dígito de controlo do NIF/NIPC português (mod 11) - não havia nenhuma validação de
// formato no projeto; agora que os dados vêm de um formulário manual em vez da IA, vale a
// pena apanhar um NIF trocado/incompleto antes de entrar no contrato.
export function nifValido(nif: string): boolean {
  const limpo = nif.replace(/\s/g, "");
  if (!/^\d{9}$/.test(limpo)) return false;
  const digitos = limpo.split("").map(Number);
  const soma = digitos.slice(0, 8).reduce((acc, d, i) => acc + d * (9 - i), 0);
  const resto = soma % 11;
  const controlo = resto < 2 ? 0 : 11 - resto;
  return controlo === digitos[8];
}
