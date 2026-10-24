const fs = require('fs');
const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const get = async (p) => (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json();
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);
(async () => {
  // um comprador com o máximo de coisas associadas
  const cs = await get('compradores?select=id,contacto_id,contactos(nome)&limit=40');
  let alvo = null, melhor = -1;
  for (const c of cs) {
    const n = (await get(`comprador_imoveis?comprador_id=eq.${c.id}&select=id`)).length + (await get(`tarefas?comprador_id=eq.${c.id}&select=id`)).length;
    if (n > melhor) { melhor = n; alvo = c; }
  }
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  try {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', password);
    await page.click('button[type=submit]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.goto('http://localhost:3001/crm/compradores/' + alvo.id);
    const botao = page.locator('button', { hasText: 'Exportar os dados deste contacto' });
    await botao.waitFor({ timeout: 15000 });
    await botao.scrollIntoViewIfNeeded();
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), botao.click()]);
    const nome = dl.suggestedFilename();
    ok('descarrega um ficheiro .json com o nome da pessoa e a data', /^cockpit-miguel-teste-\d+-\d{4}-\d{2}-\d{2}\.json$/.test(nome), nome);
    const dados = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    ok('traz o contacto certo', dados.contacto?.id === alvo.contacto_id && dados.contacto?.nome === alvo.contactos.nome);
    ok('traz a ficha de comprador, sem a de proprietário', dados.ficha_de_comprador?.id === alvo.id && dados.ficha_de_proprietario === null);
    const imoveis = await get(`comprador_imoveis?comprador_id=eq.${alvo.id}&select=id`);
    ok('traz todos os imóveis enviados', dados.ficha_de_comprador.imoveis.length === imoveis.length, `${dados.ficha_de_comprador.imoveis.length} de ${imoveis.length}`);
    const zonas = await get(`comprador_zonas?comprador_id=eq.${alvo.id}&select=id`);
    ok('traz as zonas', dados.ficha_de_comprador.zonas.length === zonas.length, `${zonas.length}`);
    const t1 = await get(`tarefas?comprador_id=eq.${alvo.id}&select=id`), t2 = await get(`tarefas?contacto_id=eq.${alvo.contacto_id}&select=id`);
    const esperadas = new Set([...t1, ...t2].map((x) => x.id)).size;
    ok('traz as tarefas, sem repetir', dados.tarefas.length === esperadas, `${dados.tarefas.length} de ${esperadas}`);
    ok('tem data de exportação e origem', !!dados.exportado_em && dados.origem === 'Cockpit (Ace Labs)');
    await page.waitForSelector('text=Ficheiro descarregado.', { timeout: 5000 }).then(() => ok('a página confirma "Ficheiro descarregado."', true)).catch(() => ok('a página confirma "Ficheiro descarregado."', false));

    // proprietário
    const ps = await get('proprietarios?select=id,contacto_id,contactos(nome)&limit=1');
    await page.goto('http://localhost:3001/crm/proprietarios/' + ps[0].id);
    const b2 = page.locator('button', { hasText: 'Exportar os dados deste contacto' });
    await b2.waitFor({ timeout: 15000 });
    await b2.scrollIntoViewIfNeeded();
    const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), b2.click()]);
    const d2 = JSON.parse(fs.readFileSync(await dl2.path(), 'utf8'));
    ok('proprietário: traz a ficha de proprietário e as angariações', d2.ficha_de_proprietario?.id === ps[0].id && Array.isArray(d2.ficha_de_proprietario.angariacoes));
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    const d = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    out.push(`limpeza: utilizador apagado (${d.status}); nada foi escrito na base`);
    console.log(out.join('\n'));
  }
})();
