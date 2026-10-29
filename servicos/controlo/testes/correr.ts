// Testes da plataforma de controlo, de ponta a ponta, contra os projetos Supabase de TESTE (nunca um cliente):
//  1. assinaturas (unitário);
//  2. arranca a app, entra com password, regista dois clientes de teste (um Cockpit, um CPCV) e usa o ecrã a sério;
//  3. repete o fluxo do CPCV pelo modo "função", com um servidor local a fazer de função `admin` (verifica a assinatura
//     e executa o mesmo núcleo), para provar que o pedido assinado funciona de ponta a ponta sem chave no computador.
// Uso: npm run testar    (precisa dos .env.local e .env.testes do cockpit-app e do cpcv-engine, só para os projetos de teste)
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { generateKeyPairSync, randomBytes, scryptSync } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { executar, verificar } from "../supabase/functions/_shared/nucleo";

const RAIZ = path.resolve(__dirname, "..");
const SERVICOS = path.resolve(RAIZ, "..");

function lerEnv(f: string): Record<string, string> {
  const o: Record<string, string> = {};
  if (!existsSync(f)) return o;
  for (const l of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) o[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return o;
}

const cockpit = { ...lerEnv(path.join(SERVICOS, "cockpit-app/.env.local")), ...lerEnv(path.join(SERVICOS, "cockpit-app/.env.testes")) };
const cpcv = lerEnv(path.join(SERVICOS, "cpcv-engine/.env.local"));
const permitido = cockpit.TESTES_PERMITIDOS_EM;
if (!permitido || !cockpit.NEXT_PUBLIC_SUPABASE_URL?.includes(`//${permitido}.`)) {
  console.error("Proteção: o projeto Supabase do cockpit-app não é o de teste indicado em TESTES_PERMITIDOS_EM. Estes testes escrevem dados.");
  process.exit(1);
}
if (!cpcv.SUPABASE_SERVICE_ROLE_KEY || !cpcv.NEXT_PUBLIC_SUPABASE_URL) {
  console.error("Falta o .env.local do cpcv-engine (projeto de teste do CPCV).");
  process.exit(1);
}

// 1. unitário
const u = spawnSync(process.execPath, [path.join(SERVICOS, "cockpit-app/node_modules/tsx/dist/cli.mjs"), "testes/unidade-assinatura.ts"], { cwd: RAIZ, encoding: "utf8" });
console.log(u.stdout.trim().split("\n").slice(-1)[0]);
if (u.status !== 0) {
  console.log(u.stdout);
  process.exit(1);
}

(async () => {
  const pasta = mkdtempSync(path.join(tmpdir(), "controlo-teste-"));
  const sal = randomBytes(16).toString("hex");
  const password = "uma-password-de-teste-123";
  const par = generateKeyPairSync("ed25519");
  const pub = par.publicKey.export({ type: "spki", format: "pem" }).toString();
  const priv = par.privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  // "Função admin" local: o que o Supabase de um cliente faria (verifica o pedido assinado e executa com a chave de administrador).
  const PORTA_FUNCAO = 3099;
  const funcao = createServer(async (req, res) => {
    const enviar = (s: number, o: unknown) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    try {
      const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const pedido = await verificar(pub, `localhost:${PORTA_FUNCAO}`, token);
      enviar(200, await executar({ url: cpcv.NEXT_PUBLIC_SUPABASE_URL, chave: cpcv.SUPABASE_SERVICE_ROLE_KEY, produto: "cpcv" }, pedido));
    } catch (e) {
      const m = e instanceof Error ? e.message : "erro";
      enviar(/assinatura|token|expirado|destinat/i.test(m) ? 401 : 400, { erro: m });
    }
  }).listen(PORTA_FUNCAO);

  const clientes = [
    { id: "teste-cockpit", nome: "Teste Cockpit", produto: "cockpit", supabase_url: cockpit.NEXT_PUBLIC_SUPABASE_URL, anon_key: cockpit.NEXT_PUBLIC_SUPABASE_ANON_KEY, app_url: "http://localhost:3001", modo: "chave" },
    { id: "teste-cpcv", nome: "Teste CPCV", produto: "cpcv", supabase_url: cpcv.NEXT_PUBLIC_SUPABASE_URL, anon_key: cpcv.NEXT_PUBLIC_SUPABASE_ANON_KEY, modo: "chave" },
    { id: "teste-funcao", nome: "Teste Funcao", produto: "cpcv", supabase_url: `http://localhost:${PORTA_FUNCAO}`, anon_key: "chave-anon-falsa-so-para-o-teste", modo: "funcao" },
  ];
  writeFileSync(path.join(pasta, "clientes.json"), JSON.stringify(clientes, null, 2));

  const env = {
    ...process.env,
    CONTROLO_DADOS: path.join(pasta, "clientes.json"),
    CONTROLO_PASSWORD_HASH: `scrypt$${sal}$${scryptSync(password, sal, 32).toString("hex")}`,
    CONTROLO_SEGREDO: randomBytes(32).toString("hex"),
    CHAVE_TESTE_COCKPIT: cockpit.SUPABASE_SERVICE_ROLE_KEY,
    CHAVE_TESTE_CPCV: cpcv.SUPABASE_SERVICE_ROLE_KEY,
    CONTROLO_CHAVE_PRIVADA: priv.replace(/\n/g, "\\n"),
  };

  const PORTA = 3012;
  const next = path.join(RAIZ, "node_modules/next/dist/bin/next");
  const servidor: ChildProcess = spawn(process.execPath, [next, "dev", "-p", String(PORTA)], { cwd: RAIZ, env, stdio: "ignore" });
  const parar = () => {
    spawnSync("taskkill", ["/PID", String(servidor.pid), "/T", "/F"], { stdio: "ignore" });
    funcao.close();
  };

  let codigo = 1;
  try {
    for (let i = 0; i < 60; i++) {
      const r = await fetch(`http://localhost:${PORTA}/login`).catch(() => null);
      if (r?.ok) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    // Assíncrono: o servidor da "função admin" corre neste processo e tem de poder responder enquanto o browser trabalha.
    const e2e = await new Promise<{ status: number | null; stdout: string }>((resolve) => {
      const filho = spawn(process.execPath, [path.join(RAIZ, "testes/e2e.cjs")], {
        cwd: RAIZ,
        env: { ...env, BASE: `http://localhost:${PORTA}`, PASSWORD: password, PLAYWRIGHT_DIR: path.join(SERVICOS, "cockpit-app/node_modules/playwright") },
      });
      let stdout = "";
      filho.stdout.on("data", (d) => (stdout += d));
      filho.stderr.on("data", (d) => (stdout += d));
      const limite = setTimeout(() => filho.kill(), 300_000);
      filho.on("close", (status) => { clearTimeout(limite); resolve({ status, stdout }); });
    });
    console.log(e2e.stdout.trim());
    codigo = e2e.status === 0 && !/^FALHA/m.test(e2e.stdout) ? 0 : 1;
  } finally {
    parar();
  }
  console.log(codigo === 0 ? "\nTudo certo." : "\nHá falhas.");
  process.exit(codigo);
})();
