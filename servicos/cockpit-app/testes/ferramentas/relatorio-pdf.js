const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
(async () => {
  const ang = (await (await fetch(`${U}/rest/v1/angariacoes?select=id&limit=1&order=created_at.asc`, { headers: H })).json())[0];
  const email = `claude-teste-${Date.now()}@acelabs.pt`, password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  try {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await ctx.newPage();
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email); await page.fill('input[type=password]', password);
    await page.click('button[type=submit]'); await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.goto(`http://localhost:3001/angariacoes/${ang.id}/relatorio`);
    await page.waitForSelector('text=O que já fizemos'); await page.waitForTimeout(1000);
    await page.locator('button', { hasText: 'Copiar resumo' }).click();
    await page.waitForTimeout(400);
    const texto = await page.evaluate(() => navigator.clipboard.readText());
    console.log('--- resumo copiado (primeiras linhas):\n' + texto.split('\n').slice(0, 6).join('\n'));
    console.log('--- botão mostra "Copiado":', await page.locator('button', { hasText: 'Copiado' }).count());
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: `${SP}/relatorio.pdf`, format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' } });
    await page.screenshot({ path: `${SP}/relatorio-print.png`, fullPage: true });
    console.log('pdf e screenshot de impressão gravados');
    await b.close();
  } finally { await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H }); }
})();
