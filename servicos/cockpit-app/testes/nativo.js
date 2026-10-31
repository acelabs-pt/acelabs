// Comportamento da app quando corre dentro do invólucro nativo (iPhone). Simula o WebView do iOS (o Capacitor deteta-o
// pelo canal webkit.messageHandlers.bridge) e verifica o que a web faz sozinha: marca a página, esconde as instruções de
// instalar e responde em JSON ao pedido da agenda. As funções nativas em si (push, Face ID, agenda) só se testam num
// iPhone real ou no simulador, ver LEIAME.md desta pasta.
const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const rest = async (m, p, b) => (await fetch(`${U}/rest/v1/${p}`, { method: m, headers: { ...H, Prefer: 'return=representation' }, body: b ? JSON.stringify(b) : undefined })).json().catch(() => null);

(async () => {
  const out = [];
  const ok = (nome, cond, extra = '') => out.push(`${cond ? 'OK   ' : 'FALHA'} ${nome}${extra ? ': ' + extra : ''}`);
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: H, body: JSON.stringify({ user_id: u.id }) }).catch(() => {});
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1); amanha.setHours(10, 0, 0, 0);
  const t = (await rest('POST', 'tarefas', { titulo: 'ZZ teste nativo', tipo: 'evento', inicio: amanha.toISOString(), origem: 'manual' }))[0];
  try {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    // Simula o WebView do iOS: é isto que o Capacitor procura para saber que está numa app nativa.
    await ctx.addInitScript(() => { window.webkit = { messageHandlers: { bridge: { postMessage() {} } } }; });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });

    await page.goto('http://localhost:3001/instalar');
    await page.waitForSelector('text=Instalar no telemóvel');
    await page.waitForFunction(() => document.documentElement.dataset.app === 'nativa', null, { timeout: 8000 }).catch(() => {});
    ok('a página fica marcada como app nativa', (await page.evaluate(() => document.documentElement.dataset.app)) === 'nativa');
    const visiveis = await page.evaluate(() => [...document.querySelectorAll('[data-so-web]')].filter((e) => e.offsetParent !== null).length);
    ok('instruções de instalar escondidas dentro da app', visiveis === 0, `${visiveis} visíveis`);

    // Face ID: o plugin nativo não existe neste WebView simulado. A app tem de continuar a responder (sem congelar, sem bloquear),
    // e a opção continua disponível em Conta. O ecrã de bloqueio em si só se vê num iPhone ou no simulador.
    await page.goto('http://localhost:3001/conta');
    await page.waitForSelector('text=Pedir Face ID ao abrir a app', { state: 'attached', timeout: 8000 }).catch(() => {});
    const responde = await Promise.race([page.evaluate(() => 1 + 1), new Promise((r) => setTimeout(() => r(null), 5000))]);
    ok('sem o plugin do Face ID a app responde e não fica bloqueada', responde === 2 && (await page.locator('[aria-label="Cockpit bloqueado"]').count()) === 0);
    ok('em Conta aparece a opção do Face ID', (await page.locator('text=Pedir Face ID ao abrir a app').count()) > 0);

    // Fora da app (browser normal) as instruções continuam a aparecer.
    const b2 = await chromium.launch();
    const normal = await b2.newContext({ viewport: { width: 390, height: 844 } });
    const p2 = await normal.newPage();
    await p2.goto('http://localhost:3001/login');
    await p2.fill('input[type=email]', email);
    await p2.fill('input[type=password]', password);
    await p2.click('button[type=submit]');
    await p2.waitForURL('**/dashboard', { timeout: 20000 });
    await p2.goto('http://localhost:3001/instalar');
    await p2.waitForSelector('text=Instalar no telemóvel');
    ok('no browser nunca há bloqueio de Face ID nem a opção em Conta', (await p2.locator('[aria-label="Cockpit bloqueado"]').count()) === 0);
    ok('no browser as instruções continuam visíveis', await p2.locator('text=Adicionar ao ecrã principal').first().isVisible());

    // A rota da agenda responde em JSON para a app criar o evento, e em .ics para o browser.
    const json = await page.evaluate(async (id) => { const r = await fetch(`/api/tarefas/${id}/calendario?formato=json`); return { tipo: r.headers.get('content-type'), corpo: await r.json() }; }, t.id);
    ok('agenda em JSON: título, início e dia inteiro', json.corpo.titulo === 'ZZ teste nativo' && !!json.corpo.inicio && json.corpo.diaInteiro === false, JSON.stringify(json.corpo).slice(0, 100));
    const ics = await page.evaluate(async (id) => { const r = await fetch(`/api/tarefas/${id}/calendario`); return { tipo: r.headers.get('content-type'), corpo: (await r.text()).slice(0, 15) }; }, t.id);
    ok('agenda em .ics continua igual no browser', /text\/calendar/.test(ics.tipo) && ics.corpo.startsWith('BEGIN:VCALENDAR'), ics.tipo);

    // Antes de hidratar: na app nativa com Face ID ligado a página sai marcada como bloqueada (o CSS esconde o conteúdo).
    // Stub mínimo do Capacitor, só para o script do <head>; regista se a marca chegou a ser posta.
    const bloq = await b2.newContext({ viewport: { width: 390, height: 844 } });
    await bloq.addInitScript(() => {
      window.Capacitor = { isNativePlatform: () => true };
      window.__marcou = false;
      new MutationObserver(() => { if (document.documentElement.getAttribute('data-bloqueado') === '1') window.__marcou = true; }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-bloqueado'] });
    });
    const p3 = await bloq.newPage();
    await p3.goto('http://localhost:3001/login');
    await p3.fill('input[type=email]', email);
    await p3.fill('input[type=password]', password);
    await p3.click('button[type=submit]');
    await p3.waitForTimeout(4000);
    await p3.goto('http://localhost:3001/conta', { waitUntil: 'domcontentloaded' });
    ok('na app nativa o conteúdo fica escondido antes de hidratar (Face ID ligado)', await p3.evaluate(() => window.__marcou === true));
    const login = await bloq.newPage();
    await login.goto('http://localhost:3001/login', { waitUntil: 'domcontentloaded' });
    ok('o ecrã de login nunca fica escondido', await login.evaluate(() => document.documentElement.getAttribute('data-bloqueado') !== '1'));

    await b2.close();
    await b.close();
  } finally {
    await rest('DELETE', `tarefas?id=eq.${t.id}`);
    const d = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    out.push(`limpeza: utilizador apagado (${d.status})`);
    console.log(out.join('\n'));
  }
})();
