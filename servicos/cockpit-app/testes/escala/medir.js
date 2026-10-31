const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const PAGINAS = [
  ['Dashboard', '/dashboard', 'text=Angariações ativas'],
  ['Compradores', '/crm/compradores', 'li a[href^="/crm/compradores/"]'],
  ['Proprietários', '/crm/proprietarios', 'li a[href^="/crm/proprietarios/"]'],
  ['Angariações', '/angariacoes', 'li a[href^="/angariacoes/"]'],
  ['Calendário (mês)', '/calendario', 'text=Abrir dia'],
];
(async () => {
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  const linhas = [];
  try {
    const b = await chromium.launch();
    for (const cpu of [1, 4]) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addInitScript(() => {
        window.__lt = 0;
        try { new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lt += e.duration))).observe({ entryTypes: ['longtask'] }); } catch {}
      });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await page.goto('http://localhost:3001/login');
      await page.fill('input[type=email]', email);
      await page.fill('input[type=password]', password);
      await page.click('button[type=submit]');
      await page.waitForURL('**/dashboard', { timeout: 60000 });
      await page.waitForTimeout(1500);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      for (const [nome, rota, sel] of PAGINAS) {
        let bytes = 0, pedidos = 0;
        const onResp = async (r) => {
          if (r.url().includes('/rest/v1/')) { pedidos++; try { bytes += (await r.body()).length; } catch {} }
        };
        page.on('response', onResp);
        await page.goto('about:blank');
        await page.evaluate(() => (window.__lt = 0));
        const t0 = Date.now();
        await page.goto(`http://localhost:3001${rota}`);
        let estado = 'ok';
        try { await page.waitForSelector(sel, { timeout: 120000 }); } catch { estado = 'TIMEOUT'; }
        const ms = Date.now() - t0;
        await page.waitForTimeout(1500);
        const lt = await page.evaluate(() => Math.round(window.__lt));
        page.off('response', onResp);
        linhas.push(`${cpu === 1 ? 'PC          ' : 'Telemóvel 4x'} | ${nome.padEnd(20)} | ${String(ms).padStart(6)} ms | bloqueio ${String(lt).padStart(6)} ms | ${pedidos} pedidos, ${(bytes / 1048576).toFixed(1)} MB | ${estado}`);
      }
      await ctx.close();
    }
    await b.close();
  } finally {
    await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    console.log(linhas.join('\n'));
  }
})();
