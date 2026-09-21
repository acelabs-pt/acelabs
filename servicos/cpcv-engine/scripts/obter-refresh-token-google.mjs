// Script de autorização única para ligar a app ao Google Drive (ver lib/google-drive.ts).
//
// Antes de correr:
//   1. Criar um projecto na Google Cloud Console, activar a "Google Drive API".
//   2. Ecrã de consentimento OAuth: tipo "Interno" se for Google Workspace, ou "Externo" +
//      adicionar a tua conta como utilizador de teste se for Gmail normal.
//   3. Criar credenciais "OAuth client ID", tipo "Web application", com este URI de
//      redireccionamento autorizado: http://localhost:53682/oauth2callback
//   4. Copiar o Client ID e o Client Secret para GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
//      em .env.local.
//
// Correr com: node scripts/obter-refresh-token-google.mjs
// Abre um separador do browser para autorizares com a conta Google onde queres guardar
// os CPCVs; no fim imprime o GOOGLE_REFRESH_TOKEN a colar em .env.local (e mais tarde
// nas env vars da Vercel).

import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const { google } = require("googleapis");

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

function lerEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) return {};
  const conteudo = readFileSync(path, "utf8");
  const vars = {};
  for (const linha of conteudo.split("\n")) {
    const m = linha.match(/^([A-Z_]+)=(.*)$/);
    if (m) vars[m[1]] = m[2].trim();
  }
  return vars;
}

const env = { ...lerEnvLocal(), ...process.env };
const clientId = env.GOOGLE_CLIENT_ID;
const clientSecret = env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "Falta GOOGLE_CLIENT_ID e/ou GOOGLE_CLIENT_SECRET em .env.local. Cria as credenciais na Google Cloud Console primeiro (ver comentário no topo deste ficheiro)."
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // força a emissão de um refresh_token mesmo que já tenhas autorizado antes
  scope: ["https://www.googleapis.com/auth/drive.file"],
});

console.log("\nAbre este link no browser e autoriza com a conta Google onde queres guardar os CPCVs:\n");
console.log(authUrl);
console.log(`\nÀ espera do redireccionamento em ${REDIRECT_URI} ...\n`);

const server = createServer(async (req, res) => {
  if (!req.url.startsWith("/oauth2callback")) {
    res.writeHead(404).end();
    return;
  }

  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");
  const erro = url.searchParams.get("error");

  if (erro) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(
      `<p>Autorização recusada (${erro}). Podes fechar esta janela.</p>`
    );
    console.error("Autorização recusada:", erro);
    server.close();
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(
      "<p>Autorizado. Podes fechar esta janela e voltar ao terminal.</p>"
    );

    if (!tokens.refresh_token) {
      console.error(
        "\nA Google não devolveu um refresh_token desta vez - já deves ter uma autorização activa. " +
          "Vai a https://myaccount.google.com/permissions, remove o acesso da app, e corre este script outra vez."
      );
    } else {
      console.log("\nGOOGLE_REFRESH_TOKEN obtido - cola esta linha em .env.local:\n");
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    }
  } catch (e) {
    console.error("Erro a trocar o código por tokens:", e instanceof Error ? e.message : e);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(PORT);
