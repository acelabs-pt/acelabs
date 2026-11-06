// A Torre está publicada (Vercel) e guarda as finanças da Ace Labs: cabeçalhos de segurança apertados e nada em cache.
// O browser nunca fala direto com o Supabase (tudo passa por ações do servidor), por isso connect-src fica só 'self'.
// 'unsafe-eval' só em desenvolvimento (o recarregamento do Next precisa dele); em produção não.
const dev = process.env.NODE_ENV !== "production";

// O ficheiro de uma fatura (/faturas/<id>/ficheiro) é o único sítio que se pode mostrar dentro de outra página, e só da
// própria Torre (a pré-visualização na revisão). Tudo o resto não entra em iframes de ninguém.
const FICHEIRO = "/faturas/:id/ficheiro";

const csp = (moldura) =>
  `default-src 'self'; script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; ` +
  `img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-src 'self'; ` +
  `frame-ancestors ${moldura}; base-uri 'self'; form-action 'self'; object-src 'none'`;

const comuns = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // "no-referrer" faz o browser mandar Origin: null nos POST e as ações do servidor do Next falham.
  // "same-origin" não manda nada para fora e mantém o Origin certo dentro da Torre.
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Um extrato de um ano inteiro (milhares de linhas) ou uma fatura em PDF passam numa só ação (a Vercel aceita até ~4,5 MB).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  async headers() {
    return [
      {
        source: "/:path((?!faturas/[^/]+/ficheiro$).*)",
        headers: [...comuns, { key: "Content-Security-Policy", value: csp("'none'") }, { key: "X-Frame-Options", value: "DENY" }],
      },
      {
        source: FICHEIRO,
        headers: [...comuns, { key: "Content-Security-Policy", value: csp("'self'") }, { key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
