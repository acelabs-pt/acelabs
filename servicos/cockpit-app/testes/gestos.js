const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const rest = async (m, path, body) => {
  const r = await fetch(`${U}/rest/v1/${path}`, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
};
const res = [];
const ok = (n, c, extra = '') => { res.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`); };

async function touchSwipe(page, cdp, x0, y0, x1, y1) {
  const passos = 8;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= passos; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / passos, y: y0 + ((y1 - y0) * i) / passos }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(500);
}
async function arrastar(page, loc, dx) {
  const b = await loc.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x + (dx * i) / 10, y + 1);
  await page.mouse.up();
  await page.waitForTimeout(400);
}

(async () => {
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  const hoje9 = new Date(2020, 0, 1, 9, 0, 0, 0);
  const t = (await rest('POST', 'tarefas', { titulo: 'ZZ teste swipe', tipo: 'tarefa', inicio: hoje9.toISOString(), origem: 'manual' }))[0];
  try {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));
    const cdp = await ctx.newCDPSession(page);
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.waitForSelector('text=Angariações ativas');

    // 1. Dashboard: tarefa de teste
    const linha = page.locator('li', { hasText: 'ZZ teste swipe' }).first();
    await linha.scrollIntoViewIfNeeded();
    await arrastar(page, linha.locator('div.relative').first(), -150);
    ok('dashboard: deslizar esquerda abre "Adiar para quando?"', await page.locator('text=Adiar para quando?').isVisible());
    await page.screenshot({ path: `${SP}/g-adiar.png` });
    await page.locator('button', { hasText: 'Amanhã' }).click();
    await page.waitForTimeout(1200);
    const apos = (await rest('GET', `tarefas?id=eq.${t.id}&select=inicio`))[0];
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
    ok('adiar: tarefa passou para amanhã, mesma hora', new Date(apos.inicio).getDate() === amanha.getDate() && new Date(apos.inicio).getHours() === 9, apos.inicio);

    await rest('PATCH', `tarefas?id=eq.${t.id}`, { inicio: hoje9.toISOString() });
    await page.reload();
    await page.waitForSelector('text=Angariações ativas');
    const linha2 = page.locator('li', { hasText: 'ZZ teste swipe' }).first();
    await linha2.scrollIntoViewIfNeeded();
    await arrastar(page, linha2.locator('div.relative').first(), 150);
    await page.waitForTimeout(800);
    const feita = (await rest('GET', `tarefas?id=eq.${t.id}&select=feita`))[0];
    ok('dashboard: deslizar direita marca como feita', feita.feita === true);

    // 2. CRM: deslizar entre separadores (toque)
    await page.goto('http://localhost:3001/crm/compradores');
    await page.waitForSelector('text=Compradores');
    // na barra dos separadores (sobre uma linha, o gesto é da linha)
    const barra = async () => { const b = await page.locator('a[href="/crm/compradores"]').first().boundingBox(); return b.y + b.height / 2; };
    let yb = await barra();
    await touchSwipe(page, cdp, 320, yb, 40, yb + 2);
    ok('CRM: deslizar esquerda vai para Proprietários', page.url().endsWith('/crm/proprietarios'), page.url());
    await page.waitForSelector('text=Proprietários');
    yb = await barra();
    await touchSwipe(page, cdp, 60, yb, 340, yb + 2);
    ok('CRM: deslizar direita volta a Compradores', page.url().endsWith('/crm/compradores'), page.url());

    // 3. Linha de comprador: arrastar curto não abre a ficha
    const comp = page.locator('li a[href^="/crm/compradores/"]').first();
    await comp.waitFor();
    await arrastar(page, comp, 40);
    ok('lista: arrastar curto não abre a ficha', page.url().endsWith('/crm/compradores'), page.url());

    // 4. Calendário: deslizar muda o período
    await page.goto('http://localhost:3001/calendario');
    await page.waitForSelector('text=Calendário');
    await page.locator('button', { hasText: /^Dia$/ }).click();
    await page.waitForTimeout(400);
    const antes = await page.locator('h2').first().textContent();
    await touchSwipe(page, cdp, 320, 400, 40, 405);
    const depois = await page.locator('h2').first().textContent();
    ok('calendário: deslizar esquerda avança um dia', antes !== depois, `${antes} -> ${depois}`);

    // 5. Botão + e "Nova tarefa"
    await page.goto('http://localhost:3001/dashboard');
    await page.waitForSelector('text=Angariações ativas');
    await page.locator('button[aria-label="Criar novo"]').click();
    ok('botão +: abre as ações rápidas', await page.locator('text=Novo proprietário').isVisible());
    await page.screenshot({ path: `${SP}/g-fab.png` });
    await page.locator('a', { hasText: 'Nova tarefa' }).click();
    await page.waitForURL('**/calendario**');
    await page.waitForTimeout(800);
    ok('"Nova tarefa" abre a folha de criação', await page.locator('h3', { hasText: 'Novo' }).isVisible());

    // 6. Fechar folha a puxar para baixo
    const pega = page.locator('div.md\\:hidden[aria-hidden="true"]').first();
    if (await pega.count()) {
      const bb = await pega.boundingBox();
      await page.mouse.move(bb.x + bb.width / 2, bb.y + 8);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(bb.x + bb.width / 2, bb.y + 8 + i * 25);
      await page.mouse.up();
      await page.waitForTimeout(500);
      ok('folha: puxar para baixo fecha', !(await page.locator('h3', { hasText: 'Novo' }).isVisible()));
    } else {
      ok('folha: barra de puxar existe', false);
    }
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    await rest('DELETE', `tarefas?id=eq.${t.id}`);
    const d = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    res.push(`limpeza: tarefa de teste apagada, utilizador apagado (${d.status})`);
    console.log(res.join('\n'));
  }
})();
