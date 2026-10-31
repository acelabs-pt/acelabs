// Compara o contrato gerado pela app contra o contrato de referência aprovado («CPCV 126601064-8
// Assinado.pdf», 16 cláusulas), e corre os cenários A-H do pedido de implementação com asserções
// estruturais (cláusulas presentes, numeração, pontos, concordância). Não há framework de testes
// no projecto (ver CLAUDE.md) - este script é standalone, corrido manualmente
// (`npm run verificar:clausulas`), não faz parte do build.
//
// Parte 1 reconstrói o processo do contrato de referência e exige que cada ponto gerado seja igual
// ao do PDF, a menos das adaptações expressamente aprovadas (listadas em ADAPTACOES_APROVADAS).
// Qualquer outra diferença faz o script falhar.

import type { Helpers, Hipoteca, Parte, Processo } from "../lib/cpcv-types";
import { formatarDataCurta, formatarDataLonga, formatarEuros } from "../lib/cpcv-types";
import { euroPorExtenso, semMarcas } from "../lib/cpcv-clausulas";
import { montarContrato, type Contrato } from "../lib/cpcv-contrato";

const h: Helpers = {
  v: (value, fallback = "____________") => (value === null || value === undefined || value === "" ? fallback : String(value)),
  euros: (value) =>
    value === null || value === undefined
      ? "____________"
      : `${formatarEuros(value)}€ (${euroPorExtenso(value)})`,
  dataPT: (iso) => formatarDataCurta(iso) ?? "____________",
  dataLongaPT: (iso) => formatarDataLonga(iso) ?? "____________",
};

function normalizar(texto: string): string {
  return semMarcas(texto)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/n\.?[º°]\s*/g, "n ")
    .replace(/[“”]/g, '"')
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

let falhas = 0;
function verificar(nome: string, ok: boolean, detalhe = ""): void {
  console.log(`${ok ? "PASS" : "FALHA"}  ${nome}${ok || !detalhe ? "" : `\n        ${detalhe}`}`);
  if (!ok) falhas += 1;
}

// ---------------------------------------------------------------------------------------------
// Parte 1 - contrato de referência, ponto a ponto
// ---------------------------------------------------------------------------------------------

const vendedorRef: Parte = {
  papel: "vendedor",
  tipo_pessoa: "singular",
  nome: "Pedro Manuel Gonçalves Roque",
  estado_civil: "solteiro",
  regime_bens: null,
  nacionalidade: "portuguesa",
  nif: "275146499",
  morada: "Travessa Rua da Igreja, nº74, 4º esquerdo, freguesia de Creixomil, concelho de Guimarães, C.P 4835-060",
  documento_tipo: "Cartão de Cidadão",
  documento_numero: "15664140 2ZV5",
  documento_validade: "2036-03-28",
};
const compradoraRef: Parte = { ...vendedorRef, papel: "comprador", nome: "Ana Catarina Pinto Melo", estado_civil: "solteira", nif: "256296103" };
const compradorRef: Parte = { ...vendedorRef, papel: "comprador", nome: "Renato Coelho Dias", nif: "265704634" };

const processoBase: Processo = {
  imovel_morada: "Praceta Padre Sena de Freitas, nº160",
  imovel_codigo_postal: null,
  imovel_localidade: null,
  imovel_freguesia: "Braga Maximinos",
  imovel_concelho: "Braga",
  imovel_distrito: "Braga",
  imovel_tipologia: "T3",
  imovel_artigo_matricial: "3",
  imovel_descricao_predial: "538/BragaMaximinos",
  imovel_certificado_energetico: "SCE141565729",
  imovel_licenca_utilizacao: "2472",
  imovel_area: null,
  imovel_anexos: null,
  imovel_estado: null,
  imovel_condominio: true,
  imovel_e_fracao_autonoma: true,
  imovel_fracao_letra: "AH",
  imovel_andar_fracao: "quinto andar centro",
  imovel_orientacao: "nascente",
  imovel_finalidade: "habitação",
  imovel_conservatoria: "Braga",
  imovel_licenca_data_emissao: "1979-09-07",
  imovel_licenca_entidade_emissora: "Câmara Municipal de Braga",
  imovel_certificado_validade: "2027-02-10",
  imovel_certificado_classe: "D",
  hipotecas_verificadas: true,
  preco_total: 222000,
  valor_sinal: 2000,
  forma_pagamento_sinal: null,
  prazo_pagamento_sinal: null,
  prazo_escritura: "2026-10-15",
  condicoes_suspensivas: null,
  penalizacao_incumprimento: null,
  metodo_pagamento: "financiamento",
  tem_fracoes_multiplas: false,
  valor_fracao_principal: null,
  valor_fracao_secundaria: null,
  valor_mobilia: null,
  reforco_sinal: null,
  reforcos_sinal: [],
  iban_sinal: null,
  destino_sinal: "agencia",
  conta_sinal_banco: null,
  conta_sinal_titular: null,
  comissao_modalidade: "integral_cpcv",
  comissao_valor: 1000,
  reserva: null,
  valor_reserva: null,
  reserva_ate_data: null,
  condicionado_avaliacao: true,
  valor_avaliacao_minimo: 222000,
  prazo_avaliacao_dias: null,
  avaliacao_prazo_data: "2026-09-30",
  avaliacao_contacto_email: "wego@remax.pt",
  condicionado_financiamento: null,
  valor_financiamento_minimo: null,
  prazo_financiamento_dias: null,
  condicionado_outra_situacao: null,
  prazo_outra_situacao_dias: null,
  dias_condicionamento: null,
  dias_condicionamento_tipo: null,
  comodato: null,
  tempo_comodato: null,
  tem_bens_moveis: true,
  incluidos_no_imovel:
    "cozinha equipada com placa, forno, exaustor, frigorífico, máquina de lavar louça, máquina de lavar roupa; cilindro; dois armários de roupa, duas mesas de cabeceira e o móvel da entrada",
  email_proprietario_contrato: null,
  email_comprador_contrato: null,
  data_assinatura_contrato: "2026-09-08",
  observacoes_adicionais: null,
};

const hipotecaRef: Hipoteca = {
  entidade_credora: "Banco Santander Totta, S.A",
  natureza: "hipoteca voluntária",
  numero_apresentacao: "AP.3661",
  data_registo: "2025-11-21",
};

// Texto do PDF assinado, por cláusula (título -> pontos), tal como extraído.
const REFERENCIA: { titulo: string; pontos: string[] }[] = [
  {
    titulo: "Objeto",
    pontos: [
      "1 – O primeiro outorgante, declara para os devidos e legais efeitos, que é o único dono e legítimo proprietário da fração autónoma designada pelas letras “AH”, quinto andar centro, virado a nascente, destinado a habitação, integrada num prédio urbano em regime de propriedade horizontal, sita na Praceta Padre Sena de Freitas, nº160, freguesia de Braga Maximinos, concelho de Braga, descrita na Conservatória do Registo Predial de Braga sob o nº 538/BragaMaximinos, inscrito na matriz sob o artigo 3, com a licença de utilização nº2472, emitida em 07 de setembro de 1979, pela Câmara Municipal de Braga, com o certificado de desempenho energético nº SCE141565729, válido até 10-02-2027, com a classe energética D.",
      "2 – Sobre a referida fração incide uma hipoteca voluntária registada a favor do Banco Santander Totta, S.A, através da AP.3661 de 2025-11-21, cujo cancelamento terá de ser assegurado pelo primeiro outorgante até à data da escritura definitiva de compra e venda.",
      "3- Por constituir este contrato uma promessa de compra e venda com entrega de sinal, os segundos outorgantes reconhecem que, com a assinatura do mesmo e, até à outorga da escritura de compra e venda, não lhes é transmitida a propriedade da fração nem lhes é conferido o direito de tomar posse da mesma.",
      "4 – Que a fração é vendida no estado de conservação em que se encontra, conforme visita ao imóvel, no estado esse que os segundos outorgantes conhecem e aceitam não podendo pedir quaisquer obras ou reparações na mesma.",
      "5– O primeiro outorgante autoriza os segundos outorgantes a visitarem a fração, no dia anterior ou no próprio dia da outorga da escritura de compra e venda, a fim de verificarem que a mesma se mantém no exato estado em que se encontra, à data de hoje, desde que para isso seja contactado com pelo menos três dias de antecedência, pelo angariador imobiliário, sendo que se existirem danos terão de ser imediatamente reparados pelo primeiro outorgante colocando a fração no mesmo estado aquando da primeira visita.",
    ],
  },
  {
    titulo: "Preço e Condições de Pagamento",
    pontos: [
      "1- Pelo presente contrato o primeiro outorgante, promete vender aos segundos outorgantes, que por sua vez prometem comprar àquele, a fração autónoma identificada na cláusula anterior, livre de ónus ou encargos, hipotecas e responsabilidades, sejam de que natureza forem, e livre de qualquer tipo de ocupação, arrendamento, servidão, comodato ou qualquer outro que limite a posse, e devoluto de pessoas e bens, pelo preço total de 222.000,00€ (Duzentos e Vinte e Dois Mil Euros).",
      "2 – Na presente data, a título de sinal e princípio de pagamento, os segundos outorgantes terão de entregar a quantia de 2.000€ (Dois Mil Euros), através de transferência bancária para a conta com o IBAN PT50 0007 0000 0080 2304 3642 3, do Novo Banco, à ordem da Agência House Culture, Lda, de que o primeiro outorgante dará quitação após boa cobrança.",
      "3 - O primeiro outorgante nomeia a Agência House Culture, Lda para ficar como fiel depositária, do valor acima mencionado, até resposta do financiamento/ avaliação que os segundos outorgantes estão a recorrer junto de uma instituição bancária.",
      "4- Os outorgantes convencionam, nos termos do disposto no artigo 432º do Código Civil, que se considera automaticamente resolvido, sem necessidade de qualquer interpelação, o presente contrato promessa de compra e venda, se o valor a título de sinal, não estiver disponível no prazo de 3 dias a contar da data da assinatura do presente contrato.",
      "5- A restante parte do preço, será paga no ato da celebração da escritura de compra e venda, objeto do presente contrato, em cheque bancário.",
    ],
  },
  {
    titulo: "Escritura Pública ou DPA",
    pontos: [
      "1 - A escritura definitiva de compra de venda, de que o presente contrato é promessa será outorgada até ao dia 15 de Outubro de 2026, em cartório notarial, escritório de advogados, solicitadores ou casa pronta, a designar pelos segundos outorgantes, devendo estes avisar o primeiro outorgante, com a data, hora e local da mesma, com antecedência mínima de 15 (quinze) dias.",
      "2 - Se a escritura não for realizada no prazo referido na cláusula anterior por facto imputável ao primeiro outorgante, os segundos outorgantes deverão notificá-los de novo, em data posterior, por carta registada com aviso de receção com pelo menos 15 (quinze) dias de antecedência.",
      "3 - Decorrido que esteja o prazo referido no nº1 desta cláusula sem se ter realizado a Escritura Pública e Definitiva por facto imputável aos segundos Outorgantes, o primeiro Outorgante tem a faculdade de reverter para si a obrigação de notificá-los, em data posterior, por carta registada, com aviso de receção com pelo menos 15(quinze) dias de antecedência, a comparecer no dia, hora e local determinado por este, para a celebração do referido ato.",
      "4 – Se a escritura definitiva de compra e venda, não se realizar após as notificações acima mencionadas, acordam as partes que se aplica a cláusula do incumprimento do presente contrato promessa de compra e venda.",
    ],
  },
  {
    titulo: "Avaliação Bancária",
    pontos: [
      "1- Os segundos outorgantes, para aquisição da referida fração, pretendem recorrer a financiamento bancário.",
      "2 - O presente contrato, fica expressamente condicionado à avaliação no valor mínimo do negócio, montante necessário para que seja aprovado o referido financiamento bancário.",
      "3- Os segundos outorgantes dispõem até ao dia 30 de setembro de 2026, para comunicar via email, para wego@remax.pt, se o resultado da avaliação foi suficiente para a obtenção do financiamento.",
      "4- Se a avaliação do imóvel não for suficiente para a aprovação do referido financiamento, este contrato considera-se automaticamente resolvido, sendo o montante entregue a título de sinal devolvido, em singelo, aos segundos outorgantes, no prazo de 5 dias.",
      "5 - Se até ao prazo acima mencionado, os segundos outorgantes não enviarem nenhum email conforme referido nos pontos anteriores, considera-se que o crédito e avaliação foram positivas e o presente contrato de compra e venda mantêm-se conforme as restantes cláusulas.",
    ],
  },
  {
    titulo: "Bens Móveis",
    pontos: [
      "1 - Que o imóvel é vendido com cozinha equipada com placa, forno, exaustor, frigorífico, máquina de lavar louça, máquina de lavar roupa; cilindro; dois armários de roupa, duas mesas de cabeceira e o móvel da entrada, no estado de conversação em que se encontram e que já foi visitado e aceite pelos segundos outorgantes.",
    ],
  },
  {
    titulo: "Encargos e Despesas",
    pontos: [
      "1 - Compete ao primeiro outorgante a organização e entrega aos segundos outorgantes de toda a documentação necessária à celebração da escritura de compra e venda, registo predial, caderneta predial, licença de utilização, certificado energético, e cancelamento da referida hipoteca e o custo a esta associado.",
      "2- São por conta dos segundos outorgantes todos os encargos notariais, registais e fiscais inerentes à qualidade de adquirentes.",
    ],
  },
  {
    titulo: "Incumprimento do Contrato",
    pontos: [
      "1- Em caso de incumprimento definitivo do presente contrato, por causa comprovadamente imputável aos segundos outorgantes, estes sujeitam-se às penalidades estabelecidas por lei, designadamente à perda, a favor do primeiro outorgante, de todas as quantias entregues por conta do preço do contrato, dito sinal, nos termos do artigo 442.º do Código Civil.",
      "2- Em caso de incumprimento definitivo do presente contrato, por causa comprovadamente imputável ao primeiro outorgante, este obriga-se à devolução, em dobro, de todas as quantias entretanto recebidas dos segundos outorgantes, nos termos do artigo 442.º do Código Civil.",
      "3 - Em qualquer dos casos previstos anteriormente, a parte não faltosa poderá, em alternativa, requerer a execução específica do presente contrato, nos termos do artigo 830.º do Código Civil. O incumprimento do contrato obriga ainda a parte faltosa ao pagamento de todos os prejuízos efetivamente causados à parte não faltosa, bem como de todas as despesas judiciais e extrajudiciais que o incumprimento determinar.",
    ],
  },
  {
    titulo: "Alterações",
    pontos: [
      "1- Eventuais alterações, anulações, aditamentos ou acordos de revogação do presente contrato só serão válidos se forem efetuados por escrito e assinados por todos os outorgantes, sendo nulos e ineficazes e sem qualquer validade jurídica acordos verbais.",
    ],
  },
  {
    titulo: "Notificações",
    pontos: [
      "1- Todas as notificações que venham a ser necessárias fazer na vigência do presente contrato, serão feitas para as moradas supra indicadas e em caso de alteração, devem ser comunicadas por escrito, através de carta registada com aviso de receção, à contraparte, no prazo máximo de 5 dias contados da data em que ocorrer a respetiva alteração.",
      "2- O envio de carta registada com aviso de receção para a morada das partes será prova bastante para demonstrar que se efetuou qualquer notificação, ou seja se realizou a interpelação daquela para a realização da escritura definitiva de compra e venda, sendo este o caso.",
    ],
  },
  {
    titulo: "Proteção de Dados",
    pontos: [
      "1- Os dados pessoais, recolhidos no presente documento destinam-se ao cumprimento do dever de identificação previsto na Lei nº83/2017, de 18 de agosto e Lei nº58/2019 de 08 de agosto e no Regulamento 276/2019, de 26 de Março e serão processados informaticamente e conservados pelo período de 7 anos.",
      "2 – As partes, enquanto titulares dos dados, têm o direito de aceder a todos os seus dados e o direito de exigir a sua limitação, retificação, oposição ou apagamento nos limites legalmente impostos.",
      "3- As partes declaram para os devidos efeitos, sob o compromisso de honra:",
      "a. Que são verdadeiros os elementos indicados, e",
      "b. Que autorizam a reprodução dos documentos de identificação bem como qualquer outro documento necessário à concretização do negócio, em suporte físico e/ou eletrónico.",
    ],
  },
  {
    titulo: "Direitos de Preferência",
    pontos: [
      "1 - Considerando que diversas entidades públicas são titulares de direito de preferência na aquisição do imóvel objeto deste contrato, fica acordado pelos outorgantes que, caso o referido direito seja exercido, o presente contrato cessa automaticamente os seus efeitos, obrigando-se a promitente vendedora a devolver, no prazo máximo de 8 (oito) dias, contados da data da comunicação ou ofício da entidade respetiva, aos promitentes compradores, a quantia total entregue a título de sinal, não havendo lugar a qualquer outra indemnização ou compensação.",
      "2 – Sendo o caso disso, compete ao promitente vendedor a instrução do anúncio destinado à comunicação das condições da presente promessa às entidades preferentes através do site www.casapronta.mj.pt.",
    ],
  },
  {
    titulo: "Condomínio",
    pontos: [
      "1 - A Parte Promitente Vendedora compromete-se a ter as prestações do condomínio, sejam elas provenientes de quotas ordinárias, extraordinárias ou para obras realizadas ou a realizar nas partes comuns do edifício, integralmente pagas até à data em que for outorgado o contrato definitivo de compra e venda, obrigando-se a entregar à Parte Promitente Compradora, naquela data, documento comprovativo da não existência de dívidas, emitido pela administração do condomínio, com reconhecimento de assinatura pelo administrador, nos termos e em cumprimento do previsto pelo artigo 1424.º-A do Código Civil, com a redação dada pela Lei n.º 8/2022 de 10 de janeiro, em vigor desde 01/04/2022.",
      "2 - Ainda, no âmbito do Decreto-Lei mencionado no ponto anterior, a Parte Vendedora é responsável pela comunicação da venda, por carta registada com aviso de receção ou email, ao administrador do condomínio, no prazo máximo de 15 dias a contar da data de escritura, com informação do nome completo, e o número de identificação fiscal do novo proprietário.",
    ],
  },
  {
    titulo: "Lei Aplicável e Foro Competente",
    pontos: [
      "1 - Para a resolução de qualquer litígio eventualmente decorrente do presente contrato, e que as partes não consigam resolver por mútuo acordo, fica desde já convencionado, com a exclusão de qualquer outro, que é competente o foro da comarca do imóvel.",
      "2 - O presente contrato promessa é exclusivamente regulado pela legislação portuguesa em vigor, nomeadamente pelo Código Civil.",
    ],
  },
  {
    titulo: "Reconhecimento de Assinaturas",
    pontos: [
      "1- Os outorgantes acordam em prescindir livre e mutuamente das formalidades exigidas pelo artigo 410.º, nº 3 do Código Civil, abdicando assim do reconhecimento presencial das respetivas assinaturas, renunciando expressamente a invocar a nulidade deste contrato pela omissão de tais requisitos para todos os efeitos legais, tendo sido informados pela Mediadora Imobiliária das consequências inerentes.",
    ],
  },
  {
    titulo: "Prévia Análise",
    pontos: [
      "1 - As cláusulas que integram o presente Contrato Promessa de Compra e Venda de imóveis resultaram de um modelo prévio e atempadamente apresentado e discutido entre as partes, a quem foi dada a possibilidade de alterar, adaptar ou de qualquer forma influenciar a sua redação final.",
    ],
  },
  {
    titulo: "Intervenção Imobiliária",
    pontos: [
      "1 – O presente negócio teve intervenção imobiliária levada a cabo pela Agência House Culture, Lda.",
      "2 - As partes declaram expressamente que foram informadas da obrigação de utilização de meio de pagamento específico por se tratar de transação de montante igual ou superior a 3.000,00€ (Três Mil Euros), para residentes em Portugal ou 10.000,00€ (Dez Mil Euros), para não residentes, conforme estipulado na Lei nº 92/2017 de 22/08/2017.",
    ],
  },
];

// Diferenças entre o PDF assinado e o gerado que foram expressamente aprovadas (ou são dados do
// processo escritos noutro formato). Aplicadas ao texto do PDF antes da comparação - tudo o resto
// tem de ser idêntico.
const ADAPTACOES_APROVADAS: [string, string][] = [
  // Dados dinâmicos do processo com formato próprio da app
  ["sita na Praceta", "sito em Praceta"],
  // Contratos finais da solicitadora (31/10/2026): "sito"/"descrito" concordam com o prédio, e "da freguesia de"
  ["nº160, freguesia de Braga Maximinos", "nº160, da freguesia de Braga Maximinos"],
  ["descrita na Conservatória", "descrito na Conservatória"],
  ["de 2025-11-21", "de 21-11-2025"],
  ["2.000€", "2.000,00€"],
  [
    "PT50 0007 0000 0080 2304 3642 3, do Novo Banco",
    `${process.env.CPCV_AGENCIA_IBAN || "____________"}, do ${process.env.CPCV_AGENCIA_BANCO || "____________"}`,
  ],
  // Fiel depositária com avaliação: redação da solicitadora no contrato final de 21/10/2026 (até ao
  // resultado da avaliação, envio do valor ao vendedor e dedução da comissão)
  [
    "até resposta do financiamento/ avaliação que os segundos outorgantes estão a recorrer junto de uma instituição bancária.",
    "até ao resultado da avaliação relativa ao financiamento que os segundos outorgantes estão a recorrer junto de uma instituição bancária, sendo posteriormente enviado, em caso de avaliação positiva, o valor entregue, ao primeiro outorgante, depois de deduzido o valor da comissão devida.",
  ],
  // (Notificações por email convencionado só entram quando as partes têm email - o contrato de
  // referência não tem, por isso fica igual ao original.)
  // Feedback da solicitadora: pedir o distrate/protocolo APB, não "o cancelamento" da hipoteca
  [
    "e cancelamento da referida hipoteca e o custo a esta associado",
    "e distrate/protocolo APB para o cancelamento da referida hipoteca e o custo a esta associado",
  ],
  // Gralha do original ("compra de venda") e mês em minúscula
  ["compra de venda", "compra e venda"],
  ["15 de Outubro de 2026", "15 de outubro de 2026"],
  // Cláusula Terceira: maiúsculas e espaçamento inconsistentes do original, e concordância
  // ("notificá-lo" com um só vendedor - o original escreve "notificá-los" com um vendedor)
  ["segundos Outorgantes, o primeiro Outorgante", "segundos outorgantes, o primeiro outorgante"],
  ["15(quinze)", "15 (quinze)"],
  ["os segundos outorgantes deverão notificá-los", "os segundos outorgantes deverão notificá-lo"],
  // Avaliação: o valor mínimo passa a ser indicado pelo consultor (pedido, secção 7, ponto 2)
  ["no valor mínimo do negócio", "no valor mínimo de 222.000,00€ (Duzentos e Vinte e Dois Mil Euros)"],
  // Bens móveis: correcção aprovada
  ["estado de conversação", "estado de conservação"],
  // Direitos de preferência: adaptação aprovada
  ["obrigando-se a promitente vendedora", "obrigando-se a parte promitente vendedora"],
  // Intervenção imobiliária: licença AMI sempre presente (decisão do Miguel)
  ["pela Agência House Culture, Lda.", "pela Agência House Culture, Lda, titular da licença AMI 21596."],
];

function esperadoAdaptado(texto: string): string {
  return ADAPTACOES_APROVADAS.reduce((t, [de, para]) => t.split(de).join(para), texto);
}

console.log("=== Parte 1: contrato de referência, ponto a ponto ===\n");

const contratoRef = montarContrato(h, processoBase, [vendedorRef, compradoraRef, compradorRef], [hipotecaRef]);

verificar("16 cláusulas, pela ordem do modelo", contratoRef.clausulas.length === 16 && contratoRef.clausulas[15].ordinal === "Décima Sexta");

REFERENCIA.forEach((ref, i) => {
  const gerada = contratoRef.clausulas[i];
  if (!gerada) {
    verificar(`Cláusula ${i + 1} (${ref.titulo}) existe`, false);
    return;
  }
  verificar(`Cláusula ${i + 1}: título "${ref.titulo}"`, gerada.titulo === ref.titulo, `gerado: ${gerada.titulo}`);
  verificar(`Cláusula ${i + 1}: ${ref.pontos.length} pontos`, gerada.pontos.length === ref.pontos.length, `gerado: ${gerada.pontos.length}`);
  ref.pontos.forEach((pontoRef, j) => {
    const esperado = normalizar(esperadoAdaptado(pontoRef));
    const obtido = normalizar(gerada.pontos[j] ?? "");
    verificar(`Cláusula ${i + 1}, ponto ${j + 1}`, esperado === obtido, `esperado: ${esperado}\n        obtido:   ${obtido}`);
  });
});

verificar(
  "Introdução de boa-fé",
  normalizar(contratoRef.introBoaFe) ===
    normalizar(
      "É celebrado de boa-fé o presente Contrato Promessa de Compra e Venda, que ambas as partes aceitam e reciprocamente se obrigam a cumprir, o qual se rege pelo conteúdo das cláusulas seguintes e no que for omisso pela legislação aplicável:"
    )
);
verificar(
  "Texto final (três exemplares, nove páginas)",
  normalizar(`${contratoRef.textoFinal.antes}NOVE${contratoRef.textoFinal.depois}`) ===
    normalizar(
      "O PRESENTE CONTRATO É FEITO EM TRÊS EXEMPLARES, COMPOSTO POR NOVE PÁGINAS, NUMERADAS E RUBRICADAS, TODOS COM O VALOR DE ORIGINAL, OS QUAIS VÃO SER ASSINADOS E RUBRICADOS PELOS OUTORGANTES, DEPOIS DE LIDO E EXPLICADO O SEU CONTEÚDO E O MESMO TER SIDO ACEITE POR TODOS NOS SEUS TERMOS E CONDIÇÕES, EM CONFORMIDADE COM AS ASSINATURAS CONSTANTES DOS RESPETIVOS DOCUMENTOS DE IDENTIFICAÇÃO, FICANDO UM EXEMPLAR EM PODER DE CADA UMA DAS PARTES."
    )
);
verificar("Local e data: Braga, 08 de setembro de 2026", contratoRef.localData === "Braga, 08 de setembro de 2026", contratoRef.localData);
verificar(
  "Assinaturas: O PRIMEIRO OUTORGANTE (1 linha) / OS SEGUNDOS OUTORGANTES (2 linhas)",
  contratoRef.assinaturas.tituloVendedores === "O PRIMEIRO OUTORGANTE:" &&
    contratoRef.assinaturas.linhasVendedores === 1 &&
    contratoRef.assinaturas.tituloCompradores === "OS SEGUNDOS OUTORGANTES:" &&
    contratoRef.assinaturas.linhasCompradores === 2
);
verificar(
  "Identificação: nomes em maiúsculas, '1 - '/'2 - ' nos compradores",
  semMarcas(contratoRef.outorgantes.identificacoesVendedores[0]).startsWith("PEDRO MANUEL GONÇALVES ROQUE, NIF 275 146 499, solteiro, maior, titular do cartão de cidadão n.º 15664140 2ZV5, válido até 28-03-2036, emitido pela República Portuguesa") &&
    semMarcas(contratoRef.outorgantes.identificacoesCompradores[0]).startsWith("1 - ANA CATARINA PINTO MELO") &&
    semMarcas(contratoRef.outorgantes.identificacoesCompradores[1]).startsWith("2 - RENATO COELHO DIAS"),
  semMarcas(contratoRef.outorgantes.identificacoesCompradores[0])
);

// ---------------------------------------------------------------------------------------------
// Parte 2 - cenários A-H do pedido
// ---------------------------------------------------------------------------------------------

console.log("\n=== Parte 2: cenários A-H ===\n");

function clausula(c: Contrato, titulo: string) {
  return c.clausulas.find((x) => x.titulo === titulo);
}
function textoTodo(c: Contrato): string {
  return c.clausulas.map((x) => x.pontos.join(" ")).join(" ");
}
const partes1x1 = [vendedorRef, compradoraRef];

// A - completo: hipoteca, financiamento, avaliação, bens móveis, condomínio
const A = contratoRef;
verificar("A: Objeto com 5 pontos (hipoteca incluída)", clausula(A, "Objeto")!.pontos.length === 5);
verificar("A: Preço com 5 pontos (um só de fiel depositária)", clausula(A, "Preço e Condições de Pagamento")!.pontos.length === 5 && textoTodo(A).includes("fiel depositária"));
verificar("A: Avaliação Bancária é a Quarta com 5 pontos", clausula(A, "Avaliação Bancária")!.ordinal === "Quarta" && clausula(A, "Avaliação Bancária")!.pontos.length === 5);
verificar("A: Bens Móveis é a Quinta", clausula(A, "Bens Móveis")!.ordinal === "Quinta");
verificar("A: Encargos menciona a hipoteca", clausula(A, "Encargos e Despesas")!.pontos[0].includes("cancelamento da referida hipoteca"));
verificar("A: Condomínio é a Décima Segunda", clausula(A, "Condomínio")!.ordinal === "Décima Segunda");
verificar("A: comissão nunca aparece no texto", !/1\.?000|comiss[ãa]o imobili[áa]ria devida.*\d/.test(textoTodo(A).replace(/podendo deduzir a comissão imobiliária devida, de acordo com a modalidade acordada/, "")));

// B - sem hipoteca, sem financiamento, sem avaliação, sem bens móveis, sem condomínio
const B = montarContrato(
  h,
  { ...processoBase, metodo_pagamento: "capital_proprio", condicionado_avaliacao: false, tem_bens_moveis: false, imovel_condominio: false, destino_sinal: "vendedor", iban_sinal: "PT50 1", conta_sinal_banco: "Banco X", conta_sinal_titular: "Pedro Manuel Gonçalves Roque" },
  partes1x1,
  []
);
verificar("B: 13 cláusulas", B.clausulas.length === 13, B.clausulas.map((c) => c.titulo).join(" | "));
verificar("B: Objeto com 4 pontos (sem hipoteca)", clausula(B, "Objeto")!.pontos.length === 4 && !textoTodo(B).includes("hipoteca voluntária"));
verificar("B: sem Avaliação Bancária, Bens Móveis e Condomínio", !clausula(B, "Avaliação Bancária") && !clausula(B, "Bens Móveis") && !clausula(B, "Condomínio"));
verificar("B: renumeração - Encargos é a Quarta, Intervenção é a Décima Terceira", clausula(B, "Encargos e Despesas")!.ordinal === "Quarta" && clausula(B, "Intervenção Imobiliária")!.ordinal === "Décima Terceira");
verificar("B: Encargos sem hipoteca termina em 'licença de utilização e certificado energético'", clausula(B, "Encargos e Despesas")!.pontos[0].includes("licença de utilização e certificado energético."));

// C - financiamento sem condição de avaliação
const C = montarContrato(h, { ...processoBase, metodo_pagamento: "misto", condicionado_avaliacao: false }, partes1x1, [hipotecaRef]);
verificar("C: Avaliação Bancária só com o ponto 1", clausula(C, "Avaliação Bancária")!.pontos.length === 1 && clausula(C, "Avaliação Bancária")!.pontos[0].includes("pretende recorrer a financiamento bancário"));
verificar("C: fiel depositária 'até resposta da aprovação do financiamento' (compradora: feminino)", textoTodo(C).includes("até resposta da aprovação do financiamento que a segunda outorgante está a recorrer"));

// D - sinal directamente ao vendedor
const D = montarContrato(h, { ...processoBase, destino_sinal: "vendedor", iban_sinal: "PT50 1234", conta_sinal_banco: "Caixa Geral de Depósitos", conta_sinal_titular: "Pedro Manuel Gonçalves Roque" }, partes1x1, [hipotecaRef]);
const precoD = clausula(D, "Preço e Condições de Pagamento")!;
verificar("D: Preço com 4 pontos, sem fiel depositária", precoD.pontos.length === 4 && !textoTodo(D).includes("fiel depositária"));
verificar("D: ponto 3 passa a ser o do artigo 432º e o 4 o do cheque bancário", precoD.pontos[2].startsWith("3 – Os outorgantes convencionam") && precoD.pontos[3].startsWith("4 – A restante parte"));
verificar("D: IBAN/banco/titular do vendedor ('da Caixa')", precoD.pontos[1].includes("IBAN PT50 1234, da Caixa Geral de Depósitos, à ordem de Pedro Manuel Gonçalves Roque"));

// E - sinal recebido pela agência (sem financiamento nem avaliação -> retenção até às assinaturas, Lei 15/2013)
const E = montarContrato(h, { ...processoBase, metodo_pagamento: "capital_proprio", condicionado_avaliacao: false }, partes1x1, [hipotecaRef]);
verificar(
  "E: fiel depositária até estarem todas as assinaturas (redação do contrato final de 17/10/2026)",
  clausula(E, "Preço e Condições de Pagamento")!.pontos[2].includes(
    "A segunda outorgante nomeia a Agência House Culture, Lda, para ficar como fiel depositária, nos termos do artigo 18.º da Lei n.º 15/2013, de 8 de fevereiro, do valor acima mencionado, até que estejam reunidas todas as assinaturas do presente contrato de promessa, sendo posteriormente enviado, por transferência bancária, para a conta do primeiro outorgante, depois de deduzido o valor da comissão devida."
  )
);
verificar("E (A): com avaliação -> 'até ao resultado da avaliação relativa ao financiamento'", clausula(A, "Preço e Condições de Pagamento")!.pontos[2].includes("até ao resultado da avaliação relativa ao financiamento"));

// F - 2 vendedores, 3 compradores
const F = montarContrato(
  h,
  processoBase,
  [vendedorRef, { ...vendedorRef, nome: "Maria Roque" }, compradoraRef, compradorRef, { ...compradorRef, nome: "Carla Dias" }],
  [hipotecaRef]
);
verificar("F: cabeçalhos no plural", F.outorgantes.cabecalhoVendedores === "PRIMEIROS OUTORGANTES – PROMITENTES VENDEDORES:" && F.outorgantes.cabecalhoCompradores === "SEGUNDOS OUTORGANTES – PROMITENTES COMPRADORES:");
verificar("F: concordância no plural nas cláusulas", clausula(F, "Objeto")!.pontos[0].startsWith("1 – Os primeiros outorgantes, declaram para os devidos e legais efeitos, que são os únicos donos e legítimos proprietários") && clausula(F, "Preço e Condições de Pagamento")!.pontos[0].includes("os primeiros outorgantes, prometem vender aos segundos outorgantes, que por sua vez prometem comprar àqueles"));
verificar("F: 2 + 3 linhas de assinatura, títulos no plural", F.assinaturas.linhasVendedores === 2 && F.assinaturas.linhasCompradores === 3 && F.assinaturas.tituloVendedores === "OS PRIMEIROS OUTORGANTES:" && F.assinaturas.tituloCompradores === "OS SEGUNDOS OUTORGANTES:");
verificar("F: CINCO EXEMPLARES", F.textoFinal.antes.includes("FEITO EM CINCO EXEMPLARES"));
verificar("F: Terceira - 'notificá-los' (vendedores) e 'notificá-los' (compradores)", clausula(F, "Escritura Pública ou DPA")!.pontos[1].includes("deverão notificá-los") && clausula(F, "Escritura Pública ou DPA")!.pontos[2].includes("têm a faculdade de reverter para si a obrigação de notificá-los"));

// Não-fracção (moradia): termos "imóvel" e ponto 1 em formato de prédio urbano
const M = montarContrato(h, { ...processoBase, imovel_e_fracao_autonoma: false, imovel_condominio: false }, partes1x1, [hipotecaRef]);
verificar("Moradia: ponto 1 'do prédio urbano sito em' e descrito na Conservatória", clausula(M, "Objeto")!.pontos[0].includes("proprietário do prédio urbano sito em Praceta Padre Sena de Freitas, nº160, da freguesia de Braga Maximinos, concelho de Braga, descrito na Conservatória do Registo Predial de Braga"));
verificar("Moradia: 'Sobre o referido imóvel incide', 'o imóvel identificado na cláusula anterior'", clausula(M, "Objeto")!.pontos[1].startsWith("2 – Sobre o referido imóvel incide") && clausula(M, "Preço e Condições de Pagamento")!.pontos[0].includes("o imóvel identificado na cláusula anterior"));

// H - datas e valores
verificar("H: euroPorExtenso 222000", euroPorExtenso(222000) === "Duzentos e Vinte e Dois Mil Euros", euroPorExtenso(222000));
verificar("H: euroPorExtenso 2000", euroPorExtenso(2000) === "Dois Mil Euros", euroPorExtenso(2000));
verificar("H: euroPorExtenso 1000000", euroPorExtenso(1_000_000) === "Um Milhão de Euros", euroPorExtenso(1_000_000));
verificar("H: euroPorExtenso 187500", euroPorExtenso(187500) === "Cento e Oitenta e Sete Mil e Quinhentos Euros", euroPorExtenso(187500));
verificar("H: data longa 2026-10-15", formatarDataLonga("2026-10-15") === "15 de outubro de 2026");
verificar("H: data curta 2027-02-10", formatarDataCurta("2027-02-10") === "10-02-2027");
verificar("H: local de assinatura é o concelho do imóvel", montarContrato(h, { ...processoBase, imovel_concelho: "GUIMARÃES" }, partes1x1, []).localData.startsWith("Guimarães, "));

// ---------------------------------------------------------------------------------------------
// Parte 3 - o que a solicitadora corrigiu nos contratos finais (31/10/2026), com dados fictícios
// (os contratos reais ficam fora do repositório). Cada cenário reproduz a estrutura de um deles.
// ---------------------------------------------------------------------------------------------

console.log("\n=== Parte 3: contratos finais da solicitadora ===\n");

const tudo = (c: Contrato) =>
  semMarcas(
    [
      c.outorgantes.cabecalhoVendedores,
      ...c.outorgantes.identificacoesVendedores,
      c.outorgantes.cabecalhoCompradores,
      ...c.outorgantes.identificacoesCompradores,
      textoTodo(c),
      c.textoFinal.antes + c.textoFinal.depois,
      c.assinaturas.tituloVendedores,
      c.assinaturas.tituloCompradores,
    ].join(" ")
  );
const pessoa = (papel: string, nome: string, extra: Partial<Parte> = {}): Parte => ({
  ...vendedorRef,
  papel,
  nome,
  morada: "Rua do Exemplo, n.º 10, 4700-001, freguesia de Palmeira, concelho de Braga",
  ...extra,
});
const contem = (nome: string, c: Contrato, trechos: string[]) => {
  const t = tudo(c);
  for (const x of trechos) verificar(`${nome}: "${x.slice(0, 90)}"`, t.includes(x), t.length > 0 ? "" : "texto vazio");
};
const naoContem = (nome: string, c: Contrato, trechos: string[]) => {
  const t = tudo(c);
  for (const x of trechos) verificar(`${nome}: sem "${x.slice(0, 90)}"`, !t.includes(x));
};

// G - um vendedor, uma compradora divorciada, fração com hipoteca, reserva + reforço, avaliação.
const G = montarContrato(
  h,
  {
    ...processoBase,
    imovel_freguesia: "UNIÃO DAS FREGUESIAS DE VILA NOVA DE FAMALICÃO E CALENDÁRIO",
    imovel_concelho: "VILA NOVA DE FAMALICÃO",
    imovel_codigo_postal: "4760-337",
    imovel_localidade: "VILA NOVA DE FAMALICÃO",
    imovel_morada: "Rua Exemplo, n.ºs 1 e 3, r/c, 4760-337 VILA NOVA DE FAMALICÃO",
    imovel_descricao_predial: "526/19910122",
    imovel_licenca_utilizacao: "resposta à comunicação prévia para utilização após operação urbanística, emitida pela Câmara Municipal de Vila Nova de Famalicão",
    preco_total: 215000,
    valor_sinal: 25000,
    reserva: true,
    valor_reserva: 2500,
    reserva_ate_data: "2026-09-02",
    iban_sinal: "PT50 0000 0000 0000 0000 0000 0",
    conta_sinal_banco: "Novo Banco",
  },
  [
    pessoa("vendedor", "Paulo Exemplo Lima", { estado_civil: "Solteiro", email: "paulo@exemplo.pt" }),
    pessoa("comprador", "Cláudia Exemplo Saraiva", { estado_civil: "Divorciada", email: "claudia@exemplo.pt", morada: "Rua A, n.º nº 113, 4730-762, freguesia de Vila Verde, concelho de Vila Verde" }),
  ],
  [{ entidade_credora: "CAIXA GERAL DE DEPÓSITOS, S.A.", natureza: "Hipoteca Voluntária", numero_apresentacao: "Ap. 555", data_registo: "2025-11-06" }]
);
contem("G", G, [
  "SEGUNDA OUTORGANTE – PROMITENTE COMPRADORA:",
  "A SEGUNDA OUTORGANTE:",
  "n.º 113, C.P. 4730-762, freguesia de Vila Verde",
  "com o email: claudia@exemplo.pt",
  "sito em Rua Exemplo, n.ºs 1 e 3, r/c, da União das Freguesias de Vila Nova de Famalicão e Calendário, concelho de Vila Nova de Famalicão, descrito na",
  "sob o n.º 526, inscrito",
  "com a resposta à comunicação prévia para utilização após operação urbanística, emitida pela Câmara Municipal de Vila Nova de Famalicão, com o certificado",
  "incide uma hipoteca voluntária registada a favor da Caixa Geral de Depósitos, S.A., através da AP. 555 de 06-11-2025, cujo cancelamento terá de ser assegurado pelo primeiro outorgante",
  "a segunda outorgante reconhece que",
  "No dia 02 de setembro do corrente ano, a segunda outorgante entregou, a título de sinal e princípio de pagamento, a quantia de 2.500,00€ (Dois Mil e Quinhentos Euros), através de transferência bancária, para a conta com o IBAN PT50 0000 0000 0000 0000 0000 0, do Novo Banco, à ordem da Agência House Culture, Lda, de que o primeiro outorgante dará quitação após boa cobrança.",
  "Na presente data, a segunda outorgante terá de entregar, a título de reforço de sinal e sempre por conta do pagamento do preço, a quantia de 22.500,00€ (Vinte e Dois Mil e Quinhentos Euros), através de transferência bancária, para a conta com o IBAN supramencionado, do Novo Banco",
  "até ao resultado da avaliação relativa ao financiamento que a segunda outorgante está a recorrer junto de uma instituição bancária, sendo posteriormente enviado, em caso de avaliação positiva, o valor entregue, ao primeiro outorgante, depois de deduzido o valor da comissão devida.",
  "a designar pela segunda outorgante, devendo esta avisar o primeiro outorgante",
  "por carta registada com aviso de receção ou através dos emails convencionados, com pelo menos 15 (quinze) dias",
  "imputável à segunda outorgante, esta sujeita-se",
  "recebidas da segunda outorgante",
  "através de carta registada com aviso de receção ou através dos emails convencionados, à contraparte",
  "para a morada das partes ou a boa receção do email será prova bastante",
  "aos promitentes compradores, a quantia total",
  "e distrate/protocolo APB para o cancelamento da referida hipoteca e o custo a esta associado",
  "FEITO EM DOIS EXEMPLARES",
]);
naoContem("G", G, ["n.º nº", "4760-337", "/19910122", "licença de utilização n.º resposta", "fiel depositária, nos termos do artigo 18.º", "ao promitente comprador,"]);

// I - dois vendedores divorciados (pagamento a cada um), casal comprador, sem financiamento, 8 dias de aviso.
const I = montarContrato(
  h,
  {
    ...processoBase,
    imovel_e_fracao_autonoma: false,
    imovel_condominio: false,
    imovel_composicao: "Casa de cave e rés-do-chão",
    imovel_situado_em: "Lugar da Exemplar, atual Rua do Forno, n.º 10",
    metodo_pagamento: "capital_proprio",
    condicionado_avaliacao: false,
    tem_bens_moveis: false,
    escritura_aviso_dias: 8,
  },
  [
    pessoa("vendedor", "Regina Exemplo Lopes", { estado_civil: "Divorciada", email: "regina@exemplo.pt" }),
    pessoa("vendedor", "António Exemplo Novais", { estado_civil: "Divorciado", email: "antonio@exemplo.pt" }),
    pessoa("comprador", "Antónia Exemplo Pinto", { estado_civil: "Casada", regime_bens: "comunhão de adquiridos", email: "pinto@exemplo.pt", casal: 1 }),
    pessoa("comprador", "Augusto Exemplo Pinto", { estado_civil: "Casado", regime_bens: "comunhão de adquiridos", documento_numero: "11111111 1ZZ1", casal: 1 }),
  ],
  []
);
contem("I", I, [
  "1 - REGINA EXEMPLO LOPES",
  "2 - ANTÓNIO EXEMPLO NOVAIS",
  "SEGUNDOS OUTORGANTES – PROMITENTES COMPRADORES:",
  "casados sob o regime de comunhão de adquiridos, titulares, respetivamente, dos cartões de cidadão n.º",
  "e do cartão de cidadão n.º 11111111 1ZZ1",
  "do prédio urbano, composto por casa de cave e rés-do-chão, sito em Lugar da Exemplar, atual Rua do Forno, n.º 10, da freguesia de Braga Maximinos",
  "Os segundos outorgantes nomeiam a Agência House Culture, Lda, para ficar como fiel depositária, nos termos do artigo 18.º da Lei n.º 15/2013",
  "na proporção de metade, para a conta de cada um dos primeiros outorgantes, depois de deduzido o valor da comissão devida.",
  "através de dois cheques bancários, um cheque para cada um dos primeiros outorgantes.",
  "com antecedência mínima de 8 (oito) dias",
  "com pelo menos 8 (oito) dias de antecedência",
  "FEITO EM TRÊS EXEMPLARES",
  "OS SEGUNDOS OUTORGANTES:",
]);
naoContem("I", I, ["ambos maiores", "Avaliação", "1) "]);

// J - casal vendedor e casal comprador (no estrangeiro), financiamento sem avaliação, duas hipotecas e
// um ónus, mobília com valor e inventário anexo, outra agência no negócio.
const J = montarContrato(
  h,
  {
    ...processoBase,
    imovel_e_fracao_autonoma: false,
    imovel_condominio: false,
    imovel_morada: "RUA DE S. EXEMPLO, n.º 18",
    imovel_codigo_postal: "4700-019",
    imovel_localidade: "PALMEIRA",
    imovel_freguesia: "PALMEIRA",
    imovel_concelho: "BRAGA",
    imovel_licenca_entidade_emissora: "Câmara Municipal de BRAGA",
    condicionado_avaliacao: false,
    condicionado_financiamento: true,
    avaliacao_prazo_data: "2026-10-30",
    preco_total: 565000,
    valor_mobilia: 25000,
    valor_sinal: 56500,
    incluidos_no_imovel: "com os móveis integrados no inventário anexo ao presente contrato e que dele faz parte integrante",
    agencia_parceira_nome: "Mediadora Exemplo, Lda",
    agencia_parceira_ami: "99999",
  },
  [
    pessoa("vendedor", "Luísa Exemplo Veloso", { estado_civil: "Casada", regime_bens: "comunhão de adquiridos", casal: 1 }),
    pessoa("vendedor", "Hugo Exemplo Mlauzi", { estado_civil: "Casado", regime_bens: "comunhão de adquiridos", email: "hugo@exemplo.pt", casal: 1 }),
    pessoa("comprador", "Sónia Exemplo Amorim", { estado_civil: "Casada", regime_bens: "comunhão de adquiridos", morada: "Rue de Exemple 4, 1530 Cidade, Suíça", casal: 1 }),
    pessoa("comprador", "João Exemplo Silva", { estado_civil: "Casado", regime_bens: "comunhão de adquiridos", morada: "Rue de Exemple 4, 1530 Cidade, Suíça", email: "joao@exemplo.pt", casal: 1 }),
  ],
  [
    { entidade_credora: "Caixa Geral de Depósitos, S.A.", natureza: "voluntária", numero_apresentacao: "AP. 2696", data_registo: "2025-10-02" },
    { entidade_credora: "Caixa Geral de Depósitos, S.A.", natureza: "voluntária", numero_apresentacao: "AP. 2697", data_registo: "2025-10-02" },
    { entidade_credora: "decorrente do mútuo garantido pela hipoteca voluntária objeto da AP. 2696 de 2025/10/02", natureza: "Ónus de Inalienabilidade", numero_apresentacao: "AP. 2698", data_registo: null },
  ]
);
contem("J", J, [
  "PRIMEIROS OUTORGANTES – PROMITENTES VENDEDORES:",
  "residentes em Rue de Exemple 4, 1530 Cidade, Suíça, com o email: joao@exemplo.pt",
  "do prédio urbano sito em Rua de S. Exemplo, n.º 18, da freguesia de Palmeira, concelho de Braga",
  "pela Câmara Municipal de Braga",
  "incidem duas hipotecas voluntárias, ambas registadas a favor da Caixa Geral de Depósitos, S.A., através da AP. 2696 de 02-10-2025 e da AP. 2697 de 02-10-2025, incidindo ainda um ónus de inalienabilidade decorrente do mútuo garantido pela hipoteca voluntária objeto da AP. 2696 de 02-10-2025, através da AP. 2698, cujo cancelamento terá de ser assegurado pelos primeiros outorgantes",
  "pelo preço total de 565.000,00€ (Quinhentos e Sessenta e Cinco Mil Euros), correspondendo a quantia de 540.000,00€ (Quinhentos e Quarenta Mil Euros) ao prédio urbano e a quantia de 25.000,00€ (Vinte e Cinco Mil Euros) ao recheio integrado no prédio urbano, conforme cláusula quinta e anexo do presente contrato de promessa.",
  "até resposta da aprovação do financiamento que os segundos outorgantes estão a recorrer junto de uma instituição bancária, sendo posteriormente enviado, aos primeiros outorgantes, em caso de aprovação do referido financiamento, o valor entregue, depois de deduzido o valor da comissão devida.",
  "O presente contrato, fica expressamente condicionado à aprovação do referido financiamento.",
  "Os segundos outorgantes dispõem até ao dia 30 de outubro de 2026, para comunicar via email, para wego@remax.pt, se o referido financiamento foi aprovado.",
  "Se o financiamento não for aprovado, este contrato considera-se automaticamente resolvido",
  "considera-se que o financiamento foi aprovado",
  "Que o imóvel é vendido com os móveis integrados no inventário anexo",
  "distrate/protocolo APB para o cancelamento das referidas hipotecas e os custos a estas associados.",
  "titular da licença AMI 21596 e pela agência Mediadora Exemplo, Lda, titular da licença AMI 99999.",
  "PÁGINAS E ANEXO, NUMERADAS",
  "FEITO EM DOIS EXEMPLARES",
]);
naoContem("J", J, ["com com", "4700-019 Palmeira", "na proporção de metade", "bem como o cancelamento do referido ónus", "A) "]);
verificar("J: Bens Móveis é a Quinta (a referência 'cláusula quinta' bate certo)", clausula(J, "Bens Móveis")!.ordinal === "Quinta");

// K - duas vendedoras (feminino plural) e dois casais compradores (letras A) e B)).
const K = montarContrato(
  h,
  { ...processoBase, metodo_pagamento: "capital_proprio", condicionado_avaliacao: false, destino_sinal: "vendedor", iban_sinal: "PT50 1", conta_sinal_banco: "Banco X", conta_sinal_titular: "Ana Irmã" },
  [
    pessoa("vendedor", "Ana Irmã Costa", { estado_civil: "Solteira" }),
    pessoa("vendedor", "Inês Irmã Costa", { estado_civil: "Divorciada" }),
    pessoa("comprador", "Rui Um", { estado_civil: "Casado", regime_bens: "separação de bens", casal: 1 }),
    pessoa("comprador", "Rita Um", { estado_civil: "Casada", regime_bens: "separação de bens", casal: 1 }),
    pessoa("comprador", "Tiago Dois", { estado_civil: "Casado", regime_bens: "comunhão de adquiridos", casal: 2 }),
    pessoa("comprador", "Teresa Dois", { estado_civil: "Casada", regime_bens: "comunhão de adquiridos", casal: 2 }),
  ],
  []
);
contem("K", K, [
  "PRIMEIRAS OUTORGANTES – PROMITENTES VENDEDORAS:",
  "AS PRIMEIRAS OUTORGANTES:",
  "As primeiras outorgantes, declaram para os devidos e legais efeitos, que são as únicas donas e legítimas proprietárias",
  "comprar àquelas",
  "sejam contactadas",
  "A) RUI UM",
  "e mulher, RITA UM",
  "B) TIAGO DOIS",
  "através de dois cheques bancários, um cheque para cada uma das primeiras outorgantes.",
  "notificá-las de novo",
  "determinado por estas",
  "estas obrigam-se",
  "FEITO EM QUATRO EXEMPLARES",
]);
naoContem("K", K, ["fiel depositária", "1 - RUI"]);

console.log(`\n${falhas === 0 ? "Tudo coincide com o contrato de referência e com os cenários do pedido." : `${falhas} verificação(ões) falhada(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
