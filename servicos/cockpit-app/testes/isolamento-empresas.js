// Isolamento entre empresas no Supabase REAL (PostgREST + regras de acesso + JWT de utilizadores), complemento do teste
// offline unidade-multiempresa.mjs. Cria duas empresas temporárias (zz-iso-a, zz-iso-b), cada uma com um utilizador, e
// confirma que nenhuma vê, altera, apaga ou cria dados na outra, que as gravações por chave composta que a app faz
// (metas) funcionam, e que suspender uma empresa só a afeta a ela. Apaga tudo no fim.
// Precisa de NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY e TESTES_PERMITIDOS_EM (ou
// DEMO_PERMITIDO_EM). Corre só no projeto de teste ou no Demo, nunca num cliente.
// Uso: node testes/isolamento-empresas.js [.env.demo]    (sem argumento usa o ambiente do runner: npm run testar)
const fs = require('fs');

const env = { ...process.env };
const ficheiro = process.argv[2];
if (ficheiro && fs.existsSync(ficheiro)) {
  for (const l of fs.readFileSync(ficheiro, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}
const U = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, K = env.SUPABASE_SERVICE_ROLE_KEY;
const permitido = env.TESTES_PERMITIDOS_EM || env.DEMO_PERMITIDO_EM;
if (!U || !ANON || !K) { console.log('FALHA faltam NEXT_PUBLIC_SUPABASE_URL, _ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
if (!permitido || !U.includes(`//${permitido}.`)) { console.log(`FALHA Proteção: ${U} não é o projeto de teste/demo indicado. Este teste escreve dados.`); process.exit(1); }

const out = [];
const ok = (nome, cond, extra = '') => out.push(`${cond ? 'OK   ' : 'FALHA'} ${nome}${extra ? ': ' + extra : ''}`);
const HA = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' };
const rest = async (cab, metodo, caminho, corpo, extra = {}) => {
  const r = await fetch(`${U}/rest/v1/${caminho}`, { method: metodo, headers: { ...cab, Prefer: 'return=representation', ...extra }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  return { status: r.status, corpo: j, ok: r.ok };
};
const admin = (m, c, b, e) => rest(HA, m, c, b, e);
const rpc = (cab, nome, b = {}) => rest(cab, 'POST', `rpc/${nome}`, b, { Prefer: '' });

(async () => {
  const sufixo = Date.now();
  const cod = (x) => `zz-iso-${x}-${String(sufixo).slice(-6)}`;
  const criadas = [], utilizadores = [];
  let antesDemo = null;
  try {
    // contagem de referência das outras empresas (têm de ficar intactas)
    const outras = await admin('GET', 'contactos?select=id');
    antesDemo = outras.corpo.length;

    const emp = {};
    for (const x of ['a', 'b']) {
      const e = await admin('POST', 'empresas', { codigo: cod(x), nome: `ISO ${x}` });
      if (!e.ok) throw new Error('criar empresa: ' + JSON.stringify(e.corpo).slice(0, 150));
      emp[x] = e.corpo[0].id;
      criadas.push(emp[x]);
    }
    const sess = {};
    for (const x of ['a', 'b']) {
      const email = `claude-teste-iso-${x}-${sufixo}@acelabs.pt`, password = 'T' + Math.random().toString(36).slice(2) + 'Aa1!';
      const cu = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: HA, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
      utilizadores.push(cu.id);
      const m = await admin('POST', 'membros', { user_id: cu.id, empresa_id: emp[x] });
      if (!m.ok) throw new Error('membro: ' + JSON.stringify(m.corpo).slice(0, 150));
      const t = await (await fetch(`${U}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();
      sess[x] = { id: cu.id, cab: { apikey: ANON, Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json' } };
    }
    const A = sess.a.cab, B = sess.b.cab;

    // 1. cada um cria os seus dados SEM indicar a empresa (como a app faz)
    const ca = await rest(A, 'POST', 'contactos', { nome: 'ZZ ISO contacto A' });
    const cb = await rest(B, 'POST', 'contactos', { nome: 'ZZ ISO contacto B' });
    ok('A cria um contacto e a base põe a empresa de A', ca.ok && ca.corpo[0].empresa_id === emp.a, ca.ok ? '' : JSON.stringify(ca.corpo).slice(0, 120));
    ok('B cria um contacto e a base põe a empresa de B', cb.ok && cb.corpo[0].empresa_id === emp.b);
    const idA = ca.corpo[0].id, idB = cb.corpo[0].id;

    // 2. leitura
    const la = await rest(A, 'GET', 'contactos?select=id,nome&nome=like.ZZ%20ISO*');
    ok('A só vê o seu contacto', la.ok && la.corpo.length === 1 && la.corpo[0].id === idA);
    const lb = await rest(B, 'GET', 'contactos?select=id,nome&nome=like.ZZ%20ISO*');
    ok('B só vê o seu contacto', lb.ok && lb.corpo.length === 1 && lb.corpo[0].id === idB);
    const directo = await rest(A, 'GET', `contactos?select=id&id=eq.${idB}`);
    ok('A não consegue ler o contacto de B nem pelo id', directo.ok && directo.corpo.length === 0);

    // 3. alterar, apagar, criar na outra empresa
    const alt = await rest(A, 'PATCH', `contactos?id=eq.${idB}`, { nome: 'HACKED' });
    ok('A não altera o contacto de B', alt.ok && alt.corpo.length === 0);
    const apa = await rest(A, 'DELETE', `contactos?id=eq.${idB}`);
    ok('A não apaga o contacto de B', apa.ok && apa.corpo.length === 0);
    const intacto = await admin('GET', `contactos?select=nome&id=eq.${idB}`);
    ok('o contacto de B continua intacto', intacto.corpo.length === 1 && intacto.corpo[0].nome === 'ZZ ISO contacto B');
    const intruso = await rest(A, 'POST', 'contactos', { nome: 'ZZ ISO intruso', empresa_id: emp.b });
    ok('A não consegue criar um contacto na empresa de B', !intruso.ok && [401, 403].includes(intruso.status), String(intruso.status));
    const mover = await rest(A, 'PATCH', `contactos?id=eq.${idA}`, { empresa_id: emp.b });
    ok('A não consegue passar um contacto seu para B', !mover.ok || mover.corpo.length === 0, String(mover.status));

    // 4. tabelas ligadas e as gravações por chave composta que a app faz (Metas)
    const ang = await rest(A, 'POST', 'angariacoes', { titulo: 'ZZ ISO angariação A' });
    await rest(B, 'POST', 'angariacoes', { titulo: 'ZZ ISO angariação B' });
    const res = await rpc(A, 'resumo_angariacoes');
    ok('resumo_angariacoes() só devolve as angariações de A', res.ok && res.corpo.length === 1 && res.corpo[0].angariacao_id === ang.corpo[0].id, JSON.stringify(res.corpo).slice(0, 100));
    for (const [x, cab] of [['a', A], ['b', B]]) {
      const up = await rest(cab, 'POST', 'metas?on_conflict=empresa_id,ano,metrica', { empresa_id: emp[x], ano: 2026, metrica: 'visitas', valor_anual: x === 'a' ? 11 : 22 }, { Prefer: 'return=representation,resolution=merge-duplicates' });
      ok(`${x.toUpperCase()}: upsert de metas por (empresa, ano, metrica)`, up.ok, up.ok ? '' : JSON.stringify(up.corpo).slice(0, 120));
      const cf = await rest(cab, 'POST', 'metas_config?on_conflict=empresa_id,ano', { empresa_id: emp[x], ano: 2026, semanas_uteis: 40 }, { Prefer: 'return=representation,resolution=merge-duplicates' });
      ok(`${x.toUpperCase()}: upsert de metas_config por (empresa, ano)`, cf.ok, cf.ok ? '' : JSON.stringify(cf.corpo).slice(0, 120));
    }
    const ma = await rest(A, 'GET', 'metas?select=valor_anual&ano=eq.2026&metrica=eq.visitas');
    ok('as metas de A e de B coexistem e cada um vê só a sua', ma.ok && ma.corpo.length === 1 && ma.corpo[0].valor_anual === 11);
    const re = await rpc(A, 'empresa_atual');
    ok('rpc empresa_atual() devolve a empresa de A', re.ok && re.corpo === emp.a, JSON.stringify(re.corpo).slice(0, 60));
    const ee = await rest(A, 'GET', 'empresas?select=id,codigo');
    ok('A só vê a sua própria empresa', ee.ok && ee.corpo.length === 1 && ee.corpo[0].id === emp.a);
    const mm = await rest(A, 'GET', 'membros?select=user_id');
    ok('A só vê o seu próprio registo de membro', mm.ok && mm.corpo.length === 1 && mm.corpo[0].user_id === sess.a.id);

    // 5. chave de administrador com várias empresas: sem empresa_id falha
    const amb = await admin('POST', 'contactos', { nome: 'ZZ ISO ambíguo' });
    ok('com várias empresas, o administrador sem empresa_id é recusado', !amb.ok, String(amb.status));

    // 6. suspender B
    await admin('PATCH', `empresas?id=eq.${emp.b}`, { suspensa: true });
    const sb = await rest(B, 'GET', 'contactos?select=id&nome=like.ZZ%20ISO*');
    ok('empresa suspensa: B deixa de ver dados', sb.ok && sb.corpo.length === 0);
    const escB = await rest(B, 'POST', 'contactos', { nome: 'ZZ ISO suspensa' });
    ok('empresa suspensa: B deixa de poder escrever', !escB.ok);
    const sa = await rest(A, 'GET', 'contactos?select=id&nome=like.ZZ%20ISO*');
    ok('suspender B não afeta A', sa.ok && sa.corpo.length === 1);
    await admin('PATCH', `empresas?id=eq.${emp.b}`, { suspensa: false });
    const rb = await rest(B, 'GET', 'contactos?select=id&nome=like.ZZ%20ISO*');
    ok('reativar B devolve o acesso', rb.ok && rb.corpo.length === 1);

    // 7. apagar a conta: último membro da empresa recusado
    const ap = await rpc(A, 'apagar_minha_conta');
    ok('o único membro de uma empresa não pode apagar a conta', !ap.ok && /ultimo_membro/.test(JSON.stringify(ap.corpo)), JSON.stringify(ap.corpo).slice(0, 80));
  } catch (e) {
    ok('o teste correu até ao fim', false, String(e.message || e).slice(0, 200));
  } finally {
    for (const id of criadas) await admin('DELETE', `empresas?id=eq.${id}`);
    for (const id of utilizadores) await fetch(`${U}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: HA });
    const depois = await admin('GET', 'contactos?select=id');
    const sobras = await admin('GET', `empresas?select=id&codigo=like.zz-iso-*`);
    ok('a limpeza apagou as empresas temporárias e os dados delas', depois.ok && depois.corpo.length === antesDemo && sobras.corpo.length === 0, `contactos ${antesDemo} -> ${depois.corpo?.length}`);
    console.log(out.join('\n'));
  }
})();
