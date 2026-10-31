// Percorre as páginas principais num iPhone 14 com o motor do Safari (WebKit): abre, erros, deslizar de lado e
// campos com menos de 16px (o Safari faz zoom). Screenshots em SP/ios-*.png. Não escreve dados (só um utilizador temporário).
// Uso: node testes/ferramentas/iphone-webkit.js   (servidor em http://localhost:3001, de preferência a versão compilada)
const { webkit, devices } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const get = async (p) => (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json();
(async () => {
  const comp = (await get('compradores?select=id&limit=1'))[0], prop = (await get('proprietarios?select=id&limit=1'))[0], ang = (await get('angariacoes?select=id&limit=1'))[0];
  const email = `claude-teste-${Date.now()}@acelabs.pt`, password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: H, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  const BASE = process.env.BASE || 'http://localhost:3001';
  const erros = [], pequenos = [], largos = [], falhas = [];
  try {
    const b = await webkit.launch();
    const page = await (await b.newContext({ ...devices['iPhone 14'] })).newPage();
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 120)));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Fast Refresh|hot-update/.test(m.text())) erros.push('consola: ' + m.text().slice(0, 120)); });
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); // esperar que a página fique interativa
    await page.fill('input[type=email]', email); await page.fill('input[type=password]', password);
    await page.click('button[type=submit]'); await page.waitForURL('**/dashboard', { timeout: 30000 });
    await page.waitForLoadState('networkidle'); await page.waitForTimeout(3000);
    const rotas = { dashboard: '/dashboard', compradores: '/crm/compradores', comprador: `/crm/compradores/${comp.id}`, proprietarios: '/crm/proprietarios', proprietario: `/crm/proprietarios/${prop.id}`, angariacoes: '/angariacoes', angariacao: `/angariacoes/${ang.id}`, relatorio: `/angariacoes/${ang.id}/relatorio`, calendario: '/calendario', conta: '/conta', instalar: '/instalar' };
    for (const [n, r] of Object.entries(rotas)) {
      try {
        await page.goto(BASE + r, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
        const m = await page.evaluate(() => ({
          larg: document.documentElement.scrollWidth - window.innerWidth,
          peq: [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]), select, textarea')].filter((e) => e.offsetParent !== null && parseFloat(getComputedStyle(e).fontSize) < 16).length,
        }));
        if (m.larg > 1) largos.push(`${n} (+${m.larg}px)`);
        if (m.peq) pequenos.push(`${n}: ${m.peq}`);
        await page.screenshot({ path: `${SP}/ios-${n}.png`, fullPage: false });
      } catch (e) { falhas.push(`${n}: ${String(e).split('\n')[0].slice(0, 90)}`); }
    }
    await b.close();
  } finally { await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H }); }
  console.log(falhas.length ? 'FALHA não abriram: ' + falhas.join(' | ') : 'OK   as 11 páginas abriram no WebKit (iPhone 14)');
  console.log(erros.length ? 'FALHA erros: ' + [...new Set(erros)].slice(0, 4).join(' | ') : 'OK   sem erros de página nem na consola');
  console.log(largos.length ? 'FALHA páginas mais largas que o ecrã: ' + largos.join(', ') : 'OK   nenhuma página desliza de lado');
  console.log(pequenos.length ? 'FALHA campos com menos de 16px: ' + pequenos.join(', ') : 'OK   todos os campos com 16px ou mais (o Safari não faz zoom)');
})();
