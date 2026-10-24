import { CANAIS_ORIGEM, FINANCIAMENTO, FUNIL, TIPOLOGIAS, TIPOS_IMOVEL, type EstadoComprador } from "@/lib/comprador";
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
  if (t.includes(".") && t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** Telemóvel com indicativo. Sem indicativo assume Portugal. Devolve null se vazio e undefined se inválido. */
export function lerTelemovel(s: string): string | null | undefined {
  let t = s.replace(/[\s.\-()]/g, "");
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

export function lerTipologia(s: string): string | null {
  const v = semAcentos(s).replace(/\s/g, "");
  const direto = TIPOLOGIAS.find((t) => semAcentos(t).replace(/\s/g, "") === v);
  if (direto) return direto;
  const m = v.match(/^t(\d+)\+?$/);
  if (m) return Number(m[1]) >= 5 ? "T5 ou mais" : `T${m[1]}`;
  return null;
}

export type Zona = { distrito: string; concelho: string; freguesia: string };

/** Resolve distrito, concelho e freguesia contra a lista oficial (CAOP). Aceita só o concelho (descobre o distrito). */
export function resolverZona(d: string, c: string, f: string): { zona?: Zona; erro?: string } {
  let dist = d.trim() ? daLista(d, DISTRITOS) : null;
  if (d.trim() && !dist) return { erro: `Distrito "${d.trim()}" não existe` };
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
  if (f.trim()) {
    if (!conc) return { erro: "Há freguesia mas falta o concelho" };
    const achada = daLista(f, freguesiasDe(dist!, conc));
    if (!achada) return { erro: `Freguesia "${f.trim()}" não existe em ${conc}` };
    freg = achada;
  }
  if (!dist) return {};
  return { zona: { distrito: dist, concelho: conc, freguesia: freg } };
}

// ---------------------------------------------------------------------------
// Mapeamento de colunas e validação linha a linha
// ---------------------------------------------------------------------------

export type Mapeamento = Record<string, number | null>;

/** Liga cada coluna do Cockpit à coluna do ficheiro que tem o nome (ou um apelido) correspondente. */
export function mapearAutomatico(e: Entidade, cabecalho: string[]): Mapeamento {
  const norm = cabecalho.map(semAcentos);
  const usadas = new Set<number>();
  const mapa: Mapeamento = {};
  for (const col of ESQUEMAS[e].colunas) {
    const nomes = [col.rotulo, col.chave, ...col.apelidos].map(semAcentos);
    let i = norm.findIndex((h, k) => !usadas.has(k) && nomes.includes(h));
    if (i < 0) i = norm.findIndex((h, k) => !usadas.has(k) && h !== "" && nomes.some((n) => n.length > 3 && h.startsWith(n)));
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

    // --- contacto (compradores e proprietários) ---
    if (e !== "angariacoes") {
      const nome = get("nome");
      if (!nome) erros.push("Falta o nome");
      const telRaw = get("telemovel");
      const tel = lerTelemovel(telRaw);
      if (tel === undefined) erros.push(`Telemóvel "${telRaw}" inválido`);
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
      if (!tipo) erros.push(`Tipo de imóvel "${tipoRaw}" não reconhecido (${TIPOS_IMOVEL.join(", ")})`);
    }
    const z1 = resolverZona(get("distrito"), get("concelho"), get("freguesia"));
    if (z1.erro) erros.push(z1.erro);
    if (z1.zona) out.zonas.push(z1.zona);

    const tipolRaw = get(e === "compradores" ? "tipologia_minima" : "tipologia");
    let tipologia: string | null = null;
    if (tipolRaw) {
      tipologia = lerTipologia(tipolRaw);
      if (!tipologia) erros.push(`Tipologia "${tipolRaw}" não reconhecida (T0 a T5 ou mais)`);
    }

    const numero = (k: string, rotulo: string, min = 0): number | null => {
      const raw = get(k);
      if (!raw) return null;
      const v = lerNumero(raw);
      if (v == null || Number.isNaN(v) || v < min) {
        erros.push(`${rotulo} "${raw}" não é um número válido`);
        return null;
      }
      return v;
    };

    if (e === "compradores") {
      for (const par of get("outras_zonas").split(/[;|]/).map((x) => x.trim()).filter(Boolean)) {
        const [d, c = "", f = ""] = par.split("/").map((x) => x.trim());
        const r = resolverZona(d, c, f);
        if (r.erro) erros.push(`Outras zonas: ${r.erro}`);
        else if (r.zona) out.zonas.push(r.zona);
      }
      const motRaw = get("motivacao");
      let motivacao: number | null = null;
      if (motRaw) {
        const m = lerNumero(motRaw);
        if (m == null || Number.isNaN(m) || m < 0 || m > 10) erros.push(`Motivação "${motRaw}" tem de ser de 0 a 10`);
        else motivacao = Math.round(m);
      }
      const estRaw = get("estado");
      const estado = estRaw ? lerEstado(estRaw, ESTADOS_C) : "lead_qualificada";
      if (!estado) erros.push(`Fase "${estRaw}" não reconhecida`);
      const finRaw = get("financiamento");
      const fin = finRaw ? daLista(finRaw, FINANCIAMENTO) : null;
      if (finRaw && !fin) avisos.push(`Financiamento "${finRaw}" não reconhecido, ignorado`);
      const pvRaw = semAcentos(get("precisa_vender"));
      const precisa = !pvRaw ? null : ["sim", "s", "yes", "1"].includes(pvRaw) ? true : ["nao", "n", "no", "0"].includes(pvRaw) ? false : null;
      if (pvRaw && precisa === null) avisos.push(`"Precisa de vender" tem de ser Sim ou Não, ignorado`);
      out.dados = {
        motivacao,
        referencia_imovel: get("referencia_imovel") || null,
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
      if (!estado) erros.push(`Fase "${estRaw}" não reconhecida`);
      const link = get("link_imovel");
      if (link && !/^https?:\/\//i.test(link)) avisos.push("O link não começa por http, guardado como está");
      out.dados = {
        link_imovel: link || null,
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
