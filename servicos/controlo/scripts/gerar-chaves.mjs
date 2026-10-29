// Gera o par de chaves (Ed25519) com que os sócios assinam os pedidos às funções `admin` dos clientes. Uma vez por equipa.
//
//   npm run chaves
//
// A chave PRIVADA vai para o .env.local de cada sócio (CONTROLO_CHAVE_PRIVADA) e não sai dos computadores deles.
// A chave PÚBLICA vai para o Supabase de cada cliente (segredo CONTROLO_CHAVE_PUBLICA da função `admin`), e pode ser vista por todos.
// Gerar de novo invalida todos os pedidos antigos: obriga a atualizar a pública em cada cliente.
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pub = publicKey.export({ type: "spki", format: "pem" }).toString().trim();
const priv = privateKey.export({ type: "pkcs8", format: "pem" }).toString().trim();

console.log("# Para o .env.local de cada sócio (numa só linha, com \\n):");
console.log(`CONTROLO_CHAVE_PRIVADA="${priv.replace(/\n/g, "\\n")}"`);
console.log("\n# Para os segredos da função admin de cada cliente (supabase secrets set CONTROLO_CHAVE_PUBLICA=...):");
console.log(pub);
