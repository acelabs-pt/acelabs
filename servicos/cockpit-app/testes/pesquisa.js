const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const get = async (p) => (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json();
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);
(async () => {
  const cs = await get('compradores?select=estado,contactos(nome,telemovel)&estado=not.in.(perdido,negocio_concluido)&limit=1000');
  const alvo = cs.find((c) => c.contactos.telemovel && /Teste 0[1-9]/.test(c.contactos.nome));
  const total = cs.length;
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
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
    await page.goto('http://localhost:3001/crm/compradores');
    await page.waitForSelector('li a[href^="/crm/compradores/"]');
    const cartoes = () => page.locator('li a[href^="/crm/compradores/"]').count();
    ok('sem pesquisa: mostra todos os compradores em curso', (await cartoes()) === total, `${await cartoes()} de ${total}`);
    const campo = page.locator('input[type=search]');
    await campo.fill(alvo.contactos.nome.toUpperCase());
    await page.waitForTimeout(300);
    ok('por nome, sem ligar a maiúsculas', (await cartoes()) === 1, `"${alvo.contactos.nome}" -> ${await cartoes()}`);
    await campo.fill('guimaraes');
    await page.waitForTimeout(300);
    ok('por zona, sem acentos ("guimaraes" acha Guimarães)', (await cartoes()) > 1, `${await cartoes()} resultados`);
    const digitos = alvo.contactos.telemovel.replace(/\D/g, '').slice(-6);
    await campo.fill(digitos);
    await page.waitForTimeout(300);
    ok('por telefone (últimos 6 dígitos)', (await cartoes()) >= 1 && (await page.locator('li a[href^="/crm/compradores/"]', { hasText: alvo.contactos.nome }).count()) === 1, `${digitos} -> ${await cartoes()}`);
    await campo.fill('zzzzzz nao existe');
    await page.waitForTimeout(300);
    ok('sem resultados: lista vazia', (await cartoes()) === 0);
    await page.screenshot({ path: `${SP}/pesquisa-vazio.png` });
    await page.locator('button[aria-label="Limpar a pesquisa"]').click();
    await page.waitForTimeout(300);
    ok('o x limpa a pesquisa e volta tudo', (await cartoes()) === total);
    // painel de filtros escondido por defeito, com contador
    ok('filtros escondidos por defeito', (await page.locator('select:visible:not([aria-label="Ordenar a lista"])').count()) === 0);
    const lista1 = await page.locator('li a[href^="/crm/compradores/"]').first().boundingBox();
    ok('a lista começa acima da dobra (y < 520)', lista1 && lista1.y < 520, `y=${lista1 && Math.round(lista1.y)}`);
    await page.locator('button', { hasText: /^Filtros/ }).click();
    ok('o botão Filtros abre o painel', (await page.locator('select:visible').count()) > 0);
    await page.locator('select').first().selectOption('T2');
    await page.waitForTimeout(300);
    ok('o contador mostra 1 filtro ativo', (await page.locator('button', { hasText: /^Filtros\s*1$/ }).count()) === 1);
    await page.locator('button', { hasText: 'Limpar' }).first().click();
    await page.waitForTimeout(300);
    ok('Limpar tira os filtros', (await page.locator('button', { hasText: /^Filtros\s*\d/ }).count()) === 0);
    // proprietários
    await page.goto('http://localhost:3001/crm/proprietarios?fase=angariado');
    await page.waitForSelector('li a[href^="/crm/proprietarios/"]');
    const antes = await page.locator('li a[href^="/crm/proprietarios/"]').count();
    await page.locator('input[type=search]').fill('zzzzzz');
    await page.waitForTimeout(300);
    ok('proprietários também pesquisam', antes > 0 && (await page.locator('li a[href^="/crm/proprietarios/"]').count()) === 0, `${antes} -> 0`);
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    const d = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    out.push(`limpeza: utilizador apagado (${d.status})`);
    console.log(out.join('\n'));
  }
})();
