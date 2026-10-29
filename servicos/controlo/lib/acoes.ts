import {
  assinar,
  criarUtilizador,
  estado,
  listarUtilizadores,
  remover,
  suspender,
  type Ctx,
  type NovoUtilizador,
  type Pedido,
  type Utilizador,
  type Verificacao,
} from "../supabase/functions/_shared/nucleo";
import { nomeVariavelChave, type Cliente } from "./clientes";

// Ponto único por onde a app executa ações sobre um cliente. Escolhe o modo do cliente:
//  - "chave": chama o núcleo diretamente com a chave de administrador guardada neste computador (variável CHAVE_<ID>);
//  - "funcao": envia um pedido assinado à função `admin` publicada no Supabase do cliente (sem chave nenhuma aqui).

function ctxChave(c: Cliente): Ctx {
  const chave = process.env[nomeVariavelChave(c.id)];
  if (!chave) throw new Error(`Falta a chave de administrador deste cliente. Define ${nomeVariavelChave(c.id)} no ficheiro .env.local, ou passa o cliente para o modo "função".`);
  return { url: c.supabase_url, chave, produto: c.produto, appUrl: c.app_url, codigoApp: c.codigo_app };
}

function refProjeto(c: Cliente): string {
  return new URL(c.supabase_url).host.split(".")[0];
}

async function viaFuncao<T>(c: Cliente, pedido: Pedido): Promise<T> {
  const privada = process.env.CONTROLO_CHAVE_PRIVADA;
  if (!privada) throw new Error("Falta CONTROLO_CHAVE_PRIVADA no .env.local (gera o par de chaves com: npm run chaves).");
  const token = await assinar(privada.replace(/\\n/g, "\n"), refProjeto(c), pedido);
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
