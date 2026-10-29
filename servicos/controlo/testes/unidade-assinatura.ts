// Pedidos assinados: a função `admin` de cada cliente só pode executar o que a plataforma de controlo assinou, a tempo,
// e para esse projeto. Corre com: npx tsx testes/unidade-assinatura.ts
import { generateKeyPairSync } from "node:crypto";
import { assinar, verificar } from "../supabase/functions/_shared/nucleo";

let falhas = 0;
const ok = (nome: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${extra ? ": " + extra : ""}`);
  if (!cond) falhas++;
};
const rejeita = async (nome: string, f: () => Promise<unknown>, quer: RegExp) => {
  try {
    await f();
    ok(nome, false, "aceitou");
  } catch (e) {
    ok(nome, quer.test(String(e instanceof Error ? e.message : e)), e instanceof Error ? e.message : "");
  }
};

const par = () => {
  const k = generateKeyPairSync("ed25519");
  return { pub: k.publicKey.export({ type: "spki", format: "pem" }).toString(), priv: k.privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
};

(async () => {
  const a = par();
  const outra = par();

  const t = await assinar(a.priv, "projetoA", { acao: "listar" });
  const p = await verificar(a.pub, "projetoA", t);
  ok("pedido assinado é aceite e devolve a ação", p.acao === "listar");

  const t2 = await assinar(a.priv, "projetoA", { acao: "criar", email: "x@y.pt", modo: "password" });
  const p2 = await verificar(a.pub, "projetoA", t2);
  ok("os parâmetros do pedido chegam intactos", p2.email === "x@y.pt" && p2.modo === "password");

  await rejeita("chave pública errada é recusada", () => verificar(outra.pub, "projetoA", t), /assinatura/);
  await rejeita("pedido para outro projeto é recusado", () => verificar(a.pub, "projetoB", t), /destinat/);

  const [cab, corpo, sig] = t.split(".");
  const adulterado = JSON.parse(Buffer.from(corpo.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
  adulterado.pedido = { acao: "remover", id: "x" };
  const corpo2 = Buffer.from(JSON.stringify(adulterado)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await rejeita("pedido adulterado (ação trocada) é recusado", () => verificar(a.pub, "projetoA", `${cab}.${corpo2}.${sig}`), /assinatura/);

  const agora = Date.now;
  Date.now = () => agora() + 3 * 60_000;
  await rejeita("pedido com mais de 2 minutos expira", () => verificar(a.pub, "projetoA", t), /expirado/);
  Date.now = agora;

  await rejeita("lixo não é um token", () => verificar(a.pub, "projetoA", "isto.nao.presta"), /./);
  await rejeita("token vazio é recusado", () => verificar(a.pub, "projetoA", ""), /token/);

  console.log(falhas ? `\n${falhas} falhas` : "\nAssinaturas: tudo certo.");
  process.exit(falhas ? 1 : 0);
})();
