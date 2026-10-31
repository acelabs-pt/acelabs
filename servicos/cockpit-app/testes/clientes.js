// Vários clientes num só deploy: escolha do cliente pelo código, convite com o código no endereço, "Mudar de empresa" e
// o botão de apagar a conta. Arranca o seu próprio servidor (porta 3003, pasta .next-clientes) com COCKPIT_CLIENTES apontado ao
// projeto de TESTE; o servidor da 3001 (cliente único) fica como está. O apagamento real precisa da migracao_apagar_conta.sql
// no projeto de teste e não é exercido aqui (só a confirmação no ecrã).
const { chromium } = require('playwright');
const { spawn, execSync } = require('node:child_process');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const PORTA = 3003, BASE = `http://localhost:${PORTA}`;
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);

async function esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  const clientes = JSON.stringify([{ codigo: 'teste-aa', nome: 'Cliente de teste', url: U, anon: ANON }]);
  const srv = spawn('npx', ['next', 'dev', '-p', String(PORTA)], {
    shell: true, stdio: 'ignore',
    env: { ...process.env, COCKPIT_CLIENTES: clientes, NEXT_DIST_DIR: '.next-clientes' },
  });
  let userId = null;
  try {
    let pronto = false;
    for (let i = 0; i < 90 && !pronto; i++) {
      try { pronto = (await fetch(`${BASE}/cliente`)).ok; } catch { /* ainda a arrancar */ }
      if (!pronto) await esperar(1000);
    }
    ok('servidor de vários clientes arrancou', pronto);
    if (!pronto) throw new Error('servidor não arrancou');

    const email = `claude-teste-${Date.now()}@acelabs.pt`;
    const pw = 'Teste' + Math.random().toString(36).slice(2) + '1!';
    const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password: pw, email_confirm: true }) })).json();
    userId = u.id;
    await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: H, body: JSON.stringify({ user_id: userId }) }).catch(() => {});

    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));

    // 1. Sem cliente escolhido tudo manda para o ecrã do código
    await page.goto(`${BASE}/dashboard`);
    ok('sem cliente: /dashboard manda para /cliente', page.url().endsWith('/cliente'));
    await page.goto(`${BASE}/login`);
    ok('sem cliente: /login manda para /cliente', page.url().endsWith('/cliente'));

    // 2. Código errado: erro genérico; código certo (com espaços e maiúsculas) entra
    await page.fill('input[name=codigo]', 'nao-existe');
    await page.locator('button[type=submit]').click();
    await page.waitForSelector('p[role=alert]', { timeout: 15000 });
    ok('código errado mostra erro', /Não encontrámos esse código/.test(await page.locator('p[role=alert]').innerText()));
    await page.fill('input[name=codigo]', '  TESTE-aa ');
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/login', { timeout: 20000 });
    ok('código certo (espaços e maiúsculas) segue para o login', true);

    // 3. O browser recebe só endereço e chave pública
    const sb = await page.evaluate(() => window.__COCKPIT_SB);
    ok('browser recebe o Supabase do cliente', sb && sb.url === U && sb.anon === ANON, JSON.stringify({ sb: sb && { u: sb.url === U, a: sb.anon === ANON, n: !!ANON } }));
    ok('a chave de administrador não vai para o browser', !(await page.content()).includes(K));
    ok('login mostra "Mudar de empresa"', await page.locator('a', { hasText: 'Mudar de empresa' }).isVisible());

    // 4. Login e acesso aos dados do cliente escolhido
    await page.fill('input[type=email]', email);
    await page.fill('input[type=password]', pw);
    await page.locator('button[type=submit]').click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    ok('login no cliente escolhido chega ao dashboard', true);
    await page.goto(`${BASE}/conta`);
    await page.waitForSelector(`text=${email}`, { timeout: 15000 });
    ok('conta mostra o email do utilizador', true);

    // 5. Apagar a conta: pede confirmação e dá para cancelar
    await page.locator('button', { hasText: 'Apagar a minha conta' }).click();
    ok('apagar conta pede confirmação', await page.locator('text=Isto não se pode desfazer').isVisible());
    await page.locator('button', { hasText: 'Cancelar' }).click();
    ok('cancelar fecha a confirmação', await page.locator('text=Isto não se pode desfazer').count() === 0);

    // 6. CSP deixa falar só com o Supabase dos clientes configurados
    const csp = (await page.request.get(`${BASE}/cliente`)).headers()['content-security-policy'] || '';
    ok('CSP permite o Supabase do cliente configurado', csp.includes(new URL(U).origin) && !csp.includes('*.supabase.co'));

    // 7. Convite: o código no endereço escolhe o cliente e o resto do link segue
    const ctx2 = await b.newContext();
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/convite/TESTE-aa?code=abc`);
    ok('convite com código válido vai para /nova-password com o resto do link', /\/nova-password\?code=abc/.test(p2.url()));
    await p2.goto(`${BASE}/login`);
    ok('depois do convite o cliente já está escolhido', p2.url().endsWith('/login'));
    const ctx3 = await b.newContext();
    const p3 = await ctx3.newPage();
    await p3.goto(`${BASE}/convite/nao-existe?code=abc`);
    ok('convite com código inválido vai para /cliente sem o resto do link', p3.url().endsWith('/cliente'));

    // 8. Mudar de empresa: volta ao ecrã do código
    await page.goto(`${BASE}/cliente`);
    ok('/cliente abre mesmo com cliente escolhido', page.url().endsWith('/cliente'));

    ok('sem erros de JavaScript', erros.length === 0, erros.join(' | '));
    await b.close();
  } catch (e) {
    ok('execução do teste', false, String(e).slice(0, 200));
  } finally {
    if (userId) await fetch(`${U}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers: H }).catch(() => {});
    try { execSync(`taskkill /PID ${srv.pid} /T /F`, { stdio: 'ignore' }); } catch { /* já terminou */ }
  }
  console.log(out.join('\n'));
  process.exit(out.some((l) => l.startsWith('FALHA')) ? 1 : 0);
})();
