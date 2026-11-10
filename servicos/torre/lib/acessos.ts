import { paraCentimos } from "./dinheiro";
import { lerData } from "./extrato";
import { normalizar } from "./texto";

// Registo dos serviços e contas da Ace Labs: para que serve cada um, com que conta se entra e ONDE está a credencial.
// Nunca guarda passwords, chaves nem tokens: o servidor recusa qualquer campo com aspeto de segredo (pareceSegredo).

export const CATEGORIAS_ACESSO = ["Código", "Alojamento", "Base de dados", "Email", "Domínio e DNS", "Lojas de apps", "IA", "Pagamentos", "Interno", "Outros"] as const;
export const ESTADOS_ACESSO = ["ativo", "por criar", "a cancelar"] as const;
export const DOIS_FATORES = ["sim", "não", "não sei"] as const;

export type EstadoAcesso = (typeof ESTADOS_ACESSO)[number];
export type DoisFatores = (typeof DOIS_FATORES)[number];

export type Acesso = {
  id: string;
  servico: string;
  categoria: string;
  para_que: string | null;
  url: string | null;
  conta: string | null;
  dono: string | null;
  onde_esta: string | null;
  dois_fatores: DoisFatores;
  custo_mensal: number | null;
  renovacao: string | null;
  estado: EstadoAcesso;
  notas: string | null;
  criado_em: string;
  atualizado_em: string;
};

export type CamposAcesso = Omit<Acesso, "id" | "criado_em" | "atualizado_em">;

const ROTULO_CAMPO: Record<string, string> = {
  servico: "Serviço",
  categoria: "Categoria",
  para_que: "Para que serve",
  url: "Endereço",
  conta: "Conta",
  dono: "Dono",
  onde_esta: "Onde está a credencial",
  notas: "Notas",
};

// Começos típicos de chaves e tokens: OpenAI/Anthropic (sk-, sk_), Supabase (sbp_, sb_secret_), Resend (re_), JWT (eyJ),
// GitHub (ghp_, gho_, github_pat_), Google (AIza), Slack (xox), Stripe (rk_, whsec_), AWS (AKIA).
const PREFIXOS = ["sk-", "sk_", "sbp_", "sb_secret_", "re_", "eyj", "ghp_", "gho_", "ghs_", "github_pat_", "aiza", "xoxb-", "xoxp-", "rk_live_", "whsec_", "akia"];

/** Devolve o motivo se o texto parecer conter um segredo (chave, token, password colada), ou null. */
export function pareceSegredo(texto: string | null | undefined): string | null {
  if (!texto) return null;
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(texto)) return "parece uma chave privada";
  if (/"private_key"\s*:/.test(texto)) return "parece o conteúdo de uma chave de conta de serviço";
  // Separa por espaços e pelos separadores usuais de "chave=valor", para apanhar também tokens dentro de endereços.
  for (const parte of texto.split(/[\s=:,;"'<>()[\]{}?&#|]+/)) {
    if (!parte) continue;
    const p = parte.toLowerCase();
    if (PREFIXOS.some((x) => p.startsWith(x) && parte.length >= x.length + 8)) return "começa como uma chave ou token";
    // Cadeia longa e aleatória: 32+ caracteres seguidos, com letras e algarismos misturados. Caminhos (/ \), endereços de
    // email (@) e nomes de ficheiro ou domínios (.) ficam de fora: são o que se escreve em "onde está".
    if (parte.length >= 32 && !/[/\\@.]/.test(parte) && /[a-z]/i.test(parte) && /\d/.test(parte) && (parte.match(/\d/g) ?? []).length >= 4) return "parece uma chave ou token (cadeia longa e aleatória)";
  }
  return null;
}

/** Primeiro campo com aspeto de segredo, com a mensagem para mostrar. */
export function segredoNosCampos(c: Partial<Record<string, unknown>>): string | null {
  for (const [k, v] of Object.entries(c)) {
    if (typeof v !== "string") continue;
    const motivo = pareceSegredo(v);
    if (motivo) return `"${ROTULO_CAMPO[k] ?? k}" ${motivo}. Nunca escrevas aqui passwords ou chaves: escreve só onde estão guardadas.`;
  }
  return null;
}

const opc = (v: unknown) => {
  const t = String(v ?? "").trim();
  return t || null;
};

/**
 * Valida e normaliza um acesso, venha do formulário ou do ficheiro de importação. Devolve { erro } quando falta algo,
 * há um valor inválido ou algum campo tem aspeto de segredo.
 */
export function lerAcesso(o: Record<string, unknown>): { erro: string } | CamposAcesso {
  const servico = opc(o.servico);
  if (!servico) return { erro: "Falta o nome do serviço." };
  const categoria = opc(o.categoria) ?? "Outros";
  const estado = (opc(o.estado) ?? "ativo") as EstadoAcesso;
  if (!ESTADOS_ACESSO.includes(estado)) return { erro: "O estado é ativo, por criar ou a cancelar." };
  const df = (opc(o.dois_fatores) ?? "não sei") as DoisFatores;
  if (!DOIS_FATORES.includes(df)) return { erro: "A verificação em dois passos é sim, não ou não sei." };
  let custo: number | null = null;
  if (typeof o.custo_mensal === "number") custo = Math.round(o.custo_mensal);
  else if (opc(o.custo_mensal)) {
    custo = paraCentimos(String(o.custo_mensal));
    if (custo === null || custo < 0) return { erro: "O custo mensal não é válido." };
  }
  let renovacao: string | null = null;
  if (opc(o.renovacao)) {
    renovacao = lerData(String(o.renovacao));
    if (!renovacao) return { erro: "A data de renovação não é válida." };
  }
  const url = opc(o.url);
  if (url && !/^https?:\/\//i.test(url)) return { erro: "O endereço começa por http:// ou https://." };
  const c: CamposAcesso = {
    servico: servico.slice(0, 120),
    categoria: categoria.slice(0, 40),
    para_que: opc(o.para_que),
    url,
    conta: opc(o.conta),
    dono: opc(o.dono),
    onde_esta: opc(o.onde_esta),
    dois_fatores: df,
    custo_mensal: custo,
    renovacao,
    estado,
    notas: opc(o.notas),
  };
  const segredo = segredoNosCampos(c);
  if (segredo) return { erro: segredo };
  return c;
}

/** Chave para não duplicar na importação: o mesmo serviço com a mesma conta. */
export function chaveAcesso(a: { servico: string; conta: string | null }): string {
  return `${normalizar(a.servico)}|${normalizar(a.conta ?? "")}`;
}

/** Os que pedem atenção: por criar, ou ativos sem verificação em dois passos confirmada. */
export function precisaAtencao(a: Pick<Acesso, "estado" | "dois_fatores">): "por criar" | "sem 2FA" | null {
  if (a.estado === "por criar") return "por criar";
  if (a.estado === "ativo" && a.dois_fatores !== "sim") return "sem 2FA";
  return null;
}

/** Filtra por texto (todos os campos de texto) e por estado ("todos" ou um dos estados, ou "atencao"). */
export function filtrarAcessos(lista: Acesso[], q: string, estado: string): Acesso[] {
  const termos = normalizar(q).split(/\s+/).filter(Boolean);
  return lista.filter((a) => {
    if (estado === "atencao" ? !precisaAtencao(a) : estado !== "todos" && a.estado !== estado) return false;
    if (!termos.length) return true;
    const t = normalizar([a.servico, a.categoria, a.para_que, a.url, a.conta, a.dono, a.onde_esta, a.notas].filter(Boolean).join(" "));
    return termos.every((x) => t.includes(x));
  });
}

/** Agrupa por categoria, pela ordem de CATEGORIAS_ACESSO (as desconhecidas vão para o fim). */
export function agruparAcessos(lista: Acesso[]): { categoria: string; itens: Acesso[] }[] {
  const m = new Map<string, Acesso[]>();
  for (const a of lista) m.set(a.categoria, [...(m.get(a.categoria) ?? []), a]);
  const ordem = (c: string) => {
    const i = (CATEGORIAS_ACESSO as readonly string[]).indexOf(c);
    return i < 0 ? 999 : i;
  };
  return [...m.entries()]
    .sort(([a], [b]) => ordem(a) - ordem(b) || a.localeCompare(b, "pt"))
    .map(([categoria, itens]) => ({ categoria, itens: itens.sort((x, y) => x.servico.localeCompare(y.servico, "pt")) }));
}
