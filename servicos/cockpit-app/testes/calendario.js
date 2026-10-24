const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const rest = async (m, p, body) => { const r = await fetch(`${U}/rest/v1/${p}`, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);
(async () => {
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  // tarefas de teste: uma hoje às 11h, uma daqui a 40 dias (fora da janela do mês atual) e uma em atraso
  const h = new Date(); h.setHours(11, 0, 0, 0);
  const longe = new Date(); longe.setDate(longe.getDate() + 40); longe.setHours(11, 0, 0, 0);
  const t = await rest('POST', 'tarefas', [
    { titulo: 'ZZ Cal hoje', tipo: 'evento', inicio: h.toISOString(), fim: new Date(h.getTime() + 3600000).toISOString(), origem: 'manual' },
    { titulo: 'ZZ Cal longe', tipo: 'tarefa', inicio: longe.toISOString(), fim: null, origem: 'manual' },
    { titulo: 'ZZ Cal atraso', tipo: 'tarefa', fim: null, inicio: (() => { const o = new Date(); o.setDate(o.getDate() - 1); o.setHours(9, 0, 0, 0); return o.toISOString(); })(), origem: 'manual' },
  ]);
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
    await page.goto('http://localhost:3001/calendario');
    await page.waitForSelector('text=Nada marcado para este dia', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    const mesTxt = await page.locator('body').innerText();
    out.push('DEBUG mes: tem hoje=' + mesTxt.includes('ZZ Cal hoje') + ' nLi=' + (await page.locator('li').count()) + ' tamanho=' + mesTxt.length + ' linhas com ZZ=' + mesTxt.split(String.fromCharCode(10)).filter((l) => l.includes('ZZ')).length);
    ok('mês: mostra a tarefa de hoje no dia escolhido', mesTxt.includes('ZZ Cal hoje'));
    ok('mês: não traz a tarefa que está 40 dias à frente', !mesTxt.includes('ZZ Cal longe'));
    await page.locator('button', { hasText: /^Semana$/ }).click();
    await page.waitForTimeout(1200);
    ok('semana: carrega sem erro', !(await page.locator('text=Não foi possível').count()));
    await page.locator('button', { hasText: /^Tarefas$/ }).click();
    await page.waitForSelector('text=Em atraso', { timeout: 15000 });
    const txt = await page.locator('body').innerText();
    ok('lista: mostra em atraso, hoje e próximas', txt.includes('ZZ Cal atraso') && txt.includes('ZZ Cal hoje') && txt.includes('ZZ Cal longe'), 'atraso=' + txt.includes('ZZ Cal atraso') + ' hoje=' + txt.includes('ZZ Cal hoje') + ' longe=' + txt.includes('ZZ Cal longe') + ' | ' + txt.split(String.fromCharCode(10)).filter((l) => /^(Em atraso|Hoje|Próximas|Sem data|Feitas)/.test(l)).join(' ; '));
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    await rest('DELETE', 'tarefas?titulo=ilike.ZZ%20Cal*');
    const sobra = await rest('GET', 'tarefas?titulo=ilike.ZZ%20Cal*&select=id');
    const d = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    out.push(`limpeza: sobras=${sobra.length}; utilizador apagado (${d.status})`);
    console.log(out.join('\n'));
  }
})();
