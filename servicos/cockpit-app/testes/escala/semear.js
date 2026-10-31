// Semeia 1000 compradores, 1000 proprietários e 1000 angariações com plano (todos "ZZ Escala") no Supabase de teste.
const crypto = require('crypto');
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
const uuid = () => crypto.randomUUID();
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const N = Number(process.env.N || 1000);

async function inserir(tabela, linhas, lote = 1000) {
  const lotes = [];
  for (let i = 0; i < linhas.length; i += lote) lotes.push(linhas.slice(i, i + lote));
  let i = 0;
  async function trabalhador() {
    while (i < lotes.length) {
      const l = lotes[i++];
      const r = await fetch(`${U}/rest/v1/${tabela}`, { method: 'POST', headers: H, body: JSON.stringify(l) });
      if (!r.ok) throw new Error(`${tabela}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    }
  }
  await Promise.all([trabalhador(), trabalhador(), trabalhador(), trabalhador()]);
}

const concelhos = [['Braga', 'Braga'], ['Braga', 'Guimarães'], ['Braga', 'Barcelos'], ['Porto', 'Porto'], ['Porto', 'Maia'], ['Viana do Castelo', 'Viana do Castelo']];
const estadosC = ['lead_qualificada', 'imoveis_enviados', 'visitas_realizadas', 'propostas_efetuadas', 'cpcv', 'escritura', 'negocio_concluido', 'perdido'];
const estadosP = ['fsbo', 'reuniao_marcada', 'reuniao_angariacao', 'dossier_enviado', 'imovel_vendido_enviado', 'follow_up_1', 'follow_up_2', 'angariado', 'perdido'];
const canais = ['Idealista', 'Imovirtual', 'Meta', 'Placa', 'Referência', 'Site da imobiliária'];
const tipos = ['Apartamento', 'Moradia', 'Terreno'];
const tipologias = ['T0', 'T1', 'T2', 'T3', 'T4'];
const dia = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const iso = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(9, 0, 0, 0); return d.toISOString(); };

(async () => {
  const t0 = Date.now();
  // compradores
  const cc = [], comp = [], zonas = [];
  for (let i = 1; i <= N; i++) {
    const [d, c] = pick(concelhos);
    const cid = uuid(), id = uuid();
    cc.push({ id: cid, nome: `ZZ Escala Comprador ${String(i).padStart(4, '0')}`, telemovel: `+3519${String(10000000 + i)}`, canal_origem: pick(canais) });
    comp.push({ id, contacto_id: cid, motivacao: Math.floor(Math.random() * 11), tipo_imovel: pick(tipos), tipologia_minima: pick(tipologias), distrito: d, concelho: c, expectativa_valor: 100000 + Math.floor(Math.random() * 40) * 10000, estado: pick(estadosC), estado_desde: new Date(Date.now() - Math.random() * 60 * 86400000).toISOString() });
    zonas.push({ comprador_id: id, distrito: d, concelho: c });
  }
  await inserir('contactos', cc); await inserir('compradores', comp); await inserir('comprador_zonas', zonas);
  console.log(`compradores ok (${Date.now() - t0} ms)`);
  // proprietários
  const pc = [], prop = [];
  for (let i = 1; i <= N; i++) {
    const [d, c] = pick(concelhos);
    const cid = uuid();
    pc.push({ id: cid, nome: `ZZ Escala Proprietario ${String(i).padStart(4, '0')}`, telemovel: `+3518${String(10000000 + i)}`, canal_origem: pick(canais) });
    prop.push({ contacto_id: cid, tipo_imovel: pick(tipos), tipologia: pick(tipologias), distrito: d, concelho: c, valor: 100000 + Math.floor(Math.random() * 60) * 10000, estado: pick(estadosP), estado_desde: new Date(Date.now() - Math.random() * 60 * 86400000).toISOString() });
  }
  await inserir('contactos', pc); await inserir('proprietarios', prop);
  console.log(`proprietarios ok (${Date.now() - t0} ms)`);
  // angariações com plano: 47 ações do plano padrão + 12 follow ups = 59 por angariação
  const blocos = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const angs = [], acoes = [], tarefas = [];
  for (let i = 1; i <= N; i++) {
    const [d, c] = pick(concelhos);
    const aid = uuid();
    const inicioOff = -Math.floor(Math.random() * 120);
    const titulo = `ZZ Escala Angariacao ${String(i).padStart(4, '0')}`;
    angs.push({ id: aid, titulo, duracao_dias: 180, regime: pick(['exclusivo', 'nao_exclusivo']), inicio: dia(inicioOff), tipo_imovel: pick(tipos), tipologia: pick(tipologias), distrito: d, concelho: c, valor: 100000 + Math.floor(Math.random() * 60) * 10000 });
    for (let k = 0; k < 59; k++) {
      const diaPlano = k < 47 ? (blocos[k % 18] - 1) * 10 : (blocos[(k - 47) % 12 + 1] - 1) * 10 + 5;
      const feita = inicioOff + diaPlano < -10 && Math.random() < 0.6;
      const acid = uuid();
      acoes.push({ id: acid, angariacao_id: aid, nome: k < 47 ? `Acao ${k % 12}` : 'Follow up', dia: diaPlano, follow_up: k >= 47, feita, feita_em: feita ? new Date().toISOString() : null });
      tarefas.push({ titulo: `Acao: ${titulo}`, tipo: 'tarefa', inicio: iso(inicioOff + diaPlano), origem: 'angariacao', angariacao_acao_id: acid, feita, feita_em: feita ? new Date().toISOString() : null, chave_automacao: `escala:${acid}` });
    }
  }
  await inserir('angariacoes', angs); console.log(`angariacoes ok (${Date.now() - t0} ms)`);
  await inserir('angariacao_acoes', acoes, 2000); console.log(`acoes ok: ${acoes.length} (${Date.now() - t0} ms)`);
  await inserir('tarefas', tarefas, 2000); console.log(`tarefas ok: ${tarefas.length} (${Date.now() - t0} ms)`);
})().catch((e) => { console.error('ERRO', e.message); process.exit(1); });
