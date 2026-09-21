/** @type {import('next').NextConfig} */
const nextConfig = {
  // @sparticuz/chromium traz um binário (chromium.br) que o file tracing do
  // Next não deve tentar analisar/bundlar como módulo JS normal - fica de fora
  // do bundle e é resolvido a partir de node_modules em runtime.
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  },
};

export default nextConfig;
