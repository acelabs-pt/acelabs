// Cabeçalhos de segurança. A app só fala com o Supabase do cliente e com o Google Fonts.
// Ao acrescentar um serviço externo, permiti-lo aqui na CSP (connect-src, img-src, ...).
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
// Vários clientes num deploy: o Supabase de cada um (COCKPIT_CLIENTES) entra na CSP. Mudar a lista pede novo deploy.
let origensClientes = [];
try {
  origensClientes = (JSON.parse(process.env.COCKPIT_CLIENTES || "[]") || []).map((c) => new URL(c.url)).filter((u) => u.protocol === "https:");
} catch {
  origensClientes = [];
}
const varios = origensClientes.length > 0;
const dev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  // o Next precisa de scripts inline para arrancar a página; em desenvolvimento também de eval (recarregar a quente)
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  `connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com${varios ? origensClientes.map((u) => ` ${u.origin} wss://${u.host}`).join("") : supabase ? ` ${supabase.origin} wss://${supabase.host}` : ""}${dev ? " ws:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite um build de verificação numa pasta à parte (NEXT_DIST_DIR=.next-build) sem estragar
  // a pasta .next do servidor de desenvolvimento, que está sempre a correr. Sem a variável, fica .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  async headers() {
    return [
      // A Apple pede este ficheiro sem extensão e espera JSON (links universais: convites a abrir na app).
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
