// Sem rede: o Dashboard guarda a lista do dia no telemóvel, a página sem rede mostra-a com o botão de ligar,
// não mostra listas de outro dia, e sair apaga a lista.
const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const rest = async (m, p, body) => {
  const r = await fetch(`${U}/rest/v1/${p}`, { method: m, headers: { ...H, Prefer: 'return=representation' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
};
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);

(async () => {
  const email = `claude-teste-${Date.now()}@acelabs.pt`, password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: H, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  const [ct] = await rest('POST', 'contactos', { nome: 'ZZ Sem Rede', telemovel: '+351900111222' });
  const [cp] = await rest('POST', 'compradores', { contacto_id: ct.id });
  // a mais antiga em atraso, para entrar nas primeiras da lista
  await rest('POST', 'tarefas', { titulo: 'ZZ Sem Rede ligar ao comprador', inicio: '2025-01-02T10:00:00Z', comprador_id: cp.id, origem: 'comprador' });
  try {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email); await page.fill('input[type=password]', password);
    await page.click('button[type=submit]'); await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.waitForSelector('text=ZZ Sem Rede ligar ao comprador', { timeout: 20000 });
    const guardado = await page.evaluate(() => JSON.parse(localStorage.getItem('cockpit-dia') || 'null'));
    const t = guardado?.tarefas.find((x) => x.titulo === 'ZZ Sem Rede ligar ao comprador');
    ok('o Dashboard guarda a lista do dia no telemóvel', !!t && t.atrasada === true && t.tel === '+351900111222', JSON.stringify(t));
    ok('guarda só o que o cartão Hoje mostra (até 20, sem feitas)', guardado.tarefas.length <= 20 && Object.keys(t).join() === 'titulo,inicio,atrasada,tel', Object.keys(t || {}).join());

    // tocar no título da tarefa abre a ficha do comprador
    await page.getByRole('link', { name: 'ZZ Sem Rede ligar ao comprador' }).click();
    await page.waitForURL(`**/crm/compradores/${cp.id}`, { timeout: 15000 }).catch(() => {});
    ok('no Dashboard, tocar na tarefa abre a ficha da pessoa', page.url().endsWith(`/crm/compradores/${cp.id}`), page.url());

    await page.goto('http://localhost:3001/offline.html');
    await page.waitForSelector('#dia:not([hidden])', { timeout: 5000 }).catch(() => {});
    ok('a página sem rede mostra a lista de hoje', await page.locator('#lista li', { hasText: 'ZZ Sem Rede ligar ao comprador' }).isVisible());
    ok('com o botão de ligar', (await page.locator('#lista li', { hasText: 'ZZ Sem Rede ligar ao comprador' }).locator('a.ligar').getAttribute('href')) === 'tel:+351900111222');
    ok('e a tarefa marcada em atraso', /em atraso/.test(await page.locator('#lista li', { hasText: 'ZZ Sem Rede' }).locator('.quando').textContent()));
    await page.screenshot({ path: `${SP}/semrede.png`, fullPage: true });

    // uma lista de ontem não aparece
    await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('cockpit-dia')); localStorage.setItem('cockpit-ontem', JSON.stringify(d)); d.dia = '2020-01-01'; localStorage.setItem('cockpit-dia', JSON.stringify(d)); });
    await page.reload();
    await page.waitForTimeout(300);
    ok('uma lista de outro dia não é mostrada', await page.locator('#dia').isHidden());
    await page.evaluate(() => localStorage.setItem('cockpit-dia', localStorage.getItem('cockpit-ontem')));

    // sair apaga a lista
    await page.goto('http://localhost:3001/conta');
    await page.getByRole('button', { name: 'Sair' }).click();
    await page.waitForURL('**/login', { timeout: 15000 });
    ok('sair apaga a lista guardada', (await page.evaluate(() => localStorage.getItem('cockpit-dia'))) === null);
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    await rest('DELETE', `contactos?id=eq.${ct.id}`); // cascata: comprador e tarefa
    const sobra = await rest('GET', 'tarefas?titulo=like.ZZ%20Sem%20Rede*&select=id');
    await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    out.push(`limpeza: tarefas que sobraram = ${Array.isArray(sobra) ? sobra.length : sobra}`);
    console.log(out.join('\n'));
  }
})();
