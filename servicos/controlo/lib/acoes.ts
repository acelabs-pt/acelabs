import {
  apagarEmpresa,
  assinar,
  atualizarEmpresa,
  contasSemEmpresa,
  criarEmpresa,
  criarUtilizador,
  definirEstadoEmpresa,
  estado,
  listarAuditoria,
  listarEmpresas,
  listarUtilizadores,
  remover,
  suspender,
  type DadosEmpresa,
  type EmpresaResumo,
  type EntradaAuditoria,
  type Ctx,
  type NovoUtilizador,
  type Pedido,
  type Utilizador,
  type Verificacao,
} from "../supabase/functions/_shared/nucleo";
import { lerClientes, nomeVariavelChave, type Cliente } from "./clientes";

// Ponto único por onde a app executa ações sobre um cliente. Escolhe o modo do cliente:
//  - "chave": chama o núcleo diretamente com a chave de administrador guardada neste computador (variável CHAVE_<ID>);
//  - "funcao": envia um pedido assinado à função `admin` publicada no Supabase do cliente (sem chave nenhuma aqui).

function ctxChave(c: Cliente): Ctx {
  const chave = process.env[nomeVariavelChave(c.id)];
  if (!chave) throw new Error(`Falta a chave de administrador deste cliente. Define ${nomeVariavelChave(c.id)} no ficheiro .env.local, ou passa o cliente para o modo "função".`);
  // quem: no modo "chave" não há assinatura que diga quem é; fica o que está no .env.local deste computador (CONTROLO_QUEM=pedro ou miguel).
  return { url: c.supabase_url, chave, produto: c.produto, appUrl: c.app_url, codigoApp: c.codigo_app, empresa: c.empresa, quem: (process.env.CONTROLO_QUEM || "socio").toLowerCase() };
}

function refProjeto(c: Cliente): string {
  return new URL(c.supabase_url).host.split(".")[0];
}

async function viaFuncao<T>(c: Cliente, pedido: Pedido): Promise<T> {
  const privada = process.env.CONTROLO_CHAVE_PRIVADA;
  if (!privada) throw new Error("Falta CONTROLO_CHAVE_PRIVADA no .env.local (gera o par de chaves com: npm run chaves).");
  const token = await assinar(privada.replace(/\\n/g, "\n"), refProjeto(c), c.empresa ? { ...pedido, empresa: c.empresa } : pedido);
  const r = await fetch(`${c.supabase_url.replace(/\/$/, "")}/functions/v1/admin`, {
    method: "POST",
    headers: { apikey: c.anon_key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const corpo = await r.json().catch(() => null);
  if (r.status === 404) throw new Error("A função `admin` ainda não está publicada no Supabase deste cliente.");
  if (!r.ok) throw new Error((corpo as { erro?: string } | null)?.erro ?? `A função recusou o pedido (${r.status}).`);
  return corpo as T;
}

export async function utilizadoresDe(c: Cliente): Promise<Utilizador[]> {
  return c.modo === "funcao" ? viaFuncao(c, { acao: "listar" }) : listarUtilizadores(ctxChave(c));
}

export async function criarEm(c: Cliente, n: NovoUtilizador): Promise<{ id: string; passwordTemporaria?: string }> {
  return c.modo === "funcao" ? viaFuncao(c, { acao: "criar", ...n }) : criarUtilizador(ctxChave(c), n);
}

export async function suspenderEm(c: Cliente, id: string, suspenso: boolean): Promise<void> {
  if (c.modo === "funcao") await viaFuncao(c, { acao: "suspender", id, suspenso });
  else await suspender(ctxChave(c), id, suspenso);
}

export async function removerEm(c: Cliente, id: string): Promise<void> {
  if (c.modo === "funcao") await viaFuncao(c, { acao: "remover", id });
  else await remover(ctxChave(c), id);
}

export async function estadoDe(c: Cliente): Promise<Verificacao[]> {
  if (c.modo === "funcao") return viaFuncao(c, { acao: "estado" });
  return estado(ctxChave(c));
}

// ---------------------------------------------------------------------------------------------
// Administração das empresas do projeto Cockpit partilhado (Painel, empresa, registo de ações).
// ---------------------------------------------------------------------------------------------

/** O projeto partilhado registado nesta lista (o que tem partilhado: true). */
export function projetoPartilhado(): Cliente | undefined {
  return lerClientes().find((c) => c.partilhado);
}

/** Uma vista do projeto partilhado limitada a UMA empresa: é com ela que se listam, convidam e removem utilizadores. */
export function daEmpresa(projeto: Cliente, codigo: string, nome: string): Cliente {
  return { ...projeto, id: projeto.id, nome, empresa: codigo, partilhado: false };
}

async function correr<T>(c: Cliente, pedido: Pedido, direto: (x: Ctx) => Promise<T>): Promise<T> {
  return c.modo === "funcao" ? viaFuncao<T>(c, pedido) : direto(ctxChave(c));
}

export const empresasDe = (c: Cliente): Promise<EmpresaResumo[]> => correr(c, { acao: "empresas" }, listarEmpresas);
export const contasSoltasDe = (c: Cliente) => correr(c, { acao: "contas_sem_empresa" }, contasSemEmpresa);
export const criarEmpresaEm = (c: Cliente, codigo: string, nome: string, dados?: DadosEmpresa) =>
  correr(c, { acao: "empresa_criar", codigo, nome, dados }, (x) => criarEmpresa(x, codigo, nome, dados));
export const atualizarEmpresaEm = (c: Cliente, codigo: string, dados: DadosEmpresa) =>
  correr(c, { acao: "empresa_atualizar", codigo, dados }, (x) => atualizarEmpresa(x, codigo, dados));
export const estadoDaEmpresaEm = (c: Cliente, codigo: string, novo: string) =>
  correr(c, { acao: "empresa_estado", codigo, estado: novo }, (x) => definirEstadoEmpresa(x, codigo, novo));
export const apagarEmpresaEm = (c: Cliente, codigo: string, confirmar: string) =>
  correr(c, { acao: "empresa_apagar", codigo, confirmar }, (x) => apagarEmpresa(x, codigo, confirmar));
export const auditoriaDe = (c: Cliente, empresa?: string, limite = 100): Promise<EntradaAuditoria[]> =>
  correr(c, { acao: "auditoria", empresa, limite }, (x) => listarAuditoria(x, empresa, limite));
