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

// Negrito: o texto legal é construído como string simples e partilhado pelo PDF e pelo Word, por
// isso o negrito vai marcado com dois caracteres privados (U+E000/U+E001) à volta do texto. O
// PDF troca-os por <b>, o Word divide o parágrafo em runs (ver cpcv-template.ts e cpcv-docx.ts).
export const NEG_ABRE = "";
export const NEG_FECHA = "";
export function neg(texto: string): string {
  return `${NEG_ABRE}${texto}${NEG_FECHA}`;
}
export function semMarcas(texto: string): string {
  return texto.split(NEG_ABRE).join("").split(NEG_FECHA).join("");
}

// "GUIMARÃES" -> "Guimarães", "VILA NOVA DE FAMALICÃO" -> "Vila Nova de Famalicão". Mexe nas
// palavras copiadas TODAS em maiúsculas de cadernetas e certidões, também a meio de texto já bem
// escrito ("Câmara Municipal de VILA VERDE", "CAIXA GERAL DE DEPÓSITOS, S.A."). Ficam como estão:
// siglas (CGD, BPI), abreviaturas com ponto (S.A., AP.), numerais romanos e grupos só de palavras de
// 1-2 letras (R/C, RC). "N.º"/"Nº" passa a "n.º".
const PALAVRAS_MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o"]);
const SIGLAS = new Set([
  "BPI", "BCP", "CGD", "BBVA", "BIC", "UCI", "CTT", "EDP", "IHRU", "CRL", "CCAM", "IMI", "IMT", "AMI", "NIF",
  "NIPC", "IBAN", "EN", "ER", "IP", "IC", "RC", "CP", "UE", "EUA", "USA", "UK",
]);
const SO_MAIUSCULAS = /^[A-ZÀ-ÖØ-Þ]+\.?$/;
const NUMERAL_ROMANO = /^(X{0,3})(IX|IV|V?I{0,3})$/;

export function capitalizarLocal(texto: string | null | undefined): string | null {
  if (!texto) return texto ?? null;
  const t = texto.trim();
  if (!/[A-Za-zÀ-ÿ]/.test(t)) return t;
  // Posições pares: palavras (letras, com pontos para "S.A." ficar inteiro); ímpares: o que as separa.
  const pecas = t.split(/([^A-Za-zÀ-ÖØ-öø-ÿ.]+)/);
  const ehPalavraMaiuscula = (p: string) => SO_MAIUSCULAS.test(p) && (!p.endsWith(".") || p.length >= 5);
  // Inicial abreviada ("S." de São, "D." de Dom) - fica como está, mas não parte o nome ("RUA DE S. JOSÉ").
  const ehInicial = (p: string) => /^[A-ZÀ-ÖØ-Þ]\.$/.test(p);
  // Grupos de palavras em maiúsculas seguidas, separadas só por espaços.
  const grupos: number[][] = [];
  let atual: number[] = [];
  const fechar = () => {
    if (atual.length) grupos.push(atual);
    atual = [];
  };
  pecas.forEach((p, i) => {
    if (i % 2 === 1) {
      if (!/^\s+$/.test(p)) fechar();
    } else if (p) {
      if (ehPalavraMaiuscula(p) || ehInicial(p)) atual.push(i);
      else fechar();
    }
  });
  fechar();
  const primeiraPalavra = pecas.findIndex((p, i) => i % 2 === 0 && p !== "");
  const letras = (p: string) => p.replace(/\.$/, "");
  const intocavel = (p: string) => ehInicial(p) || SIGLAS.has(letras(p)) || (letras(p).length > 1 && NUMERAL_ROMANO.test(letras(p)));
  for (const g of grupos) {
    if (!g.some((i) => letras(pecas[i]).length >= 3 && !intocavel(pecas[i]))) continue;
    g.forEach((i, k) => {
      if (intocavel(pecas[i])) return;
      const baixa = pecas[i].toLocaleLowerCase("pt-PT");
      // "de"/"e"/"a" só ligam palavras: no fim do grupo são uma letra de lote ou bloco ("LOTE A").
      const ligacao = i !== primeiraPalavra && k < g.length - 1 && PALAVRAS_MINUSCULAS.has(baixa);
      pecas[i] = ligacao ? baixa : baixa.charAt(0).toLocaleUpperCase("pt-PT") + baixa.slice(1);
    });
  }
  return pecas
    .join("")
    .replace(/\bN\.?\s?º\s?S\b/g, "n.ºs")
    .replace(/\bN\.?\s?º/g, "n.º");
}

// "n.º nº 18" (o número da porta já trazia "nº" e o formulário acrescentou "n.º") -> "n.º 18".
function semNumeroRepetido(texto: string): string {
  return texto.replace(/\bn\.?\s?[º°]\s*n\.?\s?[º°]\s*/gi, "n.º ");
}

// Morada de uma parte tal como sai no contrato: maiúsculas copiadas passam a nome próprio e o código
// postal leva "C.P." à frente, como em todos os contratos finais da solicitadora ("C.P. 4700-001").
export function moradaParaContrato(morada: string | null | undefined): string | null {
  const m = capitalizarLocal(morada);
  if (!m) return m;
  return semNumeroRepetido(m).replace(/(C\.?\s?P\.?:?\s*)?\b(\d{4}-\d{3})\b/g, (todo, cp, numero) => (cp ? todo : `C.P. ${numero}`));
}

// Divorciado/viúvo não levam "maior" (a solicitadora disse-o na reunião: só faz sentido no solteiro,
// como no contrato de referência assinado); o estado civil escreve-se sempre em minúsculas no meio da frase.
function estadoCivilTexto(estado: string | null): string | null {
  return estado ? estado.trim().toLocaleLowerCase("pt-PT") : null;
}
function levaMaior(estado: string | null): boolean {
  return !(estado && /^(divorciad|vi[úu]v)/i.test(estado.trim()));
}

function listaEmails(partes: Parte[]): string[] {
  return partes.map((p) => (p.email ?? "").trim()).filter(Boolean);
}
function juntarE(itens: string[]): string {
  return itens.length <= 1 ? (itens[0] ?? "") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

// Género de uma pessoa para a concordância ("a segunda outorgante", "A SEGUNDA OUTORGANTE:"), como a
// solicitadora faz nos contratos finais. Vem do estado civil escolhido no formulário (Solteira, Casada,
// Divorciada, Viúva); sem estado civil com género (ex.: união de facto), do primeiro nome. Sociedades e
// casos sem pista ficam no masculino.
const NOMES_FEMININOS_SEM_A = new Set([
  "ines", "beatriz", "isabel", "raquel", "leonor", "lurdes", "carmen", "ruth", "ester", "alice", "irene", "merces",
  "rosario", "conceicao", "assuncao", "luz", "ceu", "denise", "nicole", "simone", "liliane", "aline", "jacqueline",
]);
const NOMES_MASCULINOS_COM_A = new Set(["luca", "nicola", "andrea", "joshua", "mustafa"]);

export function parteFeminina(p: Parte): boolean {
  if (p.tipo_pessoa === "coletiva") return false;
  const estado = (p.estado_civil ?? "").trim().toLocaleLowerCase("pt-PT");
  if (/^(solteir|casad|divorciad|vi[úu]v|separad)/.test(estado)) return /a$/.test(estado);
  const primeiro = (p.nome ?? "").trim().split(/\s+/)[0].toLocaleLowerCase("pt-PT").normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!primeiro) return false;
  if (NOMES_FEMININOS_SEM_A.has(primeiro)) return true;
  return /a$/.test(primeiro) && !NOMES_MASCULINOS_COM_A.has(primeiro);
}

// Um lado do contrato vai no feminino só quando todas as pessoas desse lado são mulheres.
export function ladoFeminino(partes: Parte[]): boolean {
  return partes.length > 0 && partes.every((p) => !!p.nome && parteFeminina(p));
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
// cláusula as formas certas consoante quantos vendedores e compradores há e, como nos contratos
// finais da solicitadora, o género ("a segunda outorgante", "devendo esta avisar", "notificá-la").
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
  // este/esta/estes/estas e lo/la/los/las ("notificá-lo") de cada lado.
  estePrim: string;
  esteSeg: string;
  loPrim: string;
  loSeg: string;
  nPrim: number;
  // Pessoas ou casais do lado vendedor (um casal conta uma vez) e se são todos pessoas sozinhas:
  // decide se o sinal e o resto do preço se dividem por cada vendedor ("na proporção de metade").
  unidadesPrim: number;
  vendedoresSozinhos: boolean;
  femPrim: boolean;
  femSeg: boolean;
  vp: (singular: string, plural: string) => string;
  vs: (singular: string, plural: string) => string;
  // Masculino/feminino de cada lado.
  gp: (masculino: string, feminino: string) => string;
  gs: (masculino: string, feminino: string) => string;
};

export type OpcoesConcordancia = {
  femVendedores?: boolean;
  femCompradores?: boolean;
  unidadesVendedores?: number;
  vendedoresSozinhos?: boolean;
};

export function concordancia(nVendedores: number, nCompradores: number, opcoes: OpcoesConcordancia = {}): Concordancia {
  const pv = nVendedores > 1;
  const ps = nCompradores > 1;
  const fv = !!opcoes.femVendedores;
  const fs = !!opcoes.femCompradores;
  const vp = (s: string, p: string) => (pv ? p : s);
  const vs = (s: string, p: string) => (ps ? p : s);
  const gp = (m: string, f: string) => (fv ? f : m);
  const gs = (m: string, f: string) => (fs ? f : m);
  // Formas por ordem: masculino singular, feminino singular, masculino plural, feminino plural.
  const fp = (ms: string, fsg: string, mp: string, fpl: string) => vp(gp(ms, fsg), gp(mp, fpl));
  const fc = (ms: string, fsg: string, mp: string, fpl: string) => vs(gs(ms, fsg), gs(mp, fpl));
  return {
    prim: fp("o primeiro outorgante", "a primeira outorgante", "os primeiros outorgantes", "as primeiras outorgantes"),
    Prim: fp("O primeiro outorgante", "A primeira outorgante", "Os primeiros outorgantes", "As primeiras outorgantes"),
    seg: fc("o segundo outorgante", "a segunda outorgante", "os segundos outorgantes", "as segundas outorgantes"),
    Seg: fc("O segundo outorgante", "A segunda outorgante", "Os segundos outorgantes", "As segundas outorgantes"),
    aoPrim: fp("ao primeiro outorgante", "à primeira outorgante", "aos primeiros outorgantes", "às primeiras outorgantes"),
    aoSeg: fc("ao segundo outorgante", "à segunda outorgante", "aos segundos outorgantes", "às segundas outorgantes"),
    doPrim: fp("do primeiro outorgante", "da primeira outorgante", "dos primeiros outorgantes", "das primeiras outorgantes"),
    doSeg: fc("do segundo outorgante", "da segunda outorgante", "dos segundos outorgantes", "das segundas outorgantes"),
    peloPrim: fp("pelo primeiro outorgante", "pela primeira outorgante", "pelos primeiros outorgantes", "pelas primeiras outorgantes"),
    peloSeg: fc("pelo segundo outorgante", "pela segunda outorgante", "pelos segundos outorgantes", "pelas segundas outorgantes"),
    aquele: fp("àquele", "àquela", "àqueles", "àquelas"),
    estePrim: fp("este", "esta", "estes", "estas"),
    esteSeg: fc("este", "esta", "estes", "estas"),
    loPrim: fp("lo", "la", "los", "las"),
    loSeg: fc("lo", "la", "los", "las"),
    nPrim: nVendedores,
    unidadesPrim: opcoes.unidadesVendedores ?? nVendedores,
    vendedoresSozinhos: opcoes.vendedoresSozinhos ?? true,
    femPrim: fv,
    femSeg: fs,
    vp,
    vs,
    gp,
    gs,
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

// ", com o email: X" / ", com os emails: X e Y, respetivamente" - só quando há email registado
// (com dois pontos, como nos contratos finais da solicitadora).
function sufixoEmail(h: Helpers, partes: Parte[], respetivamente = false): string {
  const emails = listaEmails(partes);
  if (emails.length === 0) return "";
  if (emails.length === 1) return `, com o email: ${h.v(emails[0])}`;
  return `, com os emails: ${juntarE(emails.map((e) => h.v(e)))}${respetivamente ? ", respetivamente" : ""}`;
}

export function identificacaoParte(h: Helpers, p: Parte): string {
  if (p.tipo_pessoa === "coletiva") {
    return `${neg(h.v(maiusculas(p.nome)))}, pessoa coletiva com o NIF ${h.v(formatarNif(p.nif))}, com sede em ${h.v(
      moradaParaContrato(p.morada)
    )}${
      p.certidao_permanente
        ? `, matriculada com o código de certidão permanente ${h.v(p.certidao_permanente)}`
        : ""
    }${sufixoEmail(h, [p])}, aqui representada por ${h.v(
      maiusculas(p.representante_nome ?? null),
      "representante com poderes para o ato"
    )}${p.representante_cargo ? `, na qualidade de ${h.v(p.representante_cargo)}` : ""}`;
  }
  // "Emitido pela República Portuguesa" só é afirmado com confiança para o Cartão de Cidadão
  // (sempre emitido pelo Estado português) - para Passaporte/Título de Residência/Outro não
  // há dados para o garantir (pode ser estrangeiro), por isso fica omisso nesses casos.
  const emitidoPt = p.documento_tipo === "Cartão de Cidadão" ? ", emitido pela República Portuguesa" : "";
  return `${neg(h.v(maiusculas(p.nome)))}, NIF ${h.v(formatarNif(p.nif))}${
    p.estado_civil ? `, ${h.v(estadoCivilTexto(p.estado_civil))}` : ""
  }${regimeBensValido(p.regime_bens) ? `, sob o regime de ${h.v(p.regime_bens)}` : ""}${
    levaMaior(p.estado_civil) ? ", maior" : ""
  }, titular do ${h.v(
    p.documento_tipo ? documentoEmMinusculas(p.documento_tipo) : null,
    "documento de identificação"
  )} n.º ${h.v(p.documento_numero)}, válido até ${h.dataPT(p.documento_validade)}${emitidoPt}, residente em ${h.v(
    moradaParaContrato(p.morada)
  )}${sufixoEmail(h, [p])}`;
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

// "cartão de cidadão" -> "cartões de cidadão" ("titulares, respetivamente, dos cartões de cidadão n.º
// X ..., e do cartão de cidadão n.º Y ...", como no contrato final da solicitadora).
function documentoNoPlural(tipo: string): string {
  const [primeira, ...resto] = tipo.split(" ");
  const plural = /ão$/.test(primeira) ? primeira.replace(/ão$/, "ões") : /[aeiou]$/.test(primeira) ? `${primeira}s` : primeira;
  return [plural, ...resto].join(" ");
}

function identificacaoCasal(h: Helpers, a: Parte, b: Parte): string {
  const ligacao = parteFeminina(b) ? "e mulher" : "e marido";
  const emitidoA = a.documento_tipo === "Cartão de Cidadão" ? ", emitido pela República Portuguesa" : "";
  const emitidoB = b.documento_tipo === "Cartão de Cidadão" ? ", emitido pela República Portuguesa" : "";
  const tipoA = a.documento_tipo ? documentoEmMinusculas(a.documento_tipo) : null;
  const tipoB = b.documento_tipo ? documentoEmMinusculas(b.documento_tipo) : null;
  // Os dois com o mesmo tipo de documento: "dos cartões de cidadão n.º X ..., e do cartão de cidadão n.º Y".
  const doA = tipoA && tipoA === tipoB ? `dos ${documentoNoPlural(tipoA)}` : `do ${h.v(tipoA, "documento de identificação")}`;
  return `${neg(h.v(maiusculas(a.nome)))}, NIF ${h.v(formatarNif(a.nif))}, ${ligacao}, ${neg(
    h.v(maiusculas(b.nome))
  )}, NIF ${h.v(formatarNif(b.nif))}, casados sob o regime de ${h.v(a.regime_bens)}, titulares, respetivamente, ${doA} n.º ${h.v(
    a.documento_numero
  )}, válido até ${h.dataPT(a.documento_validade)}${emitidoA}, e do ${h.v(tipoB, "documento de identificação")} n.º ${h.v(
    b.documento_numero
  )}, válido até ${h.dataPT(b.documento_validade)}${emitidoB}, residentes em ${h.v(moradaParaContrato(a.morada))}${sufixoEmail(
    h,
    [a, b],
    true
  )}`;
}

// Agrupa as partes de um lado em "unidades": um casal casado entre si conta como uma única unidade
// (uma frase, um exemplar, um pagamento); qualquer outro caso é uma unidade por parte. Com 4 partes
// percorre-se a lista em pares consecutivos (A+B, C+D), cada par que for casal junta-se.
export function agruparUnidades(partes: Parte[]): Parte[][] {
  // Casais ligados à mão no formulário (campo "casal") têm prioridade sobre a deteção automática:
  // cada número com exactamente duas partes singulares vira um casal, na posição do primeiro.
  if (partes.some((p) => p.casal)) {
    const unidades: Parte[][] = [];
    const feitas = new Set<number>();
    partes.forEach((p, i) => {
      if (feitas.has(i)) return;
      const par = p.casal ? partes.findIndex((q, j) => j !== i && !feitas.has(j) && q.casal === p.casal) : -1;
      if (par >= 0 && p.tipo_pessoa !== "coletiva" && partes[par].tipo_pessoa !== "coletiva") {
        feitas.add(i);
        feitas.add(par);
        // O casal usa o regime e a morada da primeira parte; se divergirem, vale o regime de quem aparece primeiro.
        unidades.push([p, partes[par]]);
      } else {
        feitas.add(i);
        unidades.push([p]);
      }
    });
    return unidades;
  }
  const unidades: Parte[][] = [];
  for (let i = 0; i < partes.length; i++) {
    if (i + 1 < partes.length && saoCasalEntreSi(partes[i], partes[i + 1])) {
      unidades.push([partes[i], partes[i + 1]]);
      i++;
    } else {
      unidades.push([partes[i]]);
    }
  }
  return unidades;
}

export function identificacoesGrupo(h: Helpers, partes: Parte[]): string[] {
  return agruparUnidades(partes).map((u) => (u.length === 2 ? identificacaoCasal(h, u[0], u[1]) : identificacaoParte(h, u[0])));
}

// Várias unidades do mesmo lado: casais com letras ("A)", "B)") e pessoas sozinhas com números
// ("1 - ", "2 - ", como no contrato final da solicitadora) - pedido dela na reunião de 25/10/2026.
// Uma única unidade não leva prefixo.
function comPrefixos(identificacoes: string[], unidades: Parte[][]): string[] {
  if (identificacoes.length <= 1) return identificacoes;
  const soCasais = unidades.length === identificacoes.length && unidades.every((u) => u.length === 2);
  return identificacoes.map((texto, i) => `${neg(soCasais ? `${String.fromCharCode(65 + i)})` : `${i + 1} -`)} ${texto}`);
}

// "PRIMEIRO OUTORGANTE – PROMITENTE VENDEDOR:" / "SEGUNDA OUTORGANTE – PROMITENTE COMPRADORA:" /
// "PRIMEIROS OUTORGANTES – PROMITENTES VENDEDORES:". O plural conta pessoas (um casal são dois
// outorgantes), não unidades.
function cabecalhoOutorgantes(lado: "vendedor" | "comprador", pessoas: number, feminino: boolean): string {
  const ordinal = lado === "vendedor" ? (feminino ? "PRIMEIRA" : "PRIMEIRO") : feminino ? "SEGUNDA" : "SEGUNDO";
  const designacao = lado === "vendedor" ? (feminino ? "VENDEDORA" : "VENDEDOR") : feminino ? "COMPRADORA" : "COMPRADOR";
  if (pessoas <= 1) return `${ordinal} OUTORGANTE – PROMITENTE ${designacao}:`;
  return `${ordinal}S OUTORGANTES – PROMITENTES ${designacao}${feminino ? "S" : "ES"}:`;
}

// Títulos das assinaturas: "O PRIMEIRO OUTORGANTE:", "A SEGUNDA OUTORGANTE:", "OS SEGUNDOS OUTORGANTES:".
export function tituloAssinaturas(lado: "vendedor" | "comprador", pessoas: number, feminino: boolean): string {
  const ordinal = lado === "vendedor" ? (feminino ? "PRIMEIRA" : "PRIMEIRO") : feminino ? "SEGUNDA" : "SEGUNDO";
  if (pessoas <= 1) return `${feminino ? "A" : "O"} ${ordinal} OUTORGANTE:`;
  return `${feminino ? "AS" : "OS"} ${ordinal}S OUTORGANTES:`;
}

export type BlocoOutorgantes = {
  cabecalhoVendedores: string;
  identificacoesVendedores: string[];
  cabecalhoCompradores: string;
  identificacoesCompradores: string[];
};

// Processos antigos guardam os emails só no processo (email_proprietario_contrato /
// email_comprador_contrato, texto livre). Se nenhuma parte do lado tem email próprio, esse texto
// entra no fim da última identificação do lado.
function comEmailDoProcesso(h: Helpers, partes: Parte[], unidades: string[], emailProcesso: string | null | undefined): string[] {
  const texto = (emailProcesso ?? "").trim();
  if (!texto || listaEmails(partes).length > 0 || unidades.length === 0) return unidades;
  const lista = texto.split(/[;,\s]+/).filter(Boolean);
  const sufixo = lista.length === 1 ? `, com o email: ${h.v(lista[0])}` : `, com os emails: ${juntarE(lista.map((e) => h.v(e)))}`;
  return [...unidades.slice(0, -1), unidades[unidades.length - 1] + sufixo];
}

export function montarBlocoOutorgantes(
  h: Helpers,
  vendedores: Parte[],
  compradores: Parte[],
  emailsProcesso: { vendedores?: string | null; compradores?: string | null } = {}
): BlocoOutorgantes {
  const unidadesVendedores = agruparUnidades(vendedores);
  const unidadesCompradores = agruparUnidades(compradores);
  const identificacoesVendedores = comEmailDoProcesso(h, vendedores, identificacoesGrupo(h, vendedores), emailsProcesso.vendedores);
  const identificacoesCompradores = comEmailDoProcesso(h, compradores, identificacoesGrupo(h, compradores), emailsProcesso.compradores);
  return {
    cabecalhoVendedores: cabecalhoOutorgantes("vendedor", vendedores.length, ladoFeminino(vendedores)),
    identificacoesVendedores: comPrefixos(identificacoesVendedores, unidadesVendedores),
    cabecalhoCompradores: cabecalhoOutorgantes("comprador", compradores.length, ladoFeminino(compradores)),
    identificacoesCompradores: comPrefixos(identificacoesCompradores, unidadesCompradores),
  };
}

// Fim do parágrafo de identificação de uma parte: ponto final, a não ser que acabe num email (a
// solicitadora não põe ponto a seguir ao email, para não parecer parte do endereço).
export function fimDeIdentificacao(texto: string): string {
  return /@[^\s@]+\.[a-z]{2,}$/i.test(semMarcas(texto)) ? texto : `${texto}.`;
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

// "do Banco Santander Totta, S.A" / "da Caixa Geral de Depósitos" - o artigo antes do nome de um
// banco segue o género habitual do nome (quase todos os bancos são masculinos; "Caixa", "Abanca",
// "UCI" e "União" são as excepções correntes). Usado no credor das hipotecas e no banco do sinal.
function comArtigo(entidade: string): string {
  return /^(caixa|abanca|uci\b|uni[ãa]o)/i.test(entidade.trim()) ? `da ${entidade}` : `do ${entidade}`;
}

// "Ap. 555" / "ap 555" -> "AP. 555" (forma usada pela solicitadora e no contrato de referência).
function apresentacao(ap: string): string {
  return ap.trim().replace(/^ap\b\.?(\s*)/i, (_, espaco: string) => `AP.${espaco ? " " : ""}`);
}

// "hipoteca voluntária" -> "hipotecas voluntárias", "hipoteca legal" -> "hipotecas legais".
function noPlural(descricao: string): string {
  return descricao
    .split(" ")
    .map((p) => (/^(de|da|do)$/.test(p) ? p : /al$/.test(p) ? p.replace(/al$/, "ais") : /il$/.test(p) ? p.replace(/il$/, "is") : /[aeiou]$/.test(p) ? `${p}s` : p))
    .join(" ");
}

type Inscricao = { descricao: string; ehOnus: boolean; credor: string | null; origem: string | null; ap: string | null; data: string | null };

function lerInscricao(hip: Hipoteca): Inscricao {
  const natureza = (hip.natureza || "hipoteca voluntária").trim().toLocaleLowerCase("pt-PT");
  const ehOnus = /^[óo]nus/.test(natureza);
  // "voluntária" / "legal" / "judicial" sozinhos são hipotecas - o texto tem de dizer "hipoteca".
  const descricao = ehOnus || /hipoteca|penhora|arresto/.test(natureza) ? natureza : `hipoteca ${natureza}`;
  // Datas escritas à mão dentro do texto (2025/10/02, 2025-10-02) passam ao formato do contrato.
  const entidade = (capitalizarLocal(hip.entidade_credora) ?? "").replace(/\b(\d{4})[/-](\d{2})[/-](\d{2})\b/g, "$3-$2-$1");
  // Num ónus (ex.: inalienabilidade) o campo "entidade" costuma trazer a origem do ónus ("decorrente
  // do mútuo garantido pela hipoteca ...") e não um banco. Só se escreve "a favor de" quando parece
  // mesmo o nome de uma instituição; qualquer outro texto entra como descrição do ónus.
  const pareceBanco = /\b(banco|caixa|s\.?\s?a\.?|cr[ée]dito|bpi|bcp|santander|montepio|abanca|bankinter|cetelem|unicre|millennium|uci|eurobic|activobank|novo banco)\b/i.test(entidade);
  const origemDescritiva = ehOnus ? !pareceBanco : /^(decorrente|resultante|a favor|garantido|emergente)/i.test(entidade);
  return {
    descricao,
    ehOnus,
    credor: origemDescritiva ? null : entidade,
    origem: origemDescritiva ? entidade.charAt(0).toLocaleLowerCase("pt-PT") + entidade.slice(1) : null,
    ap: hip.numero_apresentacao ? apresentacao(hip.numero_apresentacao) : null,
    data: hip.data_registo,
  };
}

// " através da AP. 2696 de 02-10-2025" (ou " em 02-10-2025" quando só há data).
function registoDe(h: Helpers, i: Inscricao): string {
  if (i.ap) return ` através da ${h.v(i.ap)}${i.data ? ` de ${h.dataPT(i.data)}` : ""}`;
  return i.data ? ` em ${h.dataPT(i.data)}` : "";
}

// Ponto 2 da Cláusula Primeira, como no contrato final da solicitadora: hipotecas do mesmo credor
// juntas ("duas hipotecas voluntárias, ambas registadas a favor da Caixa Geral de Depósitos, S.A.,
// através da AP. 2696 de ... e da AP. 2697 de ..."), ónus a seguir ("incidindo ainda um ónus de
// inalienabilidade decorrente do ..., através da AP. 2698") e uma só obrigação de cancelamento.
function textoHipotecas(h: Helpers, C: Concordancia, T: TermosImovel, hipotecas: Hipoteca[]): string {
  const inscricoes = hipotecas.map(lerInscricao);

  // Hipotecas (e penhoras, arrestos) com credor: agrupadas por natureza + credor, pela ordem em que aparecem.
  const grupos: Inscricao[][] = [];
  const soltas: string[] = [];
  for (const i of inscricoes.filter((x) => !x.ehOnus)) {
    if (!i.credor) {
      soltas.push(`uma ${h.v(i.descricao)} registada${registoDe(h, i)}, ${h.v(i.origem)}`);
      continue;
    }
    const grupo = grupos.find((g) => g[0].descricao === i.descricao && g[0].credor === i.credor);
    if (grupo) grupo.push(i);
    else grupos.push([i]);
  }
  const frasesHipotecas = grupos.map((g) => {
    const masculino = /^arresto/.test(g[0].descricao);
    const aFavor = `a favor ${comArtigo(h.v(g[0].credor))}`;
    if (g.length === 1) return `${masculino ? "um" : "uma"} ${h.v(g[0].descricao)} ${masculino ? "registado" : "registada"} ${aFavor}${registoDe(h, g[0]) ? `,${registoDe(h, g[0])}` : ""}`;
    const quantos = masculino ? numeroPorExtenso(g.length) : numeroPorExtensoFeminino(g.length);
    const todos = g.length === 2 ? (masculino ? "ambos" : "ambas") : masculino ? "todos" : "todas";
    const registos = g.filter((i) => i.ap).map((i) => `da ${h.v(i.ap)}${i.data ? ` de ${h.dataPT(i.data)}` : ""}`);
    const ondeRegistos = registos.length ? `, através ${juntarE(registos)}` : "";
    return `${quantos} ${h.v(noPlural(g[0].descricao))}, ${todos} ${masculino ? "registados" : "registadas"} ${aFavor}${ondeRegistos}`;
  });
  const principais = [...frasesHipotecas, ...soltas];

  const frasesOnus = inscricoes
    .filter((x) => x.ehOnus)
    .map((i) =>
      i.credor
        ? `um ${h.v(i.descricao)} registado a favor ${comArtigo(h.v(i.credor))}${registoDe(h, i) ? `,${registoDe(h, i)}` : ""}`
        : `um ${h.v(i.descricao)}${i.origem ? ` ${h.v(i.origem)}` : ""}${registoDe(h, i) ? `,${registoDe(h, i)}` : ""}`
    );

  const listar = (frases: string[]) => (frases.length > 1 ? `${frases.slice(0, -1).join("; ")}; e ${frases[frases.length - 1]}` : frases[0]);
  const sujeito = principais.length > 0 ? principais : frasesOnus;
  const umaSo = sujeito.length === 1 && (principais.length === 0 || grupos.every((g) => g.length === 1));
  const verbo = umaSo ? "incide" : "incidem";
  const ainda = principais.length > 0 && frasesOnus.length > 0 ? `, incidindo ainda ${listar(frasesOnus)}` : "";
  return `Sobre ${T.referida} ${verbo} ${listar(sujeito)}${ainda}, cujo cancelamento terá de ser assegurado ${C.peloPrim} até à data da escritura definitiva de compra e venda.`;
}

// Morada do imóvel no ponto 1: maiúsculas copiadas passam a nome próprio, "n.º nº" fica "n.º" e sai
// o código postal com a localidade que o segue ("..., r/c, 4760-337 VILA NOVA DE FAMALICÃO").
function moradaDoImovel(texto: string): string {
  return semNumeroRepetido(capitalizarLocal(texto) ?? texto)
    .replace(/,?\s*\b\d{4}-\d{3}\b[^,]*/g, "")
    .replace(/\s+,/g, ",")
    .replace(/[,\s]+$/, "")
    .trim();
}

// "526/19910122" -> "526": a data agarrada ao número da descrição predial não entra no contrato
// (correção da solicitadora); outros sufixos ("538/BragaMaximinos") ficam.
function descricaoSemData(descricao: string | null): string | null {
  return descricao ? descricao.trim().replace(/\/(19|20)\d{6}$/, "") : descricao;
}

// "com a licença de utilização n.º 342/2009, emitida em ..., pela Câmara Municipal de ..." quando o
// campo traz um número. Quando traz texto (imóvel sem licença numerada, ex.: "resposta à comunicação
// prévia para utilização ..., emitida pela Câmara Municipal de ..."), esse texto entra tal como está,
// a seguir a "com a" - como no contrato final da solicitadora de 21/10/2026.
function textoLicenca(h: Helpers, processo: Processo): string {
  const licenca = (processo.imovel_licenca_utilizacao ?? "").trim();
  const numero = licenca.replace(/^n\.?\s?[º°]\s*/i, "");
  const emissao = (feminino: boolean) =>
    `, ${feminino ? "emitida" : "emitido"} em ${h.dataLongaPT(processo.imovel_licenca_data_emissao)}, pela ${h.v(
      capitalizarLocal(processo.imovel_licenca_entidade_emissora)
    )}`;
  if (!licenca || /^[\w./-]*\d[\w./-]*$/.test(numero)) {
    return `com a licença de utilização n.º ${neg(h.v(numero || null))}${emissao(true)}`;
  }
  const texto = licenca.charAt(0).toLocaleLowerCase("pt-PT") + licenca.slice(1);
  const masculino = /^alvar[áa]\b/i.test(texto);
  // Se o texto já diz por quem foi emitida, não se repete a emissão.
  const jaTemEmissao = /\bemitid[oa]\b/i.test(texto) || !processo.imovel_licenca_data_emissao;
  return `com ${masculino ? "o" : "a"} ${h.v(texto)}${jaTemEmissao ? "" : emissao(!masculino)}`;
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

  // Quando a certidão predial traz "situado em ..." e a composição, é isso que se escreve (é a
  // descrição registada do prédio), não a morada comercial do imóvel. Nunca com código postal nem
  // localidade: a localização legal é a freguesia e o concelho (assim em todos os contratos finais
  // da solicitadora e no contrato de referência).
  const situadoEm = (processo.imovel_situado_em ?? "").trim() || (processo.imovel_morada ?? "").trim();
  const composicao = (processo.imovel_composicao ?? "").trim().replace(/[.\s]+$/, "");
  const localDoImovel = h.v(situadoEm ? moradaDoImovel(situadoEm) : null);
  const composicaoTexto = composicao && /^[A-ZÀ-Þ][a-zß-ÿ]/.test(composicao) ? composicao.charAt(0).toLocaleLowerCase("pt-PT") + composicao.slice(1) : composicao;
  const composto = composicao ? `, composto por ${h.v(composicaoTexto)}` : "";

  // Certificado energético: válido (omissão), isento (entra a isenção, com número e data) ou em
  // execução (fica a entregar até à escritura).
  const estadoCert = processo.imovel_certificado_estado || "valido";
  let certificado: string;
  if (estadoCert === "isento") {
    certificado = `, estando o imóvel isento de certificado de desempenho energético, nos termos da isenção n.º ${neg(
      h.v(processo.imovel_certificado_isencao_numero)
    )}, emitida em ${h.dataLongaPT(processo.imovel_certificado_data_emissao ?? null)}`;
  } else if (estadoCert === "em_execucao") {
    certificado = `, encontrando-se o certificado de desempenho energético em execução, a entregar ${C.aoSeg} e a quem realize a escritura até à data da mesma`;
  } else {
    certificado = `, com o certificado de desempenho energético n.º ${neg(
      h.v(processo.imovel_certificado_energetico)
    )}, válido até ${h.dataPT(processo.imovel_certificado_validade)}, com a classe energética ${h.v(
      processo.imovel_certificado_classe
    )}`;
  }
  // O campo pode trazer só a cidade ("Guimarães") ou o nome completo ("2.ª Conservatória do Registo
  // Predial de Braga") - o prefixo só se acrescenta no primeiro caso.
  const nomeConservatoria = capitalizarLocal(processo.imovel_conservatoria);
  const conservatoria = h.v(
    nomeConservatoria && /conservat[óo]ria/i.test(nomeConservatoria)
      ? nomeConservatoria
      : `Conservatória do Registo Predial de ${nomeConservatoria ?? ""}`.replace(/ de $/, " de ____________")
  );
  // "sito"/"descrito"/"inscrito" concordam com o prédio, também numa fração (como no contrato final
  // da solicitadora de 21/10/2026). A descrição predial sai sem a data ("526/19910122" -> "526").
  const registoELicencas = `descrito na ${conservatoria} sob o n.º ${neg(h.v(descricaoSemData(processo.imovel_descricao_predial)))}, inscrito na matriz sob o artigo ${neg(
    h.v(processo.imovel_artigo_matricial)
  )}, ${textoLicenca(h, processo)}${certificado}.`;
  // "da freguesia de Turiz" / "da União das Freguesias de Vila Nova de Famalicão e Calendário".
  const freguesia = (capitalizarLocal(processo.imovel_freguesia) ?? "").replace(/^freguesia\s+d[aeo]s?\s+/i, "").trim();
  const daFreguesia = /^uni[ãa]o das freguesias\b/i.test(freguesia) ? `da ${h.v(freguesia)}` : `da freguesia de ${h.v(freguesia || null)}`;
  const localizacao = `${daFreguesia}, concelho de ${h.v(capitalizarLocal(processo.imovel_concelho))}`;
  const declara = `${C.Prim}, ${C.vp("declara", "declaram")} para os devidos e legais efeitos, que ${C.vp(
    C.gp("é o único dono e legítimo proprietário", "é a única dona e legítima proprietária"),
    C.gp("são os únicos donos e legítimos proprietários", "são as únicas donas e legítimas proprietárias")
  )}`;

  let ponto1: string;
  if (ehFracao) {
    const letra = (processo.imovel_fracao_letra ?? "").trim();
    const designacao = letra.length > 1 ? "pelas letras" : "pela letra";
    const orientacao = processo.imovel_orientacao ? `, virado a ${h.v(processo.imovel_orientacao)}` : "";
    ponto1 = `${declara} da fração autónoma designada ${designacao} “${neg(h.v(letra || null))}”, ${h.v(
      processo.imovel_andar_fracao
    )}${orientacao}, destinado a ${h.v(
      processo.imovel_finalidade
    )}, integrada num prédio urbano em regime de propriedade horizontal, sito em ${localDoImovel}${composto}, ${localizacao}, ${registoELicencas}`;
  } else {
    // Prédio: a composição vem logo a seguir a "prédio urbano" ("do prédio urbano, composto por casa
    // de cave e rés-do-chão, sito em ...").
    ponto1 = composicao
      ? `${declara} do prédio urbano${composto}, sito em ${localDoImovel}, ${localizacao}, ${registoELicencas}`
      : `${declara} do prédio urbano sito em ${localDoImovel}, ${localizacao}, ${registoELicencas}`;
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
      C.gp("seja contactado", "seja contactada"),
      C.gp("sejam contactados", "sejam contactadas")
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
// Marca de referência a outra cláusula ("conforme cláusula quinta"): o número só se sabe depois de
// filtradas as cláusulas, por isso fica uma marca (caracteres privados, como o negrito) que
// lib/cpcv-contrato.ts troca pelo ordinal em minúsculas.
export const REF_ABRE = "";
export const REF_FECHA = "";
export function refClausula(titulo: string): string {
  return `${REF_ABRE}${titulo}${REF_FECHA}`;
}

// "14 de outubro do corrente ano" (mesmo ano do contrato) ou "14 de outubro de 2025".
function diaDoAno(h: Helpers, iso: string, anoContrato: string | null): string {
  const longa = h.dataLongaPT(iso);
  return anoContrato && iso.startsWith(anoContrato) ? longa.replace(/ de \d{4}$/, " do corrente ano") : longa;
}

// O sinal e o resto do preço dividem-se por cada vendedor quando são várias pessoas sozinhas (ex.:
// dois ex-cônjuges divorciados, irmãos herdeiros) - como no contrato final da solicitadora de
// 17/10/2026. Um casal recebe junto.
function pagaACadaVendedor(C: Concordancia): boolean {
  return C.unidadesPrim > 1 && C.vendedoresSozinhos;
}

// Cláusula Segunda (Preço e Condições de Pagamento) - redação dos contratos finais da solicitadora:
// - ponto 1: preço (e, com valor atribuído à mobília, a divisão entre o imóvel e o recheio);
// - sinal: "Na presente data ... terão de entregar ..."; com reserva, dois pontos: a reserva já
//   entregue ("No dia 14 de outubro do corrente ano, ... entregaram, a título de sinal ...") e o
//   reforço de sinal na presente data (sinal menos reserva);
// - fiel depositária (só com o sinal na agência), um único ponto: até ao resultado da avaliação, até à
//   aprovação do financiamento, ou, sem financiamento, até estarem todas as assinaturas (Lei 15/2013);
// - artigo 432.º e restante preço (um cheque por vendedor quando o pagamento se divide).
// Nunca menciona o valor ou a percentagem da comissão (comissao_valor/comissao_modalidade são só para
// validação interna, ver app/api/cpcv/gerar/route.ts).
export function pontosClausulaSegunda(h: Helpers, C: Concordancia, processo: Processo): string[] {
  const ehFracao = !!processo.imovel_e_fracao_autonoma;
  const T = termosImovel(ehFracao);
  const ehAgencia = processo.destino_sinal === "agencia";
  const forma = ((processo.forma_pagamento_sinal as string | null) || "transferência bancária").trim();
  const formaMinuscula = `${forma.charAt(0).toLowerCase()}${forma.slice(1)}`;
  const aOrdemDe = ehAgencia ? `da ${AGENCIA_NOME}` : `de ${h.v(processo.conta_sinal_titular)}`;
  // O que o agente escreveu no formulário tem prioridade nos dois casos; para a agência, se o
  // formulário estiver vazio, cai para a conta fixa do .env (CPCV_AGENCIA_IBAN/BANCO).
  const banco = comArtigo(h.v(processo.conta_sinal_banco, ehAgencia ? AGENCIA_BANCO : undefined));
  const iban = h.v(processo.iban_sinal, ehAgencia ? AGENCIA_IBAN : undefined);
  const dao = `${C.prim} ${C.vp("dará", "darão")} quitação após boa cobrança`;
  const anoContrato = processo.data_assinatura_contrato ? processo.data_assinatura_contrato.slice(0, 4) : null;

  // Valor atribuído à mobília: o preço divide-se entre o imóvel e o recheio (contrato final de 23/10/2026).
  const preco = processo.preco_total;
  const mobilia = processo.valor_mobilia;
  let divisao = "";
  if (typeof preco === "number" && typeof mobilia === "number" && mobilia > 0 && mobilia < preco) {
    const anexo = /\banexo\b/i.test(processo.incluidos_no_imovel ?? "") ? " e anexo" : "";
    const conforme = processo.tem_bens_moveis ? `, conforme cláusula ${refClausula("Bens Móveis")}${anexo} do presente contrato de promessa` : "";
    divisao = `, correspondendo a quantia de ${h.euros(preco - mobilia)} ${ehFracao ? "à fração autónoma" : "ao prédio urbano"} e a quantia de ${h.euros(
      mobilia
    )} ao recheio integrado ${ehFracao ? "na fração autónoma" : "no prédio urbano"}${conforme}`;
  }

  const pontos: string[] = [
    `Pelo presente contrato ${C.prim}, ${C.vp("promete", "prometem")} vender ${C.aoSeg}, que por sua vez ${C.vs(
      "promete",
      "prometem"
    )} comprar ${C.aquele}, ${
      T.identificada
    } na cláusula anterior, livre de ónus ou encargos, hipotecas e responsabilidades, sejam de que natureza forem, e livre de qualquer tipo de ocupação, arrendamento, servidão, comodato ou qualquer outro que limite a posse, e devoluto de pessoas e bens, pelo preço total de ${h.euros(
      processo.preco_total
    )}${divisao}.`,
  ];

  const reserva = processo.reserva === true && typeof processo.valor_reserva === "number" && processo.valor_reserva > 0 ? processo.valor_reserva : null;
  if (reserva === null) {
    pontos.push(
      `Na presente data, a título de sinal e princípio de pagamento, ${C.seg} ${C.vs("terá", "terão")} de entregar a quantia de ${h.euros(
        processo.valor_sinal
      )}, através de ${h.v(formaMinuscula)} para a conta com o IBAN ${iban}, ${banco}, à ordem ${aOrdemDe}, de que ${dao}.`
    );
  } else {
    // A reserva conta para o sinal: o valor do sinal do processo é o total, a reserva já foi entregue
    // e o resto é reforço de sinal na data do contrato. Com o sinal para o vendedor não se sabe para que
    // conta foi a reserva, por isso a conta só é indicada no reforço.
    const quando = processo.reserva_ate_data ? `No dia ${diaDoAno(h, processo.reserva_ate_data, anoContrato)}` : "Em data anterior à presente";
    const contaReserva = ehAgencia ? `, através de ${h.v(formaMinuscula)}, para a conta com o IBAN ${iban}, ${banco}, à ordem ${aOrdemDe}` : "";
    pontos.push(
      `${quando}, ${C.seg} ${C.vs("entregou", "entregaram")}, a título de sinal e princípio de pagamento, a quantia de ${h.euros(reserva)}${contaReserva}, de que ${dao}.`
    );
    const reforco = typeof processo.valor_sinal === "number" ? Math.round((processo.valor_sinal - reserva) * 100) / 100 : null;
    if (reforco === null || reforco > 0) {
      pontos.push(
        `Na presente data, ${C.seg} ${C.vs("terá", "terão")} de entregar, a título de reforço de sinal e sempre por conta do pagamento do preço, a quantia de ${h.euros(
          reforco
        )}, através de ${h.v(formaMinuscula)}, para a conta com o IBAN ${ehAgencia ? "supramencionado" : iban}, ${banco}, à ordem ${aOrdemDe}, de que ${dao}.`
      );
    }
  }

  if (ehAgencia) {
    const aCada = pagaACadaVendedor(C);
    const proporcao = C.unidadesPrim === 2 ? "na proporção de metade" : "em partes iguais";
    const cadaUm = C.gp("cada um dos primeiros outorgantes", "cada uma das primeiras outorgantes");
    const aQuem = aCada ? `${proporcao}, a ${cadaUm}` : C.aoPrim;
    const deduzido = "depois de deduzido o valor da comissão devida";
    if (processo.condicionado_avaliacao) {
      pontos.push(
        `${C.Prim} ${C.vp("nomeia", "nomeiam")} a ${AGENCIA_NOME} para ficar como fiel depositária, do valor acima mencionado, até ao resultado da avaliação relativa ao financiamento que ${C.seg} ${C.vs(
          "está",
          "estão"
        )} a recorrer junto de uma instituição bancária, sendo posteriormente enviado, em caso de avaliação positiva, o valor entregue, ${aQuem}, ${deduzido}.`
      );
    } else if (recorreAFinanciamento(processo)) {
      pontos.push(
        `${C.Prim} ${C.vp("nomeia", "nomeiam")} a ${AGENCIA_NOME} para ficar como fiel depositária, do valor acima mencionado, até resposta da aprovação do financiamento que ${C.seg} ${C.vs(
          "está",
          "estão"
        )} a recorrer junto de uma instituição bancária, sendo posteriormente enviado, ${aQuem}, em caso de aprovação do referido financiamento, o valor entregue, ${deduzido}.`
      );
    } else {
      const paraConta = aCada ? `${proporcao}, para a conta de ${cadaUm}` : `para a conta ${C.doPrim}`;
      pontos.push(
        `${C.Seg} ${C.vs("nomeia", "nomeiam")} a ${AGENCIA_NOME}, para ficar como fiel depositária, nos termos do artigo 18.º da Lei n.º 15/2013, de 8 de fevereiro, do valor acima mencionado, até que estejam reunidas todas as assinaturas do presente contrato de promessa, sendo posteriormente enviado, por transferência bancária, ${paraConta}, ${deduzido}.`
      );
    }
  }

  const cheques = pagaACadaVendedor(C)
    ? `através de ${numeroPorExtenso(C.unidadesPrim)} cheques bancários, um cheque para ${C.gp("cada um dos primeiros outorgantes", "cada uma das primeiras outorgantes")}`
    : "em cheque bancário";
  pontos.push(
    "Os outorgantes convencionam, nos termos do disposto no artigo 432º do Código Civil, que se considera automaticamente resolvido, sem necessidade de qualquer interpelação, o presente contrato promessa de compra e venda, se o valor a título de sinal, não estiver disponível no prazo de 3 dias a contar da data da assinatura do presente contrato.",
    `A restante parte do preço, será paga no ato da celebração da escritura de compra e venda, objeto do presente contrato, ${cheques}.`
  );

  return numerar(pontos);
}

// Cláusula Terceira (Escritura Pública ou DPA) - 4 pontos do modelo; só a data é dinâmica.
export type EmailsPartes = { vendedores: string[]; compradores: string[] };

// " ou através dos emails convencionados," - só quando a parte notificada tem email na identificação
// dos outorgantes (são esses os emails "convencionados"); sem email fica a redação do modelo.
function viaEmails(emails: string[]): string {
  return emails.length > 0 ? " ou através dos emails convencionados," : "";
}

// Dias de antecedência para avisar da escritura: 15 no modelo, mas negociável (8 no contrato final
// de 17/10/2026) - campo escritura_aviso_dias do processo.
function diasDeAviso(processo: Processo): string {
  const dias = typeof processo.escritura_aviso_dias === "number" && processo.escritura_aviso_dias > 0 ? Math.round(processo.escritura_aviso_dias) : 15;
  return `${dias} (${numeroPorExtenso(dias)})`;
}

export function pontosClausulaTerceira(
  h: Helpers,
  C: Concordancia,
  processo: Processo,
  emails: EmailsPartes = { vendedores: [], compradores: [] }
): string[] {
  const dias = diasDeAviso(processo);
  return numerar([
    `A escritura definitiva de compra e venda, de que o presente contrato é promessa será outorgada até ao dia ${neg(
      h.dataLongaPT(processo.prazo_escritura)
    )}, em cartório notarial, escritório de advogados, solicitadores ou casa pronta, a designar ${C.peloSeg}, devendo ${
      C.esteSeg
    } avisar ${C.prim}, com a data, hora e local da mesma, com antecedência mínima de ${dias} dias.`,
    `Se a escritura não for realizada no prazo referido na cláusula anterior por facto imputável ${C.aoPrim}, ${C.seg} ${C.vs(
      "deverá",
      "deverão"
    )} notificá-${C.loPrim} de novo, em data posterior, por carta registada com aviso de receção${viaEmails(
      emails.vendedores
    )} com pelo menos ${dias} dias de antecedência.`,
    `Decorrido que esteja o prazo referido no n.º 1 desta cláusula sem se ter realizado a Escritura Pública e Definitiva por facto imputável ${C.aoSeg}, ${C.prim} ${C.vp(
      "tem",
      "têm"
    )} a faculdade de reverter para si a obrigação de notificá-${C.loSeg}, em data posterior, por carta registada, com aviso de receção${viaEmails(
      emails.compradores
    )} com pelo menos ${dias} dias de antecedência, a comparecer no dia, hora e local determinado por ${C.estePrim}, para a celebração do referido ato.`,
    "Se a escritura definitiva de compra e venda, não se realizar após as notificações acima mencionadas, acordam as partes que se aplica a cláusula do incumprimento do presente contrato promessa de compra e venda.",
  ]);
}

// Cláusula Quarta (Avaliação Bancária) - condicional:
// - sem financiamento e sem condição de avaliação: omitida (devolve []);
// - com condição de avaliação: os 5 pontos do modelo;
// - com financiamento e condicionado ao financiamento (sem avaliação): os 5 pontos na versão da
//   aprovação do financiamento, como no contrato final da solicitadora de 23/10/2026;
// - com financiamento sem nenhuma condição: só o ponto 1.
export function pontosClausulaQuarta(h: Helpers, C: Concordancia, processo: Processo): string[] {
  const T = termosImovel(!!processo.imovel_e_fracao_autonoma);
  const financiamento = recorreAFinanciamento(processo);
  const avaliacao = !!processo.condicionado_avaliacao;
  if (!financiamento && !avaliacao) return [];

  const ponto1 = `${C.Seg}, para aquisição ${T.daReferida}, ${C.vs("pretende", "pretendem")} recorrer a financiamento bancário.`;
  if (!avaliacao && financiamento && processo.condicionado_financiamento === true) {
    const montante =
      typeof processo.valor_financiamento_minimo === "number" ? `, no montante mínimo de ${h.euros(processo.valor_financiamento_minimo)}` : "";
    // Prazo: a data-limite do formulário; sem ela, os dias corridos (campo antigo) a contar da assinatura.
    const prazo =
      !processo.avaliacao_prazo_data && typeof processo.prazo_financiamento_dias === "number"
        ? `do prazo de ${processo.prazo_financiamento_dias} (${numeroPorExtenso(processo.prazo_financiamento_dias)}) dias, a contar da data da assinatura do presente contrato,`
        : `até ao dia ${h.dataLongaPT(processo.avaliacao_prazo_data)},`;
    return numerar([
      ponto1,
      `O presente contrato, fica expressamente condicionado à aprovação do referido financiamento${montante}.`,
      `${C.Seg} ${C.vs("dispõe", "dispõem")} ${prazo} para comunicar via email, para ${h.v(
        processo.avaliacao_contacto_email
      )}, se o referido financiamento foi aprovado.`,
      `Se o financiamento não for aprovado, este contrato considera-se automaticamente resolvido, sendo o montante entregue a título de sinal devolvido, em singelo, ${C.aoSeg}, no prazo de 5 (cinco) dias.`,
      `Se até ao prazo acima mencionado, ${C.seg} não ${C.vs(
        "enviar",
        "enviarem"
      )} nenhum email conforme referido nos pontos anteriores, considera-se que o financiamento foi aprovado e o presente contrato de compra e venda mantêm-se conforme as restantes cláusulas.`,
    ]);
  }
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
  // A lista pode já começar por "com" ("com os móveis do inventário anexo") - sem isto saía "com com".
  const lista = h.v(processo.incluidos_no_imovel).replace(/[.\s]+$/, "").replace(/^com\s+/i, "");
  return numerar([
    `Que o imóvel é vendido com ${lista}, no estado de conservação em que se encontram e que já foi visitado e aceite ${C.peloSeg}.`,
  ]);
}

// Cláusula Sexta (Encargos e Despesas) - a referência ao cancelamento da hipoteca só entra
// quando existe hipoteca (mesma lista que decide o ponto 2 da Cláusula Primeira).
export function pontosClausulaSexta(C: Concordancia, hipotecas: Hipoteca[], processo?: Processo): string[] {
  // Imóvel isento de certificado energético: não há certificado a entregar.
  const docs = processo?.imovel_certificado_estado === "isento" ? "licença de utilização" : "licença de utilização, certificado energético";
  const ehOnus = (hip: Hipoteca) => /^[óo]nus/i.test((hip.natureza ?? "").trim());
  const hip = hipotecas.filter((x) => !ehOnus(x));
  const nOnus = hipotecas.length - hip.length;
  // Um distrate por banco (duas hipotecas do mesmo banco levantam-se com um só distrate). Um ónus que
  // nasce da hipoteca cai com ela: como no contrato final da solicitadora, só se fala dele sozinho.
  const credores = new Set(hip.map((x) => (capitalizarLocal(x.entidade_credora) ?? "").toLocaleLowerCase("pt-PT")));
  const distrate = credores.size > 1 ? "distrates/protocolos APB" : "distrate/protocolo APB";
  let hipoteca: string;
  if (hip.length === 1) hipoteca = `${docs}, e ${distrate} para o cancelamento da referida hipoteca e o custo a esta associado`;
  else if (hip.length > 1) hipoteca = `${docs}, e ${distrate} para o cancelamento das referidas hipotecas e os custos a estas associados`;
  else if (nOnus > 0) {
    hipoteca = `${docs}, e cancelamento ${nOnus === 1 ? "do referido ónus e o custo a este associado" : "dos referidos ónus e os custos a estes associados"}`;
  } else hipoteca = docs.replace(", ", " e ");
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
    `Em caso de incumprimento definitivo do presente contrato, por causa comprovadamente imputável ${C.aoSeg}, ${C.esteSeg} ${C.vs(
      "sujeita-se",
      "sujeitam-se"
    )} às penalidades estabelecidas por lei, designadamente à perda, a favor ${
      C.doPrim
    }, de todas as quantias entregues por conta do preço do contrato, dito sinal, nos termos do artigo 442.º do Código Civil.`,
    `Em caso de incumprimento definitivo do presente contrato, por causa comprovadamente imputável ${C.aoPrim}, ${C.estePrim} ${C.vp(
      "obriga-se",
      "obrigam-se"
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

// Cláusula Nona (Notificações) - redação do modelo; quando as partes têm email na identificação, os
// emails convencionados entram também aqui, como nos três contratos finais da solicitadora.
export function pontosClausulaNona(comEmails = false): string[] {
  return numerar([
    `Todas as notificações que venham a ser necessárias fazer na vigência do presente contrato, serão feitas para as moradas supra indicadas e em caso de alteração, devem ser comunicadas por escrito, através de carta registada com aviso de receção${
      comEmails ? " ou através dos emails convencionados" : ""
    }, à contraparte, no prazo máximo de 5 dias contados da data em que ocorrer a respetiva alteração.`,
    `O envio de carta registada com aviso de receção para a morada das partes${
      comEmails ? " ou a boa receção do email" : ""
    } será prova bastante para demonstrar que se efetuou qualquer notificação, ou seja se realizou a interpelação daquela para a realização da escritura definitiva de compra e venda, sendo este o caso.`,
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
// promitente vendedora" em vez de "a promitente vendedora". "aos promitentes compradores" fica sempre
// no plural, mesmo com um só comprador: a solicitadora repôs o plural no contrato final de 21/10/2026.
export function pontosClausulaDecimaPrimeira(): string[] {
  return numerar([
    "Considerando que diversas entidades públicas são titulares de direito de preferência na aquisição do imóvel objeto deste contrato, fica acordado pelos outorgantes que, caso o referido direito seja exercido, o presente contrato cessa automaticamente os seus efeitos, obrigando-se a parte promitente vendedora a devolver, no prazo máximo de 8 (oito) dias, contados da data da comunicação ou ofício da entidade respetiva, aos promitentes compradores, a quantia total entregue a título de sinal, não havendo lugar a qualquer outra indemnização ou compensação.",
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

// Cláusula Décima Sexta (Intervenção Imobiliária) - a mediadora e a licença AMI; quando outra
// agência interveio no negócio (ex.: trouxe o comprador), entra a seguir, como no contrato final de
// 23/10/2026 ("... e pela agência X, titular da licença AMI Y").
export function pontosClausulaDecimaSexta(h?: Helpers, parceira?: { nome?: string | null; ami?: string | null }): string[] {
  const nome = (parceira?.nome ?? "").trim();
  const ami = (parceira?.ami ?? "").trim();
  const v = h ? h.v : (x: unknown) => String(x);
  const outra = nome ? ` e pela agência ${v(nome)}${ami ? `, titular da licença AMI ${v(ami)}` : ""}` : "";
  return numerar([
    `O presente negócio teve intervenção imobiliária levada a cabo pela ${AGENCIA_NOME}, titular da licença AMI ${AGENCIA_AMI}${outra}.`,
    "As partes declaram expressamente que foram informadas da obrigação de utilização de meio de pagamento específico por se tratar de transação de montante igual ou superior a 3.000,00€ (Três Mil Euros), para residentes em Portugal ou 10.000,00€ (Dez Mil Euros), para não residentes, conforme estipulado na Lei nº 92/2017 de 22/08/2017.",
  ]);
}

// Texto final do contrato - em MAIÚSCULAS e negrito nos dois formatos. Dividido em duas partes à
// volta do número de páginas, porque no Word esse número é um campo NUMPAGES (recalculado pelo
// próprio Word) e no PDF é o número real contado depois de gerar (ver lib/cpcv-pdf.ts).
export type TextoFinal = { antes: string; depois: string };

// `comAnexo`: os bens móveis estão num inventário anexo ("COMPOSTO POR SETE PÁGINAS E ANEXO", como no
// contrato final de 23/10/2026).
export function textoFinal(exemplares: number, comAnexo = false): TextoFinal {
  return {
    antes: `O PRESENTE CONTRATO É FEITO EM ${numeroPorExtenso(exemplares).toLocaleUpperCase("pt-PT")} EXEMPLARES, COMPOSTO POR `,
    depois: ` PÁGINAS${
      comAnexo ? " E ANEXO" : ""
    }, NUMERADAS E RUBRICADAS, TODOS COM O VALOR DE ORIGINAL, OS QUAIS VÃO SER ASSINADOS E RUBRICADOS PELOS OUTORGANTES, DEPOIS DE LIDO E EXPLICADO O SEU CONTEÚDO E O MESMO TER SIDO ACEITE POR TODOS NOS SEUS TERMOS E CONDIÇÕES, EM CONFORMIDADE COM AS ASSINATURAS CONSTANTES DOS RESPETIVOS DOCUMENTOS DE IDENTIFICAÇÃO, FICANDO UM EXEMPLAR EM PODER DE CADA UMA DAS PARTES.`,
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
