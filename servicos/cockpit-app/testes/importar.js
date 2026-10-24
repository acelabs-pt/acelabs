const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { chromium } = require('playwright');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, SP = process.env.SP;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const rest = async (m, p, body) => {
  const r = await fetch(`${U}/rest/v1/${p}`, { method: m, headers: { ...H, Prefer: 'return=representation,count=exact' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
};
const out = [];
const ok = (n, c, extra = '') => out.push(`${c ? 'OK   ' : 'FALHA'} ${n} ${extra}`);

async function fazerXlsx(ficheiro, linhas) {
  const textos = [];
  const idx = (s) => { let i = textos.indexOf(s); if (i < 0) { textos.push(s); i = textos.length - 1; } return i; };
  const col = (i) => String.fromCharCode(65 + i);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = linhas.map((l, r) => `<row r="${r + 1}">${l.map((v, c) => (typeof v === 'number' ? `<c r="${col(c)}${r + 1}"><v>${v}</v></c>` : `<c r="${col(c)}${r + 1}" t="s"><v>${idx(v)}</v></c>`)).join('')}</row>`).join('');
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>');
  z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  z.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Folha1" sheetId="1" r:id="rId1"/></sheets></workbook>');
  z.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>');
  z.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`);
  z.file('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${textos.length}" uniqueCount="${textos.length}">${textos.map((t) => `<si><t>${esc(t)}</t></si>`).join('')}</sst>`);
  fs.writeFileSync(ficheiro, await z.generateAsync({ type: 'nodebuffer' }));
}

(async () => {
  const existente = (await rest('GET', 'contactos?select=telemovel&telemovel=not.is.null&limit=1'))[0];
  // CSV de compradores em Windows-1252 com ";" (como o Excel em português) para testar a descodificação
  const csv = [
    'Cliente;Tlm;E-mail;Origem;Motivação;Tipo;Tipologia;Distrito;Concelho;Freguesia;Outras zonas;Orçamento;Financiamento;Precisa de vender;Fase',
    'ZZ Teste Import 01;912 000 001;zz01@teste.pt;Idealista;8;Apartamento;T2;Braga;Guimarães;Creixomil;Porto/Maia | Braga/Barcelos;250.000,00 €;Crédito pré-aprovado;Não;',
    'ZZ Teste Import 02;900000002;zz02@teste.pt;Meta;5;Apartamento;t1;Braga;Guimarães;;;180000;;;Imóveis enviados',
    'ZZ Teste Import 03;91;zz03@teste.pt;Meta;5;Apartamento;T2;Braga;Concelho Inventado;;;;;;',
    'ZZ Teste Import 04;912 000 001;zz04@teste.pt;Meta;5;Apartamento;T2;Braga;Guimarães;;;;;;',
    ';900000005;zz05@teste.pt;Meta;5;;;;;;;;;;',
    `ZZ Teste Import 06;${existente ? existente.telemovel : '900000006'};zz06@teste.pt;Meta;5;;;;;;;;;;`,
  ].join('\r\n');
  const csvPath = path.join(SP, 'compradores-teste.csv');
  fs.writeFileSync(csvPath, Buffer.from(csv.replace(/€/g, ''), 'latin1')); // 0x80 = euro em Windows-1252
  const xlsxPath = path.join(SP, 'angariacoes-teste.xlsx');
  await fazerXlsx(xlsxPath, [
    ['Imóvel', 'Início', 'Duração', 'Regime', 'Tipo', 'Distrito', 'Concelho', 'Freguesia', 'Tipologia', 'Preço'],
    ['ZZ Teste Import Apartamento Creixomil', '01/09/2026', 180, 'Exclusivo', 'Apartamento', 'Braga', 'Guimarães', 'Creixomil', 'T3', 200000],
    ['ZZ Teste Import Data Errada', '31/02/2026', 180, 'Exclusivo', 'Apartamento', 'Braga', 'Guimarães', 'Creixomil', 'T3', 200000],
  ]);

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

    // ---- COMPRADORES (CSV Windows-1252) ----
    await page.goto('http://localhost:3001/importar');
    await page.waitForSelector('text=Escolhe o ficheiro');
    await page.screenshot({ path: `${SP}/imp-1.png` });
    await page.setInputFiles('input[type=file]', csvPath);
    await page.waitForSelector('text=Ligar as colunas', { timeout: 20000 });
    await page.waitForTimeout(500);
    const nums = await page.locator('section p.text-2xl').allTextContents();
    ok('compradores: 2 prontas, 2 repetidas, 2 com erros', JSON.stringify(nums) === JSON.stringify(['2', existente ? '2' : '1', existente ? '2' : '3']), JSON.stringify(nums));
    const sels = await page.locator('select[aria-label^="Coluna do ficheiro"]').evaluateAll((els) => els.map((e) => e.selectedOptions[0].textContent));
    ok('colunas reconhecidas sozinhas (Cliente, Tlm, E-mail...)', sels[0] === 'Cliente' && sels[1] === 'Tlm' && sels[2] === 'E-mail', sels.slice(0, 4).join(','));
    ok('acentos do CSV Windows-1252 lidos bem', sels.includes('Motivação') || sels.includes('Orçamento'), sels.join(','));
    await page.screenshot({ path: `${SP}/imp-2.png`, fullPage: true });
    await page.locator('button', { hasText: /^Importar 2/ }).click();
    await page.waitForSelector('text=Importação concluída', { timeout: 60000 });
    await page.screenshot({ path: `${SP}/imp-3.png` });
    const c1 = await rest('GET', 'contactos?nome=ilike.ZZ%20Teste%20Import*&select=id,nome,telemovel,email');
    ok('compradores: 2 contactos gravados', c1.length === 2, c1.map((x) => x.telemovel).join(','));
    ok('telemóvel normalizado para +351', c1.some((x) => x.telemovel === '+351912000001'));
    const cp = await rest('GET', `compradores?contacto_id=in.(${c1.map((x) => x.id).join(',')})&select=id,estado,expectativa_valor,tipologia_minima,distrito,concelho,freguesia,contactos(nome)`);
    const c01 = cp.find((x) => x.contactos.nome.endsWith('01'));
    const c02 = cp.find((x) => x.contactos.nome.endsWith('02'));
    ok('valor 250.000,00 € lido como 250000', Number(c01.expectativa_valor) === 250000, String(c01.expectativa_valor));
    ok('tipologia t1 -> T1 e fase "Imóveis enviados"', c02.tipologia_minima === 'T1' && c02.estado === 'imoveis_enviados', `${c02.tipologia_minima} ${c02.estado}`);
    ok('primeira zona guardada na ficha', c01.distrito === 'Braga' && c01.concelho === 'Guimarães' && c01.freguesia === 'Creixomil');
    const zonas = await rest('GET', `comprador_zonas?comprador_id=eq.${c01.id}&select=distrito,concelho,freguesia`);
    ok('3 zonas (1 + 2 em "outras zonas")', zonas.length === 3, JSON.stringify(zonas.map((z) => z.concelho)));

    // ---- ANGARIAÇÕES (XLSX) ----
    await page.goto('http://localhost:3001/importar');
    await page.locator('button', { hasText: /^Angariações$/ }).click();
    await page.setInputFiles('input[type=file]', xlsxPath);
    await page.waitForSelector('text=Ligar as colunas', { timeout: 20000 });
    await page.waitForTimeout(400);
    const nums2 = await page.locator('section p.text-2xl').allTextContents();
    ok('xlsx lido: 1 pronta, 0 repetidas, 1 com erro (data 31/02)', JSON.stringify(nums2) === JSON.stringify(['1', '0', '1']), JSON.stringify(nums2));
    await page.screenshot({ path: `${SP}/imp-4.png`, fullPage: true });
    await page.locator('button', { hasText: /^Importar 1/ }).click();
    await page.waitForSelector('text=Importação concluída', { timeout: 90000 });
    const an = await rest('GET', 'angariacoes?titulo=ilike.ZZ%20Teste%20Import*&select=id,titulo,inicio,duracao_dias,regime,tipologia,valor,concelho');
    ok('angariação gravada com data, regime e preço', an.length === 1 && an[0].inicio === '2026-09-01' && an[0].regime === 'exclusivo' && Number(an[0].valor) === 200000, JSON.stringify(an[0] || {}));
    const acoes = await rest('GET', `angariacao_acoes?angariacao_id=eq.${an[0].id}&select=id,dia`);
    const passadas = acoes.filter((a) => new Date(2026, 8, 1 + a.dia) < new Date(new Date().setHours(0, 0, 0, 0)));
    ok('plano montado só com ações por vir', acoes.length > 0 && passadas.length === 0, `${acoes.length} ações, ${passadas.length} no passado`);
    const tarefas = await rest('GET', `tarefas?angariacao_acao_id=in.(${acoes.slice(0, 20).map((a) => a.id).join(',')})&select=id`);
    ok('ações no calendário (tarefas)', tarefas.length === Math.min(20, acoes.length));
    const corr = await rest('GET', `correspondencias?angariacao_id=eq.${an[0].id}&select=id`);
    ok('alertas de compradores gerados para a angariação em Creixomil', corr.length > 0, `${corr.length} alertas`);
    ok('sem erros de página', erros.length === 0, JSON.stringify(erros));
    await b.close();
  } finally {
    // limpeza: tudo o que tem o marcador ZZ Teste Import (cascata apaga fichas, zonas, ações, tarefas e alertas)
    await rest('DELETE', 'contactos?nome=ilike.ZZ%20Teste%20Import*');
    await rest('DELETE', 'angariacoes?titulo=ilike.ZZ%20Teste%20Import*');
    const sobras = [
      (await rest('GET', 'contactos?nome=ilike.ZZ%20Teste%20Import*&select=id')).length,
      (await rest('GET', 'angariacoes?titulo=ilike.ZZ%20Teste%20Import*&select=id')).length,
      (await rest('GET', 'tarefas?titulo=ilike.*ZZ%20Teste%20Import*&select=id')).length,
    ];
    const d = await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: 'DELETE', headers: H });
    out.push(`limpeza: sobras (contactos, angariações, tarefas) = ${sobras.join(', ')}; utilizador apagado (${d.status})`);
    console.log(out.join('\n'));
  }
})();
