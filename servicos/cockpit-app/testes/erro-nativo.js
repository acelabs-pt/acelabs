// Ecrã "sem ligação" da casca iOS (capacitor/www/erro.html). Simula a ponte do Capacitor (Preferences) e confirma que
// mostra a lista do dia guardada, que ignora a de outro dia ou estragada, e que sem nada guardado mostra só a mensagem.
// Não precisa de servidor nem de Supabase. A ponte real só se testa num iPhone ou no simulador.
const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

const PAGINA = pathToFileURL(path.join(__dirname, '..', 'capacitor', 'www', 'erro.html')).href;
const dia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

(async () => {
  const out = [];
  const ok = (nome, cond, extra = '') => out.push(`${cond ? 'OK   ' : 'FALHA'} ${nome}${extra ? ': ' + extra : ''}`);
  const b = await chromium.launch();
  const abrir = async (valor) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript((v) => {
      window.Capacitor = { Plugins: { Preferences: { get: async () => ({ value: v }) } } };
    }, valor);
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));
    await page.goto(PAGINA);
    await page.waitForTimeout(300);
    return { page, erros, ctx };
  };

  const agora = new Date();
  const hoje = {
    dia: dia(agora),
    guardado_em: agora.toISOString(),
    tarefas: [
      { titulo: 'ZZ ligar ao comprador', inicio: agora.toISOString(), atrasada: false, tel: '+351900111222' },
      { titulo: 'ZZ tarefa antiga', inicio: '2025-01-02T10:00:00Z', atrasada: true, tel: 'javascript:alert(1)' },
    ],
    proxima: { titulo: 'ZZ visita', inicio: agora.toISOString() },
  };

  let r = await abrir(JSON.stringify(hoje));
  ok('mostra a lista de hoje', await r.page.locator('#dia').isVisible() && (await r.page.locator('#lista li').count()) === 2);
  ok('mostra o título da tarefa e "A seguir"', (await r.page.locator('#lista').innerText()).includes('ZZ ligar ao comprador') && (await r.page.locator('#seguir').innerText()).includes('ZZ visita'));
  ok('a tarefa com telefone tem botão de ligar', (await r.page.locator('a.ligar').count()) === 1 && (await r.page.locator('a.ligar').getAttribute('href')) === 'tel:+351900111222');
  ok('um telefone estranho não vira ligação', (await r.page.locator('#lista li').nth(1).locator('a').count()) === 0);
  ok('marca a tarefa antiga como em atraso', (await r.page.locator('.atraso').count()) === 1);
  ok('não houve erros na página', r.erros.length === 0, r.erros.join('; '));
  await r.page.screenshot({ path: path.join(__dirname, 'resultados', 'erro-nativo.png') }).catch(() => {});
  await r.ctx.close();

  r = await abrir(JSON.stringify({ ...hoje, dia: '2020-01-01' }));
  ok('ignora uma lista de outro dia', !(await r.page.locator('#dia').isVisible()));
  await r.ctx.close();

  r = await abrir('isto nao e json');
  ok('ignora dados estragados', !(await r.page.locator('#dia').isVisible()) && r.erros.length === 0);
  await r.ctx.close();

  r = await abrir(null);
  ok('sem nada guardado só mostra a mensagem e o botão', !(await r.page.locator('#dia').isVisible()) && await r.page.locator('#de-novo').isVisible());
  await r.ctx.close();

  // sem ponte nenhuma (WebView sem plugin): continua a funcionar
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));
  await page.goto(PAGINA);
  ok('sem a ponte do Capacitor mostra a mensagem sem erros', erros.length === 0 && await page.locator('#de-novo').isVisible());
  await ctx.close();

  await b.close();
  console.log(out.join('\n'));
})();
