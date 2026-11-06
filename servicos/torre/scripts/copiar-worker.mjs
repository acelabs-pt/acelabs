// O worker do pdf.js (lê o código QR dos PDFs no browser) já vem minificado e o build do Next não o consegue reprocessar.
// Copia-se tal e qual para public/ antes do dev e do build (public/pdf.worker.min.mjs está no .gitignore).
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const origem = path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "build", "pdf.worker.min.mjs");
const destino = path.join(process.cwd(), "public", "pdf.worker.min.mjs");
mkdirSync(path.dirname(destino), { recursive: true });
copyFileSync(origem, destino);
