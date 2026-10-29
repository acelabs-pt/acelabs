// Capturas de ecrã para o App Store Connect, a partir da carteira de demonstração do projeto de TESTE. Só lê.
// 440x956 a 3x = 1320x2868 (iPhone de 6,9 polegadas). São renders do browser: o ideal é refazê-las no simulador
// ou num iPhone real (barra de estado verdadeira) antes de submeter. Uso (servidor em localhost:3001):
//   SP=<pasta de saída> node testes/ferramentas/capturas-appstore.js   (com as variáveis do .env.local e .env.testes)
const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const get = async (p) => (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json();
(async () => {
  const comp = (await get('compradores?select=id&estado=eq.cpcv&limit=1'))[0] || (await get('compradores?select=id&limit=1'))[0];
  const ang = (await get('angariacoes?select=id&limit=1&order=created_at.asc'))[0];
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: H, body: JSON.stringify({ user_id: u.id }) }).catch(() => {});
  try {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    const rotas = [
      ['1-dashboard', '/dashboard'],
      ['2-angariacoes', '/angariacoes'],
      ['3-comprador', `/crm/compradores/${comp.id}`],
      ['4-calendario', '/calendario'],
      ['5-relatorio', `/angariacoes/${ang.id}/relatorio`],
    ];
    for (const [nome, rota] of rotas) {
      await page.goto('http://localhost:3001' + rota);
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SP}/${nome}.png`, fullPage: false });
      console.log('ok', nome);
    }
    await b.close();
  } finally {
    await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
  }
})();
