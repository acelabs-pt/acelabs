// Conta > Descarregar os teus dados: os CSV batem com a base e voltam a entrar no importador sem erros;
// a cópia completa tem todas as tabelas. Só lê (não importa nada: para no ecrã de pré-visualização).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const contar = async (t) => {
  const r = await fetch(`${U}/rest/v1/${t}?select=*`, { method: 'HEAD', headers: { ...H, Prefer: 'count=exact' } });
  return Number((r.headers.get('content-range') || '/0').split('/')[1]);
};
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);

// CSV com ";" e aspas (o formato que a app gera)
function lerCsv(texto) {
  const linhas = [];
  let campo = '', linha = [], aspas = false;
  const t = texto.replace(/^\uFEFF/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (aspas) {
      if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === ';') { linha.push(campo); campo = ''; }
    else if (ch === '\n') { linha.push(campo.replace(/\r$/, '')); linhas.push(linha); linha = []; campo = ''; }
    else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

(async () => {
  const email = `claude-teste-${Date.now()}@acelabs.pt`, password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: H, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  try {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email); await page.fill('input[type=password]', password);
    await page.click('button[type=submit]'); await page.waitForURL('**/dashboard', { timeout: 20000 });

    const ficheiros = {};
    for (const [e, rotulo] of [['compradores', 'Compradores'], ['proprietarios', 'Proprietários'], ['angariacoes', 'Angariações']]) {
      await page.goto('http://localhost:3001/conta');
      const botao = page.getByRole('button', { name: rotulo, exact: true });
      await botao.waitFor();
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), botao.click()]);
      const destino = path.join(SP, `exportado-${e}.csv`);
      await dl.saveAs(destino);
      ficheiros[e] = destino;
      const linhas = lerCsv(fs.readFileSync(destino, 'utf8')).filter((l) => l.some((c) => c !== ''));
      const naBase = await contar(e);
      ok(`${rotulo}: CSV com uma linha por registo (${naBase})`, linhas.length - 1 === naBase, `${linhas.length - 1} no CSV`);
      ok(`${rotulo}: nome do ficheiro com a data`, /^cockpit-[a-z]+-\d{4}-\d{2}-\d{2}\.csv$/.test(dl.suggestedFilename()), dl.suggestedFilename());
      const largura = new Set(linhas.map((l) => l.length));
      ok(`${rotulo}: todas as linhas com as mesmas colunas`, largura.size === 1, [...largura].join(','));
    }
    await page.screenshot({ path: `${SP}/exportar-conta.png`, fullPage: true });

    // volta a entrar no importador: nenhuma linha com erro (as que já existem aparecem como repetidas)
    for (const [e, rotulo] of [['compradores', 'Compradores'], ['proprietarios', 'Proprietários'], ['angariacoes', 'Angariações']]) {
      await page.goto('http://localhost:3001/importar');
      await page.waitForSelector('text=Escolhe o ficheiro');
      await page.locator('button', { hasText: new RegExp(`^${rotulo}$`) }).click();
      await page.setInputFiles('input[type=file]', ficheiros[e]);
      await page.waitForSelector('text=Ligar as colunas', { timeout: 30000 });
      await page.waitForTimeout(500);
      const nums = await page.locator('section p.text-2xl').allTextContents(); // prontas, repetidas, com erros
      ok(`${rotulo}: o CSV exportado volta a entrar sem erros`, nums[2] === '0', JSON.stringify(nums));
      const naoLigadas = await page.locator('select[aria-label^="Coluna do ficheiro"]').evaluateAll((els) => els.filter((s) => s.selectedIndex <= 0).length);
      ok(`${rotulo}: todas as colunas reconhecidas sozinhas`, naoLigadas === 0, `${naoLigadas} por ligar`);
      if (nums[2] !== '0') await page.screenshot({ path: `${SP}/exportar-reimportar-${e}.png`, fullPage: true });
    }

    // cópia completa
    await page.goto('http://localhost:3001/conta');
    const bt = page.getByRole('button', { name: /Cópia completa/ });
    await bt.waitFor();
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), bt.click()]);
    const copia = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    const tabelas = Object.keys(copia.tabelas || {});
    ok('cópia completa com as 14 tabelas', tabelas.length === 14, tabelas.join(','));
    const [nc, nt] = [await contar('contactos'), await contar('tarefas')];
    ok('cópia completa: contactos e tarefas batem com a base (sem corte nas 1000)', copia.tabelas.contactos.length === nc && copia.tabelas.tarefas.length === nt, `${copia.tabelas.contactos.length}/${nc} contactos, ${copia.tabelas.tarefas.length}/${nt} tarefas`);
    await page.waitForSelector('text=/Cópia descarregada/', { timeout: 5000 }).catch(() => {});
    ok('aviso com o total de registos', await page.locator('text=/Cópia descarregada \\(/').isVisible());
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    console.log(out.join('\n'));
  }
})();
