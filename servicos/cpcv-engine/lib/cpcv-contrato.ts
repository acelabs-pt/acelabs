import type { Helpers, Hipoteca, Parte, Processo } from "./cpcv-types";
import { PARTE_EM_BRANCO } from "./cpcv-types";
import {
  INTRO_BOA_FE,
  ORDINAIS,
  concordancia,
  montarBlocoOutorgantes,
  pontosClausulaPrimeira,
  pontosClausulaSegunda,
  pontosClausulaTerceira,
  pontosClausulaQuarta,
  pontosClausulaQuinta,
  pontosClausulaSexta,
  pontosClausulaSetima,
  pontosClausulaOitava,
  pontosClausulaNona,
  pontosClausulaDecima,
  pontosClausulaDecimaPrimeira,
  pontosClausulaDecimaSegunda,
  pontosClausulaDecimaTerceira,
  pontosClausulaDecimaQuarta,
  pontosClausulaDecimaQuinta,
  pontosClausulaDecimaSexta,
  capitalizarLocal,
  textoFinal,
  agruparUnidades,
  ladoFeminino,
  tituloAssinaturas,
  REF_ABRE,
  REF_FECHA,
  type BlocoOutorgantes,
  type ClausulaTexto,
  type TextoFinal,
} from "./cpcv-clausulas";

// Estrutura única do contrato, montada uma vez com todas as condições já aplicadas e as cláusulas
// e pontos já numerados. Os geradores de PDF (cpcv-template.ts) e Word (cpcv-docx.ts) só formatam
// isto - nenhum deles decide que cláusulas entram, em que ordem, ou com que número.
export type ClausulaContrato = { ordinal: string; titulo: string; pontos: string[] };

export type Contrato = {
  outorgantes: BlocoOutorgantes;
  introBoaFe: string;
  clausulas: ClausulaContrato[];
  textoFinal: TextoFinal;
  localData: string;
  assinaturas: {
    tituloVendedores: string;
    linhasVendedores: number;
    tituloCompradores: string;
    linhasCompradores: number;
  };
};

export const TITULO_CONTRATO = "CONTRATO PROMESSA DE COMPRA E VENDA";
// Local de assinatura: o concelho do imóvel (pedido da solicitadora); "Braga" só se o concelho faltar.
const LOCAL_ASSINATURA_OMISSAO = "Braga";

export function montarContrato(h: Helpers, processo: Processo, partes: Parte[], hipotecas: Hipoteca[]): Contrato {
  const vendedores = partes.filter((p) => p.papel === "vendedor");
  const compradores = partes.filter((p) => p.papel === "comprador");
  if (vendedores.length === 0) vendedores.push(PARTE_EM_BRANCO);
  if (compradores.length === 0) compradores.push(PARTE_EM_BRANCO);

  // Unidades: um casal conta uma vez (um exemplar, um pagamento). Género: um lado vai no feminino só
  // quando todas as pessoas desse lado são mulheres.
  const unidadesVendedores = agruparUnidades(vendedores);
  const unidadesCompradores = agruparUnidades(compradores);
  const femVendedores = ladoFeminino(vendedores);
  const femCompradores = ladoFeminino(compradores);
  const C = concordancia(vendedores.length, compradores.length, {
    femVendedores,
    femCompradores,
    unidadesVendedores: unidadesVendedores.length,
    vendedoresSozinhos: unidadesVendedores.every((u) => u.length === 1 && u[0].tipo_pessoa !== "coletiva"),
  });
  const emails = {
    vendedores: vendedores.map((p) => (p.email ?? "").trim()).filter(Boolean),
    compradores: compradores.map((p) => (p.email ?? "").trim()).filter(Boolean),
  };
  const textoEmails = (s: string | null | undefined) => (s ?? "").split(/[;,\s]+/).filter(Boolean);
  if (emails.vendedores.length === 0) emails.vendedores = textoEmails(processo.email_proprietario_contrato);
  if (emails.compradores.length === 0) emails.compradores = textoEmails(processo.email_comprador_contrato);
  const comEmails = emails.vendedores.length > 0 || emails.compradores.length > 0;

  const lista: (ClausulaTexto | null)[] = [
    { titulo: "Objeto", paragrafos: pontosClausulaPrimeira(h, C, processo, hipotecas) },
    { titulo: "Preço e Condições de Pagamento", paragrafos: pontosClausulaSegunda(h, C, processo) },
    { titulo: "Escritura Pública ou DPA", paragrafos: pontosClausulaTerceira(h, C, processo, emails) },
    { titulo: "Avaliação Bancária", paragrafos: pontosClausulaQuarta(h, C, processo) },
    { titulo: "Bens Móveis", paragrafos: pontosClausulaQuinta(h, C, processo) },
    { titulo: "Encargos e Despesas", paragrafos: pontosClausulaSexta(C, hipotecas, processo) },
    { titulo: "Incumprimento do Contrato", paragrafos: pontosClausulaSetima(C) },
    { titulo: "Alterações", paragrafos: pontosClausulaOitava() },
    { titulo: "Notificações", paragrafos: pontosClausulaNona(comEmails) },
    { titulo: "Proteção de Dados", paragrafos: pontosClausulaDecima() },
    { titulo: "Direitos de Preferência", paragrafos: pontosClausulaDecimaPrimeira() },
    processo.imovel_condominio ? { titulo: "Condomínio", paragrafos: pontosClausulaDecimaSegunda() } : null,
    { titulo: "Lei Aplicável e Foro Competente", paragrafos: pontosClausulaDecimaTerceira() },
    { titulo: "Reconhecimento de Assinaturas", paragrafos: pontosClausulaDecimaQuarta() },
    { titulo: "Prévia Análise", paragrafos: pontosClausulaDecimaQuinta() },
    {
      titulo: "Intervenção Imobiliária",
      paragrafos: pontosClausulaDecimaSexta(h, { nome: processo.agencia_parceira_nome, ami: processo.agencia_parceira_ami }),
    },
  ];

  // Uma cláusula condicional que não se aplica devolve zero pontos (Avaliação Bancária, Bens
  // Móveis) ou é null (Condomínio) - sai da lista e as seguintes avançam uma posição.
  const numeradas = lista
    .filter((c): c is ClausulaTexto => c !== null && c.paragrafos.length > 0)
    .map((c, i) => ({ ordinal: ORDINAIS[i] ?? String(i + 1), titulo: c.titulo, pontos: c.paragrafos }));
  // Referências a outras cláusulas ("conforme cláusula quinta") só ficam a saber o número agora.
  const ordinalDe = (titulo: string) => (numeradas.find((c) => c.titulo === titulo)?.ordinal ?? "").toLocaleLowerCase("pt-PT");
  const marca = new RegExp(`${REF_ABRE}([^${REF_FECHA}]*)${REF_FECHA}`, "g");
  const clausulas: ClausulaContrato[] = numeradas.map((c) => ({ ...c, pontos: c.pontos.map((p) => p.replace(marca, (_, t: string) => ordinalDe(t))) }));

  // Um exemplar por parte do negócio: cada pessoa sozinha conta um e cada casal conta um (o contrato
  // final de 17/10/2026, com dois vendedores divorciados e um casal comprador, foi feito em três).
  const exemplares = unidadesVendedores.length + unidadesCompradores.length;
  const comAnexo = !!processo.tem_bens_moveis && /\banexo\b/i.test(processo.incluidos_no_imovel ?? "");

  return {
    outorgantes: montarBlocoOutorgantes(h, vendedores, compradores, {
      vendedores: processo.email_proprietario_contrato,
      compradores: processo.email_comprador_contrato,
    }),
    introBoaFe: INTRO_BOA_FE,
    clausulas,
    textoFinal: textoFinal(exemplares, comAnexo),
    localData: `${h.v(capitalizarLocal(processo.imovel_concelho), LOCAL_ASSINATURA_OMISSAO)}, ${h.dataLongaPT(processo.data_assinatura_contrato)}`,
    assinaturas: {
      tituloVendedores: tituloAssinaturas("vendedor", vendedores.length, femVendedores),
      linhasVendedores: vendedores.length,
      tituloCompradores: tituloAssinaturas("comprador", compradores.length, femCompradores),
      linhasCompradores: compradores.length,
    },
  };
}
