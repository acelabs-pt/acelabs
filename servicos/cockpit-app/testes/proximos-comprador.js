// Ficha do comprador > Próximos passos: marcar uma visita a um imóvel enviado e uma tarefa, ver as tarefas dele,
// marcar como feita (com desfazer) e oferecer "Pôr no telemóvel".
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
  const [ct] = await rest('POST', 'contactos', { nome: 'ZZ Proximos Comprador', telemovel: '+351900555666' });
  const [cp] = await rest('POST', 'compradores', { contacto_id: ct.id, estado: 'imoveis_enviados' });
  await rest('POST', 'comprador_imoveis', { comprador_id: cp.id, descricao: 'T2 Rua de Camões', enviado_em: '2026-10-20' });
  try {
    const b = await chromium.launch();
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email); await page.fill('input[type=password]', password);
    await page.click('button[type=submit]'); await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.goto(`http://localhost:3001/crm/compradores/${cp.id}`);
    const sec = page.locator('section[aria-labelledby="proximos-comprador"]');
    await sec.waitFor({ timeout: 15000 });
    await page.waitForSelector('text=Nada por fazer com ZZ', { timeout: 10000 }).catch(() => {});
    ok('sem tarefas, convida a marcar a próxima visita', await sec.locator('text=Nada por fazer com ZZ').isVisible());

    // visita ao imóvel enviado, amanhã às 15h (sempre no futuro, senão a visita já passou e deixa de aparecer nos próximos passos)
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
    const quando = `${amanha.getFullYear()}-${String(amanha.getMonth() + 1).padStart(2, '0')}-${String(amanha.getDate()).padStart(2, '0')}T15:00`;
    await sec.locator('select[aria-label="Imóvel a visitar"]').selectOption({ label: 'T2 Rua de Camões' });
    await sec.locator('input[aria-label="Dia e hora"]').fill(quando);
    await sec.getByRole('button', { name: 'Marcar', exact: true }).click();
    await sec.locator('li', { hasText: 'Visita a T2 Rua de Camões com ZZ Proximos Comprador' }).waitFor({ timeout: 10000 }).catch(() => {});
    const [v] = await rest('GET', `tarefas?comprador_id=eq.${cp.id}&tipo=eq.evento&select=id,titulo,inicio,contacto_id,origem`);
    ok('a visita fica gravada, ligada ao comprador', !!v && v.titulo === 'Visita a T2 Rua de Camões com ZZ Proximos Comprador' && v.contacto_id === ct.id && v.origem === 'comprador', JSON.stringify(v));
    ok('à hora escolhida', !!v && new Date(v.inicio).getTime() === new Date(quando).getTime(), v && v.inicio);
    ok('aparece nos próximos passos', await sec.locator('li', { hasText: 'Visita a T2 Rua de Camões' }).isVisible());
    ok('o aviso oferece "Pôr no telemóvel"', await page.getByRole('button', { name: 'Pôr no telemóvel' }).isVisible());
    ok('a linha tem o botão do calendário do telemóvel', (await sec.locator('li', { hasText: 'Visita a T2' }).locator('a').getAttribute('href')) === `/api/tarefas/${v && v.id}/calendario`);
    await page.screenshot({ path: `${SP}/proximos-comprador.png` });

    // tarefa
    await sec.getByRole('button', { name: 'Tarefa', exact: true }).click();
    await sec.locator('input[aria-label="O que há para fazer"]').fill('Enviar simulação do crédito');
    await sec.getByRole('button', { name: 'Marcar', exact: true }).click();
    await sec.locator('li', { hasText: 'Enviar simulação do crédito (ZZ Proximos Comprador)' }).waitFor({ timeout: 10000 }).catch(() => {});
    ok('tarefa marcada com o nome do comprador', await sec.locator('li', { hasText: 'Enviar simulação do crédito (ZZ Proximos Comprador)' }).isVisible());

    // feita, e desfazer
    await sec.getByRole('button', { name: /Marcar como feita: Visita a T2/ }).click();
    await page.waitForTimeout(800);
    ok('marcar como feita tira-a da lista', !(await sec.locator('li', { hasText: 'Visita a T2' }).isVisible()));
    ok('e grava na base', (await rest('GET', `tarefas?id=eq.${v.id}&select=feita`))[0].feita === true);
    await page.getByRole('button', { name: 'Desfazer' }).click();
    await sec.locator('li', { hasText: 'Visita a T2' }).waitFor({ timeout: 8000 }).catch(() => {});
    ok('desfazer volta a pô-la por fazer', (await rest('GET', `tarefas?id=eq.${v.id}&select=feita`))[0].feita === false && await sec.locator('li', { hasText: 'Visita a T2' }).isVisible());

    // no calendário, a visita está no dia
    await page.goto('http://localhost:3001/calendario');
    await page.locator('button', { hasText: /^Tarefas$/ }).click();
    await page.locator('text=Visita a T2 Rua de Camões').first().waitFor({ timeout: 10000 }).catch(() => {});
    ok('a visita aparece no calendário', await page.locator('text=Visita a T2 Rua de Camões').first().isVisible());
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    await rest('DELETE', `contactos?id=eq.${ct.id}`); // cascata: comprador, imóveis e tarefas
    await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    console.log(out.join('\n'));
  }
})();
