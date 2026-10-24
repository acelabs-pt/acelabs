const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const rest = async (m, p, body) => {
  const r = await fetch(`${U}/rest/v1/${p}`, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
};
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);
(async () => {
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  const contacto = (await rest('POST', 'contactos', { nome: 'ZZ Teste Docs', telemovel: '+351900000099' }))[0];
  const comp = (await rest('POST', 'compradores', { contacto_id: contacto.id, estado: 'cpcv', cpcv_fechado: true }))[0];
  try {
    const b = await chromium.launch();
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.goto(`http://localhost:3001/crm/compradores/${comp.id}`);
    const botao = page.locator('button', { hasText: 'Usar a lista habitual' });
    await botao.waitFor({ timeout: 20000 });
    await botao.scrollIntoViewIfNeeded();
    await botao.click();
    await page.waitForSelector('text=Documentos em falta (8)', { timeout: 10000 });
    const docs = await rest('GET', `comprador_documentos?comprador_id=eq.${comp.id}&select=nome`);
    ok('lista habitual junta 8 documentos', docs.length === 8, `${docs.length}`);
    ok('o botão desaparece quando não falta nenhum', (await page.locator('button', { hasText: 'lista habitual' }).count()) === 0);
    await page.screenshot({ path: `${SP}/docs.png`, fullPage: true });
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    await rest('DELETE', `contactos?id=eq.${contacto.id}`);
    const sobra = await rest('GET', `contactos?nome=eq.ZZ%20Teste%20Docs&select=id`);
    const d = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    out.push(`limpeza: sobras=${sobra.length}; utilizador apagado (${d.status})`);
    console.log(out.join('\n'));
  }
})();
