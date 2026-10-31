// scripts/gerar-clientes.mjs: gera o valor de COCKPIT_CLIENTES e recusa o que não deve ir para o browser (chave de
// administrador, url que não é do Supabase, códigos repetidos). Não precisa de servidor nem de Supabase.
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const jwt = (role) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ iss: 'supabase', ref: 'abc', role })}.assinatura`;
};
const SCRIPT = path.join(__dirname, '..', 'scripts', 'gerar-clientes.mjs');
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'gerar-clientes-'));
const correr = (lista) => {
  const f = path.join(pasta, 'c.json');
  fs.writeFileSync(f, typeof lista === 'string' ? lista : JSON.stringify(lista));
  const r = spawnSync(process.execPath, [SCRIPT, f], { encoding: 'utf8' });
  return { cod: r.status, out: r.stdout, err: r.stderr };
};
const bom = { codigo: 'demo', nome: 'Ace Labs Demo', url: 'https://abcdefgh.supabase.co', anon: jwt('anon') };

const out = [];
const ok = (nome, cond, extra = '') => out.push(`${cond ? 'OK   ' : 'FALHA'} ${nome}${extra ? ': ' + extra : ''}`);

let r = correr([bom, { ...bom, codigo: 'alvorada', nome: 'Alvorada', url: 'https://zzzz.supabase.co/' }]);
ok('gera a lista de dois clientes', r.cod === 0 && r.out.includes('2 cliente(s)'), r.err.slice(0, 120));
const linha = r.out.trim().split('\n').pop();
let obj = null;
try { obj = JSON.parse(linha); } catch {}
ok('a última linha é JSON numa linha só', Array.isArray(obj) && obj.length === 2 && !linha.includes('\n'));
ok('tira a barra final do url', obj && obj[1].url === 'https://zzzz.supabase.co');
ok('aceita a chave publishable nova', correr([{ ...bom, anon: 'sb_publishable_abc123' }]).cod === 0);

r = correr([{ ...bom, anon: jwt('service_role') }]);
ok('recusa a chave service_role', r.cod === 1 && r.err.includes('ADMINISTRADOR'));
ok('não imprime a chave recusada', !r.out.includes('assinatura') && !r.err.includes('assinatura'));
ok('recusa a chave sb_secret_', correr([{ ...bom, anon: 'sb_secret_xyz' }]).cod === 1);
ok('recusa um url que não é do Supabase', correr([{ ...bom, url: 'https://exemplo.com' }]).cod === 1);
ok('recusa http', correr([{ ...bom, url: 'http://abcdefgh.supabase.co' }]).cod === 1);
ok('recusa códigos repetidos', correr([bom, { ...bom }]).cod === 1);
ok('recusa um código com caracteres que a app remove', correr([{ ...bom, codigo: 'Alvorada Imóveis' }]).cod === 1);
ok('recusa uma chave que não é anon', correr([{ ...bom, anon: jwt('authenticated') }]).cod === 1);
ok('recusa JSON estragado', correr('isto não é json').cod === 1);
ok('recusa lista vazia', correr([]).cod === 1);

fs.rmSync(pasta, { recursive: true, force: true });
console.log(out.join('\n'));
