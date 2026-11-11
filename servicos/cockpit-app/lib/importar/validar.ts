import { CANAIS_ORIGEM, FINANCIAMENTO, FUNIL, TIPOLOGIAS, TIPOS_IMOVEL, TIPOS_NEGOCIO, type EstadoComprador } from "@/lib/comprador";
import { FUNIL_PROP, type EstadoProprietario } from "@/lib/proprietario";
import { DISTRITOS, concelhosDe, freguesiasDe } from "@/lib/localizacoes";
import { ESQUEMAS, type Entidade } from "@/lib/importar/esquemas";

// ---------------------------------------------------------------------------
// Normalização de valores que vêm de folhas de cálculo escritas à mão
// ---------------------------------------------------------------------------

export const semAcentos = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "250.000,00", "250 000 €", "250000", "250,5" -> número. Devolve null se vazio e NaN se não for número. */
export function lerNumero(s: string): number | null {
  let t = s.replace(/€|eur(os)?/gi, "").replace(/\s+/g, "").trim();
  if (t === "") return null;
  // "300k", "200mil", "1,2M", "1.5 milhões"
  const mult = t.match(/^(.*?)(k|mil|m|milhoes|milhões|milhao|milhão)$/i);
  if (mult) {
    const base = lerNumero(mult[1]);
    if (base == null || Number.isNaN(base)) return NaN;
    return base * (/^(k|mil)$/i.test(mult[2]) ? 1000 : 1000000);
  }
  if (t.includes(".") && t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** Telemóvel com indicativo. Sem indicativo assume Portugal. Devolve null se vazio e undefined se inválido. */
export function lerTelemovel(s: string): string | null | undefined {
  // vários números na mesma célula (Google Contactos usa " ::: "): fica o primeiro
  let t = s.split(/:::|[;,/|]| ou /)[0].replace(/[\s.\-()]/g, "");
  if (t === "") return null;
  if (t.startsWith("00")) t = "+" + t.slice(2);
  if (/^\d{9}$/.test(t)) return "+351" + t;
  if (/^351\d{9}$/.test(t)) return "+" + t;
  if (/^\+\d{8,15}$/.test(t)) return t;
  return undefined;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** dd/mm/aaaa, aaaa-mm-dd ou número de série do Excel -> "aaaa-mm-dd". null se vazio, undefined se inválida. */
export function lerData(s: string): string | null | undefined {
  const t = s.trim();
  if (t === "") return null;
  let a: number, m: number, d: number;
  let r: RegExpMatchArray | null;
  if ((r = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) [a, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) [d, m, a] = [+r[1], +r[2], +r[3]];
  else if (/^\d{5}$/.test(t)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Number(t) * 86400000);
    [a, m, d] = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
  } else return undefined;
  const dt = new Date(a, m - 1, d);
  if (dt.getFullYear() !== a || dt.getMonth() !== m - 1 || dt.getDate() !== d || a < 2000 || a > 2100) return undefined;
  return `${a}-${pad(m)}-${pad(d)}`;
}

/** Procura `valor` numa lista ignorando maiúsculas e acentos. Devolve a forma oficial da lista. */
export function daLista(valor: string, lista: string[]): string | null {
  const v = semAcentos(valor);
  return lista.find((o) => semAcentos(o) === v) ?? null;
}

/**
 * Freguesia pelo nome que as pessoas usam: "São Vítor" para "Braga (São Vítor)", "Ferreiros e Gondizalves" para "União das freguesias
 * de Ferreiros e Gondizalves". Primeiro o nome igual; depois um nome oficial que o contenha, se só houver um. Se houver vários,
 * devolve a lista deles (para a mensagem de erro).
 */
export function freguesiaDe(valor: string, lista: string[]): string | string[] {
  const exata = daLista(valor, lista);
  if (exata) return exata;
  const v = semAcentos(valor);
  if (v.length < 3) return [];
  const contem = lista.filter((o) => semAcentos(o).includes(v));
  return contem.length === 1 ? contem[0] : contem;
}

export function lerTipologia(s: string): string | null {
  const primeira = s.match(/t\s?\d+\+?/i)?.[0] ?? s.match(/^(\d+)\s*(quartos?|assoalhadas)?$/i)?.[1];
  if (primeira && primeira !== s) {
    const r = lerTipologiaExata(primeira.replace(/\s/g, "").replace(/^(\d)/, "T$1"));
    if (r) return r;
  }
  return lerTipologiaExata(s);
}

function lerTipologiaExata(s: string): string | null {
  const v = semAcentos(s).replace(/\s/g, "");
  const direto = TIPOLOGIAS.find((t) => semAcentos(t).replace(/\s/g, "") === v);
  if (direto) return direto;
  const m = v.match(/^t(\d+)\+?$/);
  if (m) return Number(m[1]) >= 5 ? "T5 ou mais" : `T${m[1]}`;
  return null;
}

export type Zona = { distrito: string; concelho: string; freguesia: string };

/**
 * Freguesia como o agente a escreve: "Ferreiros e Gondizalves" (oficial: "União das freguesias de Ferreiros e Gondizalves"),
 * "São Vítor" ("Braga (São Vítor)"), "Maia" ("Cidade da Maia"). Primeiro o nome exato; depois sem o "União das freguesias
 * de" e com o que está entre parênteses; por fim a única freguesia do concelho que contém o nome escrito.
 */
export function acharFreguesia(valor: string, lista: string[]): string | null {
  const exata = daLista(valor, lista);
  if (exata) return exata;
  const limpar = (s: string) => semAcentos(s).replace(/^uniao das freguesias de /, "").replace(/[().,]/g, " ").replace(/\s+/g, " ").trim();
  const v = limpar(valor);
  if (!v) return null;
  const formas = (o: string) => {
    const dentro = o.match(/\(([^)]+)\)/)?.[1];
    return [limpar(o), ...(dentro ? [limpar(dentro)] : [])];
  };
  const iguais = lista.filter((o) => formas(o).includes(v));
  if (iguais.length === 1) return iguais[0];
  const contem = lista.filter((o) => formas(o).some((x) => ` ${x} `.includes(` ${v} `)));
  if (contem.length === 1) return contem[0];
  // "Maia" no concelho da Maia: várias contêm o nome; a que o agente quer dizer é a "Cidade da Maia".
  const cidade = contem.filter((o) => new RegExp(`^cidade d[aeo]s? ${v}$`).test(limpar(o)));
  return cidade.length === 1 ? cidade[0] : null;
}

/** Resolve distrito, concelho e freguesia contra a lista oficial (CAOP). Aceita só o concelho (descobre o distrito). */
export function resolverZona(d: string, c: string, f: string): { zona?: Zona; erro?: string; aviso?: string } {
  let dist = d.trim() ? daLista(d, DISTRITOS) : null;
  if (d.trim() && !dist) return { erro: `Distrito "${d.trim()}" não existe` };
  if (c.trim() && !f.trim() && /,| - /.test(c)) {
    const [c1, ...resto] = c.split(/,| - /).map((x) => x.trim());
    const r = resolverZona(d, c1, resto.join(" "));
    if (!r.erro) return r;
  }
  let conc = "";
  if (c.trim()) {
    if (!dist) {
      const candidatos = DISTRITOS.filter((x) => daLista(c, concelhosDe(x)));
      if (candidatos.length === 1) dist = candidatos[0];
      else return { erro: candidatos.length > 1 ? `Concelho "${c.trim()}" existe em vários distritos, indica o distrito` : `Concelho "${c.trim()}" não existe` };
    }
    const achado = daLista(c, concelhosDe(dist));
    if (!achado) return { erro: `Concelho "${c.trim()}" não existe no distrito ${dist}` };
    conc = achado;
  }
  let freg = "";
  let aviso: string | undefined;
  if (f.trim()) {
    if (!conc) return { erro: "Há freguesia mas falta o concelho" };
    const lista = freguesiasDe(dist!, conc);
    const achada = acharFreguesia(f, lista) ?? freguesiaDe(f, lista);
    // Freguesia que não se reconhece não deita fora o cliente: entra com o distrito e o concelho, e avisa (com as hipóteses, se houver).
    if (typeof achada === "string") freg = achada;
    else
      aviso = achada.length
        ? `Freguesia "${f.trim()}" pode ser: ${achada.join(", ")}. Fica só o concelho; escreve o nome completo para ficar a freguesia`
        : `Freguesia "${f.trim()}" não reconhecida em ${conc}, fica só o concelho`;
  }
  if (!dist) return {};
  return { zona: { distrito: dist, concelho: conc, freguesia: freg }, aviso };
}

// ---------------------------------------------------------------------------
// Mapeamento de colunas e validação linha a linha
// ---------------------------------------------------------------------------

export type Mapeamento = Record<string, number | null>;

const nomesDe = (e: Entidade) => ESQUEMAS[e].colunas.flatMap((c) => [c.rotulo, c.chave, ...c.apelidos]).map(semAcentos);

/**
 * Linha do cabeçalho: os CRMs e os Excel feitos à mão têm muitas vezes um título, a data da exportação ou linhas vazias por
 * cima. É a primeira das 15 primeiras linhas com pelo menos duas colunas com nomes conhecidos (senão, a primeira).
 */
export function acharCabecalho(e: Entidade, linhas: string[][]): number {
  const nomes = nomesDe(e);
  const conhecida = (h: string) => {
    const v = semAcentos(h);
    return v !== "" && nomes.some((n) => v === n || (n.length > 3 && v.startsWith(n)));
  };
  const i = linhas.slice(0, 15).findIndex((l) => l.filter(conhecida).length >= 2);
  return i < 0 ? 0 : i;
}

/** Nome próprio e apelido em colunas separadas (Google Contactos, Outlook, alguns CRMs): junta numa coluna "Nome". */
export function juntarNomes(cabecalho: string[], linhas: string[][]): { cabecalho: string[]; linhas: string[][] } {
  const norm = cabecalho.map(semAcentos);
  if (norm.some((h) => ["nome", "nome completo", "name", "full name", "nome do cliente"].includes(h))) return { cabecalho, linhas };
  const partes = [
    norm.findIndex((h) => ["first name", "given name", "nome proprio", "primeiro nome"].includes(h)),
    norm.findIndex((h) => ["middle name", "nome do meio"].includes(h)),
    norm.findIndex((h) => ["last name", "family name", "apelido", "ultimo nome", "sobrenome"].includes(h)),
  ].filter((i) => i >= 0);
  if (partes.length < 2) return { cabecalho, linhas };
  return {
    cabecalho: [...cabecalho, "Nome"],
    linhas: linhas.map((l) => [...l, partes.map((i) => (l[i] ?? "").trim()).filter(Boolean).join(" ")]),
  };
}

/**
 * Liga cada coluna do Cockpit à coluna do ficheiro que tem o nome (ou um apelido) correspondente. Com uma amostra das linhas,
 * olha também para o conteúdo: a coluna "Contacto" cheia de números é o telemóvel e não o nome, e o "Phone 1 - Value" do
 * Google ganha ao "Phone 1 - Label" (que só diz "Mobile").
 */
export function mapearAutomatico(e: Entidade, cabecalho: string[], amostra: string[][] = []): Mapeamento {
  const norm = cabecalho.map(semAcentos);
  const linhasAmostra = amostra.slice(0, 30);
  const fracao = (k: number, teste: (v: string) => boolean) => {
    const vals = linhasAmostra.map((l) => (l[k] ?? "").trim()).filter(Boolean);
    return vals.length ? vals.filter(teste).length / vals.length : 0;
  };
  const eTel = (v: string) => typeof lerTelemovel(v) === "string";
  const eMail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const pareceTel = cabecalho.map((_, k) => fracao(k, eTel) >= 0.6);
  const pareceMail = cabecalho.map((_, k) => fracao(k, eMail) >= 0.6);
  const comAmostra = linhasAmostra.length > 0;
  const serve = (chave: string, k: number) => {
    if (!comAmostra) return true;
    if (chave === "nome") return !pareceTel[k] && !pareceMail[k];
    if (chave === "telemovel") return pareceTel[k];
    if (chave === "email") return pareceMail[k];
    return !(pareceTel[k] || pareceMail[k]) || ["observacoes"].includes(chave);
  };
  const usadas = new Set<number>();
  const mapa: Mapeamento = {};
  // o telemóvel e o email primeiro: assim uma coluna "Contacto" com números não vai parar ao nome
  const ordem = [...ESQUEMAS[e].colunas].sort((a, b) => Number(["telemovel", "email"].includes(b.chave)) - Number(["telemovel", "email"].includes(a.chave)));
  for (const col of ordem) {
    const nomes = [col.rotulo, col.chave, ...col.apelidos].map(semAcentos);
    const livre = (k: number) => !usadas.has(k) && serve(col.chave, k);
    let i = norm.findIndex((h, k) => livre(k) && nomes.includes(h));
    if (i < 0) i = norm.findIndex((h, k) => livre(k) && h !== "" && nomes.some((n) => n.length > 3 && h.startsWith(n)));
    // sem nome conhecido, mas o conteúdo não deixa dúvidas
    if (i < 0 && comAmostra && col.chave === "telemovel") i = pareceTel.findIndex((p, k) => p && !usadas.has(k));
    if (i < 0 && comAmostra && col.chave === "email") i = pareceMail.findIndex((p, k) => p && !usadas.has(k));
    if (i >= 0) usadas.add(i);
    mapa[col.chave] = i >= 0 ? i : null;
  }
  return mapa;
}

export type Contacto = { nome: string; telemovel: string | null; email: string | null; canal_origem: string | null; observacoes: string | null };

export type LinhaValida = {
  /** Número da linha no ficheiro (a 1.ª é o cabeçalho). */
  n: number;
  erros: string[];
  avisos: string[];
  /** Motivo pelo qual a linha não será importada por já existir. */
  duplicada: string | null;
  contacto?: Contacto;
  dados: Record<string, unknown>;
  zonas: Zona[];
};

export type Existentes = { telemoveis: Set<string>; emails: Set<string>; titulos: Set<string> };

const ESTADOS_C = FUNIL.map((f) => ({ id: f.id as string, label: f.label }));
const ESTADOS_P = FUNIL_PROP.map((f) => ({ id: f.id as string, label: f.label }));

function lerEstado(s: string, lista: { id: string; label: string }[]): string | null {
  const v = semAcentos(s);
  return lista.find((x) => semAcentos(x.label) === v || x.id.replace(/_/g, " ") === v)?.id ?? (v === "perdido" ? "perdido" : null);
}

export function validar(e: Entidade, linhas: string[][], mapa: Mapeamento, existentes: Existentes): LinhaValida[] {
  const vistosTel = new Map<string, number>();
  const vistosEmail = new Map<string, number>();
  const vistosTitulo = new Map<string, number>();

  return linhas.map((cels, idx) => {
    const n = idx + 2;
    const erros: string[] = [];
    const avisos: string[] = [];
    const get = (k: string) => {
      const i = mapa[k];
      return i == null ? "" : (cels[i] ?? "").trim();
    };
    const out: LinhaValida = { n, erros, avisos, duplicada: null, dados: {}, zonas: [] };
    // Compradores e proprietários vindos de outro CRM: um campo que não se percebe fica vazio, com aviso, e o cliente entra.
    // Nas angariações o imóvel e o contrato contam para o plano, por isso aí continuam a ser erros.
    const suave = (msg: string) => (e === "angariacoes" ? erros : avisos).push(msg);

    // --- contacto (compradores e proprietários) ---
    if (e !== "angariacoes") {
      const nome = get("nome");
      if (!nome) erros.push("Falta o nome");
      const telRaw = get("telemovel");
      const tel = lerTelemovel(telRaw);
      if (tel === undefined) suave(`Telemóvel "${telRaw}" não reconhecido, não foi guardado`);
      const email = get("email");
      // um email mal escrito não deve deixar a pessoa de fora: fica como está, com aviso
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) avisos.push(`Email "${email}" parece incompleto, guardado como está`);
      const canalRaw = get("canal_origem");
      out.contacto = {
        nome,
        telemovel: tel ?? null,
        email: email ? email.toLowerCase() : null,
        canal_origem: canalRaw ? daLista(canalRaw, CANAIS_ORIGEM) ?? canalRaw : null,
        observacoes: get("observacoes") || null,
      };
      if (!tel && !email) avisos.push("Sem telemóvel nem email");
      // duplicados contra a base e dentro do ficheiro
      const chaveTel = out.contacto.telemovel;
      const chaveMail = out.contacto.email;
      if (chaveTel && existentes.telemoveis.has(chaveTel)) out.duplicada = "Já existe um contacto com este telemóvel";
      else if (chaveMail && existentes.emails.has(chaveMail)) out.duplicada = "Já existe um contacto com este email";
      else if (chaveTel && vistosTel.has(chaveTel)) out.duplicada = `Repetido no ficheiro (linha ${vistosTel.get(chaveTel)})`;
      else if (chaveMail && vistosEmail.has(chaveMail)) out.duplicada = `Repetido no ficheiro (linha ${vistosEmail.get(chaveMail)})`;
      if (chaveTel && !vistosTel.has(chaveTel)) vistosTel.set(chaveTel, n);
      if (chaveMail && !vistosEmail.has(chaveMail)) vistosEmail.set(chaveMail, n);
    }

    // --- imóvel / zona ---
    const tipoRaw = get("tipo_imovel");
    let tipo: string | null = null;
    if (tipoRaw) {
      tipo = daLista(tipoRaw, TIPOS_IMOVEL);
      if (!tipo) suave(`Tipo de imóvel "${tipoRaw}" não reconhecido (${TIPOS_IMOVEL.join(", ")})`);
    }
    const negRaw = get("tipo_negocio");
    const negocio = negRaw ? daLista(negRaw, TIPOS_NEGOCIO) : null;
    if (negRaw && !negocio) avisos.push(`Tipo de negócio "${negRaw}" não reconhecido (Habitação ou Comercial), ignorado`);
    const z1 = resolverZona(get("distrito"), get("concelho"), get("freguesia"));
    if (z1.erro) suave(e === "angariacoes" ? z1.erro : `${z1.erro}: fica sem zona`);
    if (z1.aviso) avisos.push(z1.aviso);
    if (z1.zona) out.zonas.push(z1.zona);

    const tipolRaw = get(e === "compradores" ? "tipologia_minima" : "tipologia");
    let tipologia: string | null = null;
    if (tipolRaw) {
      tipologia = lerTipologia(tipolRaw);
      if (!tipologia) suave(`Tipologia "${tipolRaw}" não reconhecida (T0 a T5 ou mais)`);
    }

    const numero = (k: string, rotulo: string, min = 0): number | null => {
      const raw = get(k);
      if (!raw) return null;
      const v = lerNumero(raw);
      if (v == null || Number.isNaN(v) || v < min) {
        avisos.push(`${rotulo} "${raw}" não é um número, ficou vazio`);
        return null;
      }
      return v;
    };

    if (e === "compradores") {
      for (const par of get("outras_zonas").split(/[;|]/).map((x) => x.trim()).filter(Boolean)) {
        const [d, c = "", f = ""] = par.split("/").map((x) => x.trim());
        const r = resolverZona(d, c, f);
        if (r.erro) avisos.push(`Outras zonas: ${r.erro}, ignorada`);
        else if (r.zona) out.zonas.push(r.zona);
        if (r.aviso) avisos.push(`Outras zonas: ${r.aviso}`);
      }
      const motRaw = get("motivacao");
      let motivacao: number | null = null;
      if (motRaw) {
        const m = lerNumero(motRaw);
        if (m == null || Number.isNaN(m) || m < 0 || m > 10) avisos.push(`Motivação "${motRaw}" tem de ser de 0 a 10, ficou vazia`);
        else motivacao = Math.round(m);
      }
      const estRaw = get("estado");
      const estado = estRaw ? lerEstado(estRaw, ESTADOS_C) : "lead_qualificada";
      if (!estado) avisos.push(`Fase "${estRaw}" não reconhecida, entra como ${FUNIL[0].label}`);
      const finRaw = get("financiamento");
      const fin = finRaw ? daLista(finRaw, FINANCIAMENTO) : null;
      if (finRaw && !fin) avisos.push(`Financiamento "${finRaw}" não reconhecido, ignorado`);
      const pvRaw = semAcentos(get("precisa_vender"));
      const precisa = !pvRaw ? null : ["sim", "s", "yes", "1"].includes(pvRaw) ? true : ["nao", "n", "no", "0"].includes(pvRaw) ? false : null;
      if (pvRaw && precisa === null) avisos.push(`"Precisa de vender" tem de ser Sim ou Não, ignorado`);
      out.dados = {
        motivacao,
        tipo_negocio: negocio,
        tipo_imovel: tipo,
        tipologia_minima: tipologia,
        expectativa_valor: numero("expectativa_valor", "Valor"),
        financiamento: fin,
        precisa_vender: precisa,
        estado: (estado ?? "lead_qualificada") as EstadoComprador,
        distrito: out.zonas[0]?.distrito ?? null,
        concelho: out.zonas[0]?.concelho || null,
        freguesia: out.zonas[0]?.freguesia || null,
      };
      if (!out.zonas.length) avisos.push("Sem zona: não gera alertas de imóveis");
    } else if (e === "proprietarios") {
      const estRaw = get("estado");
      const estado = estRaw ? lerEstado(estRaw, ESTADOS_P) : "fsbo";
      if (!estado) avisos.push(`Fase "${estRaw}" não reconhecida, entra como ${ESTADOS_P.find((x) => x.id === "fsbo")?.label ?? "a primeira fase"}`);
      const link = get("link_imovel");
      if (link && !/^https?:\/\//i.test(link)) avisos.push("O link não começa por http, guardado como está");
      out.dados = {
        link_imovel: link || null,
        tipo_negocio: negocio,
        tipo_imovel: tipo,
        tipologia,
        valor: numero("valor", "Preço"),
        estado: (estado ?? "fsbo") as EstadoProprietario,
        distrito: out.zonas[0]?.distrito ?? null,
        concelho: out.zonas[0]?.concelho || null,
        freguesia: out.zonas[0]?.freguesia || null,
      };
    } else {
      const titulo = get("titulo");
      if (!titulo) erros.push("Falta o imóvel (morada ou referência)");
      const iniRaw = get("inicio");
      const ini = lerData(iniRaw);
      if (ini === undefined) erros.push(`Data "${iniRaw}" inválida (usa dd/mm/aaaa)`);
      const durRaw = get("duracao_dias");
      let dur = 180;
      if (durRaw) {
        const d = lerNumero(durRaw);
        if (d === 120 || d === 180) dur = d;
        else erros.push(`Duração "${durRaw}" tem de ser 120 ou 180`);
      }
      const regRaw = get("regime");
      let regime: string | null = null;
      if (regRaw) {
        const r = semAcentos(regRaw);
        if (["exclusivo", "em exclusivo", "exclusividade", "sim"].includes(r)) regime = "exclusivo";
        else if (["nao exclusivo", "nao", "sem exclusividade", "aberto"].includes(r)) regime = "nao_exclusivo";
        else erros.push(`Regime "${regRaw}" tem de ser Exclusivo ou Não exclusivo`);
      }
      const chave = semAcentos(titulo);
      if (chave && existentes.titulos.has(chave)) out.duplicada = "Já existe uma angariação com este nome";
      else if (chave && vistosTitulo.has(chave)) out.duplicada = `Repetida no ficheiro (linha ${vistosTitulo.get(chave)})`;
      if (chave && !vistosTitulo.has(chave)) vistosTitulo.set(chave, n);
      out.dados = {
        titulo,
        inicio: ini ?? null,
        duracao_dias: dur,
        regime,
        tipo_imovel: tipo,
        tipologia,
        valor: numero("valor", "Preço"),
        distrito: out.zonas[0]?.distrito ?? null,
        concelho: out.zonas[0]?.concelho || null,
        freguesia: out.zonas[0]?.freguesia || null,
      };
      if (!out.zonas.length) avisos.push("Sem zona: não gera alertas de compradores");
    }
    return out;
  });
}
