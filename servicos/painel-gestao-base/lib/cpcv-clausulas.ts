import type { Helpers, Parte, Processo } from "./cpcv-types";
import { regimeBensValido } from "./cpcv-types";

// Biblioteca de texto de cláusulas partilhada pelos dois geradores (PDF em cpcv-template.ts,
// Word em cpcv-docx.ts), para o texto legal não ficar duplicado (e a divergir) em dois sítios.
// Cada função recebe um `Helpers` (v/euros/dataPT) fornecido pelo gerador que a chama, porque o
// PDF precisa de escapar HTML e o Word não.

export function identificacaoParte(h: Helpers, p: Parte): string {
  if (p.tipo_pessoa === "coletiva") {
    return `${h.v(p.nome)}, pessoa colectiva com o NIF ${h.v(p.nif)}, com sede em ${h.v(p.morada)}${
      p.certidao_permanente
        ? `, matriculada com o código de certidão permanente ${h.v(p.certidao_permanente)}`
        : ""
    }, aqui representada por ${h.v(p.representante_nome, "representante com poderes para o acto")}${
      p.representante_cargo ? `, na qualidade de ${h.v(p.representante_cargo)}` : ""
    }`;
  }
  return `${h.v(p.nome)}, ${h.v(p.estado_civil, "estado civil não indicado")}${
    regimeBensValido(p.regime_bens) ? `, casado sob o regime de ${h.v(p.regime_bens)}` : ""
  }${p.naturalidade ? `, natural de ${p.naturalidade}` : ""}, de nacionalidade ${h.v(
    p.nacionalidade,
    "não indicada"
  )}, contribuinte fiscal n.º ${h.v(p.nif)}, residente em ${h.v(
    p.morada
  )}, titular do ${h.v(p.documento_tipo, "documento de identificação")} n.º ${h.v(
    p.documento_numero
  )}, válido até ${h.dataPT(p.documento_validade)}`;
}

// Nas 15 minutas lidas, um casal casado do mesmo papel (dois vendedores, ou dois compradores,
// casados um com o outro) não aparece como dois parágrafos separados, mas sim numa única frase
// ("A, NIF..., e mulher/marido, B, NIF..., casados sob o regime de..."), com o regime de bens e
// a morada mencionados uma única vez. Não há na BD um campo explícito que ligue duas partes como
// cônjuges entre si - o sinal usado é os dois terem o mesmo papel e o mesmo regime de bens válido
// (ambos "casados"), o que na prática dos processos reais só acontece quando são o mesmo casal.
function saoCasalEntreSi(a: Parte, b: Parte): boolean {
  return (
    a.tipo_pessoa !== "coletiva" &&
    b.tipo_pessoa !== "coletiva" &&
    regimeBensValido(a.regime_bens) &&
    regimeBensValido(b.regime_bens) &&
    a.regime_bens === b.regime_bens
  );
}

function generoFeminino(estadoCivil: string | null): boolean {
  return !!estadoCivil && /a$/i.test(estadoCivil.trim());
}

function identificacaoCasal(h: Helpers, a: Parte, b: Parte): string {
  const ligacao = generoFeminino(b.estado_civil) ? "e mulher" : "e marido";
  return `${h.v(a.nome)}, contribuinte fiscal n.º ${h.v(a.nif)}, ${ligacao}, ${h.v(
    b.nome
  )}, contribuinte fiscal n.º ${h.v(b.nif)}, casados sob o regime de ${h.v(
    a.regime_bens
  )}, titulares, respectivamente, do ${h.v(a.documento_tipo, "documento de identificação")} n.º ${h.v(
    a.documento_numero
  )}, válido até ${h.dataPT(a.documento_validade)}, e do ${h.v(
    b.documento_tipo,
    "documento de identificação"
  )} n.º ${h.v(b.documento_numero)}, válido até ${h.dataPT(b.documento_validade)}, ambos de nacionalidade ${h.v(
    a.nacionalidade,
    "não indicada"
  )}, residentes em ${h.v(a.morada)}`;
}

// Devolve uma identificação por "unidade": um casal casado entre si conta como uma única
// unidade (uma frase); qualquer outro caso (pessoa só, pessoa colectiva, ou mais do que duas
// partes sem se conseguir determinar pares de cônjuges) devolve uma unidade por parte - fica ao
// cuidado do gerador (PDF/Word) decidir como prefixar/separar as unidades.
export function identificacoesGrupo(h: Helpers, partes: Parte[]): string[] {
  if (partes.length === 2 && saoCasalEntreSi(partes[0], partes[1])) {
    return [identificacaoCasal(h, partes[0], partes[1])];
  }
  return partes.map((p) => identificacaoParte(h, p));
}

export function clausulaCondicoesSuspensivas(h: Helpers, processo: Processo): string {
  if (processo.condicoes_suspensivas) return h.v(processo.condicoes_suspensivas);

  const condicoes: string[] = [];
  if (processo.condicionado_avaliacao) {
    condicoes.push(
      `avaliação do Imóvel em valor igual ou superior a ${
        processo.valor_avaliacao_minimo ? h.euros(processo.valor_avaliacao_minimo as number) : "____________"
      }`
    );
  }
  if (processo.condicionado_financiamento) {
    condicoes.push("obtenção de financiamento bancário pelo(s) SEGUNDO(S) OUTORGANTE(S)");
  }
  if (processo.condicionado_outra_situacao) {
    condicoes.push(processo.condicionado_outra_situacao as string);
  }

  if (condicoes.length === 0) {
    return "Não foram estipuladas condições suspensivas para o presente contrato.";
  }

  const prazo = processo.dias_condicionamento
    ? ` no prazo de ${processo.dias_condicionamento} dias ${
        processo.dias_condicionamento_tipo === "corridos" ? "corridos" : "úteis"
      } a contar da data de assinatura do presente contrato`
    : "";

  const listaCondicoes =
    condicoes.length === 1 ? condicoes[0] : condicoes.map((c, i) => `${i + 1}) ${c}`).join("; ");

  return `O presente contrato fica sujeito às seguintes condições suspensivas: ${listaCondicoes}${prazo}.`;
}

// Cláusula rica de financiamento/avaliação bancária (ver `minutas/_extraido/`, minutas com
// "Cava"+"F" no nome). Só faz sentido quando ambos os condicionamentos estão activos - é o
// mecanismo completo (prazo, contacto, e o que acontece à avaliação/ao sinal), não só a menção
// genérica que a Cláusula de Condições Suspensivas dá. `avaliacao_prazo_data` e
// `avaliacao_contacto_email` ainda não têm coluna na BD nem estão pedidos pela IA (ver
// migration_fase3.sql) - até lá aparecem como "____________" no documento, tal como qualquer
// outro campo em falta.
export function financiamentoAvaliacaoAtivo(processo: Processo): boolean {
  return !!(processo.condicionado_financiamento && processo.condicionado_avaliacao);
}

export function clausulaFinanciamentoAvaliacao(h: Helpers, processo: Processo): string[] {
  return [
    "O(s) SEGUNDO(S) OUTORGANTE(S), para aquisição do Imóvel, pretende(m) recorrer a financiamento bancário.",
    `O presente contrato fica expressamente condicionado a avaliação, igual ou superior, ao montante de ${h.euros(
      (processo.valor_avaliacao_minimo as number | null) ?? null
    )}, montante necessário para que seja aprovado o referido financiamento bancário.`,
    `O(s) SEGUNDO(S) OUTORGANTE(S) dispõe(m) até ao dia ${h.dataPT(
      (processo.avaliacao_prazo_data as string | null) ?? null
    )} para comunicar(em), via email, para ${h.v(
      processo.avaliacao_contacto_email
    )}, se a respectiva avaliação foi suficiente para a obtenção do financiamento.`,
    "Se a avaliação do Imóvel não for suficiente para a aprovação do referido financiamento, este contrato considera-se automaticamente resolvido, sendo o montante entregue a título de sinal devolvido, em singelo, ao(s) SEGUNDO(S) OUTORGANTE(S), no prazo de 5 (cinco) dias.",
    "Se, até ao prazo acima mencionado, o(s) SEGUNDO(S) OUTORGANTE(S) não enviar(em) qualquer email conforme referido nos números anteriores, considera-se que a avaliação foi positiva e o presente contrato mantém-se nos termos das restantes cláusulas.",
  ];
}

// Declaração de Condomínio - só aparece nas minutas quando o imóvel é uma fracção em
// condomínio constituído. Gatilhada por `imovel_condominio` (novo campo, ver
// migration_fase3.sql) - ainda sem forma de o utilizador o definir (nem formulário nem IA), por
// isso esta cláusula está pronta mas dormente até essa parte ser ligada.
export function clausulaDeclaracaoCondominio(): string[] {
  return [
    "O(s) PRIMEIRO(S) OUTORGANTE(S) compromete(m)-se a ter as prestações de condomínio, sejam elas provenientes de quotas ordinárias, extraordinárias ou para obras realizadas ou a realizar nas partes comuns do edifício, integralmente pagas até à data em que for outorgado o contrato definitivo de compra e venda, obrigando-se a entregar ao(s) SEGUNDO(S) OUTORGANTE(S), naquela data, documento comprovativo da não existência de dívidas, emitido pela administração do condomínio, com reconhecimento de assinatura pelo administrador, nos termos e em cumprimento do previsto pelo artigo 1424.º-A do Código Civil, com a redacção dada pela Lei n.º 8/2022, de 10 de Janeiro, em vigor desde 1 de Abril de 2022.",
    "No âmbito do diploma mencionado no número anterior, o(s) PRIMEIRO(S) OUTORGANTE(S) é/são responsável(eis) pela comunicação da venda, por carta registada com aviso de recepção ou email, ao administrador do condomínio, no prazo máximo de 15 (quinze) dias a contar da data da escritura, com informação do nome completo e do número de identificação fiscal do novo proprietário.",
  ];
}

// Cláusulas "boilerplate" abaixo: texto extraído verbatim das 15 minutas reais da agência em
// `servicos/painel-gestao-base/minutas/` (ver plano em análise, ficheiro
// `minutas/_extraido/analise-boilerplate.md`, não commitado - pasta com dados de cliente). Nas
// 15 minutas lidas este texto não varia (ou varia apenas no nome/AMI da agência), por isso está
// aqui fixo em vez de gerado a partir de campos da BD. Cada função devolve um array de
// parágrafos (não uma string só) para cada gerador poder aplicar a sua própria formatação de
// parágrafo (`<p>` no HTML, `corpo()` no Word).

const AGENCIA_NOME = process.env.CPCV_AGENCIA_NOME || "____________";
const AGENCIA_AMI = process.env.CPCV_AGENCIA_AMI || "____________";

export function clausulaProtecaoDados(): string[] {
  return [
    "Os dados pessoais, recolhidos no presente documento, destinam-se ao cumprimento do dever de identificação previsto na Lei n.º 83/2017, de 18 de Agosto, e Lei n.º 58/2019, de 8 de Agosto, e no Regulamento 2016/679, de 27 de Abril de 2016, e serão processados informaticamente e conservados pelo período de 7 (sete) anos.",
    "As partes, enquanto titulares dos dados, têm o direito de aceder a todos os seus dados e o direito de exigir a sua limitação, rectificação, oposição ou apagamento nos limites legalmente impostos.",
    "As partes declaram, para os devidos efeitos, sob compromisso de honra:",
    "a) Que são verdadeiros os elementos indicados; e",
    "b) Que autorizam a reprodução dos documentos de identificação, bem como de qualquer outro documento necessário à concretização do negócio, em suporte físico e/ou electrónico.",
  ];
}

export function clausulaAlteracoes(): string[] {
  return [
    "Eventuais alterações, anulações, aditamentos ou acordos de revogação do presente contrato só serão válidos se forem efectuados por escrito e assinados por todos os outorgantes, sendo nulos, ineficazes e sem qualquer validade jurídica os acordos verbais.",
  ];
}

export function clausulaNotificacoes(): string[] {
  return [
    "Todas as notificações que venham a ser necessárias fazer na vigência do presente contrato serão feitas para as moradas supra indicadas e, em caso de alteração, devem ser comunicadas por escrito, através de carta registada com aviso de recepção, à contraparte, no prazo máximo de 5 (cinco) dias contados da data em que ocorrer a respectiva alteração.",
    "O envio de carta registada com aviso de recepção para a morada das partes será prova bastante para demonstrar que se efectuou qualquer notificação, designadamente a interpelação para a realização da escritura definitiva de compra e venda.",
  ];
}

export function clausulaLeiAplicavelForo(): string[] {
  return [
    "Para a resolução de qualquer litígio eventualmente decorrente do presente contrato, e que as partes não consigam resolver por mútuo acordo, fica desde já convencionado, com exclusão de qualquer outro, que é competente o foro da comarca do Imóvel.",
    "O presente contrato-promessa é exclusivamente regulado pela legislação portuguesa em vigor, nomeadamente pelo Código Civil.",
  ];
}

export function clausulaReconhecimentoAssinaturas(): string[] {
  return [
    "Os outorgantes acordam em prescindir livre e mutuamente das formalidades exigidas pelo artigo 410.º, n.º 3, do Código Civil, abdicando assim do reconhecimento presencial das respectivas assinaturas, renunciando expressamente a invocar a nulidade deste contrato pela omissão de tais requisitos para todos os efeitos legais, tendo sido informados pela Mediadora Imobiliária das consequências inerentes.",
  ];
}

export function clausulaPreviaAnalise(): string[] {
  return [
    "As cláusulas que integram o presente Contrato-Promessa de Compra e Venda resultaram de um modelo prévio e atempadamente apresentado e discutido entre as partes, a quem foi dada a possibilidade de alterar, adaptar ou de qualquer forma influenciar a sua redacção final.",
  ];
}

// Só cobre o padrão de imóvel urbano (13 das 15 minutas lidas). O texto adicional para
// confinantes de prédios rústicos (2 minutas) fica para quando o tipo de imóvel "rústico" for
// suportado como campo próprio (plano, fase de variantes por tipo de imóvel).
export function clausulaDireitoPreferencia(): string[] {
  return [
    "Considerando que diversas entidades públicas são titulares de direito de preferência na aquisição do Imóvel objecto deste contrato, fica acordado pelos outorgantes que, caso o referido direito seja exercido, o presente contrato cessa automaticamente os seus efeitos, obrigando-se o(s) PRIMEIRO(S) OUTORGANTE(S) a devolver, no prazo máximo de 8 (oito) dias contados da data da comunicação ou ofício da entidade respectiva, ao(s) SEGUNDO(S) OUTORGANTE(S), a quantia total entregue a título de sinal, não havendo lugar a qualquer outra indemnização ou compensação.",
    "Sendo o caso disso, compete ao(s) PRIMEIRO(S) OUTORGANTE(S) a instrução do anúncio destinado à comunicação das condições da presente promessa às entidades preferentes através do site www.casapronta.mj.pt.",
  ];
}

export function clausulaIntervencaoImobiliaria(): string[] {
  return [
    `O presente negócio teve intervenção imobiliária levada a cabo pela ${AGENCIA_NOME}, titular da licença AMI n.º ${AGENCIA_AMI}.`,
    "As partes declaram expressamente que foram informadas da obrigação de utilização de meio de pagamento específico por se tratar de transacção de montante igual ou superior a 3.000,00 € (três mil euros), para residentes em Portugal, ou 10.000,00 € (dez mil euros), para não residentes, conforme estipulado na Lei n.º 92/2017, de 22 de Agosto.",
  ];
}

// Ordinais femininos ("Cláusula Primeira", "Cláusula Décima Primeira", ...) - a lista de
// cláusulas de um CPCV varia consoante o processo (comodato, observações, fracções múltiplas,
// etc.), por isso os dois geradores montam uma lista de cláusulas presentes e numeram por
// posição em vez de terem o número escrito directamente em cada título.
export const ORDINAIS = [
  "Primeira",
  "Segunda",
  "Terceira",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sétima",
  "Oitava",
  "Nona",
  "Décima",
  "Décima Primeira",
  "Décima Segunda",
  "Décima Terceira",
  "Décima Quarta",
  "Décima Quinta",
  "Décima Sexta",
  "Décima Sétima",
  "Décima Oitava",
  "Décima Nona",
  "Vigésima",
];

export type ClausulaTexto = { titulo: string; paragrafos: string[] };
