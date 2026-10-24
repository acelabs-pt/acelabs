const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const get = async (p) => { const todos = []; for (let off = 0; ; off += 1000) { const r = await (await fetch(U + "/rest/v1/" + p.replace(/&limit=1000/, "") + "&limit=1000&offset=" + off, { headers: H })).json(); todos.push(...r); if (r.length < 1000) return todos; } };
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);
(async () => {
  // números esperados, calculados à parte a partir da base
  const cs = await get('compradores?select=estado,contactos(canal_origem)&limit=1000');
  const ordem = ['lead_qualificada', 'imoveis_enviados', 'visitas_realizadas', 'propostas_efetuadas', 'cpcv', 'escritura', 'negocio_concluido'];
  const ativos = cs.filter((c) => c.estado !== 'perdido');
  const cheg = ordem.map((_, i) => ativos.filter((c) => ordem.indexOf(c.estado) >= i).length);
  const esperadoPassagem = cheg.slice(1).map((n, i) => Math.round((n / cheg[i]) * 100));

  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  try {
    const b = await chromium.launch();
    const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.waitForSelector('text=Onde mais se perde', { timeout: 20000 });
    const texto = await page.locator('section', { hasText: 'Funis' }).first().innerText();
    const passagens = await page.locator('section', { hasText: 'Funis' }).first().locator('[aria-label$="passam da fase anterior"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('aria-label').split('%')[0])));
    ok('funil: taxas de passagem batem com a base', JSON.stringify(passagens) === JSON.stringify(esperadoPassagem), `app=${passagens} esperado=${esperadoPassagem}`);
    ok('funil: "chegaram" da 1.ª fase = ativos', texto.includes(`${cheg[0]} chegaram`), `esperado ${cheg[0]}`);
    const pior = esperadoPassagem.indexOf(Math.min(...esperadoPassagem)) + 1;
    const frase = (texto.match(/Onde mais se perde: [^.]*./) || ['sem frase'])[0]; const nomes = ['Lead qualificada', 'Imóveis enviados', 'Visitas realizadas', 'Propostas efetuadas', 'CPCV']; const ate = esperadoPassagem.slice(0, 4).map((v, i) => ({ v, nome: nomes[i + 1], base: cheg[i] })).filter((x) => x.base >= 3); const piorEsp = ate.reduce((m, x) => (x.v < m.v ? x : m), ate[0]); ok('funil: fase onde mais se perde (ate ao CPCV)', frase.includes(piorEsp.nome) && !frase.includes('Negócio concluído'), frase + ' | esperado ' + piorEsp.nome);
    await page.screenshot({ path: `${SP}/funis-desktop.png`, fullPage: true });

    // origens
    const origensTxt = await page.locator('section', { hasText: 'De onde vêm os negócios' }).first().innerText();
    const porCanal = {};
    for (const c of cs) { const k = c.contactos.canal_origem || 'Sem canal'; porCanal[k] = (porCanal[k] || 0) + 1; }
    const prs = await get('proprietarios?select=contactos(canal_origem)&limit=1000');
    for (const p of prs) { const k = p.contactos.canal_origem || 'Sem canal'; porCanal[k] = (porCanal[k] || 0) + 1; }
    const totalEsperado = Object.values(porCanal).reduce((a, b) => a + b, 0);
    const primeiroNumero = Number((origensTxt.match(/\d+/) || ['-1'])[0]);
    ok('origens: total de contactos bate com a base', primeiroNumero === totalEsperado, `app=${primeiroNumero} esperado=${totalEsperado}`);

    // tocar numa fase abre a lista filtrada
    await page.locator('a', { hasText: 'CPCV' }).filter({ hasText: 'aqui' }).first().click();
    await page.waitForURL('**/crm/compradores?fase=cpcv');
    await page.waitForSelector('text=Fase: CPCV');
    await page.waitForTimeout(800);
    const n = await page.locator('li a[href^="/crm/compradores/"]').count();
    const esperadoCpcv = cs.filter((c) => c.estado === 'cpcv').length;
    ok('tocar em "CPCV" abre a lista só com essa fase (60 de cada vez)', n === Math.min(60, esperadoCpcv), `${n} cartões, esperado ${esperadoCpcv}`);
    await page.locator('button[aria-label="Tirar o filtro de fase"]').click();
    await page.waitForTimeout(400);
    const depois = await page.locator('li a[href^="/crm/compradores/"]').count();
    ok('tirar o filtro volta à lista normal', depois >= n, `${depois} cartões`);

    // proprietários
    await page.goto('http://localhost:3001/crm/proprietarios?fase=angariado');
    await page.waitForSelector('text=Fase: Angariado');
    await page.waitForTimeout(800);
    const np = await page.locator('li a[href^="/crm/proprietarios/"]').count();
    const esperadoAng = (await get('proprietarios?select=estado&estado=eq.angariado')).length;
    ok('proprietários: ?fase=angariado filtra (60 de cada vez)', np === Math.min(60, esperadoAng), `${np}, esperado ${esperadoAng}`);
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    const d = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    out.push(`limpeza: utilizador apagado (${d.status})`);
    console.log(out.join('\n'));
  }
})();
