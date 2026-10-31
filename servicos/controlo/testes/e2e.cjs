// Ecrãs da plataforma de controlo, usados a sério num browser (chamado por testes/correr.ts, que arranca a app).
const { chromium } = require(process.env.PLAYWRIGHT_DIR);
const fs = require("fs");
const BASE = process.env.BASE;

function lerEnv(f) {
  const o = {};
  if (!fs.existsSync(f)) return o;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) o[m[1]] = m[2].trim().replace(/^"|"$/g, ""); }
  return o;
}
const S = require("path").resolve(__dirname, "../..");
const clientes = JSON.parse(fs.readFileSync(process.env.CONTROLO_DADOS, "utf8"));
const porId = Object.fromEntries(clientes.map((c) => [c.id, c]));
const chaves = { "teste-cockpit": process.env.CHAVE_TESTE_COCKPIT, "teste-cpcv": process.env.CHAVE_TESTE_CPCV, "teste-funcao": process.env.CHAVE_TESTE_CPCV };
const urlReal = { "teste-cockpit": porId["teste-cockpit"].supabase_url, "teste-cpcv": porId["teste-cpcv"].supabase_url, "teste-funcao": porId["teste-cpcv"].supabase_url };
const anonReal = { "teste-cockpit": porId["teste-cockpit"].anon_key, "teste-cpcv": porId["teste-cpcv"].anon_key, "teste-funcao": porId["teste-cpcv"].anon_key };

const out = [];
const ok = (nome, cond, extra = "") => out.push(`${cond ? "OK   " : "FALHA"} ${nome}${extra ? ": " + String(extra).slice(0, 140) : ""}`);

const admin = (id, caminho, init = {}) => fetch(`${urlReal[id]}${caminho}`, { ...init, headers: { apikey: chaves[id], Authorization: `Bearer ${chaves[id]}`, "Content-Type": "application/json", ...(init.headers || {}) } });
const existe = async (id, email) => ((await (await admin(id, "/auth/v1/admin/users?per_page=200")).json()).users || []).find((u) => u.email === email);
const entrarComo = async (id, email, password) => (await fetch(`${urlReal[id]}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anonReal[id], "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })).status;

(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  page.on("dialog", (d) => d.accept());
  const emails = [];
  try {
    // acesso
    const sem = await fetch(`${BASE}/clientes/teste-cpcv`, { redirect: "manual" });
    ok("sem sessão a página do cliente redireciona para o login", sem.status >= 300 && sem.status < 400 && /\/login/.test(sem.headers.get("location") || ""), `${sem.status} ${sem.headers.get("location")}`);

    await page.goto(`${BASE}/`);
    ok("a página inicial pede login", /\/login$/.test(page.url()), page.url());
    await page.fill("input[name=password]", "password-errada");
    await page.click("button[type=submit]");
    await page.waitForSelector("text=Password errada.", { timeout: 15000 }).catch(() => {});
    ok("password errada é recusada", await page.locator("text=Password errada.").isVisible());
    await page.fill("input[name=password]", process.env.PASSWORD);
    await page.click("button[type=submit]");
    await page.waitForSelector("text=Teste CPCV", { timeout: 20000 });
    ok("com a password certa aparece a lista de clientes", (await page.locator("text=Teste Cockpit").count()) > 0 && (await page.locator("text=Teste CPCV").count()) > 0);

    // CPCV e função: o mesmo fluxo completo, por chave e por pedido assinado
    for (const id of ["teste-cpcv", "teste-funcao"]) {
      const etiqueta = id === "teste-cpcv" ? "modo chave" : "modo função assinada";
      await page.goto(`${BASE}/clientes/${id}`);
      await page.waitForSelector("text=Estado da instalação", { timeout: 30000 });
      ok(`[${etiqueta}] o estado lista as tabelas do CPCV`, await page.locator("text=Perfis e papéis").isVisible() && await page.locator("text=Dados das partes (email e casal)").isVisible());

      const email = `controlo-teste-${id}-${Date.now()}@acelabs.pt`;
      emails.push([id, email]);
      await page.fill("input[name=nome]", "ZZ Teste Controlo");
      await page.fill("input[name=email]", email);
      await page.selectOption("select[name=papel]", "gestora");
      await page.click("button:has-text('Criar utilizador')");
      await page.waitForSelector("[data-teste=password-temporaria]", { timeout: 30000 });
      const pass = (await page.locator("[data-teste=password-temporaria]").innerText()).trim();
      ok(`[${etiqueta}] mostra a password temporária uma vez`, pass.length >= 12);
      const criado = await existe(id, email);
      ok(`[${etiqueta}] a conta existe no Supabase`, !!criado);
      const perfil = criado ? await (await admin(id, `/rest/v1/profiles?id=eq.${criado.id}&select=nome,role`)).json() : [];
      ok(`[${etiqueta}] o perfil tem nome e papel`, perfil[0]?.nome === "ZZ Teste Controlo" && perfil[0]?.role === "gestora", JSON.stringify(perfil));
      ok(`[${etiqueta}] a password temporária entra mesmo`, (await entrarComo(id, email, pass)) === 200);

      await page.goto(`${BASE}/clientes/${id}`);
      const linha = page.locator(`[data-utilizador="${email}"]`);
      await linha.waitFor({ timeout: 20000 });
      ok(`[${etiqueta}] aparece na lista com o papel`, /gestora/.test(await linha.innerText()));

      await linha.locator("button:has-text('Suspender')").click();
      await page.waitForSelector(`[data-utilizador="${email}"] >> text=suspenso`, { timeout: 20000 });
      ok(`[${etiqueta}] suspender impede o acesso`, (await entrarComo(id, email, pass)) !== 200);
      await page.locator(`[data-utilizador="${email}"] button:has-text('Reativar')`).click();
      await page.waitForFunction((e) => !document.querySelector(`[data-utilizador="${e}"]`)?.textContent?.includes("suspenso"), email, { timeout: 20000 });
      ok(`[${etiqueta}] reativar devolve o acesso`, (await entrarComo(id, email, pass)) === 200);

      await page.locator(`[data-utilizador="${email}"] button:has-text('Apagar')`).click();
      await page.waitForFunction((e) => !document.querySelector(`[data-utilizador="${e}"]`), email, { timeout: 20000 });
      ok(`[${etiqueta}] apagar remove a conta e o perfil`, !(await existe(id, email)));
    }

    // Cockpit: ou cria (se o projeto tem a lista de membros) ou falha limpo e não deixa conta a meio
    await page.goto(`${BASE}/clientes/teste-cockpit`);
    await page.waitForSelector("text=Estado da instalação", { timeout: 30000 });
    const emailC = `controlo-teste-cockpit-${Date.now()}@acelabs.pt`;
    emails.push(["teste-cockpit", emailC]);
    await page.fill("input[name=email]", emailC);
    await page.check("input[value=password]");
    await page.click("button:has-text('Criar utilizador')");
    await page.waitForSelector("[data-teste=password-temporaria], p[role=alert]", { timeout: 30000 });
    const criouC = await page.locator("[data-teste=password-temporaria]").count();
    const membros = (await admin("teste-cockpit", "/rest/v1/membros?select=user_id&limit=1")).status;
    if (membros === 404) {
      ok("[cockpit] sem a tabela de membros avisa e não deixa conta a meio", criouC === 0 && !(await existe("teste-cockpit", emailC)), (await page.locator("p[role=alert]").first().innerText().catch(() => "")));
    } else {
      ok("[cockpit] cria a conta e junta-a à lista de membros", criouC === 1 && !!(await existe("teste-cockpit", emailC)));
    }
    ok("[cockpit] o estado avisa o que falta no projeto (ex.: registo público)", await page.locator("text=Registo público desligado").isVisible());
  } catch (e) {
    ok("erro inesperado no teste", false, e && e.message);
  } finally {
    // limpeza: nenhuma conta de teste fica para trás
    for (const [id, email] of emails) {
      const u = await existe(id, email).catch(() => null);
      if (u) {
        await admin(id, `/rest/v1/profiles?id=eq.${u.id}`, { method: "DELETE" }).catch(() => {});
        await admin(id, `/rest/v1/membros?user_id=eq.${u.id}`, { method: "DELETE" }).catch(() => {});
        await admin(id, `/auth/v1/admin/users/${u.id}`, { method: "DELETE" }).catch(() => {});
      }
    }
    await b.close();
    console.log(out.join("\n"));
  }
})();
