// Define a password de entrada na plataforma de controlo e o segredo do cookie de sessão. Uso:
//
//   npm run password -- "a tua password"
//
// Imprime as duas linhas a pôr no .env.local (que não vai para o git). A password em si nunca fica guardada, só o hash.
import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Uso: npm run password -- "uma password com pelo menos 12 caracteres"');
  process.exit(1);
}
const sal = randomBytes(16).toString("hex");
console.log(`CONTROLO_PASSWORD_HASH=scrypt$${sal}$${scryptSync(password, sal, 32).toString("hex")}`);
console.log(`CONTROLO_SEGREDO=${randomBytes(32).toString("hex")}`);
