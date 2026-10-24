/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite um build de verificação numa pasta à parte (NEXT_DIST_DIR=.next-build) sem estragar
  // a pasta .next do servidor de desenvolvimento, que está sempre a correr. Sem a variável, fica .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
