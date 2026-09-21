/** @type {import('next').NextConfig} */
const nextConfig = {
  // @sparticuz/chromium traz um binário (chromium.br) que o file tracing do
  // Next não deve tentar analisar/bundlar como módulo JS normal - fica de fora
  // do bundle e é resolvido a partir de node_modules em runtime.
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "playwright-core"],
    // serverComponentsExternalPackages sozinho não chegou em produção (testado): o
    // tracing da função serverless da Vercel excluía o binário
    // "@sparticuz/chromium/bin" do pacote final, e o download do PDF falhava com
    // "input directory does not exist". Isto força a incluir a pasta toda.
    // Tem de estar dentro de "experimental" no Next 14 (testado: ao nível de topo
    // é ignorado silenciosamente, sem erro nenhum a avisar).
    outputFileTracingIncludes: {
      "/api/cpcv/gerar": ["./node_modules/@sparticuz/chromium/**/*"],
      "/api/cpcv/[id]/rascunho": ["./node_modules/@sparticuz/chromium/**/*"],
    },
  },
};

export default nextConfig;
