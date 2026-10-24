// Enviar um imóvel ao comprador por WhatsApp a partir de um alerta. Cria dados de teste e repõe tudo no fim.
const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const rest = async (m, p, body) => { const r = await fetch(`${U}/rest/v1/${p}`, { method: m, headers: H, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);
(async () => {
  const comp = (await rest('GET', 'compradores?select=id,estado,estado_desde,contactos(nome,telemovel)&estado=eq.lead_qualificada&limit=10')).find((c) => c.contactos.telemovel);
  const original = { estado: comp.estado, estado_desde: comp.estado_desde };
  const ang = (await rest('POST', 'angariacoes', { titulo: 'ZZ Envio Apartamento T2 Creixomil', duracao_dias: 180, tipo_imovel: 'Apartamento', tipologia: 'T2', distrito: 'Braga', concelho: 'Guimarães', freguesia: 'Creixomil', valor: 200000 }))[0];
  const corr = (await rest('POST', 'correspondencias', { comprador_id: comp.id, angariacao_id: ang.id, estado: 'nova' }))[0];
  const email = `claude-teste-${Date.now()}@acelabs.pt`, password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
  const u = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: H, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${U}/rest/v1/membros`, { method: 'POST', headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: u.id }) }).catch(() => {}); // lista de membros (migracao_seguranca.sql), se existir
  try {
    const b = await chromium.launch();
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', (e) => erros.push(String(e).slice(0, 100)));
    await page.goto('http://localhost:3001/login');
    await page.fill('input[type=email]', email); await page.fill('input[type=password]', password);
    await page.click('button[type=submit]'); await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.waitForSelector('text=Oportunidades', { timeout: 20000 });
    const linha = page.locator('li', { hasText: 'ZZ Envio Apartamento' }).first();
    await linha.waitFor();
    await linha.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SP}/ux4-oportunidade.png` });
    ok('o alerta mostra "Enviar por WhatsApp"', await linha.locator('button', { hasText: 'Enviar por WhatsApp' }).isVisible());
    const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }), linha.locator('button', { hasText: 'Enviar por WhatsApp' }).click()]);
    // o wa.me pode redirecionar para api.whatsapp.com (phone=...&text=... com + nos espaços).
    // O número tem de ir só com dígitos (com "+" o WhatsApp não abre a conversa certa em todos os telemóveis).
    const bruto = popup.url();
    const url = decodeURIComponent(bruto.replace(/\+/g, ' '));
    const digitos = comp.contactos.telemovel.replace(/\D/g, '');
    const paraOComprador = new RegExp(`(wa\\.me/|phone=)${digitos}(\\?|&|$)`).test(bruto);
    ok('abre o WhatsApp do comprador com a mensagem escrita', /wa\.me|whatsapp\.com/.test(url) && paraOComprador && url.includes('ZZ Envio Apartamento T2 Creixomil') && url.includes('Olá ' + comp.contactos.nome.split(' ')[0]), url.slice(0, 120));
    await popup.close();
    await page.waitForTimeout(2000);
    const im = await rest('GET', `comprador_imoveis?comprador_id=eq.${comp.id}&descricao=eq.ZZ Envio Apartamento T2 Creixomil&select=enviado_em`);
    ok('o imóvel fica registado como enviado na ficha', im.length === 1 && !!im[0].enviado_em, JSON.stringify(im));
    const c2 = (await rest('GET', `correspondencias?id=eq.${corr.id}&select=estado`))[0];
    ok('o alerta passa a "faz sentido"', c2.estado === 'faz_sentido');
    const e2 = (await rest('GET', `compradores?id=eq.${comp.id}&select=estado`))[0];
    ok('o comprador avança para "Imóveis enviados"', e2.estado === 'imoveis_enviados', e2.estado);
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    await rest('DELETE', `comprador_imoveis?descricao=eq.ZZ Envio Apartamento T2 Creixomil`);
    await rest('DELETE', `angariacoes?id=eq.${ang.id}`);
    await rest('PATCH', `compradores?id=eq.${comp.id}`, original);
    const rep = (await rest('GET', `compradores?id=eq.${comp.id}&select=estado`))[0];
    const sobra = await rest('GET', `correspondencias?id=eq.${corr.id}&select=id`);
    await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: { apikey: K, Authorization: `Bearer ${K}` } });
    out.push(`limpeza: angariação, imóvel e alerta de teste apagados (sobras ${sobra.length}); comprador reposto em "${rep.estado}"`);
    console.log(out.join('\n'));
  }
})();
