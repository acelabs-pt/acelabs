const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const BASE = process.env.BASE;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);
(async () => {
  // 1. Sem browser: o que o mundo vê
  for (const [rota, esperado] of [['/', [200, 307, 308]], ['/login', [200]], ['/manifest.webmanifest', [200]], ['/sw.js', [200]], ['/icons/icon-512.png', [200]], ['/offline.html', [200]], ['/dashboard', [307, 308]]]) {
    const r = await fetch(BASE + rota, { redirect: 'manual' });
    ok(`HTTP ${rota}`, esperado.includes(r.status), `-> ${r.status}${r.headers.get('location') ? ' para ' + r.headers.get('location') : ''}`);
  }
  const man = await (await fetch(BASE + '/manifest.webmanifest')).json();
  ok('manifest: nome, modo ecrã inteiro e ícones', man.name === 'Cockpit' && man.display === 'standalone' && man.icons.length >= 3, `${man.name} ${man.display} ${man.icons.length} ícones`);

  // 2. Com browser, com um utilizador de teste temporário
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  try {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const erros = [], falhas = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 120)));
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/auth/v1/user')) falhas.push(`${r.status()} ${r.url().slice(0, 90)}`); });
    await page.goto(BASE + '/login');
    ok('login abre', await page.locator('text=Entra no teu Cockpit').isVisible());
    await page.screenshot({ path: `${SP}/live-login.png` });
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    await page.waitForSelector('text=Angariações ativas', { timeout: 30000 });
    ok('login e dashboard no endereço publicado', true);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${SP}/live-dashboard.png`, fullPage: true });

    // service worker (só se regista em produção) e instalabilidade, segundo o próprio Chrome
    const sw = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return r ? (r.active ? 'ativo' : r.installing ? 'a instalar' : 'registado') : 'nenhum';
    });
    ok('service worker registado', sw !== 'nenhum', sw);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Page.enable');
    const inst = await cdp.send('Page.getInstallabilityErrors');
    ok('Chrome considera a app instalável', inst.installabilityErrors.length === 0, inst.installabilityErrors.map((e) => e.errorId).join(',') || 'sem erros');

    // ecrã sem rede: com o service worker ativo, sem internet aparece o aviso
    await page.waitForTimeout(1500);
    await ctx.setOffline(true);
    await page.goto(BASE + '/calendario').catch(() => {});
    await page.waitForTimeout(1500);
    const off = await page.locator('text=Sem ligação').count();
    ok('sem internet mostra o ecrã "Sem ligação"', off > 0);
    await ctx.setOffline(false);

    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    ok('sem respostas de erro (4xx, 5xx) a recursos', falhas.length === 0, JSON.stringify(falhas.slice(0, 4)));
    await b.close();
  } finally {
    const d = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    out.push(`limpeza: utilizador de teste apagado (${d.status})`);
    console.log(out.join('\n'));
  }
})();
