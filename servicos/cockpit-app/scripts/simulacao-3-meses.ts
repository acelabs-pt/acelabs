// Simulação de 3 meses de uso do Cockpit: gera um ficheiro SQL (simulacao_3_meses.sql) para colar no SQL Editor do
// Supabase. Todos os dados são FICTÍCIOS: emails @exemplo.pt e telemóveis +351 900 000 xxx (é por aí que se apagam).
// Nunca toca em registos que já existam: só insere. A empresa vem do contacto do João Carvalho (base multiempresa).
//
//   npx tsx --tsconfig tsconfig.json scripts/simulacao-3-meses.ts
//
// Para apagar a simulação no fim: ver o bloco LIMPAR no topo do ficheiro gerado.
import { writeFileSync } from "node:fs";
import { ACOES_PADRAO, dataDoDia, linhasDoPlano, tarefaDaAcao, type Acao } from "@/lib/angariacao";
import { ESTADOS_A_PROCURAR, corresponde, type Zona } from "@/lib/oportunidades";
import { concelhosDe, freguesiasDe } from "@/lib/localizacoes";

const EMAIL_REAL = "iamjoaocarvalho@gmail.com"; // dono da empresa a usar (e do único registo real, que não se toca)

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------
type Linha = Record<string, unknown>;
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
const uuid = () => crypto.randomUUID();
let seq = 100;
const tel = () => `+351900000${seq++}`;
const email = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 60) + "@exemplo.pt";

const lit = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};
const contagens: Record<string, number> = {};
function inserir(tabela: string, linhas: Linha[]): string {
  if (!linhas.length) return "";
  contagens[tabela] = (contagens[tabela] ?? 0) + linhas.length;
  const cols = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const partes: string[] = [];
  for (let i = 0; i < linhas.length; i += 150) {
    const lote = linhas.slice(i, i + 150).map((l) => `(${cols.map((c) => lit(l[c])).join(", ")}, v_empresa)`);
    partes.push(`insert into ${tabela} (${cols.join(", ")}, empresa_id) values\n${lote.join(",\n")};`);
  }
  return partes.join("\n");
}

function validarZona([d, c, f]: ZonaDemo) {
  if (c && !concelhosDe(d).includes(c)) throw new Error(`Concelho inválido: ${d}/${c}`);
  if (c && f && !freguesiasDe(d, c).includes(f)) throw new Error(`Freguesia inválida: ${d}/${c}/${f}`);
}

// ---------------------------------------------------------------------------
// Dados fictícios
// ---------------------------------------------------------------------------
type ZonaDemo = [string, string | null, string | null];
type ImovelDemo = {
  descricao?: string;
  ang?: string; // chave de uma angariação simulada
  enviado: number;
  visitado?: number;
  visitaObs?: string;
  proposta?: number;
  propostaObs?: string;
  semInteresse?: number;
};
type CompradorDemo = {
  nome: string;
  canal: string;
  estado: string;
  desde: number; // dias desde que está nesta fase (negativo)
  criado?: number;
  motivacao: number | null;
  tipo: string;
  tipologia: string;
  valor: number;
  financiamento: string;
  precisaVender: boolean;
  zonas: ZonaDemo[];
  imoveis?: ImovelDemo[];
  notas?: string;
  semTelemovel?: boolean;
  cpcv?: { data: number; escrituraPrazo: number; valorNegocio: number; comissao: number; escrituraAgendada?: number };
  concluido?: { recebidaHa: number; valorNegocio: number; comissao: number };
};

const COMPRADORES: CompradorDemo[] = [
  { nome: "Ana Rita Fernandes", canal: "Idealista", estado: "lead_qualificada", desde: -2, motivacao: 8, tipo: "Apartamento", tipologia: "T2", valor: 230000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Guimarães", "Azurém"], ["Braga", "Guimarães", "Creixomil"]], notas: "Trabalha na Universidade do Minho. Quer perto do campus de Azurém." },
  { nome: "João Pedro Machado", canal: "Meta", estado: "lead_qualificada", desde: -5, motivacao: 6, tipo: "Moradia", tipologia: "T3", valor: 340000, financiamento: "Vai pedir crédito", precisaVender: true, zonas: [["Braga", "Braga", null]], notas: "Tem de vender o T2 em Fraião primeiro." },
  { nome: "Sofia Carvalho", canal: "Site da imobiliária", estado: "lead_qualificada", desde: -1, motivacao: 9, tipo: "Apartamento", tipologia: "T3", valor: 290000, financiamento: "Capitais próprios", precisaVender: false, zonas: [["Porto", "Matosinhos", "Leça da Palmeira"], ["Porto", "Maia", null]] },
  { nome: "Tiago Moreira", canal: "Idealista", estado: "lead_qualificada", desde: -16, motivacao: 4, tipo: "Apartamento", tipologia: "T1", valor: 150000, financiamento: "Vai pedir crédito", precisaVender: false, zonas: [["Braga", "Braga", "Gualtar"]], notas: "Primeira casa. Ainda a juntar para a entrada." },
  { nome: "Telmo Santos", canal: "Placa", estado: "lead_qualificada", desde: -41, criado: -52, motivacao: 3, tipo: "Apartamento", tipologia: "T2", valor: 180000, financiamento: "Vai pedir crédito", precisaVender: false, zonas: [["Braga", "Guimarães", null]], notas: "Parado há mais de um mês, sem resposta às mensagens." },
  { nome: "Maria Conceição de Albuquerque e Vasconcelos Pimentel", canal: "Referência", estado: "lead_qualificada", desde: -3, motivacao: 7, tipo: "Apartamento", tipologia: "T3", valor: 320000, financiamento: "Capitais próprios", precisaVender: false, zonas: [["Braga", "Guimarães", "Urgezes"]], notas: "Nome longo de propósito, para testar o ecrã." },
  { nome: "Inês Barbosa", canal: "Referência", estado: "imoveis_enviados", desde: -4, motivacao: 7, tipo: "Apartamento", tipologia: "T2", valor: 210000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Guimarães", null]], imoveis: [{ descricao: "T2 com varanda em Creixomil", enviado: -4 }, { descricao: "T2 renovado no centro histórico", enviado: -3 }, { descricao: "T2 com garagem em Urgezes", enviado: -1 }] },
  { nome: "Ricardo Lopes", canal: "Imovirtual", estado: "imoveis_enviados", desde: -9, motivacao: 5, tipo: "Moradia", tipologia: "T4", valor: 420000, financiamento: "Capitais próprios", precisaVender: true, zonas: [["Braga", "Vila Nova de Famalicão", null], ["Braga", "Braga", null]], imoveis: [{ descricao: "Moradia T4 com jardim em Brufe", enviado: -9 }, { descricao: "Moradia isolada em Cavalões", enviado: -8 }] },
  { nome: "Catarina Pinto", canal: "Meta", estado: "imoveis_enviados", desde: -2, motivacao: 8, tipo: "Apartamento", tipologia: "T3", valor: 310000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Porto", "Maia", "Cidade da Maia"]], imoveis: [{ descricao: "T3 novo na Cidade da Maia", enviado: -2 }] },
  { nome: "Hugo Teixeira", canal: "Placa", estado: "imoveis_enviados", desde: -6, motivacao: 6, tipo: "Apartamento", tipologia: "T2", valor: 195000, financiamento: "Vai pedir crédito", precisaVender: false, zonas: [["Braga", "Barcelos", null]], imoveis: [{ descricao: "T2 junto ao rio em Barcelos", enviado: -6 }, { descricao: "T2 com terraço em Arcozelo", enviado: -5 }] },
  { nome: "Rui Cunha", canal: "Meta", estado: "imoveis_enviados", desde: -7, motivacao: null, tipo: "Apartamento", tipologia: "T2", valor: 200000, financiamento: "Por definir", precisaVender: false, zonas: [], semTelemovel: true, notas: "Sem zona e sem telemóvel de propósito (só email), para testar os vazios.", imoveis: [{ descricao: "T2 em Fafe", enviado: -7 }] },
  { nome: "Daniela Pires", canal: "Idealista", estado: "imoveis_enviados", desde: -26, criado: -38, motivacao: 4, tipo: "Apartamento", tipologia: "T2", valor: 215000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Braga", "Gualtar"]], imoveis: [{ descricao: "T2 em Gualtar com vista", enviado: -26 }, { descricao: "T2 junto ao Sporting de Braga", enviado: -25 }] },
  { nome: "Marta Gonçalves", canal: "Idealista", estado: "visitas_realizadas", desde: -3, motivacao: 9, tipo: "Apartamento", tipologia: "T3", valor: 280000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Guimarães", "Azurém"]], imoveis: [{ ang: "a1", enviado: -12, visitado: -3, visitaObs: "Gostou da luz e da cozinha. Vai falar com o banco." }, { descricao: "T3 com lugar de garagem em Azurém", enviado: -10, visitado: -3 }, { descricao: "T3 a estrear em Creixomil", enviado: -8 }], notas: "Gostou muito do 3.º andar. Vai falar com o banco." },
  { nome: "Filipa Neves", canal: "Referência", estado: "visitas_realizadas", desde: -8, motivacao: 7, tipo: "Apartamento", tipologia: "T3", valor: 295000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Guimarães", "Azurém"]], imoveis: [{ ang: "a1", enviado: -15, visitado: -8, visitaObs: "Acha o preço ligeiramente alto. Pediu para rever com o marido." }] },
  { nome: "Leonor Brito", canal: "Meta", estado: "visitas_realizadas", desde: -8, motivacao: 5, tipo: "Apartamento", tipologia: "T3", valor: 290000, financiamento: "Vai pedir crédito", precisaVender: false, zonas: [["Braga", "Guimarães", null]], imoveis: [{ ang: "a1", enviado: -14, visitado: -8, visitaObs: "Visita no mesmo dia da Filipa Neves. Gostou, mas acha pequeno." }] },
  { nome: "Nuno Ribeiro", canal: "Site da imobiliária", estado: "visitas_realizadas", desde: -11, motivacao: 5, tipo: "Moradia", tipologia: "T3", valor: 360000, financiamento: "Vai pedir crédito", precisaVender: true, zonas: [["Braga", "Braga", "Esporões"], ["Braga", "Braga", "Adaúfe"]], imoveis: [{ descricao: "Moradia em banda em Esporões", enviado: -20, visitado: -11 }, { descricao: "Moradia T3 com piscina em Adaúfe", enviado: -18, visitado: -12 }] },
  { nome: "Beatriz Correia", canal: "Meta", estado: "visitas_realizadas", desde: -5, motivacao: 7, tipo: "Apartamento", tipologia: "T2", valor: 240000, financiamento: "Capitais próprios", precisaVender: false, zonas: [["Porto", "Matosinhos", null]], imoveis: [{ ang: "a3", enviado: -14, visitado: -5, visitaObs: "Adorou a vista mar. Quer voltar com a mãe." }] },
  { nome: "Marco Dias", canal: "Placa", estado: "visitas_realizadas", desde: -15, motivacao: 3, tipo: "Apartamento", tipologia: "T2", valor: 235000, financiamento: "Vai pedir crédito", precisaVender: false, zonas: [["Porto", "Matosinhos", "Leça da Palmeira"]], imoveis: [{ ang: "a3", enviado: -22, visitado: -15, visitaObs: "Barulho da estrada incomodou.", semInteresse: -14 }] },
  { nome: "Luís Ferreira", canal: "Idealista", estado: "visitas_realizadas", desde: -4, motivacao: 8, tipo: "Apartamento", tipologia: "T3", valor: 270000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Braga", "Gualtar"]], imoveis: [{ ang: "a5", enviado: -18, visitado: -9, visitaObs: "Muito interessado.", proposta: -4, propostaObs: "Proposta de 255 000 EUR, aguarda resposta." }], notas: "Visita e proposta ao mesmo imóvel, para testar o estado." },
  { nome: "André Sousa", canal: "Referência", estado: "propostas_efetuadas", desde: -2, motivacao: 9, tipo: "Apartamento", tipologia: "T2", valor: 225000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Braga", "Braga (São Vítor)"]], imoveis: [{ descricao: "T2 em São Vítor, perto da universidade", enviado: -25, visitado: -15, proposta: -2, propostaObs: "Proposta de 215 000 EUR. Proprietário responde até sexta." }, { descricao: "T2 renovado em São Vítor", enviado: -22, visitado: -15 }], notas: "Proposta de 215 000 €. Proprietário responde até sexta." },
  { nome: "Joana Faria", canal: "Idealista", estado: "propostas_efetuadas", desde: -6, motivacao: 8, tipo: "Moradia", tipologia: "T4", valor: 450000, financiamento: "Capitais próprios", precisaVender: true, zonas: [["Braga", "Guimarães", "Caldelas"]], imoveis: [{ descricao: "Moradia T4 em Caldelas com terreno", enviado: -30, visitado: -20, proposta: -6 }] },
  { nome: "Gonçalo Vaz", canal: "Site da imobiliária", estado: "propostas_efetuadas", desde: -10, motivacao: 8, tipo: "Moradia", tipologia: "T4", valor: 420000, financiamento: "Capitais próprios", precisaVender: false, zonas: [["Braga", "Vila Nova de Famalicão", "Brufe"]], imoveis: [{ ang: "a2", enviado: -30, visitado: -20, visitaObs: "Veio com o arquiteto.", proposta: -10, propostaObs: "Proposta de 385 000 EUR, contraproposta a 400 000." }] },
  { nome: "Diogo Antunes", canal: "Imovirtual", estado: "cpcv", desde: -18, motivacao: 10, tipo: "Apartamento", tipologia: "T3", valor: 265000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Braga", "Gualtar"]], imoveis: [{ descricao: "T3 em Gualtar com arrecadação", enviado: -50, visitado: -40, proposta: -30 }], cpcv: { data: -18, escrituraPrazo: 22, valorNegocio: 258000, comissao: 7740, escrituraAgendada: 19 } },
  { nome: "Rita Monteiro", canal: "Site da imobiliária", estado: "cpcv", desde: -40, motivacao: 9, tipo: "Moradia", tipologia: "T3", valor: 330000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Vila Nova de Famalicão", null]], imoveis: [{ descricao: "Moradia T3 em Cabeçudos", enviado: -80, visitado: -70, proposta: -60 }], cpcv: { data: -40, escrituraPrazo: 9, valorNegocio: 318000, comissao: 9540 } },
  { nome: "Helder Cruz", canal: "Meta", estado: "escritura", desde: -6, motivacao: 10, tipo: "Apartamento", tipologia: "T2", valor: 190000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Guimarães", "Creixomil"]], imoveis: [{ descricao: "T2 em Creixomil com varanda", enviado: -75, visitado: -65, proposta: -55 }], cpcv: { data: -45, escrituraPrazo: 3, valorNegocio: 183000, comissao: 5490, escrituraAgendada: 3 } },
  { nome: "Paulo Azevedo", canal: "Referência", estado: "negocio_concluido", desde: -35, motivacao: 10, tipo: "Apartamento", tipologia: "T2", valor: 200000, financiamento: "Capitais próprios", precisaVender: false, zonas: [["Braga", "Guimarães", "Creixomil"]], imoveis: [{ descricao: "T2 em Creixomil, 1.º andar", enviado: -85, visitado: -80, proposta: -75 }], concluido: { recebidaHa: 35, valorNegocio: 192000, comissao: 5760 } },
  { nome: "Cátia Rocha", canal: "Placa", estado: "negocio_concluido", desde: -62, motivacao: 10, tipo: "Moradia", tipologia: "T3", valor: 295000, financiamento: "Crédito pré-aprovado", precisaVender: false, zonas: [["Braga", "Barcelos", null]], imoveis: [{ descricao: "Moradia T3 em Barcelos", enviado: -88, visitado: -84, proposta: -80 }], concluido: { recebidaHa: 62, valorNegocio: 288000, comissao: 8640 } },
  { nome: "Sérgio Matos", canal: "Meta", estado: "perdido", desde: -45, criado: -78, motivacao: 2, tipo: "Apartamento", tipologia: "T2", valor: 160000, financiamento: "Vai pedir crédito", precisaVender: false, zonas: [["Braga", "Braga", null]], notas: "Crédito recusado pelo banco." },
  { nome: "Vera Lima", canal: "Idealista", estado: "perdido", desde: -70, criado: -88, motivacao: 3, tipo: "Moradia", tipologia: "T3", valor: 300000, financiamento: "Vai pedir crédito", precisaVender: true, zonas: [["Braga", "Guimarães", null]], notas: "Comprou com outra agência." },
  { nome: "Bruno Peixoto", canal: "Referência", estado: "perdido", desde: -20, criado: -55, motivacao: 5, tipo: "Apartamento", tipologia: "T3", valor: 250000, financiamento: "Capitais próprios", precisaVender: false, zonas: [["Porto", "Maia", null]], imoveis: [{ descricao: "T3 na Maia", enviado: -45, visitado: -35, semInteresse: -30 }], notas: "Desistiu da compra." },
];

type ProprietarioDemo = {
  nome: string;
  canal: string;
  estado: string;
  desde: number;
  criado?: number;
  tipo: string | null;
  tipologia: string | null;
  valor: number | null;
  zona: ZonaDemo;
  reuniao?: number; // dias a partir de hoje
  notas?: string;
  ang?: string; // chave da angariação simulada
};

const PROPRIETARIOS: ProprietarioDemo[] = [
  { nome: "Manuel Oliveira", canal: "Placa", estado: "fsbo", desde: -3, tipo: "Apartamento", tipologia: "T2", valor: 215000, zona: ["Braga", "Guimarães", "Creixomil"], notas: "Anúncio próprio no OLX há 2 meses. Aberto a conversar." },
  { nome: "Fernanda Costa", canal: "Idealista", estado: "fsbo", desde: -8, tipo: "Moradia", tipologia: "T4", valor: 395000, zona: ["Braga", "Braga", "Esporões"] },
  { nome: "Cláudia Mota", canal: "Meta", estado: "fsbo", desde: -14, tipo: null, tipologia: null, valor: null, zona: ["Braga", "Barcelos", null], notas: "Sem tipologia nem valor de propósito, para testar os vazios." },
  { nome: "Alberto Ramos", canal: "Referência", estado: "reuniao_marcada", desde: -2, tipo: "Apartamento", tipologia: "T3", valor: 275000, zona: ["Braga", "Guimarães", "Azurém"], reuniao: 1 },
  { nome: "Joaquim Pereira", canal: "Placa", estado: "reuniao_angariacao", desde: -1, tipo: "Moradia", tipologia: "T3", valor: 340000, zona: ["Braga", "Braga", "Adaúfe"], reuniao: -1 },
  { nome: "Lurdes Martins", canal: "Idealista", estado: "dossier_enviado", desde: -4, tipo: "Apartamento", tipologia: "T3", valor: 305000, zona: ["Porto", "Matosinhos", "Leça da Palmeira"], reuniao: -6 },
  { nome: "Isabel Meireles", canal: "Site da imobiliária", estado: "follow_up_1", desde: -17, criado: -30, tipo: "Apartamento", tipologia: "T2", valor: 225000, zona: ["Braga", "Braga", "Gualtar"], reuniao: -17 },
  { nome: "Armindo Costa", canal: "Meta", estado: "perdido", desde: -60, criado: -85, tipo: "Moradia", tipologia: "T4", valor: 480000, zona: ["Braga", "Guimarães", "Caldelas"], notas: "Preferiu outra agência (comissão mais baixa)." },
  { nome: "Carlos Vieira", canal: "Placa", estado: "angariado", desde: -12, tipo: "Apartamento", tipologia: "T3", valor: 285000, zona: ["Braga", "Guimarães", "Azurém"], ang: "a1" },
  { nome: "Teresa Mendes", canal: "Meta", estado: "angariado", desde: -47, tipo: "Moradia", tipologia: "T4", valor: 410000, zona: ["Braga", "Vila Nova de Famalicão", "Brufe"], ang: "a2" },
  { nome: "José Araújo", canal: "Referência", estado: "angariado", desde: -96, criado: -110, tipo: "Apartamento", tipologia: "T2", valor: 235000, zona: ["Porto", "Matosinhos", "Leça da Palmeira"], ang: "a3" },
  { nome: "Graça Fonseca", canal: "Site da imobiliária", estado: "angariado", desde: -140, criado: -150, tipo: "Apartamento", tipologia: "T2", valor: 198000, zona: ["Braga", "Guimarães", "Creixomil"], ang: "a4" },
  { nome: "Helena Sampaio", canal: "Referência", estado: "angariado", desde: -70, criado: -80, tipo: "Apartamento", tipologia: "T3", valor: 265000, zona: ["Braga", "Braga", "Gualtar"], ang: "a5" },
  { nome: "Rui Barros", canal: "Placa", estado: "angariado", desde: -5, tipo: "Apartamento", tipologia: "T2", valor: 205000, zona: ["Braga", "Guimarães", "Creixomil"], ang: "a6" },
];

type AngDemo = {
  chave: string;
  tipo: string;
  tipologia: string;
  zona: ZonaDemo;
  valor: number;
  inicioHa: number;
  regime: "exclusivo" | "nao_exclusivo";
  referencia: string | null;
  vendidaHa?: number;
  comissao?: number;
  semProprietario?: boolean;
  plano: "normal" | "atrasado" | "inicial" | "nenhum";
};
const ANGARIACOES: AngDemo[] = [
  { chave: "a1", tipo: "Apartamento", tipologia: "T3", zona: ["Braga", "Guimarães", "Azurém"], valor: 285000, inicioHa: 12, regime: "exclusivo", referencia: "REF-2041", plano: "normal" },
  { chave: "a2", tipo: "Moradia", tipologia: "T4", zona: ["Braga", "Vila Nova de Famalicão", "Brufe"], valor: 410000, inicioHa: 47, regime: "exclusivo", referencia: "REF-2017", plano: "normal" },
  { chave: "a3", tipo: "Apartamento", tipologia: "T2", zona: ["Porto", "Matosinhos", "Leça da Palmeira"], valor: 235000, inicioHa: 96, regime: "nao_exclusivo", referencia: "REF-1988", plano: "atrasado" },
  { chave: "a4", tipo: "Apartamento", tipologia: "T2", zona: ["Braga", "Guimarães", "Creixomil"], valor: 198000, inicioHa: 140, regime: "exclusivo", referencia: "REF-1950", vendidaHa: 30, comissao: 5940, plano: "normal" },
  { chave: "a5", tipo: "Apartamento", tipologia: "T3", zona: ["Braga", "Braga", "Gualtar"], valor: 265000, inicioHa: 70, regime: "exclusivo", referencia: null, plano: "inicial" },
  { chave: "a6", tipo: "Apartamento", tipologia: "T2", zona: ["Braga", "Guimarães", "Creixomil"], valor: 205000, inicioHa: 5, regime: "exclusivo", referencia: "REF-2072", plano: "nenhum" },
  { chave: "a7", tipo: "Moradia", tipologia: "T3", zona: ["Braga", "Barcelos", null], valor: 245000, inicioHa: 25, regime: "nao_exclusivo", referencia: "REF-2063", semProprietario: true, plano: "normal" },
];
const tituloAng = (a: AngDemo) => [a.tipologia, a.zona[1], a.zona[2]].filter(Boolean).join(", ");

const FEEDBACK = [
  "Duas visitas esta semana, gostaram da luz.",
  "Fotografias novas com o dia de sol.",
  "Três contactos pelo portal, um quer visitar.",
  "Visita do casal de Braga: acham o preço alto.",
  "Open house com 6 visitas.",
  "Partilhado em 4 agências parceiras.",
];

// ---------------------------------------------------------------------------
// Gerar
// ---------------------------------------------------------------------------
for (const c of COMPRADORES) c.zonas.forEach(validarZona);
for (const p of PROPRIETARIOS) validarZona(p.zona);
for (const a of ANGARIACOES) validarZona(a.zona);

const blocos: string[] = [];

// contactos
const contC = COMPRADORES.map((c) => ({
  id: uuid(),
  nome: c.nome,
  telemovel: c.semTelemovel ? null : tel(),
  email: email(c.nome),
  canal_origem: c.canal,
  observacoes: c.notas ?? null,
  created_at: dias(c.criado ?? c.desde - 10).toISOString(),
}));
const contP = PROPRIETARIOS.map((p) => ({
  id: uuid(),
  nome: p.nome,
  telemovel: tel(),
  email: email(p.nome),
  canal_origem: p.canal,
  observacoes: p.notas ?? null,
  created_at: dias(p.criado ?? p.desde - 15).toISOString(),
}));
blocos.push("-- contactos", inserir("contactos", [...contC, ...contP]));

// compradores
const comps = COMPRADORES.map((c, i) => ({
  id: uuid(),
  contacto_id: contC[i].id,
  estado: c.estado,
  estado_desde: dias(c.desde, 11).toISOString(),
  motivacao: c.motivacao,
  tipo_imovel: c.tipo,
  tipologia_minima: c.tipologia,
  expectativa_valor: c.valor,
  financiamento: c.financiamento,
  simulacao_credito: c.financiamento === "Capitais próprios" ? "Não aplicável" : (c.motivacao ?? 0) >= 8 ? "Feita" : "Por fazer",
  precisa_vender: c.precisaVender,
  distrito: c.zonas[0]?.[0] ?? null,
  concelho: c.zonas[0]?.[1] ?? null,
  freguesia: c.zonas[0]?.[2] ?? null,
  cpcv_fechado: !!c.cpcv || !!c.concluido,
  cpcv_data: c.cpcv ? dia(c.cpcv.data) : c.concluido ? dia(-c.concluido.recebidaHa - 45) : null,
  escritura_agendada: !!c.cpcv?.escrituraAgendada || !!c.concluido,
  escritura_data: c.cpcv?.escrituraAgendada ? dia(c.cpcv.escrituraAgendada) : c.concluido ? dia(-c.concluido.recebidaHa) : null,
  escritura_prazo: c.cpcv ? dia(c.cpcv.escrituraPrazo) : null,
  valor_negocio: c.cpcv?.valorNegocio ?? c.concluido?.valorNegocio ?? null,
  comissao_valor: c.cpcv?.comissao ?? c.concluido?.comissao ?? null,
  comissao_recebida: !!c.concluido,
  comissao_recebida_em: c.concluido ? dia(-c.concluido.recebidaHa) : null,
}));
blocos.push("-- compradores", inserir("compradores", comps));
blocos.push(
  "-- zonas dos compradores",
  inserir(
    "comprador_zonas",
    COMPRADORES.flatMap((c, i) => c.zonas.map(([d, co, f]) => ({ comprador_id: comps[i].id, distrito: d, concelho: co, freguesia: f })))
  )
);

// proprietários
const props = PROPRIETARIOS.map((p, i) => ({
  id: uuid(),
  contacto_id: contP[i].id,
  estado: p.estado,
  estado_desde: dias(p.desde, 11).toISOString(),
  tipo_imovel: p.tipo,
  tipologia: p.tipologia,
  valor: p.valor,
  distrito: p.zona[0],
  concelho: p.zona[1],
  freguesia: p.zona[2],
  reuniao_em: p.reuniao != null ? dias(p.reuniao, 18, 30).toISOString() : p.ang ? dias(-(ANGARIACOES.find((a) => a.chave === p.ang)!.inicioHa) - 5, 18).toISOString() : null,
}));
blocos.push("-- proprietários", inserir("proprietarios", props));

// angariações
const angs = ANGARIACOES.map((a) => {
  const idxP = PROPRIETARIOS.findIndex((p) => p.ang === a.chave);
  return {
    def: a,
    id: uuid(),
    linha: {
      proprietario_id: a.semProprietario || idxP < 0 ? null : props[idxP].id,
      titulo: tituloAng(a),
      referencia: a.referencia,
      duracao_dias: 180,
      regime: a.regime,
      inicio: dia(-a.inicioHa),
      vendido_em: a.vendidaHa != null ? dia(-a.vendidaHa) : null,
      valor_negocio: a.vendidaHa != null ? a.valor - 6000 : null,
      comissao_valor: a.comissao ?? null,
      comissao_recebida: a.vendidaHa != null,
      comissao_recebida_em: a.vendidaHa != null ? dia(-a.vendidaHa + 10) : null,
      tipo_imovel: a.tipo,
      tipologia: a.tipologia,
      distrito: a.zona[0],
      concelho: a.zona[1],
      freguesia: a.zona[2],
      valor: a.valor,
    },
  };
});
blocos.push("-- angariações", inserir("angariacoes", angs.map((a) => ({ id: a.id, ...a.linha }))));
const angPorChave = (k: string) => angs.find((a) => a.def.chave === k)!;

// planos das angariações + tarefas do calendário
const nomes = ACOES_PADRAO.map((a) => a.nome);
const hoje0 = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
const acoes: Linha[] = [];
const tarefas: Linha[] = [];
angs.forEach((a, k) => {
  if (a.def.plano === "nenhum") return;
  const vendidaEm = a.def.vendidaHa != null ? dias(-a.def.vendidaHa) : null;
  let n = 0;
  for (const l of linhasDoPlano(nomes, true, 180)) {
    const quando = dataDoDia(a.linha.inicio, l.dia);
    const passou = quando < hoje0;
    if (vendidaEm && quando > vendidaEm) continue; // vendida: o resto do plano já não interessa
    const i = n++;
    const feita = passou && (a.def.plano === "atrasado" ? i % 3 !== 1 : a.def.plano === "inicial" ? i % 2 === 0 : i % 9 !== 4);
    const acao = {
      id: uuid(),
      angariacao_id: a.id,
      nome: l.nome,
      dia: l.dia,
      follow_up: l.follow_up,
      feita,
      feita_em: feita ? new Date(quando.getTime() + 36e5 * 10).toISOString() : null,
      feedback: feita && (i + k) % 5 === 0 ? FEEDBACK[(i + k) % FEEDBACK.length] : null,
    };
    acoes.push(acao);
    tarefas.push({ ...tarefaDaAcao(acao as Acao, { inicio: a.linha.inicio, titulo: a.linha.titulo }), feita, feita_em: acao.feita_em });
  }
});
blocos.push("-- ações dos planos", inserir("angariacao_acoes", acoes));

// imóveis dos compradores (com ligação a angariações, observações, sem interesse)
const imoveis: Linha[] = COMPRADORES.flatMap((c, i) =>
  (c.imoveis ?? []).map((m) => ({
    comprador_id: comps[i].id,
    angariacao_id: m.ang ? angPorChave(m.ang).id : null,
    descricao: m.ang ? angPorChave(m.ang).linha.titulo : m.descricao ?? null,
    enviado_em: dia(m.enviado),
    visitado_em: m.visitado != null ? dia(m.visitado) : null,
    visita_obs: m.visitaObs ?? null,
    proposta_em: m.proposta != null ? dia(m.proposta) : null,
    proposta_obs: m.propostaObs ?? null,
    sem_interesse_em: m.semInteresse != null ? dia(m.semInteresse) : null,
  }))
);
blocos.push("-- imóveis dos compradores", inserir("comprador_imoveis", imoveis));

// visitas e propostas de clientes de outros consultores
blocos.push(
  "-- visitas e propostas de clientes de outros consultores",
  inserir("visitas_externas", [
    { angariacao_id: angPorChave("a1").id, consultor: "Marta Bessa", data: dia(-7), obs: "Casal jovem, gostou mas vai ver mais opções." },
    { angariacao_id: angPorChave("a1").id, consultor: "Rodrigo Valente", data: dia(-4), obs: null },
    { angariacao_id: angPorChave("a2").id, consultor: "Marta Bessa", data: dia(-20), obs: "Investidor, quer ver a rentabilidade." },
    { angariacao_id: angPorChave("a3").id, consultor: "Paula Ventura", data: dia(-33), obs: "Achou o preço alto." },
  ]),
  inserir("propostas_externas", [
    { angariacao_id: angPorChave("a1").id, consultor: "Rodrigo Valente", data: dia(-2), obs: "Proposta de 270 000 EUR, abaixo do pedido." },
    { angariacao_id: angPorChave("a3").id, consultor: "Paula Ventura", data: dia(-28), obs: "Proposta recusada pelo proprietário." },
  ])
);

// documentos da escritura (CPCV e escritura)
const docs = ["Cartão de Cidadão dos compradores", "Comprovativo de morada", "Aprovação do crédito", "Comprovativo do sinal", "Certidão de casamento"];
blocos.push(
  "-- documentos da escritura",
  inserir(
    "comprador_documentos",
    COMPRADORES.flatMap((c, i) => (c.cpcv ? docs.map((nome, k) => ({ comprador_id: comps[i].id, nome, entregue: k < (c.cpcv!.escrituraPrazo < 15 ? 3 : 2) })) : []))
  )
);

// tarefas dos compradores e proprietários: histórico dos 3 meses (feitas) + o que está por fazer esta semana
const doComprador = (i: number, titulo: string, quando: Date, tipo: "tarefa" | "evento" = "tarefa", feita = false): Linha => ({
  titulo,
  tipo,
  inicio: quando.toISOString(),
  feita,
  feita_em: feita ? quando.toISOString() : null,
  origem: "comprador",
  comprador_id: comps[i].id,
  contacto_id: contC[i].id,
});
const doProp = (i: number, titulo: string, quando: Date, tipo: "tarefa" | "evento" = "tarefa", feita = false, chave: string | null = null): Linha => ({
  titulo,
  tipo,
  inicio: quando.toISOString(),
  feita,
  feita_em: feita ? quando.toISOString() : null,
  origem: "proprietario",
  proprietario_id: props[i].id,
  contacto_id: contP[i].id,
  chave_automacao: chave,
});
COMPRADORES.forEach((c, i) => {
  const ativo = ESTADOS_A_PROCURAR.includes(c.estado) || c.estado === "cpcv" || c.estado === "escritura";
  const antigas = c.estado === "perdido" ? 1 : (i % 3) + 2; // histórico feito
  for (let j = 0; j < antigas; j++) {
    tarefas.push(doComprador(i, `Ligar a ${c.nome.split(" ").slice(0, 2).join(" ")}: ponto de situação`, dias(-(8 + j * 17 + (i % 6)), 10 + (j % 6)), "tarefa", true));
  }
  if (ativo && i % 2 === 0) tarefas.push(doComprador(i, `Seguimento com ${c.nome.split(" ").slice(0, 2).join(" ")}`, dias((i % 6) - 1, 10 + (i % 7))));
  if (ativo && i % 5 === 0) tarefas.push(doComprador(i, `Enviar novas opções a ${c.nome.split(" ").slice(0, 2).join(" ")}`, dias(-(3 + (i % 5)), 12))); // em atraso
});
tarefas.push(
  doComprador(COMPRADORES.findIndex((x) => x.nome === "Marta Gonçalves"), "Visita ao T3 em Creixomil com Marta Gonçalves", dias(0, 15, 30), "evento"),
  doComprador(COMPRADORES.findIndex((x) => x.nome === "Beatriz Correia"), "Segunda visita em Leça com Beatriz Correia", dias(2, 11), "evento"),
  doComprador(COMPRADORES.findIndex((x) => x.nome === "Diogo Antunes"), "Escritura do Diogo Antunes", dias(19, 11), "evento"),
  doComprador(COMPRADORES.findIndex((x) => x.nome === "Helder Cruz"), "Escritura do Helder Cruz", dias(3, 10), "evento"),
  doComprador(COMPRADORES.findIndex((x) => x.nome === "Rita Monteiro"), "Pedir à Rita Monteiro o comprovativo do sinal", dias(0, 9, 30)),
  doComprador(COMPRADORES.findIndex((x) => x.nome === "Paulo Azevedo"), "Ligar a Paulo Azevedo (6 meses após a escritura)", dias(148, 9))
);
PROPRIETARIOS.forEach((p, i) => {
  if (p.estado === "perdido") {
    tarefas.push(doProp(i, `Primeiro contacto com ${p.nome}`, dias(p.desde - 12, 11), "tarefa", true));
    return;
  }
  tarefas.push(doProp(i, `Primeiro contacto com ${p.nome}`, dias(p.desde - 10, 11), "tarefa", true));
  if (p.reuniao != null) {
    const passada = p.reuniao < 0;
    tarefas.push(doProp(i, `Reunião de angariação: ${p.nome}`, dias(p.reuniao, 18, 30), "evento", passada, `proprietario:${props[i].id}:reuniao`));
  }
  if (p.estado === "dossier_enviado") {
    tarefas.push(doProp(i, `Enviar Dossier Digital + página de Instagram a ${p.nome}`, dias(-4, 10), "tarefa", true, `proprietario:${props[i].id}:dossier`));
    tarefas.push(doProp(i, `Partilhar um imóvel vendido com ${p.nome} (exemplo, de forma natural)`, dias(1, 10), "tarefa", false, `proprietario:${props[i].id}:vendido`));
  }
  if (p.estado === "follow_up_1") tarefas.push(doProp(i, `Follow up com ${p.nome} (14 dias)`, dias(-2, 10), "tarefa", false, `proprietario:${props[i].id}:followup1`));
  if (p.estado === "fsbo") tarefas.push(doProp(i, `Contactar ${p.nome} (anúncio próprio)`, dias(i % 3, 11)));
});
blocos.push("-- tarefas e calendário", inserir("tarefas", tarefas));

// chamadas: histórico dos 90 dias; alguns contactos sem chamadas, outros com a última há mais de 14 dias
const notas = ["Atendeu, combinámos ver opções esta semana.", "Não atendeu, deixei mensagem.", "Confirmou a visita.", "Quer baixar o orçamento 10 mil.", "Pediu para ligar depois das 18h.", ""];
const chamadas: Linha[] = [];
[...contC, ...contP].forEach((k, i) => {
  if (i % 7 === 3) return; // nunca contactado
  const n = (i % 5) + 1;
  const atraso = i % 5 === 0 ? 16 + (i % 9) : i % 4; // última chamada há 16 a 24 dias, ou recente
  for (let j = 0; j < n; j++) {
    chamadas.push({ contacto_id: k.id, ocorreu_em: dias(-(atraso + j * (6 + (i % 5))), 9 + ((i + j) % 9), (i * 7) % 60).toISOString(), observacoes: notas[(i + j) % notas.length] || null });
  }
});
blocos.push("-- chamadas", inserir("chamadas", chamadas));

// correspondências (alertas de imóveis), com a regra da app
const zonasDe = (c: CompradorDemo): Zona[] => c.zonas.map(([d, co, f]) => ({ distrito: d, concelho: co, freguesia: f }));
const corresp: Linha[] = [];
COMPRADORES.forEach((c, i) => {
  if (!ESTADOS_A_PROCURAR.includes(c.estado) || !c.zonas.length) return;
  const perfil = { tipo_imovel: c.tipo, tipologia_minima: c.tipologia, expectativa_valor: c.valor };
  angs.forEach((a, k) => {
    if (a.linha.vendido_em) return;
    const im = { tipo_imovel: a.def.tipo, tipologia: a.def.tipologia, distrito: a.def.zona[0], concelho: a.def.zona[1], freguesia: a.def.zona[2], valor: a.def.valor };
    if (corresponde(perfil, zonasDe(c), im)) corresp.push({ comprador_id: comps[i].id, angariacao_id: a.id, estado: (i + k) % 5 === 0 ? "descartada" : (i + k) % 4 === 0 ? "faz_sentido" : "nova" });
  });
  PROPRIETARIOS.forEach((p, k) => {
    if (p.ang || p.estado === "perdido") return;
    const im = { tipo_imovel: p.tipo, tipologia: p.tipologia, distrito: p.zona[0], concelho: p.zona[1], freguesia: p.zona[2], valor: p.valor };
    if (corresponde(perfil, zonasDe(c), im)) corresp.push({ comprador_id: comps[i].id, proprietario_id: props[k].id, estado: "nova" });
  });
});
blocos.push("-- correspondências", inserir("correspondencias", corresp));

// metas do ano e decisões semanais
const ano = agora.getFullYear();
const semanaISO = (d: Date) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${pad(Math.ceil(((t.getTime() - ini.getTime()) / 86400000 + 1) / 7))}`;
};
const semanas = [...new Set(Array.from({ length: 14 }, (_, k) => semanaISO(dias(-7 * (13 - k)))))];
blocos.push(
  "-- metas",
  inserir("metas", [
    { ano, metrica: "visitas", valor_anual: 140, taxa_conversao: 10 },
    { ano, metrica: "reunioes_angariacao", valor_anual: 60, taxa_conversao: 2.5 },
    { ano, metrica: "angariacoes", valor_anual: 24 },
    { ano, metrica: "transacoes", valor_anual: 14 },
  ]),
  inserir("metas_config", [{ ano, semanas_uteis: 46, faturacao_anual: 75000 }]),
  inserir("metas_semanas", semanas.map((s, k) => ({ semana: s, decisao: k % 4 === 2 ? "ignorada" : "colocada" })))
);

// ---------------------------------------------------------------------------
// Ficheiro final
// ---------------------------------------------------------------------------
const resumo = Object.entries(contagens).map(([t, n]) => `--   ${t}: ${n}`).join("\n");
const sql = `-- SIMULAÇÃO DE 3 MESES DE USO DO COCKPIT (dados FICTÍCIOS), gerada a ${iso(agora)}.
-- Colar no SQL Editor do projeto "Cockpit". Só insere: não apaga nem altera nada que já exista.
-- Antes de correr: o SQL de limpeza (limpar_para_simulacao.sql) já deve ter sido corrido.
-- É um único bloco: ou insere tudo, ou não insere nada.
-- Pré-requisito: as migrações das visitas/propostas e a coluna angariacoes.referencia.
--
-- Linhas inseridas:
${resumo}
--
-- LIMPAR a simulação no fim (apaga só o que tem email @exemplo.pt e as angariações ligadas; não toca no João Carvalho):
--   delete from angariacoes where referencia in ('REF-2041','REF-2017','REF-1988','REF-1950','REF-2072','REF-2063') or titulo in ('T3, Braga, Gualtar');
--   delete from contactos where email like '%@exemplo.pt';
--   delete from metas; delete from metas_config; delete from metas_semanas;

do $simulacao$
declare
  v_empresa uuid;
begin
  select empresa_id into v_empresa from contactos where email = ${lit(EMAIL_REAL)};
  if v_empresa is null then
    raise exception 'Não encontrei o contacto % (ou não tem empresa). Nada foi inserido.', ${lit(EMAIL_REAL)};
  end if;

${blocos.filter(Boolean).join("\n\n")}
end
$simulacao$;

-- Verificação (correr depois):
-- select 'contactos' t, count(*) from contactos union all select 'compradores', count(*) from compradores
-- union all select 'proprietarios', count(*) from proprietarios union all select 'angariacoes', count(*) from angariacoes
-- union all select 'acoes', count(*) from angariacao_acoes union all select 'tarefas', count(*) from tarefas
-- union all select 'chamadas', count(*) from chamadas union all select 'imoveis', count(*) from comprador_imoveis
-- union all select 'correspondencias', count(*) from correspondencias;
`;
writeFileSync("simulacao_3_meses.sql", sql);
console.log(`simulacao_3_meses.sql escrito (${Math.round(sql.length / 1024)} KB).\n${Object.entries(contagens).map(([t, n]) => `  ${t}: ${n}`).join("\n")}`);
