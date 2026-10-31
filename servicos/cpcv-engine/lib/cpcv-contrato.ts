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

  const C = concordancia(vendedores.length, compradores.length);
  const emails = {
    vendedores: vendedores.map((p) => (p.email ?? "").trim()).filter(Boolean),
    compradores: compradores.map((p) => (p.email ?? "").trim()).filter(Boolean),
  };
  const textoEmails = (s: string | null | undefined) => (s ?? "").split(/[;,s]+/).filter(Boolean);
  if (emails.vendedores.length === 0) emails.vendedores = textoEmails(processo.email_proprietario_contrato);
  if (emails.compradores.length === 0) emails.compradores = textoEmails(processo.email_comprador_contrato);

  const lista: (ClausulaTexto | null)[] = [
    { titulo: "Objeto", paragrafos: pontosClausulaPrimeira(h, C, processo, hipotecas) },
    { titulo: "Preço e Condições de Pagamento", paragrafos: pontosClausulaSegunda(h, C, processo) },
    { titulo: "Escritura Pública ou DPA", paragrafos: pontosClausulaTerceira(h, C, processo, emails) },
    { titulo: "Avaliação Bancária", paragrafos: pontosClausulaQuarta(h, C, processo) },
    { titulo: "Bens Móveis", paragrafos: pontosClausulaQuinta(h, C, processo) },
    { titulo: "Encargos e Despesas", paragrafos: pontosClausulaSexta(C, hipotecas, processo) },
    { titulo: "Incumprimento do Contrato", paragrafos: pontosClausulaSetima(C) },
    { titulo: "Alterações", paragrafos: pontosClausulaOitava() },
    { titulo: "Notificações", paragrafos: pontosClausulaNona() },
    { titulo: "Proteção de Dados", paragrafos: pontosClausulaDecima() },
    { titulo: "Direitos de Preferência", paragrafos: pontosClausulaDecimaPrimeira(C) },
    processo.imovel_condominio ? { titulo: "Condomínio", paragrafos: pontosClausulaDecimaSegunda() } : null,
    { titulo: "Lei Aplicável e Foro Competente", paragrafos: pontosClausulaDecimaTerceira() },
    { titulo: "Reconhecimento de Assinaturas", paragrafos: pontosClausulaDecimaQuarta() },
    { titulo: "Prévia Análise", paragrafos: pontosClausulaDecimaQuinta() },
    { titulo: "Intervenção Imobiliária", paragrafos: pontosClausulaDecimaSexta() },
  ];

  // Uma cláusula condicional que não se aplica devolve zero pontos (Avaliação Bancária, Bens
  // Móveis) ou é null (Condomínio) - sai da lista e as seguintes avançam uma posição.
  const clausulas: ClausulaContrato[] = lista
    .filter((c): c is ClausulaTexto => c !== null && c.paragrafos.length > 0)
    .map((c, i) => ({ ordinal: ORDINAIS[i] ?? String(i + 1), titulo: c.titulo, pontos: c.paragrafos }));

  // Um exemplar por outorgante (o modelo, com 1 vendedor e 2 compradores, é feito em três).
  const exemplares = vendedores.length + compradores.length;

  return {
    outorgantes: montarBlocoOutorgantes(h, vendedores, compradores, {
      vendedores: processo.email_proprietario_contrato,
      compradores: processo.email_comprador_contrato,
    }),
    introBoaFe: INTRO_BOA_FE,
    clausulas,
    textoFinal: textoFinal(exemplares),
    localData: `${h.v(capitalizarLocal(processo.imovel_concelho), LOCAL_ASSINATURA_OMISSAO)}, ${h.dataLongaPT(processo.data_assinatura_contrato)}`,
    assinaturas: {
      tituloVendedores: vendedores.length > 1 ? "OS PRIMEIROS OUTORGANTES:" : "O PRIMEIRO OUTORGANTE:",
      linhasVendedores: vendedores.length,
      tituloCompradores: compradores.length > 1 ? "OS SEGUNDOS OUTORGANTES:" : "O SEGUNDO OUTORGANTE:",
      linhasCompradores: compradores.length,
    },
  };
}
