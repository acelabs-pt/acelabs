const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
async function touchSwipe(page, cdp, x0, y0, x1, y1) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 8, y: y0 + ((y1 - y0) * i) / 8 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(700);
}
(async () => {
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  const out = [];
  try {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.goto('http://localhost:3001/crm/compradores');
    await page.waitForSelector('text=Compradores');
    const tabs = await page.locator('a[href="/crm/compradores"]').first().boundingBox();
    const y = tabs.y + tabs.height / 2;
    await touchSwipe(page, cdp, 340, y, 40, y + 2);
    out.push(`${page.url().endsWith('/crm/proprietarios') ? 'OK   ' : 'FALHA'} esquerda na barra: ${page.url()}`);
    await page.waitForSelector('text=Proprietários');
    const tabs2 = await page.locator('a[href="/crm/compradores"]').first().boundingBox();
    await touchSwipe(page, cdp, 40, tabs2.y + tabs2.height / 2, 340, tabs2.y + tabs2.height / 2 + 2);
    out.push(`${page.url().endsWith('/crm/compradores') ? 'OK   ' : 'FALHA'} direita na barra: ${page.url()}`);
    // sobre uma linha, o gesto nao muda de separador
    const linha = page.locator('li a[href^="/crm/compradores/"]').first();
    await linha.waitFor();
    const lb = await linha.boundingBox();
    await touchSwipe(page, cdp, 300, lb.y + lb.height / 2, 120, lb.y + lb.height / 2 + 2);
    out.push(`${page.url().endsWith('/crm/compradores') ? 'OK   ' : 'FALHA'} sobre uma linha nao muda de separador: ${page.url()}`);
    await page.screenshot({ path: `${SP}/g-crm.png` });
    await b.close();
  } finally {
    const d = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    out.push(`limpeza: utilizador apagado (${d.status})`);
    console.log(out.join('\n'));
  }
})();
