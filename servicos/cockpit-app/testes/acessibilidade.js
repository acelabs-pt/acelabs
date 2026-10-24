// Auditoria de acessibilidade (axe-core, regras WCAG 2 A e AA) em todas as páginas. Só lê.
// Aproveita a volta para ver se a política de segurança (CSP) bloqueia alguma coisa.
const { chromium } = require('playwright');
const AXE = require.resolve('axe-core/axe.min.js');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const get = async (p) => (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json();
(async () => {
  const comp = (await get('compradores?select=id&estado=eq.cpcv&limit=1'))[0];
  const prop = (await get('proprietarios?select=id&limit=1'))[0];
  const ang = (await get('angariacoes?select=id&limit=1&order=created_at.asc'))[0];
  const email = `claude-teste-${Date.now()}@acelabs.pt`, password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  const total = {};
  try {
    const b = await chromium.launch();
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    const bloqueios = [];
    page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) bloqueios.push(m.text().slice(0, 160)); });
    const correr = async (nome) => {
      await page.addScriptTag({ path: AXE });
      const r = await page.evaluate(async () => {
        const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
        return res.violations.map((v) => ({ id: v.id, impacto: v.impact, n: v.nodes.length, exemplo: v.nodes[0].target.join(' ').slice(0, 90), texto: v.help }));
      });
      for (const v of r) {
        const k = v.id;
        total[k] ??= { impacto: v.impacto, texto: v.texto, paginas: [], n: 0, exemplo: v.exemplo };
        total[k].paginas.push(nome);
        total[k].n += v.n;
      }
    };
    await page.goto('http://localhost:3001/login');
    await page.waitForTimeout(1200);
    await correr('login');
    await page.fill('input[type=email]', email); await page.fill('input[type=password]', password);
    await page.click('button[type=submit]'); await page.waitForURL('**/dashboard', { timeout: 20000 });
    const rotas = [
      ['dashboard', '/dashboard'], ['compradores', '/crm/compradores'], ['comprador', `/crm/compradores/${comp.id}`],
      ['proprietarios', '/crm/proprietarios?fase=angariado'], ['proprietario', `/crm/proprietarios/${prop.id}`],
      ['angariacoes', '/angariacoes'], ['angariacao', `/angariacoes/${ang.id}`], ['relatorio', `/angariacoes/${ang.id}/relatorio`],
      ['calendario', '/calendario'], ['importar', '/importar'], ['conta', '/conta'], ['instalar', '/instalar'], ['novo', '/crm/compradores/novo'],
    ];
    for (const [nome, rota] of rotas) {
      await page.goto('http://localhost:3001' + rota);
      await page.waitForTimeout(3000);
      await correr(nome);
    }
    console.log(bloqueios.length ? `FALHA a CSP bloqueou ${bloqueios.length}x: ${[...new Set(bloqueios)].slice(0, 3).join(' | ')}` : 'OK    A CSP não bloqueou nada nas 14 páginas');
    await b.close();
  } finally {
    await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
  }
  const lista = Object.entries(total).sort((a, b) => b[1].n - a[1].n);
  if (!lista.length) console.log('OK    Sem problemas de acessibilidade WCAG A/AA nas 14 páginas');
  for (const [id, v] of lista) console.log(`FALHA ${v.impacto} ${id} (${v.n}x) em ${[...new Set(v.paginas)].join(',')}: ${v.texto}. Ex.: ${v.exemplo}`);
})();
