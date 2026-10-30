// Função `admin` do cliente: executa pedidos de administração (listar, criar, suspender, apagar utilizadores e ver o
// estado da instalação) enviados pela plataforma de controlo da Ace Labs. A chave de administrador do projeto já
// existe aqui (SUPABASE_SERVICE_ROLE_KEY) e nunca sai; a plataforma só envia pedidos ASSINADOS (Ed25519, 2 minutos
// de validade, só para este projeto).
//
// Publicar (uma vez por cliente, com a CLI do Supabase ligada ao projeto do cliente):
//   supabase functions deploy admin --no-verify-jwt
//   supabase secrets set CONTROLO_CHAVE_PUBLICA="$(cat chave-publica.pem)" PRODUTO=cockpit APP_URL=https://cockpit.acelabs.pt
// (PRODUTO é "cockpit" ou "cpcv". A chave pública vem de `npm run chaves` na plataforma de controlo.)
// Com dois sócios, cada um tem o seu par de chaves e o seu segredo: CONTROLO_CHAVE_PUBLICA_PEDRO e CONTROLO_CHAVE_PUBLICA_MIGUEL.
// O nome do segredo diz quem assinou o pedido, e é isso que fica no registo de ações (CONTROLO_CHAVE_PUBLICA sozinho = "socio").

import { executar, verificar, type Pedido, type Produto } from "../_shared/nucleo.ts";

const PREFIXO = "CONTROLO_CHAVE_PUBLICA";

/** Verifica o pedido contra cada chave pública configurada. Devolve o pedido e o nome de quem o assinou. */
async function verificarSocio(ref: string, token: string): Promise<{ pedido: Pedido; quem: string }> {
  const chaves = Object.entries(Deno.env.toObject()).filter(([k, v]) => k.startsWith(PREFIXO) && v);
  for (const [nome, pem] of chaves) {
    try {
      return { pedido: await verificar(pem, ref, token), quem: nome.slice(PREFIXO.length).replace(/^_/, "").toLowerCase() || "socio" };
    } catch (e) {
      // pedido expirado ou para outro projeto: a mesma resposta com qualquer chave, não vale a pena tentar as outras
      if (!/assinatura/i.test(e instanceof Error ? e.message : "")) throw e;
    }
  }
  throw new Error("assinatura inválida");
}

Deno.serve(async (req) => {
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const url = Deno.env.get("SUPABASE_URL")!;
    const ref = new URL(url).host.split(".")[0];
    const { pedido, quem } = await verificarSocio(ref, token);
    const produto = (Deno.env.get("PRODUTO") === "cpcv" ? "cpcv" : "cockpit") as Produto;
    const resultado = await executar(
      { url, chave: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, produto, appUrl: Deno.env.get("APP_URL") ?? undefined, codigoApp: Deno.env.get("APP_CODIGO") ?? undefined, quem },
      pedido
    );
    return Response.json(resultado);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    // Falhas de assinatura são 401; o resto (validações, ex. "Já existe uma conta") é 400 com a mensagem para o ecrã.
    const naoAutorizado = /assinatura|token|expirado|destinat/i.test(msg);
    return Response.json({ erro: naoAutorizado ? "Pedido não autorizado." : msg }, { status: naoAutorizado ? 401 : 400 });
  }
});
