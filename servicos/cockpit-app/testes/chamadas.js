const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const rest = async (m, p, body) => { const r = await fetch(`${U}/rest/v1/${p}`, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);
(async () => {
  const inicioTeste = new Date().toISOString();
  // dois compradores só deste teste (sem chamadas nem dados antigos), os mais recentes da lista
  const cts = await rest('POST', 'contactos', [
    { nome: 'ZZ UX Chamadas A', telemovel: '+351900777001' },
    { nome: 'ZZ UX Chamadas B', telemovel: '+351900777002' },
  ]);
  const cps = await rest('POST', 'compradores', cts.map((c) => ({ contacto_id: c.id })));
  const [A, B] = cps.map((c) => ({ id: c.id, contacto_id: c.contacto_id }));
  const antiga = new Date(Date.now() - 10 * 86400000).toISOString();
  await rest('POST', 'chamadas', [
    { contacto_id: A.contacto_id, ocorreu_em: antiga, observacoes: 'ZZ UX antigo' },
    { contacto_id: B.contacto_id, ocorreu_em: new Date().toISOString(), observacoes: 'ZZ UX hoje' },
  ]);
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  try {
    const b = await chromium.launch();
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    page.on('dialog', (d) => d.accept());
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.goto('http://localhost:3001/crm/compradores');
    await page.waitForSelector('li a[href^="/crm/compradores/"]');
    await page.waitForTimeout(800);
    const cartaoA = page.locator('li a[href="/crm/compradores/' + A.id + '"]');
    const cartaoB = page.locator('li a[href="/crm/compradores/' + B.id + '"]');
    ok('cartão mostra "Último contacto há 10 dias"', /Último contacto há 10 dias/.test(await cartaoA.innerText()));
    ok('cartão mostra "Último contacto hoje"', /Último contacto hoje/.test(await cartaoB.innerText()));
    ok('quem não tem chamadas diz que ainda não tem', (await page.locator('text=Ainda sem chamadas registadas').count()) > 0);

    // ordenar por "sem contacto há mais tempo"
    await page.locator('select[aria-label="Ordenar a lista"]').selectOption('parados');
    await page.waitForTimeout(400);
    const hrefs = await page.locator('li a[href^="/crm/compradores/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    const iA = hrefs.indexOf('/crm/compradores/' + A.id), iB = hrefs.indexOf('/crm/compradores/' + B.id);
    const semChamadas = (await page.locator('li a[href^="/crm/compradores/"]', { hasText: 'Ainda sem chamadas' }).count());
    ok('ordem "sem contacto há mais tempo": nunca contactados primeiro', iA >= semChamadas && iB >= semChamadas, `sem chamadas=${semChamadas}, A=${iA}, B=${iB}`);
    ok('e depois o de há 10 dias antes do de hoje', iA >= 0 && iB >= 0 && iA < iB);
    await page.screenshot({ path: `${SP}/ux2-lista.png` });

    // swipe de ligar regista a chamada
    const antesN = (await rest('GET', `chamadas?contacto_id=eq.${A.contacto_id}&select=id`)).length;
    await cartaoA.scrollIntoViewIfNeeded();
    const box = await cartaoA.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width / 2 + i * 16, box.y + box.height / 2 + 1);
    await page.mouse.up();
    await page.waitForSelector('text=Chamada registada.', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    const depoisN = (await rest('GET', `chamadas?contacto_id=eq.${A.contacto_id}&select=id`)).length;
    ok('deslizar para ligar regista uma chamada', depoisN === antesN + 1, `${antesN} -> ${depoisN}`);
    await page.screenshot({ path: `${SP}/ux2-toast.png` });
    await page.locator('button', { hasText: 'Desfazer' }).click().catch(() => {});
    await page.waitForTimeout(1000);
    const aposDesfazer = (await rest('GET', `chamadas?contacto_id=eq.${A.contacto_id}&select=id`)).length;
    ok('e "Desfazer" apaga-a', aposDesfazer === antesN, `${aposDesfazer}`);

    // ficha: histórico e registo rápido
    await page.goto('http://localhost:3001/crm/compradores/' + A.id);
    await page.waitForSelector('text=Chamadas');
    ok('ficha mostra a chamada antiga', await page.locator('text=ZZ UX antigo').waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
    ok('ficha diz "última há 10 dias"', await page.locator('text=última há 10 dias').waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
    await page.locator('textarea[placeholder^="Nota da chamada"]').fill('ZZ UX nota nova');
    await page.locator('button', { hasText: 'Registei uma chamada agora' }).click();
    await page.waitForSelector('text=ZZ UX nota nova', { timeout: 8000 });
    ok('registar na ficha acrescenta ao histórico', true);
    ok('e aparece o aviso com Desfazer', await page.locator('text=Chamada registada.').waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
    await page.screenshot({ path: `${SP}/ux2-ficha.png`, fullPage: true });
    await page.locator('li', { hasText: 'ZZ UX nota nova' }).locator('button[aria-label="Apagar este registo"]').click();
    await page.waitForTimeout(1000);
    ok('apagar um registo tira-o da lista', (await page.locator('text=ZZ UX nota nova').count()) === 0);

    // proprietários: último contacto e ordenar
    await page.goto('http://localhost:3001/crm/proprietarios?fase=angariado');
    await page.waitForSelector('li a[href^="/crm/proprietarios/"]');
    ok('proprietários mostram o último contacto', (await page.locator('text=/Último contacto|Ainda sem chamadas/').count()) > 0);
    ok('e têm o seletor de ordem', await page.locator('select[aria-label="Ordenar a lista"]').isVisible());
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    await rest('DELETE', 'contactos?nome=ilike.ZZ UX Chamadas*'); // cascata: fichas e chamadas
    await rest('DELETE', `chamadas?or=(observacoes.ilike.ZZ UX*,and(contacto_id.in.(${A.contacto_id},${B.contacto_id}),ocorreu_em.gte.${inicioTeste}))`);
    const sobra = await rest('GET', `chamadas?or=(observacoes.ilike.ZZ UX*,and(contacto_id.in.(${A.contacto_id},${B.contacto_id}),ocorreu_em.gte.${inicioTeste}))&select=id`);
    const d = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: { apikey: K, Authorization: `Bearer ${K}` } });
    out.push(`limpeza: chamadas de teste apagadas (sobras ${Array.isArray(sobra) ? sobra.length : '?'}), utilizador apagado (${d.status})`);
    console.log(out.join('\n'));
  }
})();
