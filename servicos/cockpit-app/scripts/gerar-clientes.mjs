// Gera o valor de COCKPIT_CLIENTES (variável da Vercel) a partir de um ficheiro local, e confere cada entrada.
// Uso (na pasta servicos/cockpit-app):
//
//   1. criar clientes-cockpit.json (fora do git) com a lista:
//        [{ "codigo": "demo", "nome": "Ace Labs Demo", "url": "https://xxxx.supabase.co", "anon": "<chave anon>" }]
//   2. npm run clientes            (ou: node scripts/gerar-clientes.mjs outro-ficheiro.json)
//   3. colar a linha que sai na Vercel: Settings, Environment Variables, COCKPIT_CLIENTES. Depois fazer novo deploy.
//
// Só entra a chave PÚBLICA (anon / publishable). O script recusa a chave de administrador (service_role / sb_secret_),
// porque esta lista vai para o browser de quem entra na app.
import { existsSync, readFileSync } from "node:fs";

const ficheiro = process.argv[2] || "clientes-cockpit.json";
if (!existsSync(ficheiro)) {
  console.error(`Não encontro ${ficheiro}. Cria-o com a lista de clientes (ver o início deste script).`);
  process.exit(1);
}
let lista;
try {
  lista = JSON.parse(readFileSync(ficheiro, "utf8"));
} catch (e) {
  console.error(`${ficheiro} não é JSON válido: ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(lista) || !lista.length) {
  console.error("O ficheiro tem de ser uma lista com pelo menos um cliente.");
  process.exit(1);
}

const normalizar = (c) => String(c ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
const papelDoJwt = (k) => {
  try {
    return JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
};

const erros = [];
const codigos = new Set();
const saida = [];
lista.forEach((c, i) => {
  const quem = `Cliente ${i + 1}${c?.codigo ? ` (${c.codigo})` : ""}`;
  const codigo = normalizar(c?.codigo);
  const nome = String(c?.nome ?? "").trim();
  const url = String(c?.url ?? "").trim().replace(/\/$/, "");
  const anon = String(c?.anon ?? "").trim();
  if (!codigo) erros.push(`${quem}: falta o código (letras minúsculas, números e hífen).`);
  else if (codigo !== String(c.codigo).trim().toLowerCase()) erros.push(`${quem}: o código "${c.codigo}" tem caracteres que a app remove; usa "${codigo}".`);
  if (codigos.has(codigo)) erros.push(`${quem}: código repetido.`);
  codigos.add(codigo);
  if (!nome) erros.push(`${quem}: falta o nome.`);
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) erros.push(`${quem}: o url tem de ser https://<referência>.supabase.co (sem barra no fim).`);
  if (!anon) erros.push(`${quem}: falta a chave anon.`);
  else if (anon.startsWith("sb_secret_") || papelDoJwt(anon) === "service_role") erros.push(`${quem}: ESTA É A CHAVE DE ADMINISTRADOR (service_role). Nunca vai para aqui. Usa a chave anon / publishable.`);
  else if (!anon.startsWith("sb_publishable_") && papelDoJwt(anon) !== "anon") erros.push(`${quem}: a chave não parece a anon do Supabase (JWT com role anon, ou sb_publishable_).`);
  saida.push({ codigo, nome, url, anon });
});

if (erros.length) {
  console.error("Não gerei nada. Corrige:\n- " + erros.join("\n- "));
  process.exit(1);
}
console.log(`OK: ${saida.length} cliente(s): ${saida.map((c) => c.codigo).join(", ")}\n`);
console.log("COCKPIT_CLIENTES (cola só a linha seguinte na Vercel):");
console.log(JSON.stringify(saida));
