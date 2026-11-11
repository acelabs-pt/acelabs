"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sair } from "@/app/acoes";

// Menu lateral, como no Cockpit em ecrã largo. Três tamanhos: aberto (ícone e nome), recolhido (só ícones) e, no
// telemóvel, uma gaveta que abre de lado. As secções agrupam o que se faz todos os dias, o dinheiro e a gestão.

export type Modo = "auto" | "aberta" | "fechada";

type Item = { href: string; texto: string; icone: React.ReactNode; contador?: "faturas" | "movimentos" };
type Grupo = { titulo: string; itens: Item[] };

const GRUPOS: Grupo[] = [
  {
    titulo: "Dia a dia",
    itens: [
      {
        href: "/",
        texto: "Início",
        icone: (
          <>
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </>
        ),
      },
      {
        href: "/faturas",
        texto: "Faturas",
        contador: "faturas",
        icone: (
          <>
            <path d="M6 3h9l4 4v14l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21V4a1 1 0 0 1 1-1Z" />
            <path d="M9 9h6M9 13h6" />
          </>
        ),
      },
      { href: "/movimentos", texto: "Movimentos", contador: "movimentos", icone: <path d="M4 7h13l-3-3M20 17H7l3 3" /> },
      {
        href: "/contactos",
        texto: "Clientes e fornecedores",
        icone: (
          <>
            <rect x="4" y="3" width="16" height="18" rx="2" />
            <circle cx="12" cy="10" r="2.5" />
            <path d="M7.5 17c.8-2 2.4-3 4.5-3s3.7 1 4.5 3" />
          </>
        ),
      },
    ],
  },
  {
    titulo: "Dinheiro",
    itens: [
      {
        href: "/tesouraria",
        texto: "Tesouraria",
        icone: (
          <>
            <path d="M3 17l5-5 4 3 8-9" />
            <path d="M14 6h6v6" />
          </>
        ),
      },
      {
        href: "/debitos",
        texto: "Débitos diretos",
        icone: (
          <>
            <rect x="3" y="5" width="18" height="15" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4M8 15h3" />
          </>
        ),
      },
      { href: "/resultados", texto: "Resultados", icone: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
      {
        href: "/socios",
        texto: "Sócios",
        icone: (
          <>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5" />
            <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.5 2.4 3.5 5.2" />
          </>
        ),
      },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      {
        href: "/acessos",
        texto: "Acessos",
        icone: (
          <>
            <circle cx="8" cy="15" r="4" />
            <path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2" />
          </>
        ),
      },
      {
        href: "/registo",
        texto: "Registo",
        icone: (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </>
        ),
      },
      {
        href: "/definicoes",
        texto: "Definições",
        icone: (
          <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 10h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1Z" />
          </>
        ),
      },
    ],
  },
];

export function Icone({ children, tamanho = 22 }: { children: React.ReactNode; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      {children}
    </svg>
  );
}

function ativo(caminho: string, href: string) {
  return href === "/" ? caminho === "/" : caminho.startsWith(href);
}

export function abrirPesquisa() {
  window.dispatchEvent(new Event("torre:pesquisa"));
}

/** Classes de cada tamanho. Escritas por extenso para o Tailwind as encontrar. */
export const TAMANHOS: Record<Modo, { largura: string; margem: string; texto: string; bloco: string; so_icones: string; centrar: string }> = {
  auto: { largura: "w-[72px] lg:w-60", margem: "sm:pl-[72px] lg:pl-60", texto: "hidden lg:inline", bloco: "hidden lg:block", so_icones: "block lg:hidden", centrar: "justify-center lg:justify-start" },
  aberta: { largura: "w-60", margem: "sm:pl-60", texto: "inline", bloco: "block", so_icones: "hidden", centrar: "justify-start" },
  fechada: { largura: "w-[72px]", margem: "sm:pl-[72px]", texto: "hidden", bloco: "hidden", so_icones: "block", centrar: "justify-center" },
};

function Corpo({
  modo,
  nome,
  contadores,
  aoAlternar,
  gaveta = false,
}: {
  modo: Modo;
  nome: string;
  contadores: { faturas: number; movimentos: number };
  aoAlternar?: () => void;
  gaveta?: boolean;
}) {
  const caminho = usePathname() ?? "/";
  // Na gaveta (telemóvel) há sempre espaço para os nomes.
  const t = gaveta ? { largura: "", margem: "", texto: "inline", bloco: "block", so_icones: "hidden", centrar: "justify-start" } : TAMANHOS[modo];

  return (
    <>
      <div className={`flex items-center ${t.centrar} px-3 pb-3 pt-4`}>
        <Link href="/" className="text-xl font-bold tracking-tight text-tinta" aria-label="Torre, início">
          T<span className={t.texto}>orre</span>
          <span className="text-azul">.</span>
        </Link>
      </div>

      <button
        type="button"
        onClick={abrirPesquisa}
        title="Pesquisar (Ctrl K)"
        aria-label="Pesquisar"
        className={`mx-2 mb-2 flex items-center gap-2 rounded-2xl border border-linha bg-white px-3 py-2 text-sm text-secundario hover:border-azul/40 ${t.centrar}`}
      >
        <Icone tamanho={18}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </Icone>
        <span className={`${t.texto} flex-1 text-left`}>Pesquisar ou fazer</span>
        <kbd className={`${t.texto} rounded-md border border-linha px-1.5 font-sans text-[11px]`}>Ctrl K</kbd>
      </button>

      <ul className="flex-1 overflow-y-auto px-2 pb-2">
        {GRUPOS.map((g, i) => (
          <li key={g.titulo}>
            <p className={`${t.bloco} px-3 pb-1 pt-4 text-xs font-semibold text-secundario`}>{g.titulo}</p>
            {i > 0 && <div className={`${t.so_icones} mx-3 my-2 h-px bg-linha`} />}
            <ul className="space-y-0.5">
              {g.itens.map((item) => {
                const a = ativo(caminho, item.href);
                const n = item.contador ? contadores[item.contador] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={item.texto}
                      aria-current={a ? "page" : undefined}
                      className={`relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium ${t.centrar} ${a ? "bg-azul-suave text-azul" : "text-secundario hover:bg-black/5 hover:text-tinta"}`}
                    >
                      <Icone>{item.icone}</Icone>
                      <span className={t.texto}>{item.texto}</span>
                      {n > 0 && (
                        <>
                          <span className={`${t.texto} numero ml-auto rounded-full bg-azul px-1.5 py-0.5 text-[11px] font-bold leading-none text-white`} aria-label={`${n} por tratar`}>
                            {n > 99 ? "99+" : n}
                          </span>
                          <span className={`${t.so_icones} absolute right-2.5 top-2 h-2.5 w-2.5 rounded-full bg-azul ring-2 ring-white`} aria-hidden />
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      <div className="border-t border-linha p-2">
        <div className={`flex items-center gap-3 px-3 py-2 ${t.centrar}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-azul-suave text-sm font-bold text-azul-escuro" aria-hidden>
            {nome.charAt(0).toUpperCase()}
          </span>
          <span className={`${t.texto} min-w-0 flex-1 truncate text-sm font-semibold text-tinta`}>{nome}</span>
        </div>
        <div className={`flex flex-col gap-0.5 text-sm ${t.centrar === "justify-start" ? "" : "items-center"}`}>
          <Link href="/pin" title="Mudar PIN" className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-secundario hover:bg-black/5 hover:text-tinta ${t.centrar}`}>
            <Icone tamanho={20}>
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </Icone>
            <span className={t.texto}>Mudar PIN</span>
          </Link>
          <form action={sair} className="w-full">
            <button title="Sair" className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-secundario hover:bg-black/5 hover:text-tinta ${t.centrar}`}>
              <Icone tamanho={20}>
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" />
              </Icone>
              <span className={t.texto}>Sair</span>
            </button>
          </form>
          {aoAlternar && (
            <button
              type="button"
              onClick={aoAlternar}
              title="Encolher ou abrir o menu"
              aria-label="Encolher ou abrir o menu"
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-secundario hover:bg-black/5 hover:text-tinta ${t.centrar}`}
            >
              <Icone tamanho={20}>
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M9 4v16" />
              </Icone>
              <span className={t.texto}>Encolher menu</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export default function Menu({
  modo,
  nome,
  contadores,
  aoAlternar,
  gavetaAberta,
  aoFecharGaveta,
}: {
  modo: Modo;
  nome: string;
  contadores: { faturas: number; movimentos: number };
  aoAlternar: () => void;
  gavetaAberta: boolean;
  aoFecharGaveta: () => void;
}) {
  return (
    <>
      {/* A partir de 640 px: barra lateral fixa */}
      <nav aria-label="Secções" className={`fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-linha bg-white/85 backdrop-blur sm:flex ${TAMANHOS[modo].largura}`}>
        <Corpo modo={modo} nome={nome} contadores={contadores} aoAlternar={aoAlternar} />
      </nav>

      {/* Telemóvel: gaveta que abre de lado */}
      {gavetaAberta && (
        <div className="fixed inset-0 z-40 sm:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/30" onClick={aoFecharGaveta} />
          <nav aria-label="Secções" className="anim-gaveta absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <Corpo modo="aberta" nome={nome} contadores={contadores} gaveta />
          </nav>
        </div>
      )}
    </>
  );
}
