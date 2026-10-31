// "Pôr no calendário do telemóvel": o detalhe da marcação dá um .ics com alarme e o telefone do comprador;
// sem sessão a rota não dá nada; uma tarefa que não existe dá 404.
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
  const [ct] = await rest('POST', 'contactos', { nome: 'ZZ Calendario Telemovel', telemovel: '+351900333444' });
  const [cp] = await rest('POST', 'compradores', { contacto_id: ct.id });
  const ini = new Date(); ini.setHours(21, 30, 0, 0);
  const [t] = await rest('POST', 'tarefas', { titulo: 'ZZ Visita, T2 Creixomil', tipo: 'evento', inicio: ini.toISOString(), comprador_id: cp.id, origem: 'comprador' });
  try {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email); await page.fill('input[type=password]', password);
    await page.click('button[type=submit]'); await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.goto('http://localhost:3001/calendario');
    await page.locator('button', { hasText: /^Mês$/ }).click();
    const linha = page.locator('li button.text-left', { hasText: 'ZZ Visita, T2 Creixomil' });
    await linha.waitFor({ timeout: 15000 });
    const link = page.getByRole('link', { name: 'Pôr no calendário do telemóvel' });
    for (let i = 0; i < 5 && !(await link.isVisible()); i++) { await linha.click(); await page.waitForTimeout(600); } // a lista pode recarregar logo a seguir a aparecer
    await page.screenshot({ path: `${SP}/calendario-telemovel.png` });
    const href = await link.getAttribute('href');
    ok('o detalhe da marcação tem "Pôr no calendário do telemóvel"', href === `/api/tarefas/${t.id}/calendario`, href);
    ok('o endereço não leva o nome do cliente', !/ZZ|Visita/.test(href));
    const r = await page.request.get('http://localhost:3001' + href);
    const ics = (await r.text()).replace(/\r\n /g, '');
    ok('devolve um ficheiro de calendário', r.status() === 200 && r.headers()['content-type'].startsWith('text/calendar'), `${r.status()} ${r.headers()['content-type']}`);
    ok('com o título, a hora e alarme 30 min antes', ics.includes('SUMMARY:ZZ Visita\\, T2 Creixomil') && ics.includes(`DTSTART:${ini.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`) && ics.includes('TRIGGER:-PT30M'));
    ok('com o telefone e a ficha do comprador', ics.includes('Telefone: +351900333444') && ics.includes(`/crm/compradores/${cp.id}`));
    ok('nome do ficheiro sem acentos', /filename="zz-visita-t2-creixomil\.ics"/.test(r.headers()['content-disposition'] || ''), r.headers()['content-disposition']);
    const nada = await page.request.get('http://localhost:3001/api/tarefas/00000000-0000-0000-0000-000000000000/calendario');
    ok('tarefa que não existe dá 404', nada.status() === 404, String(nada.status()));
    const anon = await (await b.newContext()).request.get('http://localhost:3001' + href, { maxRedirects: 0 });
    ok('sem sessão não devolve a marcação', anon.status() >= 300 && anon.status() < 400 && !(await anon.text()).includes('BEGIN:VCALENDAR'), String(anon.status()));
    // criar uma marcação: o aviso oferece logo "Pôr no telemóvel"
    await page.keyboard.press('Escape').catch(() => {});
    await page.goto('http://localhost:3001/calendario');
    await page.getByRole('button', { name: 'Novo', exact: true }).click();
    await page.fill('input[placeholder="Título"]', 'ZZ Calendario Telemovel nova marcação');
    await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
    const acao = page.getByRole('button', { name: 'Pôr no telemóvel' });
    await acao.waitFor({ timeout: 10000 }).catch(() => {});
    ok('ao criar uma marcação, o aviso oferece "Pôr no telemóvel"', await acao.isVisible() && await page.locator('text=Marcação criada.').isVisible());
    const [criada] = await rest('GET', 'tarefas?titulo=eq.ZZ%20Calendario%20Telemovel%20nova%20marca%C3%A7%C3%A3o&select=id');
    if (await acao.isVisible()) {
      const [resp] = await Promise.all([page.waitForResponse((r) => r.url().includes('/calendario') && r.url().includes('/api/tarefas/'), { timeout: 10000 }).catch(() => null), acao.click()]);
      ok('e tocar descarrega o .ics da marcação nova', !!resp && !!criada && resp.url().includes(criada.id) && resp.headers()['content-type'].startsWith('text/calendar'), resp ? resp.url().slice(-60) : 'sem resposta');
    }
    if (criada) await rest('DELETE', `tarefas?id=eq.${criada.id}`);

    // reunião de angariação na ficha do proprietário
    const [pr] = await rest('POST', 'proprietarios', { contacto_id: ct.id, estado: 'reuniao_marcada', reuniao_em: ini.toISOString() });
    const [tr] = await rest('POST', 'tarefas', { titulo: 'ZZ Reunião de angariação', tipo: 'evento', inicio: ini.toISOString(), proprietario_id: pr.id, contacto_id: ct.id, origem: 'proprietario', chave_automacao: `proprietario:${pr.id}:reuniao` });
    await page.goto(`http://localhost:3001/crm/proprietarios/${pr.id}`);
    const lr = page.getByRole('link', { name: 'Pôr no calendário do telemóvel' });
    await lr.waitFor({ timeout: 15000 }).catch(() => {});
    ok('a reunião de angariação tem "Pôr no calendário do telemóvel"', (await lr.getAttribute('href').catch(() => null)) === `/api/tarefas/${tr.id}/calendario`);
    await page.screenshot({ path: `${SP}/calendario-telemovel-reuniao.png` });
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    await rest('DELETE', `contactos?id=eq.${ct.id}`); // cascata: comprador e tarefa
    await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    console.log(out.join('\n'));
  }
})();
