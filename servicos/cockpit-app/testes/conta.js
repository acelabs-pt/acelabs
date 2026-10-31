const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);
(async () => {
  const email = `claude-teste-${Date.now()}@acelabs.pt`;
  const pw1 = 'Primeira' + Math.random().toString(36).slice(2) + '1!';
  const pw2 = 'Segunda' + Math.random().toString(36).slice(2) + '2!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password: pw1, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  try {
    const b = await chromium.launch();
    const page = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));

    // 1. Sem sessão, páginas protegidas mandam para o login; as públicas abrem
    await page.goto('http://localhost:3001/dashboard');
    ok('sem sessão: /dashboard manda para o login', page.url().includes('/login'));
    await page.goto('http://localhost:3001/login');
    await page.locator('a', { hasText: 'Esqueci a password' }).click();
    await page.waitForURL('**/recuperar');
    ok('login tem link "Esqueci a password"', true);

    // 2. Recuperar com um email que não existe: mensagem neutra (não revela se existe)
    await page.fill('input[type=email]', 'ninguem-existe@exemplo.invalid');
    await page.locator('button[type=submit]').click();
    await page.waitForSelector('text=Se este email tiver conta', { timeout: 15000 });
    ok('recuperar: mensagem neutra', true);

    // 3. Link inválido
    await page.goto('http://localhost:3001/nova-password');
    await page.waitForSelector('text=Este link já não é válido', { timeout: 15000 });
    ok('/nova-password sem link válido avisa e oferece pedir outro', await page.locator('a', { hasText: 'Pedir um link novo' }).isVisible());

    // 4. Link de recuperação verdadeiro (gerado pelo administrador, formato com # como os convites)
    const g = await (await fetch(`${U}/auth/v1/admin/generate_link`, { method: 'POST', headers: H, body: JSON.stringify({ type: 'recovery', email, redirect_to: 'http://localhost:3001/nova-password' }) })).json();
    await page.goto(g.action_link);
    await page.waitForTimeout(2500);
    const aterrou = page.url();
    ok('o link do email aterra em /nova-password', aterrou.includes('/nova-password'), aterrou.slice(0, 80));
    if (aterrou.includes('/nova-password')) {
      await page.waitForSelector('input[aria-label="Nova password"]', { timeout: 15000 });
      ok('o código sai do endereço', !page.url().includes('access_token') && !page.url().includes('code='), page.url());
      await page.fill('input[aria-label="Nova password"]', 'curta');
      await page.fill('input[aria-label="Repete a password"]', 'curta');
      await page.locator('button[type=submit]').click();
      ok('password curta é recusada', await page.locator('text=pelo menos 8 caracteres').isVisible());
      await page.fill('input[aria-label="Nova password"]', pw2);
      await page.fill('input[aria-label="Repete a password"]', pw2 + 'x');
      await page.locator('button[type=submit]').click();
      ok('passwords diferentes são recusadas', await page.locator('text=não são iguais').isVisible());
      await page.fill('input[aria-label="Repete a password"]', pw2);
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/dashboard', { timeout: 20000 });
      ok('guardar a password entra no dashboard', true);

      // 5. Conta: sair
      await page.goto('http://localhost:3001/conta');
      await page.waitForSelector(`text=${email}`, { timeout: 15000 });
      ok('Conta mostra o email', true);
      await page.screenshot({ path: `${SP}/conta.png`, fullPage: true });
      await page.locator('button', { hasText: /^Sair$/ }).click();
      await page.waitForURL('**/login', { timeout: 15000 });
      await page.goto('http://localhost:3001/dashboard');
      ok('depois de sair, o dashboard volta a pedir login', page.url().includes('/login'));

      // 6. a password antiga já não serve e a nova serve
      await page.fill('input[type=email]', email);
      await page.fill('input[type=password]', pw1);
      await page.locator('button[type=submit]').click();
      await page.waitForSelector('text=Email ou password incorretos', { timeout: 15000 });
      ok('a password antiga já não entra', true);
      await page.fill('input[type=password]', pw2);
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/dashboard', { timeout: 20000 });
      ok('a password nova entra', true);

      // 7. Mudar a password na Conta
      const pw3 = 'Terceira' + Math.random().toString(36).slice(2) + '3!';
      await page.goto('http://localhost:3001/conta');
      await page.fill('input[aria-label="Nova password"]', pw3);
      await page.fill('input[aria-label="Repete a password"]', pw3);
      await page.locator('button', { hasText: 'Mudar password' }).click();
      await page.waitForSelector('text=Password mudada', { timeout: 15000 });
      ok('Conta: mudar a password', true);
      await page.locator('button', { hasText: /^Sair$/ }).click();
      await page.waitForURL('**/login');
      await page.fill('input[type=email]', email);
      await page.fill('input[type=password]', pw3);
      await page.locator('button[type=submit]').click();
      await page.waitForURL('**/dashboard', { timeout: 20000 });
      ok('entra com a password mudada na Conta', true);
    }
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    const d = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    out.push(`limpeza: utilizador apagado (${d.status})`);
    console.log(out.join('\n'));
  }
})();
