// Apaga tudo o que o teste de escala semeou ("ZZ Escala"), em lotes pequenos por causa da cascata (59 mil ações e 59 mil tarefas).
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,count=exact' };
const get = async (p) => (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json();
const contar = async (tabela, filtro) => {
  const r = await fetch(`${U}/rest/v1/${tabela}?select=id&${filtro}`, { method: 'HEAD', headers: H });
  return Number((r.headers.get('content-range') || '*/0').split('/')[1]);
};
(async () => {
  const t0 = Date.now();
  // tarefas de teste primeiro, em lotes (sem índice em tarefas.angariacao_acao_id a cascata das ações dava timeout)
  for (;;) {
    const todos = (await get("tarefas?select=id&chave_automacao=like.escala:*&limit=1000")).map((x) => x.id);
    if (!todos.length) break;
    for (let i = 0; i < todos.length; i += 150) {
      const ids = todos.slice(i, i + 150);
      const r = await fetch(U + "/rest/v1/tarefas?id=in.(" + ids.join(",") + ")", { method: "DELETE", headers: H });
      if (!r.ok) throw new Error("tarefas: " + r.status + " " + (await r.text()).slice(0, 150));
    }
  }
  console.log("tarefas de teste apagadas (" + (Date.now() - t0) + " ms)");
  // angariações (a maior cascata), 20 de cada vez
  for (;;) {
    const ids = (await get('angariacoes?select=id&titulo=ilike.ZZ%20Escala*&limit=20')).map((x) => x.id);
    if (!ids.length) break;
    const r = await fetch(`${U}/rest/v1/angariacoes?id=in.(${ids.join(',')})`, { method: 'DELETE', headers: H });
    if (!r.ok) throw new Error(`angariacoes: ${r.status} ${(await r.text()).slice(0, 150)}`);
  }
  console.log(`angariações apagadas (${Date.now() - t0} ms)`);
  // contactos (cascata: compradores, zonas, proprietários, correspondências), 200 de cada vez
  for (;;) {
    const ids = (await get('contactos?select=id&nome=ilike.ZZ%20Escala*&limit=200')).map((x) => x.id);
    if (!ids.length) break;
    const r = await fetch(`${U}/rest/v1/contactos?id=in.(${ids.join(',')})`, { method: 'DELETE', headers: H });
    if (!r.ok) throw new Error(`contactos: ${r.status} ${(await r.text()).slice(0, 150)}`);
  }
  console.log(`contactos apagados (${Date.now() - t0} ms)`);
  const sobras = {
    contactos: await contar('contactos', 'nome=ilike.ZZ%20Escala*'),
    angariacoes: await contar('angariacoes', 'titulo=ilike.ZZ%20Escala*'),
    tarefas: await contar('tarefas', 'chave_automacao=like.escala:*'),
    tarefas_total: await contar('tarefas', 'id=not.is.null'),
    acoes_total: await contar('angariacao_acoes', 'id=not.is.null'),
    compradores_total: await contar('compradores', 'id=not.is.null'),
  };
  console.log('sobras do teste:', JSON.stringify(sobras));
})().catch((e) => { console.error('ERRO', e.message); process.exit(1); });
