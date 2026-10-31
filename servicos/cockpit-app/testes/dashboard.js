const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const rest = async (m, p, body) => { const r = await fetch(`${U}/rest/v1/${p}`, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);
(async () => {
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  // Ontem às 9h: em atraso, mas dentro das 200 mais recentes que o calendário carrega (uma data de 2020 ficava
  // de fora assim que a carteira de demonstração enche a lista).
  const antigo = new Date();
  antigo.setDate(antigo.getDate() - 1);
  antigo.setHours(9, 0, 0, 0);
  const t = (await rest('POST', 'tarefas', { titulo: 'ZZ UX desfazer', tipo: 'tarefa', inicio: antigo.toISOString(), origem: 'manual' }))[0];
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
    await page.waitForSelector('text=Angariações ativas');

    // 1. esqueleto: atrasar os dados 2 s e ver o esqueleto
    await page.route('**/rest/v1/**', async (route) => { await new Promise((r) => setTimeout(r, 2000)); try { await route.continue(); } catch {} });
    await page.reload();
    const viuEsqueleto = await page.locator('[aria-label="A carregar"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    ok('dashboard: esqueleto enquanto carrega', viuEsqueleto);
    await page.screenshot({ path: `${SP}/ux-esqueleto.png` });
    await page.unroute('**/rest/v1/**');
    await page.waitForSelector('text=Angariações ativas', { timeout: 30000 });
    ok('o esqueleto desaparece quando chegam os dados', (await page.locator('[aria-label="A carregar"]').count()) === 0);

    // 2. frase-resumo
    const resumo = await page.locator('p', { hasText: /Bom dia|Boa tarde|Boa noite/ }).first().innerText();
    ok('frase-resumo com saudação e tarefas', /Tens \d+ tarefa/.test(resumo) || /em dia/.test(resumo), resumo.slice(0, 90));

    // 3. primeiros passos
    await page.evaluate(() => localStorage.removeItem('cockpit-primeiros-passos-escondido'));
    await page.reload();
    await page.waitForSelector('text=Angariações ativas');
    const pp = page.locator('section[aria-label="Primeiros passos"]');
    ok('primeiros passos aparecem (falta instalar)', await pp.isVisible());
    ok('mostra quantos passos estão feitos', /\d de 4 feitos/.test(await pp.innerText()), (await pp.innerText()).match(/\d de 4 feitos/)?.[0]);
    await page.screenshot({ path: `${SP}/ux-primeiros.png`, fullPage: false });
    await pp.locator('a', { hasText: 'Ver como' }).click();
    await page.waitForURL('**/instalar');
    ok('"Ver como" abre a página Instalar', await page.locator('h1', { hasText: 'Instalar no telemóvel' }).isVisible());
    ok('Instalar diz que estás no browser', await page.locator('text=Estás a ver no browser').waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
    await page.screenshot({ path: `${SP}/ux-instalar.png`, fullPage: true });
    await page.goto('http://localhost:3001/dashboard');
    await page.waitForSelector('text=Angariações ativas');
    await pp.locator('button', { hasText: 'Esconder' }).click();
    ok('Esconder tira o cartão', !(await pp.isVisible().catch(() => false)));
    await page.reload();
    await page.waitForSelector('text=Angariações ativas');
    await page.waitForTimeout(500);
    ok('e lembra-se depois de recarregar', !(await pp.isVisible().catch(() => false)));

    // 4. Seguimentos da semana no Dashboard
    ok('Dashboard mostra os Seguimentos da semana', await page.locator('text=/Seguimentos da semana/').first().isVisible());

    // 5. desfazer "feita" (na lista de tarefas do calendário)
    await page.goto('http://localhost:3001/calendario');
    await page.locator('button', { hasText: /^Tarefas$/ }).click();
    // Com a carteira de demonstração a lista só mostra as primeiras de cada secção: abre "Mostrar mais" até aparecer.
      const alvo = page.locator('li', { hasText: 'ZZ UX desfazer' }).first();
      for (let i = 0; i < 15 && !(await alvo.isVisible()); i++) {
        const mais = page.locator('button', { hasText: /Mostrar mais/ }).first();
        if (!(await mais.count())) { await page.waitForTimeout(400); continue; }
        await mais.click();
      }
      await alvo.waitFor({ timeout: 15000 });
    const linha = alvo;
    await linha.locator('button[aria-label="Marcar como feita"]').click();
    await page.waitForSelector('text=Tarefa feita.', { timeout: 10000 });
    await page.screenshot({ path: `${SP}/ux-toast.png` });
    let db = (await rest('GET', `tarefas?id=eq.${t.id}&select=feita`))[0];
    ok('marcar feita grava', db.feita === true);
    await page.locator('button', { hasText: 'Desfazer' }).last().click();
    await page.waitForTimeout(1500);
    db = (await rest('GET', `tarefas?id=eq.${t.id}&select=feita`))[0];
    ok('"Desfazer" volta a pôr por fazer', db.feita === false);

    // 6. desfazer "adiar"
    const linha2 = page.locator('li', { hasText: 'ZZ UX desfazer' }).first();
    await linha2.locator('button', { hasText: 'Adiar' }).click();
    await page.locator('button', { hasText: 'Amanhã' }).click();
    await page.waitForSelector('text=Adiada para', { timeout: 10000 });
    db = (await rest('GET', `tarefas?id=eq.${t.id}&select=inicio`))[0];
    ok('adiar muda a data', new Date(db.inicio).getTime() !== antigo.getTime(), db.inicio);
    await page.locator('button', { hasText: 'Desfazer' }).last().click();
    await page.waitForTimeout(1500);
    db = (await rest('GET', `tarefas?id=eq.${t.id}&select=inicio`))[0];
    ok('"Desfazer" repõe a data e a hora originais', new Date(db.inicio).getTime() === antigo.getTime(), db.inicio);

    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    await rest('DELETE', `tarefas?id=eq.${t.id}`);
    const d = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: { apikey: K, Authorization: `Bearer ${K}` } });
    out.push(`limpeza: tarefa e utilizador de teste apagados (${d.status})`);
    console.log(out.join('\n'));
  }
})();
