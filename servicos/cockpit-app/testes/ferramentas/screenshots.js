// Screenshots de todas as páginas, no telemóvel, para revisão visual. Só lê.
const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const get = async (p) => (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json();
const W = Number(process.env.W || 390);
(async () => {
  const comp = (await get('compradores?select=id&estado=eq.cpcv&limit=1'))[0];
  const prop = (await get('proprietarios?select=id&limit=1'))[0];
  const ang = (await get('angariacoes?select=id&limit=1&order=created_at.asc'))[0];
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  try {
    const b = await chromium.launch();
    const page = await (await b.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 1 })).newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    const paginas = (process.env.PAGINAS || 'angariacoes,angariacao,relatorio,comprador,proprietario,calendario,tarefas,importar,novo-comprador,conta').split(',');
    const rotas = {
      angariacoes: '/angariacoes', angariacao: `/angariacoes/${ang.id}`, relatorio: `/angariacoes/${ang.id}/relatorio`,
      comprador: `/crm/compradores/${comp.id}`, proprietario: `/crm/proprietarios/${prop.id}`, calendario: '/calendario',
      tarefas: '/calendario', importar: '/importar', 'novo-comprador': '/crm/compradores/novo', conta: '/conta',
    };
    for (const p of paginas) {
      await page.goto('http://localhost:3001' + rotas[p]);
      await page.waitForTimeout(2500);
      if (p === 'tarefas') {
        await page.locator('button', { hasText: /^Tarefas$/ }).click();
        await page.waitForTimeout(1500);
      }
      await page.screenshot({ path: `${SP}/tour-${W}-${p}.png`, fullPage: true });
    }
    console.log('ok, erros de página:', JSON.stringify(erros));
    await b.close();
  } finally {
    await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
  }
})();
