import type { Parte, Processo, Helpers } from "./cpcv-types";
import { PARTE_EM_BRANCO, METODO_PAGAMENTO_LABEL } from "./cpcv-types";
import {
  identificacoesGrupo,
  clausulaCondicoesSuspensivas as clausulaCondicoesSuspensivasBase,
  clausulaAlteracoes,
  clausulaNotificacoes,
  clausulaEncargosDespesas,
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

// Todo o texto livre (extraído pela IA ou escrito pela gestora - morada, observações,
// nome das partes, etc.) acaba nesta string HTML que é passada directamente a
// page.setContent() do Playwright para gerar o PDF - sem escaping, uma morada ou
// observação com "<b>", "<script>" ou "&" era interpretada como markup real (testado:
// alterava mesmo o aspecto do documento gerado). v() é o ponto central por onde passa
// quase todo o texto, por isso escapa aqui em vez de em cada local de interpolação.
function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function v(value: unknown, fallback = "____________"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return escapeHtml(String(value));
}

function euros(value: number | null): string {
  if (value === null || value === undefined) return "____________";
  return `${value.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (${valorPorExtenso(value)})`;
}

function valorPorExtenso(value: number): string {
  return `${value.toLocaleString("pt-PT")} euros`;
}

function dataPT(iso: string | null): string {
  if (!iso) return "____________";
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return escapeHtml(iso);
  return `${dia}/${mes}/${ano}`;
}

const helpers: Helpers = { v, euros, dataPT };
const clausulaCondicoesSuspensivas = (processo: Processo) =>
  clausulaCondicoesSuspensivasBase(helpers, processo);

export function gerarHtmlCpcv(processo: Processo, partes: Parte[]): string {
  const vendedores = partes.filter((p) => p.papel === "vendedor");
  const compradores = partes.filter((p) => p.papel === "comprador");
  if (vendedores.length === 0) vendedores.push(PARTE_EM_BRANCO);
  if (compradores.length === 0) compradores.push(PARTE_EM_BRANCO);

  const identificacoesVendedores = identificacoesGrupo(helpers, vendedores);
  const outorgantesVendedores = identificacoesVendedores.map(
    (texto, i) => `<p>${identificacoesVendedores.length > 1 ? `${i + 1}.º Outorgante - ` : ""}${texto}, doravante designado(a) <strong>PRIMEIRO OUTORGANTE</strong> ou <strong>PROMITENTE(S) VENDEDOR(A/ES)</strong>.</p>`
  );

  const identificacoesCompradores = identificacoesGrupo(helpers, compradores);
  const outorgantesCompradores = identificacoesCompradores.map(
    (texto, i) => `<p>${identificacoesCompradores.length > 1 ? `${i + 1}.º Outorgante - ` : ""}${texto}, doravante designado(a) <strong>SEGUNDO OUTORGANTE</strong> ou <strong>PROMITENTE(S) COMPRADOR(A/ES)</strong>.</p>`
  );

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
        }, com a área de ${
          processo.imovel_area ? `${processo.imovel_area} m²` : "____________"
        }, doravante designado por "Imóvel".`,
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
    // A cláusula de Financiamento e Avaliação Bancária já cobre os condicionamentos de
    // financiamento/avaliação com o mecanismo completo - só mostra a cláusula genérica de
    // Condições Suspensivas se houver algo mais a dizer (texto manual da gestora, ou uma
    // condição "outra situação" que a cláusula rica não cobre).
    financiamentoAvaliacaoAtivo(processo) &&
    !processo.condicoes_suspensivas &&
    !processo.condicionado_outra_situacao
      ? null
      : { titulo: "Condições Suspensivas", paragrafos: [clausulaCondicoesSuspensivas(processo)] },
    { titulo: "Encargos e Despesas", paragrafos: clausulaEncargosDespesas() },
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

  const clausulasHtml = clausulas
    .filter((c): c is ClausulaTexto => c !== null)
    .map(
      (c, i) =>
        `<h2>Cláusula ${ORDINAIS[i] ?? i + 1} (${c.titulo})</h2>\n${c.paragrafos
          .map((p) => `<p class="clausula">${p}</p>`)
          .join("\n")}`
    )
    .join("\n\n");

  return `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>Contrato-Promessa de Compra e Venda</title>
<style>
  /* Mesma tipografia das minutas reais da agência (confirmado no document.xml de uma
     minuta real): Segoe UI, 11pt, espaçamento de linha 1.5 - para o PDF e o Word
     ficarem visualmente iguais, ainda que gerados por dois motores diferentes. */
  @page { size: A4; margin: 25mm 20mm; }
  body { font-family: "Segoe UI", Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; }
  h1 { text-align: center; font-size: 14pt; text-transform: uppercase; margin-bottom: 4mm; }
  h2 { font-size: 11pt; text-transform: uppercase; text-align: center; margin-top: 8mm; margin-bottom: 2mm; }
  p { text-align: justify; margin: 2mm 0; }
  .clausula { margin-top: 4mm; }
  .assinaturas { margin-top: 20mm; display: flex; justify-content: space-between; }
  .assinatura { width: 45%; text-align: center; }
  .linha { border-top: 1px solid #111; margin-top: 15mm; padding-top: 2mm; }
  .rodape { margin-top: 10mm; font-size: 9pt; color: #666; text-align: center; }
</style>
</head>
<body>
  <h1>Contrato-Promessa de Compra e Venda</h1>
  <p>Entre:</p>
  ${outorgantesVendedores.join("\n")}
  <p>e</p>
  ${outorgantesCompradores.join("\n")}
  <p>é celebrado o presente contrato-promessa de compra e venda, que se rege pelas cláusulas seguintes:</p>

  ${clausulasHtml}

  <p class="clausula">Feito em dois exemplares, ficando cada uma das partes na posse de um exemplar.</p>
  <p class="clausula">
    Local e data: ${v(processo.imovel_concelho, "____________")}, ${
    processo.data_assinatura_contrato ? dataPT(processo.data_assinatura_contrato) : "____ de ____________ de ________"
  }
  </p>

  <div class="assinaturas">
    <div class="assinatura">
      <div class="linha">O(s) Promitente(s) Vendedor(a/es)</div>
    </div>
    <div class="assinatura">
      <div class="linha">O(s) Promitente(s) Comprador(a/es)</div>
    </div>
  </div>

  <p class="rodape">Documento gerado automaticamente com apoio de IA - a rever antes de assinatura. Ace Labs.</p>
</body>
</html>`;
}
