// Dados de vendedor/comprador deixaram de ser extraídos pela IA (ver app/api/cpcv/extrair e
// app/api/cpcv/responder) - passaram a ser preenchidos num formulário manual, em blocos
// repetíveis por pessoa (app/cpcv/ParteCampos.tsx), usado tanto em /cpcv/novo (antes de o
// processo existir) como em app/cpcv/[id]/DadosPartes.tsx (depois de criado). Este ficheiro
// centraliza o tipo do rascunho e a conversão para a linha de `cpcv_partes`, para os dois
// sítios nunca divergirem.

import type { sbBrowser } from "./supabase-browser";
import { nomeFicheiroSeguro } from "./cpcv-ficheiros";

export type ParteDraft = {
  id?: string;
  tipoPessoa: "singular" | "coletiva";
  nome: string;
  estadoCivil: string;
  regimeBens: string;
  nacionalidade: string;
  naturalidade: string;
  // Sub-campos usados só quando o formulário mostra a morada/naturalidade divididas (ver
  // `moradaEstruturada` em ParteCampos.tsx) - `morada`/`naturalidade` continuam a ser a fonte
  // de verdade gravada em `cpcv_partes` (uma única string), compostos a partir destes sempre
  // que um deles muda. Numa parte já existente (vinda de `parteDraftDeLinha`) ficam vazios -
  // não há forma fiável de decompor uma morada livre já gravada nas suas partes.
  moradaRua: string;
  moradaNumero: string;
  moradaAndar: string;
  moradaCodigoPostal: string;
  moradaLocalidade: string;
  moradaFreguesia: string;
  moradaConcelho: string;
  naturalidadeFreguesia: string;
  naturalidadeConcelho: string;
  nif: string;
  morada: string;
  documentoTipo: string;
  documentoNumero: string;
  documentoValidade: string;
  representanteNome: string;
  representanteCargo: string;
  certidaoPermanente: string;
  // Só usado em /cpcv/novo, antes de o processo (e o Storage path) existirem - vários
  // documentos por pessoa (CC + comprovativo de morada + etc.), não só um.
  ficheiros: File[];
};

export function composeMoradaPessoa(
  rua: string,
  numero: string,
  andar: string,
  codigoPostal: string,
  localidade: string,
  freguesia: string,
  concelho: string
): string {
  const linha1 = [rua, numero ? `n.º ${numero}` : "", andar].filter(Boolean).join(", ");
  const linha2 = [codigoPostal, localidade].filter(Boolean).join(" ");
  const linha3 = [freguesia ? `freguesia de ${freguesia}` : "", concelho ? `concelho de ${concelho}` : ""]
    .filter(Boolean)
    .join(", ");
  return [linha1, linha2, linha3].filter(Boolean).join(", ");
}

export function composeNaturalidade(freguesia: string, concelho: string): string {
  return [freguesia, concelho].filter(Boolean).join(", ");
}

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
    moradaRua: "",
    moradaNumero: "",
    moradaAndar: "",
    moradaCodigoPostal: "",
    moradaLocalidade: "",
    moradaFreguesia: "",
    moradaConcelho: "",
    naturalidadeFreguesia: "",
    naturalidadeConcelho: "",
    nif: "",
    morada: "",
    documentoTipo: "Cartão de Cidadão",
    documentoNumero: "",
    documentoValidade: "",
    representanteNome: "",
    representanteCargo: "",
    certidaoPermanente: "",
    ficheiros: [],
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
    moradaRua: "",
    moradaNumero: "",
    moradaAndar: "",
    moradaCodigoPostal: "",
    moradaLocalidade: "",
    moradaFreguesia: "",
    moradaConcelho: "",
    naturalidadeFreguesia: "",
    naturalidadeConcelho: "",
    nif: p.nif ?? "",
    morada: p.morada ?? "",
    documentoTipo: p.documento_tipo ?? "",
    documentoNumero: p.documento_numero ?? "",
    documentoValidade: p.documento_validade ?? "",
    representanteNome: p.representante_nome ?? "",
    representanteCargo: p.representante_cargo ?? "",
    certidaoPermanente: p.certidao_permanente ?? "",
    ficheiros: [],
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

// Envia os documentos de identificação anexados a cada parte - usado em /cpcv/novo (antes de
// o processo existir) e em DadosPartes.tsx (depois de criado, ao adicionar mais tarde) para
// os dois sítios nunca divergirem na forma como o `tipo` é composto. `tipo` é só uma etiqueta
// livre (sem constraint única na BD - ver migration_fase8.sql), por isso não há problema em
// chamar isto mais do que uma vez sobre o mesmo processo (ex.: mais um documento adicionado
// depois de aprovado o processo inicial) - os `tipo` podem repetir-se entre chamadas.
export async function enviarFicheirosDasPartes(
  supabase: ReturnType<typeof sbBrowser>,
  processoId: string,
  donoId: string,
  grupos: { lista: ParteDraft[]; prefixo: string }[]
): Promise<string | null> {
  for (const { lista, prefixo } of grupos) {
    for (let i = 0; i < lista.length; i++) {
      const basePessoa = i === 0 ? prefixo : `${prefixo}_${i + 1}`;
      for (let j = 0; j < lista[i].ficheiros.length; j++) {
        const file = lista[i].ficheiros[j];
        const tipo = j === 0 ? basePessoa : `${basePessoa}_${j + 1}`;
        const path = `${donoId}/${processoId}/${nomeFicheiroSeguro(file.name)}`;
        const { error: uploadError } = await supabase.storage.from("cpcv-documentos").upload(path, file, { upsert: true });
        if (uploadError) return `Erro a enviar ${file.name}: ${uploadError.message}`;
        const { error: ficheiroError } = await supabase
          .from("cpcv_ficheiros")
          .insert({ processo_id: processoId, tipo, storage_path: path, nome_original: file.name });
        if (ficheiroError) return `Erro a registar ${file.name}: ${ficheiroError.message}`;
      }
    }
  }
  return null;
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
