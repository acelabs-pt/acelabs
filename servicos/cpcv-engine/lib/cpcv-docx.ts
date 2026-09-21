import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from "docx";
import type { Parte, Processo, Helpers } from "./cpcv-types";
import { PARTE_EM_BRANCO, METODO_PAGAMENTO_LABEL } from "./cpcv-types";
import {
  identificacoesGrupo,
  clausulaCondicoesSuspensivas as clausulaCondicoesSuspensivasBase,
  clausulaAlteracoes,
  clausulaNotificacoes,
  clausulaProtecaoDados,
  clausulaDireitoPreferencia,
  clausulaLeiAplicavelForo,
  clausulaReconhecimentoAssinaturas,
  clausulaPreviaAnalise,
  clausulaIntervencaoImobiliaria,
  financiamentoAvaliacaoAtivo,
  clausulaFinanciamentoAvaliacao,
  clausulaDeclaracaoCondominio,
  textoFormaPagamentoSinal,
  ORDINAIS,
  type ClausulaTexto,
} from "./cpcv-clausulas";

function v(value: unknown, fallback = "____________"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function euros(value: number | null): string {
  if (value === null || value === undefined) return "____________";
  return `${value.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function dataPT(iso: string | null): string {
  if (!iso) return "____________";
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

const helpers: Helpers = { v, euros, dataPT };
const clausulaCondicoesSuspensivas = (processo: Processo) =>
  clausulaCondicoesSuspensivasBase(helpers, processo);

function corpo(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 200 },
    children: [new TextRun({ text, size: 24 })],
  });
}

function titulo(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, size: 24 })],
  });
}

export async function gerarDocxCpcv(processo: Processo, partes: Parte[]): Promise<Buffer> {
  const vendedores = partes.filter((p) => p.papel === "vendedor");
  const compradores = partes.filter((p) => p.papel === "comprador");
  if (vendedores.length === 0) vendedores.push(PARTE_EM_BRANCO);
  if (compradores.length === 0) compradores.push(PARTE_EM_BRANCO);

  const identificacoesVendedores = identificacoesGrupo(helpers, vendedores);
  const identificacoesCompradores = identificacoesGrupo(helpers, compradores);

  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: "Contrato-Promessa de Compra e Venda", bold: true, size: 32 })],
    }),
    corpo("Entre:"),
    ...identificacoesVendedores.map((texto, i) =>
      corpo(
        `${identificacoesVendedores.length > 1 ? `${i + 1}.º Outorgante - ` : ""}${texto}, doravante designado(a) PRIMEIRO OUTORGANTE ou PROMITENTE(S) VENDEDOR(A/ES).`
      )
    ),
    corpo("e"),
    ...identificacoesCompradores.map((texto, i) =>
      corpo(
        `${identificacoesCompradores.length > 1 ? `${i + 1}.º Outorgante - ` : ""}${texto}, doravante designado(a) SEGUNDO OUTORGANTE ou PROMITENTE(S) COMPRADOR(A/ES).`
      )
    ),
    corpo("é celebrado o presente contrato-promessa de compra e venda, que se rege pelas cláusulas seguintes:"),
  ];

  const clausulas: (ClausulaTexto | null)[] = [
    {
      titulo: "Objecto",
      paragrafos: [
        `O(s) PRIMEIRO(S) OUTORGANTE(S) é/são legítimo(s) proprietário(s) e possuidor(es) do prédio urbano sito em ${v(
          processo.imovel_morada
        )}, freguesia de ${v(processo.imovel_freguesia)}, concelho de ${v(
          processo.imovel_concelho
        )}, distrito de ${v(processo.imovel_distrito)}, com a tipologia ${v(
          processo.imovel_tipologia
        )}, inscrito na matriz predial urbana sob o artigo n.º ${v(processo.imovel_artigo_matricial)}${
          processo.imovel_descricao_predial
            ? `, descrito na Conservatória do Registo Predial sob o n.º ${v(processo.imovel_descricao_predial)}`
            : ""
        }, com a área de ${processo.imovel_area ? `${processo.imovel_area} m²` : "____________"}, doravante designado por "Imóvel".`,
        processo.tem_fracoes_multiplas
          ? `O Imóvel é composto por duas fracções, sendo atribuído à fracção principal o valor de ${euros(
              processo.valor_fracao_principal
            )} e à segunda fracção (garagem/arrumo) o valor de ${euros(processo.valor_fracao_secundaria)}.`
          : "",
      ].filter(Boolean),
    },
    {
      titulo: "Promessa",
      paragrafos: [
        "Pela presente, o(s) PRIMEIRO(S) OUTORGANTE(S) promete(m) vender, livre de ónus ou encargos, e o(s) SEGUNDO(S) OUTORGANTE(S) promete(m) comprar o Imóvel identificado na Cláusula Primeira, nas condições constantes do presente contrato.",
      ],
    },
    {
      titulo: "Preço e Condições de Pagamento",
      paragrafos: [
        `O preço global e convencionado para a presente promessa de compra e venda é de ${euros(
          processo.preco_total
        )}, a pagar através de ${v(
          METODO_PAGAMENTO_LABEL[processo.metodo_pagamento ?? ""],
          "meio de pagamento a definir"
        )}, da seguinte forma:`,
        `a) A título de sinal e princípio de pagamento, a quantia de ${euros(
          processo.valor_sinal
        )}, paga ${textoFormaPagamentoSinal(helpers, processo)}${
          processo.iban_sinal ? `, para o IBAN ${v(processo.iban_sinal)}` : ""
        }${processo.reforco_sinal ? `, com reforço de sinal de ${v(processo.reforco_sinal)}` : ""};`,
        "b) O remanescente do preço será pago na data da celebração da escritura pública de compra e venda, através de meio de pagamento idóneo.",
        processo.reserva
          ? `Foi entregue pelo(s) SEGUNDO(S) OUTORGANTE(S), a título de reserva, a quantia de ${euros(
              processo.valor_reserva
            )}, a deduzir ao valor do sinal referido na alínea a).`
          : "",
        processo.valor_mobilia
          ? `É atribuído à mobília e aos bens móveis incluídos na transacção o valor de ${euros(processo.valor_mobilia)}.`
          : "",
      ].filter(Boolean),
    },
    financiamentoAvaliacaoAtivo(processo)
      ? { titulo: "Financiamento e Avaliação Bancária", paragrafos: clausulaFinanciamentoAvaliacao(helpers, processo) }
      : null,
    {
      titulo: "Escritura Pública",
      paragrafos: [
        `A escritura pública de compra e venda, ou documento particular autenticado equivalente, será celebrada até ${dataPT(
          processo.prazo_escritura
        )}, em local, dia e hora a acordar entre as partes, devendo o(s) PRIMEIRO(S) OUTORGANTE(S) ser notificado(s) com uma antecedência mínima de 8 (oito) dias.`,
      ],
    },
    financiamentoAvaliacaoAtivo(processo) &&
    !processo.condicoes_suspensivas &&
    !processo.condicionado_outra_situacao
      ? null
      : { titulo: "Condições Suspensivas", paragrafos: [clausulaCondicoesSuspensivas(processo)] },
    {
      titulo: "Incumprimento",
      paragrafos: [
        v(
          processo.penalizacao_incumprimento,
          "Em caso de incumprimento definitivo do presente contrato por causa imputável ao PRIMEIRO OUTORGANTE, este restituirá ao SEGUNDO OUTORGANTE o valor do sinal em dobro; em caso de incumprimento definitivo por causa imputável ao SEGUNDO OUTORGANTE, perderá este, a favor do PRIMEIRO OUTORGANTE, o valor do sinal já entregue, nos termos gerais do artigo 442.º do Código Civil."
        ),
      ],
    },
    {
      titulo: "Estado do Imóvel e Licenciamento",
      paragrafos: [
        `O Imóvel é transaccionado no estado de conservação em que actualmente se encontra${
          processo.imovel_estado ? `: ${v(processo.imovel_estado)}` : ""
        }, o qual é do conhecimento do(s) SEGUNDO(S) OUTORGANTE(S), dispõe de licença de utilização n.º ${v(
          processo.imovel_licenca_utilizacao
        )} e de certificado energético com a classificação ${v(processo.imovel_certificado_energetico)}${
          processo.imovel_anexos ? `, possuindo ainda os seguintes anexos: ${v(processo.imovel_anexos)}` : ""
        }.`,
        processo.incluidos_no_imovel
          ? `Ficam incluídos na transacção: ${v(processo.incluidos_no_imovel).replace(/\.+$/, "")}.`
          : "",
      ].filter(Boolean),
    },
    processo.imovel_condominio
      ? { titulo: "Declaração de Condomínio", paragrafos: clausulaDeclaracaoCondominio() }
      : null,
    { titulo: "Alterações", paragrafos: clausulaAlteracoes() },
    {
      titulo: "Notificações",
      paragrafos: [
        ...clausulaNotificacoes(),
        processo.email_proprietario_contrato || processo.email_comprador_contrato
          ? `Para efeitos de comunicação relativa ao presente contrato: proprietário - ${v(
              processo.email_proprietario_contrato
            )}; comprador - ${v(processo.email_comprador_contrato)}.`
          : "",
      ].filter(Boolean),
    },
    { titulo: "Protecção de Dados", paragrafos: clausulaProtecaoDados() },
    { titulo: "Direito de Preferência", paragrafos: clausulaDireitoPreferencia() },
    { titulo: "Lei Aplicável e Foro Competente", paragrafos: clausulaLeiAplicavelForo() },
    { titulo: "Reconhecimento de Assinaturas", paragrafos: clausulaReconhecimentoAssinaturas() },
    { titulo: "Prévia Análise", paragrafos: clausulaPreviaAnalise() },
    { titulo: "Intervenção Imobiliária", paragrafos: clausulaIntervencaoImobiliaria() },
    processo.comodato
      ? {
          titulo: "Comodato",
          paragrafos: [
            `O(s) PRIMEIRO(S) OUTORGANTE(S) permanecerá(ão) no Imóvel a título de comodato após a escritura, por um período de ${v(
              processo.tempo_comodato,
              "____________"
            )}, findo o qual entregará(ão) o Imóvel livre de pessoas e bens ao(s) SEGUNDO(S) OUTORGANTE(S).`,
          ],
        }
      : null,
    processo.observacoes_adicionais
      ? { titulo: "Observações Adicionais", paragrafos: [v(processo.observacoes_adicionais)] }
      : null,
  ];

  clausulas
    .filter((c): c is ClausulaTexto => c !== null)
    .forEach((c, i) => {
      children.push(titulo(`Cláusula ${ORDINAIS[i] ?? i + 1} (${c.titulo})`));
      c.paragrafos.forEach((p) => children.push(corpo(p)));
    });

  children.push(
    corpo("Feito em dois exemplares, ficando cada uma das partes na posse de um exemplar."),
    corpo(
      `Local e data: ${v(processo.imovel_concelho, "____________")}, ${
        processo.data_assinatura_contrato ? dataPT(processo.data_assinatura_contrato) : "____ de ____________ de ________"
      }`
    ),
    new Paragraph({ spacing: { before: 600 }, children: [new TextRun({ text: "" })] }),
    new Paragraph({
      spacing: { before: 600 },
      children: [new TextRun({ text: "_______________________________________", size: 24 })],
    }),
    corpo("O(s) Promitente(s) Vendedor(a/es)"),
    new Paragraph({
      spacing: { before: 600 },
      children: [new TextRun({ text: "_______________________________________", size: 24 })],
    }),
    corpo("O(s) Promitente(s) Comprador(a/es)")
  );

  const doc = new Document({ sections: [{ children }] });

  return Packer.toBuffer(doc);
}
