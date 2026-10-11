import type { Helpers, Hipoteca, Parte, Processo } from "./cpcv-types";
import { regimeBensValido } from "./cpcv-types";

// Biblioteca de texto do CPCV, partilhada pelos dois geradores (PDF em cpcv-template.ts, Word em
// cpcv-docx.ts) através de lib/cpcv-contrato.ts. A redacção de todas as cláusulas é a do contrato
// de referência aprovado pelo Miguel («CPCV 126601064-8 Assinado.pdf», 16 cláusulas) - só os
// elementos dinâmicos (nomes, valores, datas, singular/plural) e as condições expressamente
// aprovadas variam. Não modernizar nem parafrasear: `npm run verificar:clausulas` compara estas
// funções contra o texto desse contrato.
//
// Cada função recebe um `Helpers` (v/euros/dataPT/dataLongaPT) fornecido pelo gerador que a
// chama, porque o PDF precisa de escapar HTML e o Word não.

// Identificação da mediadora - fixa para todos os contratos (decisão do Miguel), nunca um campo
// por processo nem variável de ambiente.
export const AGENCIA_NOME = "Agência House Culture, Lda";
export const AGENCIA_AMI = "21596";
// Conta bancária da agência - só usada na Cláusula Segunda quando destino_sinal = "agencia"
// (o sinal fica com a agência como fiel depositária). Fixa por deployment, via .env, por serem
// dados bancários que não devem ficar num repositório público.
const AGENCIA_IBAN = process.env.CPCV_AGENCIA_IBAN || "____________";
const AGENCIA_BANCO = process.env.CPCV_AGENCIA_BANCO || "____________";

// "Cartão de Cidadão" -> "cartão de cidadão" - para encaixar o tipo de documento a meio de
// frase ("titular do cartão de cidadão n.º...") sem maiúsculas no meio do texto corrido.
function documentoEmMinusculas(s: string): string {
  return s.toLowerCase();
}

function maiusculas(s: string | null): string | null {
  return s ? s.toLocaleUpperCase("pt-PT") : s;
}

// "275146499" -> "275 146 499" - só quando o NIF tem os 9 dígitos esperados; um NIF
// incompleto/malformado é devolvido tal como está, nunca cortado ou preenchido às cegas.
export function formatarNif(nif: string | null): string | null {
  if (!nif) return null;
  const limpo = nif.replace(/\D/g, "");
  if (limpo.length !== 9) return nif;
  return `${limpo.slice(0, 3)} ${limpo.slice(3, 6)} ${limpo.slice(6, 9)}`;
}

// ---------------------------------------------------------------------------------------------
// Números por extenso
// ---------------------------------------------------------------------------------------------

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZANOVE = [
  "dez", "onze", "doze", "treze", "catorze", "quinze", "dezasseis", "dezassete", "dezoito", "dezanove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos",
];

// 0-999 -> português. "cem" é um caso especial (não "cento", que só aparece seguido de "e X").
function grupoDeTres(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (centena > 0) partes.push(CENTENAS[centena]);
  if (resto > 0) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZANOVE[resto - 10]);
    else {
      const dezena = Math.floor(resto / 10);
      const unidade = resto % 10;
      partes.push(unidade > 0 ? `${DEZENAS[dezena]} e ${UNIDADES[unidade]}` : DEZENAS[dezena]);
    }
  }
  return partes.join(" e ");
}

// Inteiro (>= 0, cobre até às centenas de milhão - mais do que suficiente para qualquer preço
// real de um imóvel) -> português por extenso em minúsculas, sem a palavra "euros".
export function numeroPorExtenso(n: number): string {
  if (n === 0) return "zero";

  const milhoes = Math.floor(n / 1_000_000);
  const restoAposMilhoes = n % 1_000_000;
  const milhares = Math.floor(restoAposMilhoes / 1000);
  const unidades = restoAposMilhoes % 1000;

  const grupos: string[] = [];
  if (milhoes > 0) grupos.push(`${grupoDeTres(milhoes)} ${milhoes === 1 ? "milhão" : "milhões"}`);
  if (milhares > 0) grupos.push(milhares === 1 ? "mil" : `${grupoDeTres(milhares)} mil`);
  if (unidades > 0) grupos.push(grupoDeTres(unidades));

  if (grupos.length === 1) return grupos[0];

  // "e" só liga o último grupo aos anteriores quando esse último é um valor pequeno (<100) ou
  // uma centena redonda (ex.: "...mil e cem", "...mil e cinco") - grupos maiores intermédios
  // separam-se por vírgula, convenção comum em números por extenso em português.
  const valorUltimoGrupo = unidades > 0 ? unidades : milhares > 0 ? milhares : milhoes;
  const usaEntreUltimos = valorUltimoGrupo < 100 || valorUltimoGrupo % 100 === 0;
  const ultimo = grupos[grupos.length - 1];
  const anteriores = grupos.slice(0, -1).join(", ");
  return usaEntreUltimos ? `${anteriores} e ${ultimo}` : `${anteriores}, ${ultimo}`;
}

// "páginas" é feminino: "duas páginas", "vinte e uma páginas" - só a unidade final muda.
export function numeroPorExtensoFeminino(n: number): string {
  return numeroPorExtenso(n).replace(/\bum$/, "uma").replace(/\bdois$/, "duas");
}

function capitalizarExtenso(texto: string): string {
  return texto
    .split(" ")
    .map((palavra) => (palavra === "e" ? palavra : palavra.charAt(0).toUpperCase() + palavra.slice(1)))
    .join(" ");
}

// "222000" -> "Duzentos e Vinte e Dois Mil Euros" (formato do contrato de referência). Só a parte
// inteira - os cêntimos ficam visíveis em algarismos (ver euros() nos geradores).
export function euroPorExtenso(valor: number): string {
  const inteiro = Math.round(valor);
  const extenso = capitalizarExtenso(numeroPorExtenso(inteiro));
  // "um milhão DE euros" - "de" só entra quando "milhão(ões)" fica directamente colado a
  // "euros"; "mil" nunca leva "de", por isso isto só se aplica a múltiplos exactos de 1.000.000.
  const ligacaoMilhao = inteiro >= 1_000_000 && inteiro % 1_000_000 === 0 ? "de " : "";
  return `${extenso} ${ligacaoMilhao}${inteiro === 1 ? "Euro" : "Euros"}`;
}

// ---------------------------------------------------------------------------------------------
// Concordância singular/plural
// ---------------------------------------------------------------------------------------------

// O contrato de referência escreve "o primeiro outorgante, declara..." / "os segundos outorgantes
// terão de entregar..." com o número resolvido, não a notação "(S)". Este objecto dá a cada
// cláusula as formas certas consoante quantos vendedores e compradores há. O género fica
// masculino, como no modelo (concordância de género está fora do âmbito aprovado).
export type Concordancia = {
  prim: string;
  Prim: string;
  seg: string;
  Seg: string;
  aoPrim: string;
  aoSeg: string;
  doPrim: string;
  doSeg: string;
  peloPrim: string;
  peloSeg: string;
  aquele: string;
  vp: (singular: string, plural: string) => string;
  vs: (singular: string, plural: string) => string;
};

export function concordancia(nVendedores: number, nCompradores: number): Concordancia {
  const pv = nVendedores > 1;
  const ps = nCompradores > 1;
  const vp = (s: string, p: string) => (pv ? p : s);
  const vs = (s: string, p: string) => (ps ? p : s);
  return {
    prim: vp("o primeiro outorgante", "os primeiros outorgantes"),
    Prim: vp("O primeiro outorgante", "Os primeiros outorgantes"),
    seg: vs("o segundo outorgante", "os segundos outorgantes"),
    Seg: vs("O segundo outorgante", "Os segundos outorgantes"),
    aoPrim: vp("ao primeiro outorgante", "aos primeiros outorgantes"),
    aoSeg: vs("ao segundo outorgante", "aos segundos outorgantes"),
    doPrim: vp("do primeiro outorgante", "dos primeiros outorgantes"),
    doSeg: vs("do segundo outorgante", "dos segundos outorgantes"),
    peloPrim: vp("pelo primeiro outorgante", "pelos primeiros outorgantes"),
    peloSeg: vs("pelo segundo outorgante", "pelos segundos outorgantes"),
    aquele: vp("àquele", "àqueles"),
    vp,
    vs,
  };
}

// Termo usado para o imóvel ao longo do contrato: "a fração" quando é fracção autónoma (texto do
// modelo), "o imóvel" para moradias/terrenos/prédios inteiros.
type TermosImovel = {
  fracao: string;
  Fracao: string;
  daFracao: string;
  naMesma: string;
  daMesma: string;
  aMesma: string;
  referida: string;
  daReferida: string;
  vendida: string;
  identificada: string;
};

function termosImovel(ehFracao: boolean): TermosImovel {
  return ehFracao
    ? {
        fracao: "a fração",
        Fracao: "A fração",
        daFracao: "da fração",
        naMesma: "na mesma",
        daMesma: "da mesma",
        aMesma: "a mesma",
        referida: "a referida fração",
        daReferida: "da referida fração",
        vendida: "vendida",
        identificada: "a fração autónoma identificada",
      }
    : {
        fracao: "o imóvel",
        Fracao: "O imóvel",
        daFracao: "do imóvel",
        naMesma: "no mesmo",
        daMesma: "do mesmo",
        aMesma: "o mesmo",
        referida: "o referido imóvel",
        daReferida: "do referido imóvel",
        vendida: "vendido",
        identificada: "o imóvel identificado",
      };
}

// ---------------------------------------------------------------------------------------------
// Identificação dos outorgantes
// ---------------------------------------------------------------------------------------------

export function identificacaoParte(h: Helpers, p: Parte): string {
  if (p.tipo_pessoa === "coletiva") {
    return `${h.v(maiusculas(p.nome))}, pessoa coletiva com o NIF ${h.v(formatarNif(p.nif))}, com sede em ${h.v(p.morada)}${
      p.certidao_permanente
        ? `, matriculada com o código de certidão permanente ${h.v(p.certidao_permanente)}`
        : ""
    }, aqui representada por ${h.v(maiusculas(p.representante_nome ?? null), "representante com poderes para o ato")}${
      p.representante_cargo ? `, na qualidade de ${h.v(p.representante_cargo)}` : ""
    }`;
  }
  // "Emitido pela República Portuguesa" só é afirmado com confiança para o Cartão de Cidadão
  // (sempre emitido pelo Estado português) - para Passaporte/Título de Residência/Outro não
  // há dados para o garantir (pode ser estrangeiro), por isso fica omisso nesses casos.
  const emitidoPt = p.documento_tipo === "Cartão de Cidadão" ? ", emitido pela República Portuguesa" : "";
  return `${h.v(maiusculas(p.nome))}, NIF ${h.v(formatarNif(p.nif))}${p.estado_civil ? `, ${h.v(p.estado_civil)}` : ""}${
    regimeBensValido(p.regime_bens) ? `, sob o regime de ${h.v(p.regime_bens)}` : ""
  }, maior, titular do ${h.v(
    p.documento_tipo ? documentoEmMinusculas(p.documento_tipo) : null,
    "documento de identificação"
  )} n.º ${h.v(p.documento_numero)}, válido até ${h.dataPT(p.documento_validade)}${emitidoPt}, residente em ${h.v(
    p.morada
  )}`;
}

// Um casal casado do mesmo papel (dois vendedores, ou dois compradores, casados um com o outro)
// aparece numa única frase ("A, NIF..., e mulher/marido, B, NIF..., casados sob o regime de..."),
// com o regime de bens e a morada mencionados uma única vez. Não há na BD um campo explícito que
// ligue duas partes como cônjuges - o sinal usado é os dois terem o mesmo papel e o mesmo regime
// de bens válido (ambos "casados"), o que na prática só acontece quando são o mesmo casal.
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
  const emitidoA = a.documento_tipo === "Cartão de Cidadão" ? ", emitido pela República Portuguesa" : "";
  const emitidoB = b.documento_tipo === "Cartão de Cidadão" ? ", emitido pela República Portuguesa" : "";
  return `${h.v(maiusculas(a.nome))}, NIF ${h.v(formatarNif(a.nif))}, ${ligacao}, ${h.v(
    maiusculas(b.nome)
  )}, NIF ${h.v(formatarNif(b.nif))}, casados sob o regime de ${h.v(
    a.regime_bens
  )}, ambos maiores, titulares, respetivamente, do ${h.v(
    a.documento_tipo ? documentoEmMinusculas(a.documento_tipo) : null,
    "documento de identificação"
  )} n.º ${h.v(a.documento_numero)}, válido até ${h.dataPT(a.documento_validade)}${emitidoA}, e do ${h.v(
    b.documento_tipo ? documentoEmMinusculas(b.documento_tipo) : null,
    "documento de identificação"
  )} n.º ${h.v(b.documento_numero)}, válido até ${h.dataPT(b.documento_validade)}${emitidoB}, residentes em ${h.v(
    a.morada
  )}`;
}

// Uma identificação por "unidade": um casal casado entre si conta como uma única unidade (uma
// frase); qualquer outro caso devolve uma unidade por parte.
export function identificacoesGrupo(h: Helpers, partes: Parte[]): string[] {
  if (partes.length === 2 && saoCasalEntreSi(partes[0], partes[1])) {
    return [identificacaoCasal(h, partes[0], partes[1])];
  }
  return partes.map((p) => identificacaoParte(h, p));
}

function letraOrdinal(i: number): string {
  return String.fromCharCode(65 + i);
}

// A) / B) / C)... - só quando há mais do que uma unidade de identificação do mesmo lado.
function comLetras(identificacoes: string[]): string[] {
  if (identificacoes.length <= 1) return identificacoes;
  return identificacoes.map((texto, i) => `${letraOrdinal(i)}) ${texto}`);
}

function cabecalhoOutorgantes(
  ordinalSingular: "PRIMEIRO" | "SEGUNDO",
  designacaoSingular: "VENDEDOR" | "COMPRADOR",
  quantidade: number
): string {
  if (quantidade <= 1) return `${ordinalSingular} OUTORGANTE – PROMITENTE ${designacaoSingular}:`;
  const ordinalPlural = ordinalSingular === "PRIMEIRO" ? "PRIMEIROS" : "SEGUNDOS";
  const designacaoPlural = designacaoSingular === "VENDEDOR" ? "VENDEDORES" : "COMPRADORES";
  return `${ordinalPlural} OUTORGANTES – PROMITENTES ${designacaoPlural}:`;
}

export type BlocoOutorgantes = {
  cabecalhoVendedores: string;
  identificacoesVendedores: string[];
  cabecalhoCompradores: string;
  identificacoesCompradores: string[];
};

export function montarBlocoOutorgantes(h: Helpers, vendedores: Parte[], compradores: Parte[]): BlocoOutorgantes {
  const identificacoesVendedores = identificacoesGrupo(h, vendedores);
  const identificacoesCompradores = identificacoesGrupo(h, compradores);
  return {
    cabecalhoVendedores: cabecalhoOutorgantes("PRIMEIRO", "VENDEDOR", identificacoesVendedores.length),
    identificacoesVendedores: comLetras(identificacoesVendedores),
    cabecalhoCompradores: cabecalhoOutorgantes("SEGUNDO", "COMPRADOR", identificacoesCompradores.length),
    identificacoesCompradores: comLetras(identificacoesCompradores),
  };
}

export const INTRO_BOA_FE =
  "É celebrado de boa-fé o presente Contrato Promessa de Compra e Venda, que ambas as partes aceitam e reciprocamente se obrigam a cumprir, o qual se rege pelo conteúdo das cláusulas seguintes e no que for omisso pela legislação aplicável:";

// ---------------------------------------------------------------------------------------------
// Cláusulas
// ---------------------------------------------------------------------------------------------

// Pergunta A da Cláusula de Avaliação Bancária ("o comprador vai recorrer a financiamento
// bancário?") é respondida pelo campo já existente "método de pagamento" - não há coluna nova.
export function recorreAFinanciamento(processo: Processo): boolean {
  return processo.metodo_pagamento === "financiamento" || processo.metodo_pagamento === "misto";
}

function numerar(pontos: string[]): string[] {
  return pontos.map((texto, i) => `${i + 1} – ${texto}`);
}

// "a favor do Banco Santander Totta, S.A" / "a favor da Caixa Geral de Depósitos" - o artigo
// antes do nome do credor segue o género habitual do nome (quase todos os bancos são masculinos;
// "Caixa", "Abanca", "UCI" e "União" são as excepções correntes).
function aFavorDe(entidade: string): string {
  return /^(caixa|abanca|uci\b|uni[ãa]o)/i.test(entidade.trim()) ? `da ${entidade}` : `do ${entidade}`;
}

// Uma frase por hipoteca, seguida de uma única obrigação de cancelamento a cobrir todas.
function textoHipotecas(h: Helpers, C: Concordancia, T: TermosImovel, hipotecas: Hipoteca[]): string {
  const frases = hipotecas.map((hip) => {
    const natureza = hip.natureza || "hipoteca voluntária";
    const detalhe = hip.numero_apresentacao
      ? `, através da ${h.v(hip.numero_apresentacao)}${hip.data_registo ? ` de ${h.dataPT(hip.data_registo)}` : ""}`
      : hip.data_registo
        ? `, registada em ${h.dataPT(hip.data_registo)}`
        : "";
    return `uma ${h.v(natureza)} registada a favor ${aFavorDe(h.v(hip.entidade_credora))}${detalhe}`;
  });
  const verbo = frases.length === 1 ? "incide" : "incidem";
  return `Sobre ${T.referida} ${verbo} ${frases.join("; ")}, cujo cancelamento terá de ser assegurado ${C.peloPrim} até à data da escritura definitiva de compra e venda.`;
}

// Cláusula Primeira (Objeto) - 5 pontos do modelo. O ponto 1 varia consoante o imóvel é fracção
// autónoma (texto do modelo) ou não (mesma estrutura, para prédio urbano); o ponto 2 (hipoteca)
// só entra quando há hipotecas registadas; os pontos 3-5 são fixos.
export function pontosClausulaPrimeira(
  h: Helpers,
  C: Concordancia,
  processo: Processo,
  hipotecas: Hipoteca[]
): string[] {
  const ehFracao = !!processo.imovel_e_fracao_autonoma;
  const T = termosImovel(ehFracao);

  const moradaCompleta = [
    h.v(processo.imovel_morada),
    [processo.imovel_codigo_postal, processo.imovel_localidade].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const registoELicencas = `descrit${ehFracao ? "a" : "o"} na Conservatória do Registo Predial de ${h.v(
    processo.imovel_conservatoria
  )} sob o n.º ${h.v(processo.imovel_descricao_predial)}, inscrito na matriz sob o artigo ${h.v(
    processo.imovel_artigo_matricial
  )}, com a licença de utilização n.º ${h.v(processo.imovel_licenca_utilizacao)}, emitida em ${h.dataLongaPT(
    processo.imovel_licenca_data_emissao
  )}, pela ${h.v(processo.imovel_licenca_entidade_emissora)}, com o certificado de desempenho energético n.º ${h.v(
    processo.imovel_certificado_energetico
  )}, válido até ${h.dataPT(processo.imovel_certificado_validade)}, com a classe energética ${h.v(
    processo.imovel_certificado_classe
  )}.`;
  const localizacao = `freguesia de ${h.v(processo.imovel_freguesia)}, concelho de ${h.v(processo.imovel_concelho)}`;
  const declara = `${C.Prim}, ${C.vp("declara", "declaram")} para os devidos e legais efeitos, que ${C.vp(
    "é o único dono e legítimo proprietário",
    "são os únicos donos e legítimos proprietários"
  )}`;

  let ponto1: string;
  if (ehFracao) {
    const letra = (processo.imovel_fracao_letra ?? "").trim();
    const designacao = letra.length > 1 ? "pelas letras" : "pela letra";
    const orientacao = processo.imovel_orientacao ? `, virado a ${h.v(processo.imovel_orientacao)}` : "";
    ponto1 = `${declara} da fração autónoma designada ${designacao} “${h.v(letra || null)}”, ${h.v(
      processo.imovel_andar_fracao
    )}${orientacao}, destinado a ${h.v(
      processo.imovel_finalidade
    )}, integrada num prédio urbano em regime de propriedade horizontal, sita em ${moradaCompleta}, ${localizacao}, ${registoELicencas}`;
  } else {
    ponto1 = `${declara} do prédio urbano sito em ${moradaCompleta}, ${localizacao}, ${registoELicencas}`;
  }

  const pontos: string[] = [ponto1];
  if (hipotecas.length > 0) pontos.push(textoHipotecas(h, C, T, hipotecas));

  pontos.push(
    `Por constituir este contrato uma promessa de compra e venda com entrega de sinal, ${C.seg} ${C.vs(
      "reconhece",
      "reconhecem"
    )} que, com a assinatura do mesmo e, até à outorga da escritura de compra e venda, não ${C.vs(
      "lhe",
      "lhes"
    )} é transmitida a propriedade ${T.daFracao} nem ${C.vs("lhe", "lhes")} é conferido o direito de tomar posse ${T.daMesma}.`,
    `Que ${T.fracao} é ${T.vendida} no estado de conservação em que se encontra, conforme visita ao imóvel, no estado esse que ${C.seg} ${C.vs(
      "conhece e aceita",
      "conhecem e aceitam"
    )} não podendo pedir quaisquer obras ou reparações ${T.naMesma}.`,
    `${C.Prim} ${C.vp("autoriza", "autorizam")} ${C.seg} a ${C.vs("visitar", "visitarem")} ${
      T.fracao
    }, no dia anterior ou no próprio dia da outorga da escritura de compra e venda, a fim de ${C.vs(
      "verificar",
      "verificarem"
    )} que ${T.aMesma} se mantém no exato estado em que se encontra, à data de hoje, desde que para isso ${C.vp(
      "seja contactado",
      "sejam contactados"
    )} com pelo menos três dias de antecedência, pelo angariador imobiliário, sendo que se existirem danos terão de ser imediatamente reparados ${
      C.peloPrim
    } colocando ${T.fracao} no mesmo estado aquando da primeira visita.`
  );

  return numerar(pontos);
}

// Cláusula Segunda (Preço e Condições de Pagamento) - 5 pontos do modelo; o ponto 3 (fiel
// depositária) só existe quando o sinal é transferido para a agência, e nunca menciona o valor
// ou a percentagem da comissão (comissao_valor/comissao_modalidade são só para validação interna,
// ver app/api/cpcv/gerar/route.ts).
export function pontosClausulaSegunda(h: Helpers, C: Concordancia, processo: Processo): string[] {
  const T = termosImovel(!!processo.imovel_e_fracao_autonoma);
  const ehAgencia = processo.destino_sinal === "agencia";
  const forma = ((processo.forma_pagamento_sinal as string | null) || "transferência bancária").trim();
  const formaMinuscula = `${forma.charAt(0).toLowerCase()}${forma.slice(1)}`;
  const aOrdemDe = ehAgencia ? `da ${AGENCIA_NOME}` : `de ${h.v(processo.conta_sinal_titular)}`;
  const banco = ehAgencia ? AGENCIA_BANCO : h.v(processo.conta_sinal_banco);
  const iban = ehAgencia ? AGENCIA_IBAN : h.v(processo.iban_sinal);

  const pontos: string[] = [
    `Pelo presente contrato ${C.prim}, ${C.vp("promete", "prometem")} vender ${C.aoSeg}, que por sua vez ${C.vs(
      "promete",
      "prometem"
    )} comprar ${C.aquele}, ${
      T.identificada
    } na cláusula anterior, livre de ónus ou encargos, hipotecas e responsabilidades, sejam de que natureza forem, e livre de qualquer tipo de ocupação, arrendamento, servidão, comodato ou qualquer outro que limite a posse, e devoluto de pessoas e bens, pelo preço total de ${h.euros(
      processo.preco_total
    )}.`,
    `Na presente data, a título de sinal e princípio de pagamento, ${C.seg} ${C.vs(
      "terá",
      "terão"
    )} de entregar a quantia de ${h.euros(
      processo.valor_sinal
    )}, através de ${h.v(formaMinuscula)} para a conta com o IBAN ${iban}, do ${banco}, à ordem ${aOrdemDe}, de que ${
      C.prim
    } ${C.vp("dará", "darão")} quitação após boa cobrança.`,
  ];

  if (ehAgencia) {
    const temFinanciamento = recorreAFinanciamento(processo);
    const temAvaliacao = !!processo.condicionado_avaliacao;
    const condicao =
      temFinanciamento && temAvaliacao
        ? "do financiamento/avaliação"
        : temFinanciamento
          ? "do financiamento"
          : temAvaliacao
            ? "da avaliação"
            : null;
    const ate = condicao
      ? `até resposta ${condicao} que ${C.seg} ${C.vs("está", "estão")} a recorrer junto de uma instituição bancária`
      : "até à assinatura do presente contrato-promessa por todos os outorgantes";
    pontos.push(
      `${C.Prim} ${C.vp("nomeia", "nomeiam")} a ${AGENCIA_NOME} para ficar como fiel depositária, do valor acima mencionado, ${ate}, após o que transferirá o sinal ${
        C.aoPrim
      }, podendo deduzir a comissão imobiliária devida, de acordo com a modalidade acordada.`
    );
  }

  pontos.push(
    "Os outorgantes convencionam, nos termos do disposto no artigo 432º do Código Civil, que se considera automaticamente resolvido, sem necessidade de qualquer interpelação, o presente contrato promessa de compra e venda, se o valor a título de sinal, não estiver disponível no prazo de 3 dias a contar da data da assinatura do presente contrato.",
    "A restante parte do preço, será paga no ato da celebração da escritura de compra e venda, objeto do presente contrato, em cheque bancário."
  );

  return numerar(pontos);
}

// Cláusula Terceira (Escritura Pública ou DPA) - 4 pontos do modelo; só a data é dinâmica.
export function pontosClausulaTerceira(h: Helpers, C: Concordancia, processo: Processo): string[] {
  return numerar([
    `A escritura definitiva de compra e venda, de que o presente contrato é promessa será outorgada até ao dia ${h.dataLongaPT(
      processo.prazo_escritura
    )}, em cartório notarial, escritório de advogados, solicitadores ou casa pronta, a designar ${C.peloSeg}, devendo ${C.vs(
      "este",
      "estes"
    )} avisar ${C.prim}, com a data, hora e local da mesma, com antecedência mínima de 15 (quinze) dias.`,
    `Se a escritura não for realizada no prazo referido na cláusula anterior por facto imputável ${C.aoPrim}, ${C.seg} ${C.vs(
      "deverá",
      "deverão"
    )} notificá-${C.vp("lo", "los")} de novo, em data posterior, por carta registada com aviso de receção com pelo menos 15 (quinze) dias de antecedência.`,
    `Decorrido que esteja o prazo referido no n.º 1 desta cláusula sem se ter realizado a Escritura Pública e Definitiva por facto imputável ${C.aoSeg}, ${C.prim} ${C.vp(
      "tem",
      "têm"
    )} a faculdade de reverter para si a obrigação de notificá-${C.vs(
      "lo",
      "los"
    )}, em data posterior, por carta registada, com aviso de receção com pelo menos 15 (quinze) dias de antecedência, a comparecer no dia, hora e local determinado por ${C.vp(
      "este",
      "estes"
    )}, para a celebração do referido ato.`,
    "Se a escritura definitiva de compra e venda, não se realizar após as notificações acima mencionadas, acordam as partes que se aplica a cláusula do incumprimento do presente contrato promessa de compra e venda.",
  ]);
}

// Cláusula Quarta (Avaliação Bancária) - condicional:
// - sem financiamento e sem condição de avaliação: omitida (devolve []);
// - com financiamento mas sem condição de avaliação: só o ponto 1;
// - com condição de avaliação: os 5 pontos.
export function pontosClausulaQuarta(h: Helpers, C: Concordancia, processo: Processo): string[] {
  const T = termosImovel(!!processo.imovel_e_fracao_autonoma);
  const financiamento = recorreAFinanciamento(processo);
  const avaliacao = !!processo.condicionado_avaliacao;
  if (!financiamento && !avaliacao) return [];

  const ponto1 = `${C.Seg}, para aquisição ${T.daReferida}, ${C.vs("pretende", "pretendem")} recorrer a financiamento bancário.`;
  if (!avaliacao) return numerar([ponto1]);

  return numerar([
    ponto1,
    `O presente contrato, fica expressamente condicionado à avaliação no valor mínimo de ${h.euros(
      processo.valor_avaliacao_minimo
    )}, montante necessário para que seja aprovado o referido financiamento bancário.`,
    `${C.Seg} ${C.vs("dispõe", "dispõem")} até ao dia ${h.dataLongaPT(
      processo.avaliacao_prazo_data
    )}, para comunicar via email, para ${h.v(
      processo.avaliacao_contacto_email
    )}, se o resultado da avaliação foi suficiente para a obtenção do financiamento.`,
    `Se a avaliação do imóvel não for suficiente para a aprovação do referido financiamento, este contrato considera-se automaticamente resolvido, sendo o montante entregue a título de sinal devolvido, em singelo, ${C.aoSeg}, no prazo de 5 dias.`,
    `Se até ao prazo acima mencionado, ${C.seg} não ${C.vs(
      "enviar",
      "enviarem"
    )} nenhum email conforme referido nos pontos anteriores, considera-se que o crédito e avaliação foram positivas e o presente contrato de compra e venda mantêm-se conforme as restantes cláusulas.`,
  ]);
}

// Cláusula Quinta (Bens Móveis) - só quando tem_bens_moveis = true; a lista vem de
// incluidos_no_imovel. Texto do modelo com a correcção aprovada ("conservação").
export function pontosClausulaQuinta(h: Helpers, C: Concordancia, processo: Processo): string[] {
  if (!processo.tem_bens_moveis) return [];
  const lista = h.v(processo.incluidos_no_imovel).replace(/[.\s]+$/, "");
  return numerar([
    `Que o imóvel é vendido com ${lista}, no estado de conservação em que se encontram e que já foi visitado e aceite ${C.peloSeg}.`,
  ]);
}

// Cláusula Sexta (Encargos e Despesas) - a referência ao cancelamento da hipoteca só entra
// quando existe hipoteca (mesma lista que decide o ponto 2 da Cláusula Primeira).
export function pontosClausulaSexta(C: Concordancia, hipotecas: Hipoteca[]): string[] {
  const hipoteca =
    hipotecas.length === 0
      ? "licença de utilização e certificado energético"
      : hipotecas.length === 1
        ? "licença de utilização, certificado energético, e cancelamento da referida hipoteca e o custo a esta associado"
        : "licença de utilização, certificado energético, e cancelamento das referidas hipotecas e os custos a estas associados";
  return numerar([
    `Compete ${C.aoPrim} a organização e entrega ${C.aoSeg} de toda a documentação necessária à celebração da escritura de compra e venda, registo predial, caderneta predial, ${hipoteca}.`,
    `São por conta ${C.doSeg} todos os encargos notariais, registais e fiscais inerentes à qualidade de ${C.vs(
      "adquirente",
      "adquirentes"
    )}.`,
  ]);
}

// Cláusula Sétima (Incumprimento do Contrato) - fixa.
export function pontosClausulaSetima(C: Concordancia): string[] {
  return numerar([
    `Em caso de incumprimento definitivo do presente contrato, por causa comprovadamente imputável ${C.aoSeg}, ${C.vs(
      "este sujeita-se",
      "estes sujeitam-se"
    )} às penalidades estabelecidas por lei, designadamente à perda, a favor ${
      C.doPrim
    }, de todas as quantias entregues por conta do preço do contrato, dito sinal, nos termos do artigo 442.º do Código Civil.`,
    `Em caso de incumprimento definitivo do presente contrato, por causa comprovadamente imputável ${C.aoPrim}, ${C.vp(
      "este obriga-se",
      "estes obrigam-se"
    )} à devolução, em dobro, de todas as quantias entretanto recebidas ${C.doSeg}, nos termos do artigo 442.º do Código Civil.`,
    "Em qualquer dos casos previstos anteriormente, a parte não faltosa poderá, em alternativa, requerer a execução específica do presente contrato, nos termos do artigo 830.º do Código Civil. O incumprimento do contrato obriga ainda a parte faltosa ao pagamento de todos os prejuízos efetivamente causados à parte não faltosa, bem como de todas as despesas judiciais e extrajudiciais que o incumprimento determinar.",
  ]);
}

// Cláusula Oitava (Alterações) - fixa.
export function pontosClausulaOitava(): string[] {
  return numerar([
    "Eventuais alterações, anulações, aditamentos ou acordos de revogação do presente contrato só serão válidos se forem efetuados por escrito e assinados por todos os outorgantes, sendo nulos e ineficazes e sem qualquer validade jurídica acordos verbais.",
  ]);
}

// Cláusula Nona (Notificações) - fixa; as moradas são as da identificação inicial, nunca emails.
export function pontosClausulaNona(): string[] {
  return numerar([
    "Todas as notificações que venham a ser necessárias fazer na vigência do presente contrato, serão feitas para as moradas supra indicadas e em caso de alteração, devem ser comunicadas por escrito, através de carta registada com aviso de receção, à contraparte, no prazo máximo de 5 dias contados da data em que ocorrer a respetiva alteração.",
    "O envio de carta registada com aviso de receção para a morada das partes será prova bastante para demonstrar que se efetuou qualquer notificação, ou seja se realizou a interpelação daquela para a realização da escritura definitiva de compra e venda, sendo este o caso.",
  ]);
}

// Cláusula Décima (Proteção de Dados) - fixa, com alíneas.
export function pontosClausulaDecima(): string[] {
  return [
    ...numerar([
      "Os dados pessoais, recolhidos no presente documento destinam-se ao cumprimento do dever de identificação previsto na Lei nº83/2017, de 18 de agosto e Lei nº58/2019 de 08 de agosto e no Regulamento 276/2019, de 26 de Março e serão processados informaticamente e conservados pelo período de 7 anos.",
      "As partes, enquanto titulares dos dados, têm o direito de aceder a todos os seus dados e o direito de exigir a sua limitação, retificação, oposição ou apagamento nos limites legalmente impostos.",
      "As partes declaram para os devidos efeitos, sob o compromisso de honra:",
    ]),
    "a. Que são verdadeiros os elementos indicados, e",
    "b. Que autorizam a reprodução dos documentos de identificação bem como qualquer outro documento necessário à concretização do negócio, em suporte físico e/ou eletrónico.",
  ];
}

// Cláusula Décima Primeira (Direitos de Preferência) - única adaptação aprovada: "a parte
// promitente vendedora" em vez de "a promitente vendedora".
export function pontosClausulaDecimaPrimeira(C: Concordancia): string[] {
  return numerar([
    `Considerando que diversas entidades públicas são titulares de direito de preferência na aquisição do imóvel objeto deste contrato, fica acordado pelos outorgantes que, caso o referido direito seja exercido, o presente contrato cessa automaticamente os seus efeitos, obrigando-se a parte promitente vendedora a devolver, no prazo máximo de 8 (oito) dias, contados da data da comunicação ou ofício da entidade respetiva, ${C.vs(
      "ao promitente comprador",
      "aos promitentes compradores"
    )}, a quantia total entregue a título de sinal, não havendo lugar a qualquer outra indemnização ou compensação.`,
    "Sendo o caso disso, compete ao promitente vendedor a instrução do anúncio destinado à comunicação das condições da presente promessa às entidades preferentes através do site www.casapronta.mj.pt.",
  ]);
}

// Cláusula Décima Segunda (Condomínio) - só quando imovel_condominio = true (resposta explícita,
// nunca inferida de o imóvel ser fracção autónoma).
export function pontosClausulaDecimaSegunda(): string[] {
  return numerar([
    "A Parte Promitente Vendedora compromete-se a ter as prestações do condomínio, sejam elas provenientes de quotas ordinárias, extraordinárias ou para obras realizadas ou a realizar nas partes comuns do edifício, integralmente pagas até à data em que for outorgado o contrato definitivo de compra e venda, obrigando-se a entregar à Parte Promitente Compradora, naquela data, documento comprovativo da não existência de dívidas, emitido pela administração do condomínio, com reconhecimento de assinatura pelo administrador, nos termos e em cumprimento do previsto pelo artigo 1424.º-A do Código Civil, com a redação dada pela Lei n.º 8/2022 de 10 de janeiro, em vigor desde 01/04/2022.",
    "Ainda, no âmbito do Decreto-Lei mencionado no ponto anterior, a Parte Vendedora é responsável pela comunicação da venda, por carta registada com aviso de receção ou email, ao administrador do condomínio, no prazo máximo de 15 dias a contar da data de escritura, com informação do nome completo, e o número de identificação fiscal do novo proprietário.",
  ]);
}

// Cláusula Décima Terceira (Lei Aplicável e Foro Competente) - fixa.
export function pontosClausulaDecimaTerceira(): string[] {
  return numerar([
    "Para a resolução de qualquer litígio eventualmente decorrente do presente contrato, e que as partes não consigam resolver por mútuo acordo, fica desde já convencionado, com a exclusão de qualquer outro, que é competente o foro da comarca do imóvel.",
    "O presente contrato promessa é exclusivamente regulado pela legislação portuguesa em vigor, nomeadamente pelo Código Civil.",
  ]);
}

// Cláusula Décima Quarta (Reconhecimento de Assinaturas) - fixa. Redacção ainda a validar pela
// solicitadora quanto aos efeitos da dispensa do reconhecimento presencial.
export function pontosClausulaDecimaQuarta(): string[] {
  return numerar([
    "Os outorgantes acordam em prescindir livre e mutuamente das formalidades exigidas pelo artigo 410.º, nº 3 do Código Civil, abdicando assim do reconhecimento presencial das respetivas assinaturas, renunciando expressamente a invocar a nulidade deste contrato pela omissão de tais requisitos para todos os efeitos legais, tendo sido informados pela Mediadora Imobiliária das consequências inerentes.",
  ]);
}

// Cláusula Décima Quinta (Prévia Análise) - fixa.
export function pontosClausulaDecimaQuinta(): string[] {
  return numerar([
    "As cláusulas que integram o presente Contrato Promessa de Compra e Venda de imóveis resultaram de um modelo prévio e atempadamente apresentado e discutido entre as partes, a quem foi dada a possibilidade de alterar, adaptar ou de qualquer forma influenciar a sua redação final.",
  ]);
}

// Cláusula Décima Sexta (Intervenção Imobiliária) - fixa, com a mediadora e a licença AMI.
export function pontosClausulaDecimaSexta(): string[] {
  return numerar([
    `O presente negócio teve intervenção imobiliária levada a cabo pela ${AGENCIA_NOME}, titular da licença AMI ${AGENCIA_AMI}.`,
    "As partes declaram expressamente que foram informadas da obrigação de utilização de meio de pagamento específico por se tratar de transação de montante igual ou superior a 3.000,00€ (Três Mil Euros), para residentes em Portugal ou 10.000,00€ (Dez Mil Euros), para não residentes, conforme estipulado na Lei nº 92/2017 de 22/08/2017.",
  ]);
}

// Texto final do contrato - em MAIÚSCULAS e negrito nos dois formatos. Dividido em duas partes à
// volta do número de páginas, porque no Word esse número é um campo NUMPAGES (recalculado pelo
// próprio Word) e no PDF é o número real contado depois de gerar (ver lib/cpcv-pdf.ts).
export type TextoFinal = { antes: string; depois: string };

export function textoFinal(exemplares: number): TextoFinal {
  return {
    antes: `O PRESENTE CONTRATO É FEITO EM ${numeroPorExtenso(exemplares).toLocaleUpperCase("pt-PT")} EXEMPLARES, COMPOSTO POR `,
    depois:
      " PÁGINAS, NUMERADAS E RUBRICADAS, TODOS COM O VALOR DE ORIGINAL, OS QUAIS VÃO SER ASSINADOS E RUBRICADOS PELOS OUTORGANTES, DEPOIS DE LIDO E EXPLICADO O SEU CONTEÚDO E O MESMO TER SIDO ACEITE POR TODOS NOS SEUS TERMOS E CONDIÇÕES, EM CONFORMIDADE COM AS ASSINATURAS CONSTANTES DOS RESPETIVOS DOCUMENTOS DE IDENTIFICAÇÃO, FICANDO UM EXEMPLAR EM PODER DE CADA UMA DAS PARTES.",
  };
}

export function paginasPorExtenso(paginas: number | null): string {
  if (!paginas) return "____________";
  return numeroPorExtensoFeminino(paginas).toLocaleUpperCase("pt-PT");
}

// Ordinais femininos ("Cláusula Primeira", "Cláusula Décima Primeira", ...) - a lista de
// cláusulas varia consoante o processo (avaliação, bens móveis, condomínio), por isso o contrato é
// numerado por posição depois de aplicadas todas as condições, em lib/cpcv-contrato.ts.
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
