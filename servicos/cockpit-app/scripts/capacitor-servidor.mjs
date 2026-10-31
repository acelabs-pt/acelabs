// Escreve o endereço da app em capacitor/www/servidor.js (usado pelo ecrã "sem ligação" para tentar outra vez).
// Uso: CAP_SERVER_URL=http://192.168.1.20:3001 node scripts/capacitor-servidor.mjs   (sem variável: produção)
import { writeFileSync } from "node:fs";
const url = (process.env.CAP_SERVER_URL || "https://cockpit.acelabs.pt").replace(/\/?$/, "/");
writeFileSync(
  "capacitor/www/servidor.js",
  `// Gerado por scripts/capacitor-servidor.mjs a partir de CAP_SERVER_URL. Nao editar a mao.\nwindow.COCKPIT_URL = ${JSON.stringify(url)};\n`
);
console.log("Endereço da app:", url);
