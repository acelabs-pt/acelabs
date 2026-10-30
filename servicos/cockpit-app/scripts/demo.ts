// Carteira de demonstração: enche um projeto Supabase com dados FICTÍCIOS e credíveis para mostrar o Cockpit
// a uma imobiliária (compradores em várias fases, proprietários, angariações a meio do plano, chamadas,
// tarefas para hoje, alertas de imóveis, metas). As datas são relativas ao dia em que corre.
//
//   npx tsx --tsconfig tsconfig.json scripts/demo.ts            semear
//   npx tsx --tsconfig tsconfig.json scripts/demo.ts --limpar   apagar tudo o que o script criou
//
// Precisa de NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e DEMO_PERMITIDO_EM (a referência
// do projeto, a parte antes de .supabase.co), no ambiente, no .env.demo (o mais simples: ficheiro só do Demo, fora do git) ou no
// .env.testes. PROTEÇÃO: só corre nesse projeto.
// Usar um projeto próprio para demonstrações, nunca o de um cliente.
//
// Os contactos de demonstração têm todos email @exemplo.pt e telemóveis +351 900 000 xxx (não atribuídos a
// telemóveis): é por aí que o --limpar os encontra. As metas só são criadas se o ano ainda não tiver metas,
// e o --limpar não lhes toca.
import { existsSync, readFileSync } from "node:fs";
import { ACOES_PADRAO, dataDoDia, linhasDoPlano, tarefaDaAcao, type Acao } from "@/lib/angariacao";
import { ESTADOS_A_PROCURAR, corresponde, type Zona } from "@/lib/oportunidades";
import { concelhosDe, freguesiasDe } from "@/lib/localizacoes";

// ---------------------------------------------------------------------------
// Ligação e proteção
// ---------------------------------------------------------------------------
const env: Record<string, string | undefined> = { ...process.env };
for (const f of [".env.demo", ".env.local", ".env.testes"]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
}
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL;
const CHAVE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !CHAVE) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
if (!env.DEMO_PERMITIDO_EM || !URL_SB.includes(`//${env.DEMO_PERMITIDO_EM}.`)) {
  console.error(`Proteção: ${URL_SB} não é o projeto indicado em DEMO_PERMITIDO_EM. O script escreve dados: nunca corre num cliente.`);
  process.exit(1);
}
const H = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" };

type Linha = Record<string, unknown>;
async function rest(metodo: string, caminho: string, corpo?: unknown): Promise<Linha[]> {
  const r = await fetch(`${URL_SB}/rest/v1/${caminho}`, { method: metodo, headers: { ...H, Prefer: "return=representation" }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${caminho.split("?")[0]}: ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : [];
}
// Projeto partilhado (migracao_multiempresa.sql): a demonstração vive numa empresa própria ("demo", ou DEMO_EMPRESA) e o
// script só toca nas linhas dessa empresa. Base antiga, sem tabela empresas: não filtra nada.
let EMPRESA: string | null = null;
const daEmpresa = () => (EMPRESA ? `&empresa_id=eq.${EMPRESA}` : "");
async function prepararEmpresa() {
  const cod = (env.DEMO_EMPRESA || "demo").toLowerCase();
  const r = await fetch(`${URL_SB}/rest/v1/empresas?select=id&codigo=eq.${cod}`, { headers: H });
  if (r.status === 404) return;
  if (!r.ok) throw new Error(`Não consegui ler as empresas (${r.status}).`);
  const l = (await r.json()) as { id: string }[];
  if (l.length) {
    EMPRESA = l[0].id;
    return;
  }
  const c = await fetch(`${URL_SB}/rest/v1/empresas`, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify({ codigo: cod, nome: "Ace Labs Demo" }) });
  if (!c.ok) throw new Error(`Não consegui criar a empresa "${cod}" (${c.status}).`);
  EMPRESA = ((await c.json()) as { id: string }[])[0].id;
  console.log(`Empresa "${cod}" criada.`);
}

/** Insere em lotes; todas as linhas de um lote têm de ter as mesmas chaves (o que falta vai a null). */
async function inserir(tabela: string, linhas: Linha[]): Promise<Linha[]> {
  const chaves = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const out: Linha[] = [];
  for (let i = 0; i < linhas.length; i += 300) {
    const lote = linhas.slice(i, i + 300).map((l) => ({ ...Object.fromEntries(chaves.map((k) => [k, l[k] ?? null])), ...(EMPRESA ? { empresa_id: EMPRESA } : {}) }));
    out.push(...(await rest("POST", tabela, lote)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Datas relativas a hoje
// ---------------------------------------------------------------------------
const agora = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dias = (n: number, hora = 10, min = 0) => {
  const d = new Date(agora);
  d.setDate(d.getDate() + n);
  d.setHours(hora, min, 0, 0);
  return d;
};
const dia = (n: number) => iso(dias(n));

// ---------------------------------------------------------------------------
// Limpar
// ---------------------------------------------------------------------------
async function limpar() {
  await prepararEmpresa();
  const props = await rest("GET", `proprietarios?select=id,contactos!inner(email)&contactos.email=like.*%40exemplo.pt${daEmpresa()}`);
  if (props.length) {
    // as angariações ficam sem proprietário ao apagar o contacto (set null): apagá-las primeiro (cascata: ações e tarefas)
    await rest("DELETE", `angariacoes?proprietario_id=in.(${props.map((p) => p.id).join(",")})${daEmpresa()}`);
  }
  const apagados = await rest("DELETE", `contactos?email=like.*%40exemplo.pt${daEmpresa()}`); // cascata: fichas, zonas, imóveis, chamadas, tarefas, alertas
  console.log(`Demonstração apagada: ${apagados.length} contactos e tudo o que estava ligado a eles.`);
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------
let seq = 100;
const tel = () => `+351900000${seq++}`;
const email = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.|\.$/g, "") + "@exemplo.pt";

type ZonaDemo = [string, string | null, string | null];
type CompradorDemo = {
  nome: string;
  canal: string;
  estado: string;
  desde: number; // dias desde que está nesta fase (negativo)
  motivacao: number;
  tipo: string;
  tipologia: string;
  valor: number;
  financiamento: string;
  precisaVender: boolean;
  zonas: ZonaDemo[];
  imoveis?: { descricao: string; enviado: number; visitado?: number; proposta?: number }[];
  notas?: string;
  cpcv?: { data: number; escrituraPrazo: number; valorNegocio: number; comissao: number; escrituraAgendada?: number };
  concluido?: { recebidaHa: number; valorNegocio: number; comissao: number };
};

const COMPRADORES: CompradorDemo[] = [
  { nome: "Ana Rita Fernandes", canal: "Idealista", estado: "lead_qualificada", desde: -2, motivacao: 8, tipo: "Apartamento", tipologia: "T2", valor: 230000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Guimarães", "Azurém"], ["Braga", "Guimarães", "Creixomil"]], notas: "Trabalha na Universidade do Minho. Quer perto do campus de Azurém." },
  { nome: "João Pedro Machado", canal: "Meta", estado: "lead_qualificada", desde: -5, motivacao: 6, tipo: "Moradia", tipologia: "T3", valor: 340000, financiamento: "Vai pedir crédito", precisaVender: true, zonas: [["Braga", "Braga", null]], notas: "Tem de vender o T2 em Fraião primeiro." },
  { nome: "Sofia Carvalho", canal: "Site da imobiliária", estado: "lead_qualificada", desde: -1, motivacao: 9, tipo: "Apartamento", tipologia: "T3", valor: 290000, financiamento: "Capitais próprios", precisaVender: false, zonas: [["Porto", "Matosinhos", "Leça da Palmeira"], ["Porto", "Maia", null]] },
  { nome: "Tiago Moreira", canal: "Idealista", estado: "lead_qualificada", desde: -16, motivacao: 4, tipo: "Apartamento", tipologia: "T1", valor: 150000, financiamento: "Vai pedir crédito", precisaVender: false, zonas: [["Braga", "Braga", "Gualtar"]], notas: "Primeira casa. Ainda a juntar para a entrada." },
  { nome: "Inês Barbosa", canal: "Referência", estado: "imoveis_enviados", desde: -4, motivacao: 7, tipo: "Apartamento", tipologia: "T2", valor: 210000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Guimarães", null]], imoveis: [{ descricao: "T2 com varanda em Creixomil", enviado: -4 }, { descricao: "T2 renovado no centro histórico", enviado: -3 }, { descricao: "T2 com garagem em Urgezes", enviado: -1 }] },
  { nome: "Ricardo Lopes", canal: "Imovirtual", estado: "imoveis_enviados", desde: -9, motivacao: 5, tipo: "Moradia", tipologia: "T4", valor: 420000, financiamento: "Capitais próprios", precisaVender: true, zonas: [["Braga", "Vila Nova de Famalicão", null], ["Braga", "Braga", null]], imoveis: [{ descricao: "Moradia T4 com jardim em Brufe", enviado: -9 }, { descricao: "Moradia isolada em Cavalões", enviado: -8 }] },
  { nome: "Catarina Pinto", canal: "Meta", estado: "imoveis_enviados", desde: -2, motivacao: 8, tipo: "Apartamento", tipologia: "T3", valor: 310000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Porto", "Maia", "Cidade da Maia"]], imoveis: [{ descricao: "T3 novo na Cidade da Maia", enviado: -2 }] },
  { nome: "Hugo Teixeira", canal: "Placa", estado: "imoveis_enviados", desde: -6, motivacao: 6, tipo: "Apartamento", tipologia: "T2", valor: 195000, financiamento: "Vai pedir crédito", precisaVender: false, zonas: [["Braga", "Barcelos", null]], imoveis: [{ descricao: "T2 junto ao rio em Barcelos", enviado: -6 }, { descricao: "T2 com terraço em Arcozelo", enviado: -5 }] },
  { nome: "Marta Gonçalves", canal: "Idealista", estado: "visitas_realizadas", desde: -3, motivacao: 9, tipo: "Apartamento", tipologia: "T3", valor: 280000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Guimarães", "Azurém"]], imoveis: [{ descricao: "T3 em Azurém, 3.º andar", enviado: -12, visitado: -3 }, { descricao: "T3 com lugar de garagem em Azurém", enviado: -10, visitado: -3 }, { descricao: "T3 a estrear em Creixomil", enviado: -8 }], notas: "Gostou muito do 3.º andar. Vai falar com o banco." },
  { nome: "Nuno Ribeiro", canal: "Site da imobiliária", estado: "visitas_realizadas", desde: -11, motivacao: 5, tipo: "Moradia", tipologia: "T3", valor: 360000, financiamento: "Vai pedir crédito", precisaVender: true, zonas: [["Braga", "Braga", "Esporões"], ["Braga", "Braga", "Adaúfe"]], imoveis: [{ descricao: "Moradia em banda em Esporões", enviado: -20, visitado: -11 }, { descricao: "Moradia T3 com piscina em Adaúfe", enviado: -18, visitado: -12 }] },
  { nome: "Beatriz Correia", canal: "Meta", estado: "visitas_realizadas", desde: -5, motivacao: 7, tipo: "Apartamento", tipologia: "T2", valor: 240000, financiamento: "Capitais próprios", precisaVender: false, zonas: [["Porto", "Matosinhos", null]], imoveis: [{ descricao: "T2 com vista mar em Leça da Palmeira", enviado: -14, visitado: -5 }] },
  { nome: "André Sousa", canal: "Referência", estado: "propostas_efetuadas", desde: -2, motivacao: 9, tipo: "Apartamento", tipologia: "T2", valor: 225000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Braga", "Braga (São Vítor)"]], imoveis: [{ descricao: "T2 em São Vítor, perto da universidade", enviado: -25, visitado: -15, proposta: -2 }, { descricao: "T2 renovado em São Vítor", enviado: -22, visitado: -15 }], notas: "Proposta de 215 000 €. Proprietário responde até sexta." },
  { nome: "Joana Faria", canal: "Idealista", estado: "propostas_efetuadas", desde: -6, motivacao: 8, tipo: "Moradia", tipologia: "T4", valor: 450000, financiamento: "Capitais próprios", precisaVender: true, zonas: [["Braga", "Guimarães", "Caldelas"]], imoveis: [{ descricao: "Moradia T4 em Caldelas com terreno", enviado: -30, visitado: -20, proposta: -6 }] },
  { nome: "Diogo Antunes", canal: "Imovirtual", estado: "cpcv", desde: -18, motivacao: 10, tipo: "Apartamento", tipologia: "T3", valor: 265000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Braga", "Gualtar"]], imoveis: [{ descricao: "T3 em Gualtar com arrecadação", enviado: -50, visitado: -40, proposta: -30 }], cpcv: { data: -18, escrituraPrazo: 22, valorNegocio: 258000, comissao: 7740, escrituraAgendada: 19 } },
  { nome: "Rita Monteiro", canal: "Site da imobiliária", estado: "cpcv", desde: -40, motivacao: 9, tipo: "Moradia", tipologia: "T3", valor: 330000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Vila Nova de Famalicão", null]], imoveis: [{ descricao: "Moradia T3 em Cabeçudos", enviado: -80, visitado: -70, proposta: -60 }], cpcv: { data: -40, escrituraPrazo: 9, valorNegocio: 318000, comissao: 9540 } },
  { nome: "Paulo Azevedo", canal: "Referência", estado: "negocio_concluido", desde: -35, motivacao: 10, tipo: "Apartamento", tipologia: "T2", valor: 200000, financiamento: "Capitais próprios", precisaVender: false, zonas: [["Braga", "Guimarães", "Creixomil"]], imoveis: [{ descricao: "T2 em Creixomil, 1.º andar", enviado: -120, visitado: -110, proposta: -100 }], concluido: { recebidaHa: 35, valorNegocio: 192000, comissao: 5760 } },
];

type ProprietarioDemo = {
  nome: string;
  canal: string;
  estado: string;
  desde: number;
  tipo: string;
  tipologia: string;
  valor: number;
  zona: ZonaDemo;
  reuniao?: number; // dias a partir de hoje
  notas?: string;
  angariacao?: { titulo: string; inicioHa: number; regime: "exclusivo" | "nao_exclusivo"; vendidoHa?: number; comissao?: number };
};

const PROPRIETARIOS: ProprietarioDemo[] = [
  { nome: "Manuel Oliveira", canal: "Placa", estado: "fsbo", desde: -3, tipo: "Apartamento", tipologia: "T2", valor: 215000, zona: ["Braga", "Guimarães", "Creixomil"], notas: "Anúncio próprio no OLX há 2 meses. Aberto a conversar." },
  { nome: "Fernanda Costa", canal: "Idealista", estado: "fsbo", desde: -8, tipo: "Moradia", tipologia: "T4", valor: 395000, zona: ["Braga", "Braga", "Esporões"] },
  { nome: "Alberto Ramos", canal: "Referência", estado: "reuniao_marcada", desde: -2, tipo: "Apartamento", tipologia: "T3", valor: 275000, zona: ["Braga", "Guimarães", "Azurém"], reuniao: 1 },
  { nome: "Lurdes Martins", canal: "Idealista", estado: "dossier_enviado", desde: -4, tipo: "Apartamento", tipologia: "T3", valor: 305000, zona: ["Porto", "Matosinhos", "Leça da Palmeira"], reuniao: -6 },
  { nome: "Carlos Vieira", canal: "Placa", estado: "angariado", desde: -12, tipo: "Apartamento", tipologia: "T3", valor: 285000, zona: ["Braga", "Guimarães", "Azurém"], angariacao: { titulo: "Apartamento T3 em Azurém, Guimarães", inicioHa: 12, regime: "exclusivo" } },
  { nome: "Teresa Mendes", canal: "Meta", estado: "angariado", desde: -47, tipo: "Moradia", tipologia: "T4", valor: 410000, zona: ["Braga", "Vila Nova de Famalicão", "Brufe"], angariacao: { titulo: "Moradia T4 com jardim em Brufe, Famalicão", inicioHa: 47, regime: "exclusivo" } },
  { nome: "José Araújo", canal: "Referência", estado: "angariado", desde: -96, tipo: "Apartamento", tipologia: "T2", valor: 235000, zona: ["Porto", "Matosinhos", "Leça da Palmeira"], angariacao: { titulo: "Apartamento T2 com vista mar em Leça da Palmeira", inicioHa: 96, regime: "nao_exclusivo" } },
  { nome: "Graça Fonseca", canal: "Site da imobiliária", estado: "angariado", desde: -140, tipo: "Apartamento", tipologia: "T2", valor: 198000, zona: ["Braga", "Guimarães", "Creixomil"], angariacao: { titulo: "Apartamento T2 em Creixomil, Guimarães", inicioHa: 140, regime: "exclusivo", vendidoHa: 30, comissao: 5940 } },
];

const FEEDBACK = [
  "Duas visitas esta semana, gostaram da luz.",
  "Fotografias novas com o dia de sol.",
  "Três contactos pelo portal, um quer visitar.",
  "Visita do casal de Braga: acham o preço alto.",
  "Open house com 6 visitas.",
  "Partilhado em 4 agências parceiras.",
];

function validarZona([d, c, f]: ZonaDemo) {
  if (c && !concelhosDe(d).includes(c)) throw new Error(`Concelho inválido: ${d}/${c}`);
  if (c && f && !freguesiasDe(d, c).includes(f)) throw new Error(`Freguesia inválida: ${d}/${c}/${f}`);
}

// ---------------------------------------------------------------------------
// Semear
// ---------------------------------------------------------------------------
async function semear() {
  await prepararEmpresa();
  for (const c of COMPRADORES) c.zonas.forEach(validarZona);
  for (const p of PROPRIETARIOS) validarZona(p.zona);
  const ja = await rest("GET", `contactos?select=id&email=like.*%40exemplo.pt&limit=1${daEmpresa()}`);
  if (ja.length) {
    console.error("Já há dados de demonstração neste projeto. Corre primeiro com --limpar.");
    process.exit(1);
  }

  // --- compradores ---
  const contC = await inserir(
    "contactos",
    COMPRADORES.map((c) => ({ nome: c.nome, telemovel: tel(), email: email(c.nome), canal_origem: c.canal, observacoes: c.notas ?? null, created_at: dias(c.desde - 10).toISOString() }))
  );
  const comps = await inserir(
    "compradores",
    COMPRADORES.map((c, i) => ({
      contacto_id: contC[i].id,
      estado: c.estado,
      estado_desde: dias(c.desde, 11).toISOString(),
      motivacao: c.motivacao,
      tipo_imovel: c.tipo,
      tipologia_minima: c.tipologia,
      expectativa_valor: c.valor,
      financiamento: c.financiamento,
      simulacao_credito: c.financiamento === "Capitais próprios" ? "Não aplicável" : c.motivacao >= 8 ? "Feita" : "Por fazer",
      precisa_vender: c.precisaVender,
      distrito: c.zonas[0][0],
      concelho: c.zonas[0][1],
      freguesia: c.zonas[0][2],
      cpcv_fechado: !!c.cpcv || !!c.concluido,
      cpcv_data: c.cpcv ? dia(c.cpcv.data) : c.concluido ? dia(-c.concluido.recebidaHa - 45) : null,
      escritura_agendada: !!c.cpcv?.escrituraAgendada || !!c.concluido,
      escritura_data: c.cpcv?.escrituraAgendada ? dia(c.cpcv.escrituraAgendada) : c.concluido ? dia(-c.concluido.recebidaHa) : null,
      escritura_prazo: c.cpcv ? dia(c.cpcv.escrituraPrazo) : null,
      valor_negocio: c.cpcv?.valorNegocio ?? c.concluido?.valorNegocio ?? null,
      comissao_valor: c.cpcv?.comissao ?? c.concluido?.comissao ?? null,
      comissao_recebida: !!c.concluido,
      comissao_recebida_em: c.concluido ? dia(-c.concluido.recebidaHa) : null,
    }))
  );
  await inserir(
    "comprador_zonas",
    COMPRADORES.flatMap((c, i) => c.zonas.map(([d, co, f]) => ({ comprador_id: comps[i].id, distrito: d, concelho: co, freguesia: f })))
  );
  await inserir(
    "comprador_imoveis",
    COMPRADORES.flatMap((c, i) =>
      (c.imoveis ?? []).map((m) => ({ comprador_id: comps[i].id, descricao: m.descricao, enviado_em: dia(m.enviado), visitado_em: m.visitado != null ? dia(m.visitado) : null, proposta_em: m.proposta != null ? dia(m.proposta) : null }))
    )
  );
  // documentos da escritura dos CPCV: parte entregue
  const docs = ["Cartão de Cidadão dos compradores", "Comprovativo de morada", "Aprovação do crédito", "Comprovativo do sinal", "Certidão de casamento"];
  await inserir(
    "comprador_documentos",
    COMPRADORES.flatMap((c, i) => (c.cpcv ? docs.map((nome, k) => ({ comprador_id: comps[i].id, nome, entregue: k < (c.cpcv!.escrituraPrazo < 15 ? 3 : 2) })) : []))
  );

  // --- proprietários e angariações ---
  const contP = await inserir(
    "contactos",
    PROPRIETARIOS.map((p) => ({ nome: p.nome, telemovel: tel(), email: email(p.nome), canal_origem: p.canal, observacoes: p.notas ?? null, created_at: dias(p.desde - 15).toISOString() }))
  );
  const props = await inserir(
    "proprietarios",
    PROPRIETARIOS.map((p, i) => ({
      contacto_id: contP[i].id,
      estado: p.estado,
      estado_desde: dias(p.desde, 11).toISOString(),
      tipo_imovel: p.tipo,
      tipologia: p.tipologia,
      valor: p.valor,
      distrito: p.zona[0],
      concelho: p.zona[1],
      freguesia: p.zona[2],
      reuniao_em: p.reuniao != null ? dias(p.reuniao, 18, 30).toISOString() : p.angariacao ? dias(-p.angariacao.inicioHa - 5, 18).toISOString() : null,
    }))
  );
  const comAng = PROPRIETARIOS.map((p, i) => ({ p, prop: props[i] })).filter((x) => x.p.angariacao);
  const angs = await inserir(
    "angariacoes",
    comAng.map(({ p, prop }) => ({
      proprietario_id: prop.id,
      titulo: p.angariacao!.titulo,
      duracao_dias: 180,
      regime: p.angariacao!.regime,
      inicio: dia(-p.angariacao!.inicioHa),
      vendido_em: p.angariacao!.vendidoHa != null ? dia(-p.angariacao!.vendidoHa) : null,
      valor_negocio: p.angariacao!.vendidoHa != null ? p.valor - 6000 : null,
      comissao_valor: p.angariacao!.comissao ?? null,
      comissao_recebida: p.angariacao!.vendidoHa != null,
      comissao_recebida_em: p.angariacao!.vendidoHa != null ? dia(-p.angariacao!.vendidoHa + 10) : null,
      tipo_imovel: p.tipo,
      tipologia: p.tipologia,
      distrito: p.zona[0],
      concelho: p.zona[1],
      freguesia: p.zona[2],
      valor: p.valor,
    }))
  );

  // planos: o que já passou está quase todo feito (umas poucas em atraso, para o Dashboard ter o que mostrar)
  const nomes = ACOES_PADRAO.map((a) => a.nome);
  const hoje0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const acoes: Linha[] = [];
  const tarefas: Linha[] = [];
  angs.forEach((a, k) => {
    const vendida = a.vendido_em != null;
    let n = 0;
    for (const l of linhasDoPlano(nomes, true, 180)) {
      const quando = dataDoDia(a.inicio as string, l.dia);
      const passou = quando < hoje0;
      const feita = vendida ? passou : passou && n++ % 9 !== 4; // ~1 em 9 fica em atraso
      const acao = { id: crypto.randomUUID(), angariacao_id: a.id, nome: l.nome, dia: l.dia, follow_up: l.follow_up, feita, feita_em: feita ? new Date(quando.getTime() + 36e5 * 10).toISOString() : null, feedback: feita && (n + k) % 5 === 0 ? FEEDBACK[(n + k) % FEEDBACK.length] : null };
      if (vendida && !passou) continue; // vendida: o resto do plano já não interessa
      acoes.push(acao);
      tarefas.push({ ...tarefaDaAcao(acao as Acao, { inicio: a.inicio as string, titulo: a.titulo as string }), feita, feita_em: acao.feita_em });
    }
  });
  await inserir("angariacao_acoes", acoes);

  // --- tarefas e marcações do comprador e do proprietário ---
  const c = (nome: string) => comps[COMPRADORES.findIndex((x) => x.nome === nome)];
  const ct = (nome: string) => contC[COMPRADORES.findIndex((x) => x.nome === nome)];
  const p = (nome: string) => props[PROPRIETARIOS.findIndex((x) => x.nome === nome)];
  const pt = (nome: string) => contP[PROPRIETARIOS.findIndex((x) => x.nome === nome)];
  const doComprador = (nome: string, titulo: string, quando: Date, tipo: "tarefa" | "evento" = "tarefa", feita = false) => ({
    titulo,
    tipo,
    inicio: quando.toISOString(),
    feita,
    feita_em: feita ? quando.toISOString() : null,
    origem: "comprador",
    comprador_id: c(nome).id,
    contacto_id: ct(nome).id,
  });
  tarefas.push(
    doComprador("Ana Rita Fernandes", "Ligar a Ana Rita Fernandes: primeiras opções em Azurém", dias(0, 10)),
    doComprador("Marta Gonçalves", "Visita ao T3 em Creixomil com Marta Gonçalves", dias(0, 15, 30), "evento"),
    doComprador("André Sousa", "Saber resposta do proprietário à proposta do André Sousa", dias(0, 17)),
    doComprador("Catarina Pinto", "Enviar mais 2 opções na Maia a Catarina Pinto", dias(-1, 12)),
    doComprador("Beatriz Correia", "Segunda visita em Leça com Beatriz Correia", dias(2, 11), "evento"),
    doComprador("Diogo Antunes", "Escritura do Diogo Antunes", dias(19, 11), "evento"),
    doComprador("Rita Monteiro", "Pedir à Rita Monteiro o comprovativo do sinal", dias(0, 9, 30)),
    doComprador("Nuno Ribeiro", "Ponto de situação com Nuno Ribeiro (venda da casa dele)", dias(-3, 18)),
    doComprador("Paulo Azevedo", "Ligar a Paulo Azevedo (6 meses após a escritura)", dias(148, 9))
  );
  const reuniao = (nome: string, quando: Date, feita: boolean) => ({
    titulo: `Reunião de angariação: ${nome}`,
    tipo: "evento",
    inicio: quando.toISOString(),
    feita,
    feita_em: feita ? quando.toISOString() : null,
    origem: "proprietario",
    proprietario_id: p(nome).id,
    contacto_id: pt(nome).id,
    chave_automacao: `proprietario:${p(nome).id}:reuniao`,
  });
  tarefas.push(
    reuniao("Alberto Ramos", dias(1, 18, 30), false),
    reuniao("Lurdes Martins", dias(-6, 18, 30), true),
    {
      titulo: "Enviar Dossier Digital + página de Instagram a Lurdes Martins",
      tipo: "tarefa",
      inicio: dias(-4, 10).toISOString(),
      feita: true,
      feita_em: dias(-4, 12).toISOString(),
      origem: "proprietario",
      proprietario_id: p("Lurdes Martins").id,
      contacto_id: pt("Lurdes Martins").id,
      chave_automacao: `proprietario:${p("Lurdes Martins").id}:dossier`,
    },
    {
      titulo: "Partilhar um imóvel vendido com Lurdes Martins (exemplo, de forma natural)",
      tipo: "tarefa",
      inicio: dias(1, 10).toISOString(),
      feita: false,
      feita_em: null,
      origem: "proprietario",
      proprietario_id: p("Lurdes Martins").id,
      contacto_id: pt("Lurdes Martins").id,
      chave_automacao: `proprietario:${p("Lurdes Martins").id}:vendido`,
    },
    { titulo: "Primeiro contacto com Manuel Oliveira (anúncio no OLX)", tipo: "tarefa", inicio: dias(0, 11).toISOString(), feita: false, feita_em: null, origem: "proprietario", proprietario_id: p("Manuel Oliveira").id, contacto_id: pt("Manuel Oliveira").id }
  );
  await inserir("tarefas", tarefas);

  // --- chamadas: um histórico curto para os contactos ativos ---
  const notas = ["Atendeu, combinámos ver opções esta semana.", "Não atendeu, deixei mensagem.", "Confirmou a visita.", "Quer baixar o orçamento 10 mil.", "Pediu para ligar depois das 18h.", ""];
  const chamadas: Linha[] = [];
  [...contC, ...contP].forEach((k, i) => {
    const n = (i % 4) + 1;
    for (let j = 0; j < n; j++) chamadas.push({ contacto_id: k.id, ocorreu_em: dias(-(j * 4 + (i % 3)), 10 + ((i + j) % 8), (i * 7) % 60).toISOString(), observacoes: notas[(i + j) % notas.length] || null });
  });
  await inserir("chamadas", chamadas);

  // --- alertas de correspondência, com a regra da app ---
  const zonasDe = (cd: CompradorDemo): Zona[] => cd.zonas.map(([d, co, f]) => ({ distrito: d, concelho: co, freguesia: f }));
  const alertas: Linha[] = [];
  COMPRADORES.forEach((cd, i) => {
    if (!ESTADOS_A_PROCURAR.includes(cd.estado)) return;
    const perfil = { tipo_imovel: cd.tipo, tipologia_minima: cd.tipologia, expectativa_valor: cd.valor };
    angs.forEach((a, k) => {
      if (a.vendido_em) return;
      const im = { tipo_imovel: a.tipo_imovel as string, tipologia: a.tipologia as string, distrito: a.distrito as string, concelho: a.concelho as string, freguesia: a.freguesia as string, valor: Number(a.valor) };
      if (corresponde(perfil, zonasDe(cd), im)) alertas.push({ comprador_id: comps[i].id, angariacao_id: a.id, estado: (i + k) % 4 === 0 ? "faz_sentido" : "nova" });
    });
    PROPRIETARIOS.forEach((pd, k) => {
      if (pd.angariacao || pd.estado === "perdido") return;
      const im = { tipo_imovel: pd.tipo, tipologia: pd.tipologia, distrito: pd.zona[0], concelho: pd.zona[1], freguesia: pd.zona[2], valor: pd.valor };
      if (corresponde(perfil, zonasDe(cd), im)) alertas.push({ comprador_id: comps[i].id, proprietario_id: props[k].id, estado: "nova" });
    });
  });
  if (alertas.length) await inserir("correspondencias", alertas);

  // --- metas do ano, só se ainda não houver ---
  const ano = agora.getFullYear();
  const metas = await rest("GET", `metas?select=id&ano=eq.${ano}&limit=1${daEmpresa()}`);
  let metasCriadas = false;
  if (!metas.length) {
    await inserir("metas", [
      { ano, metrica: "visitas", valor_anual: 140 },
      { ano, metrica: "reunioes_angariacao", valor_anual: 60 },
      { ano, metrica: "angariacoes", valor_anual: 24 },
      { ano, metrica: "transacoes", valor_anual: 14 },
    ]);
    const cfg = await rest("GET", `metas_config?select=ano&ano=eq.${ano}${daEmpresa()}`);
    if (!cfg.length) await inserir("metas_config", [{ ano, semanas_uteis: 46, faturacao_anual: 75000 }]);
    metasCriadas = true;
  }

  console.log(
    [
      "Demonstração pronta:",
      `  ${comps.length} compradores (${COMPRADORES.filter((x) => x.cpcv).length} com CPCV, 1 negócio concluído)`,
      `  ${props.length} proprietários, ${angs.length} angariações (1 vendida) com ${acoes.length} ações no plano`,
      `  ${tarefas.length} tarefas e marcações, ${chamadas.length} chamadas, ${alertas.length} alertas de imóveis`,
      metasCriadas ? `  metas de ${ano} criadas` : `  metas de ${ano} já existiam, ficaram como estavam`,
      "Para apagar: npx tsx --tsconfig tsconfig.json scripts/demo.ts --limpar",
    ].join("\n")
  );
}

(process.argv.includes("--limpar") ? limpar() : semear()).catch((e) => {
  console.error(String(e));
  process.exit(1);
});
