---
name: browser-check
description: Use this skill whenever you need to open a browser to test, navigate, click through, fill forms, take screenshots, or verify a web page/app in this repository - the site estático em site/, os ficheiros HTML de docs/, ou a app Next.js em servicos/painel-gestao-base/. Substitui um MCP de browser sempre ligado: em vez disso, escreve e corre um script Playwright descartável.
---

# Verificação em browser sem MCP

Este repositório já usou um MCP de browser (playwright/chrome-devtools) sempre ligado. Foi
removido porque um servidor MCP persistente despeja snapshots de accessibility-tree e logs de
consola inteiros para o contexto a cada interacção - em sessões de teste longas isso consumia a
maior parte da janela de contexto sem necessidade. A alternativa é mais simples e mais barata:
**escrever um pequeno script Node/Playwright descartável e correr com Bash**, extraindo só o que
é preciso (um valor, um screenshot, um erro de consola específico) em vez de despejar tudo.

## Quando usar

- Confirmar visualmente que uma alteração resultou (`site/index.html`, páginas em `docs/`,
  qualquer página em `servicos/painel-gestao-base/app/**`).
- Percorrer um fluxo (login, preencher um formulário, submeter, verificar o resultado).
- Descarregar e inspeccionar um ficheiro gerado pela app (ex.: PDF/DOCX do CPCV).
- Apanhar erros de consola ou verificar um pedido de rede específico.

## Como fazer

1. **Escreve o script no scratchpad da sessão** (nunca no repositório), um ficheiro `.mjs`. O
   Playwright já está instalado (com os browsers já descarregados) em
   `servicos/painel-gestao-base/node_modules`, mas a resolução de módulos ESM do Node segue a
   localização do *ficheiro que faz o import*, não o directório de trabalho onde correste `node`
   - por isso nem `cd servicos/painel-gestao-base && node /caminho/scratchpad/script.mjs` resolve
   (confirmado por teste: `ERR_MODULE_NOT_FOUND`), nem um import por caminho absoluto tipo
   `import ... from "C:/.../playwright/index.mjs"` (falha com `ERR_UNSUPPORTED_ESM_URL_SCHEME` -
   o loader ESM não aceita `C:` como esquema de URL). **Usa sempre `createRequire` ancorado ao
   `package.json` do projecto**, como no exemplo abaixo - isto funciona a partir de qualquer
   directório de trabalho.
2. **Só imprime/guarda o que precisas.** Não faças `console.log(await page.content())` nem
   despejes o accessibility tree inteiro - lê um `textContent` específico, tira um screenshot para
   um ficheiro (depois usa a tool `Read` para o veres), ou devolve um pequeno objecto JSON.
3. **Fecha sempre o browser no `finally`**, mesmo em caso de erro, para não deixar processos
   `chromium` pendurados.

### Exemplo - navegar, preencher, submeter, ler o resultado

```js
// scratchpad/check.mjs - correr com: node /caminho/absoluto/scratchpad/check.mjs (de qualquer directório)
import { createRequire } from "node:module";
const require = createRequire(
  "C:/Users/pedro/Acelabs_main_repo/acelabs/servicos/painel-gestao-base/package.json"
);
const { chromium } = require("playwright");

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/cpcv/login");

  await page.fill('input[type="email"]', "agente.teste@acelabs.pt");
  await page.fill('input[type="password"]', "TesteCpcv-2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/cpcv");

  const total = await page.textContent("h1");
  console.log(JSON.stringify({ ok: true, heading: total }));
} finally {
  await browser.close();
}
```

Testado de ponta a ponta (login real como `agente.teste@acelabs.pt`, chegada confirmada a
`/cpcv`): o output do script foi uma única linha, `{"ok":true,"heading":"Os meus CPCVs"}` (38
bytes). O mesmo fluxo replicado com um MCP de browser (navegar + snapshot da página de login +
preencher + submeter + snapshot final) produziu cerca de 8850 bytes de accessibility-tree
devolvidos ao contexto - a maior parte disso vindo só do snapshot final, que lista as ~150 linhas
da tabela de processos mesmo sem ninguém ter pedido para ver isso. Ordem de grandeza: ~230x menos
texto devolvido ao contexto para a mesma tarefa.

Nota: `page.fill()` do Playwright já dispara os eventos `input`/`change` correctamente através do
setter nativo - ao contrário de definir `.value` directamente em JS no browser, não tens o
problema de o estado do React ficar dessincronizado do DOM (ver `CLAUDE.md` de
`servicos/painel-gestao-base` sobre esse cuidado).

### Exemplo - screenshot para verificação visual

```js
await page.screenshot({ path: "C:/Users/pedro/AppData/Local/Temp/.../scratchpad/check.png", fullPage: false });
```

Depois usa a tool `Read` nesse caminho para ver a imagem - mais barato em contexto do que um
snapshot de accessibility tree, e mais fiel ao que um utilizador real vê.

### Exemplo - apanhar erros de consola

```js
const erros = [];
page.on("console", (msg) => {
  if (msg.type() === "error") erros.push(msg.text());
});
// ... navegar/interagir ...
console.log(JSON.stringify(erros));
```

### Exemplo - descarregar um ficheiro gerado pela app e inspeccionar (testado)

`page.request` partilha os cookies de sessão da `page`, por isso um pedido autenticado a uma rota
de download/API é só isto - não precisas de reconstruir o cookie à mão:

```js
import { writeFile } from "node:fs/promises";
// ... depois do login (ver exemplo acima) ...
const res = await page.request.get(`${BASE}/api/cpcv/${id}/download?tipo=pdf`);
const buf = await res.body();
await writeFile(`${SCRATCH}/cpcv.pdf`, buf);
console.log(JSON.stringify({ status: res.status(), contentType: res.headers()["content-type"], bytes: buf.length }));
```
Depois lê o PDF com a tool `Read` (suporta PDF nativamente, extrai texto e imagem por página) -
serve tanto para confirmar que o download funciona como para verificar o conteúdo gerado (ex.:
uma cláusula com fraseado errado).

### Exemplo - testar controlo de acessos entre roles (testado)

Usa `browser.newContext()` para ter duas sessões isoladas (cookies diferentes) no mesmo browser,
sem precisar de dois processos - faz login uma vez por role e reaproveita o `page.request` de
cada contexto para bater em rotas que deviam estar fechadas:

```js
async function login(browser, email, password) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${BASE}/cpcv/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/cpcv`);
  return { context, page };
}

const { page: pageAgente } = await login(browser, "agente.teste@acelabs.pt", "TesteCpcv-2026!");

// deve devolver 403 - só gestora pode aprovar
const res = await pageAgente.request.post(`${BASE}/api/cpcv/gerar`, {
  data: { processo_id: "<id de um processo qualquer>" },
});
console.log(JSON.stringify({ status: res.status(), body: await res.json() }));
```

Testado contra este projecto depois da mudança de pasta para `servicos/painel-gestao-base`:
confirma 403 (role errado) e 404 (RLS - IDOR noutro `processo_id`) em duas chamadas, ~250 bytes de
output no total.

## O que evitar

- Não recrees um MCP de browser para isto (nem `.mcp.json` na raiz do repositório) - foi
  deliberadamente removido por causa do custo de contexto.
- Não uses `page.accessibility.snapshot()` nem `page.content()` para "ver o que está na página" -
  só se precisares mesmo da árvore completa para debugging de acessibilidade; para verificação
  normal, um `textContent`/`locator` específico ou um screenshot chegam.
- Não deixes o servidor de dev (`npm run dev`) nem processos `chromium` órfãos a correr em
  segundo plano sem o utilizador saber.
