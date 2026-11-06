import Link from "next/link";
import { euros } from "@/lib/dinheiro";

// Peças visuais comuns, as mesmas do Cockpit: cartões brancos arredondados, quadros azuis nos indicadores, seletores
// segmentados, azul da marca e texto secundário cinzento.

export const campo = "w-full min-w-0 rounded-xl border border-linha bg-white px-3 py-2.5 text-base outline-none focus:border-azul focus:ring-2 focus:ring-azul/20";
export const rotulo = "mb-1 block text-sm font-medium text-tinta";
export const botaoSecundario = "inline-flex min-h-[44px] items-center rounded-full border border-linha bg-white px-5 text-base font-semibold text-tinta hover:bg-black/5";
export const botaoPrimario = "inline-flex min-h-[44px] items-center rounded-full bg-azul px-5 text-base font-semibold text-white hover:bg-azul-escuro";

export function Titulo({ titulo, texto, children }: { titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-tinta">{titulo}</h1>
        {texto && <p className="mt-1 text-base text-secundario">{texto}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Cartao({ titulo, children, className = "", acao }: { titulo?: string; children: React.ReactNode; className?: string; acao?: React.ReactNode }) {
  return (
    <section className={`rounded-3xl border border-linha bg-white p-5 ${className}`}>
      {(titulo || acao) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {titulo && <h2 className="text-lg font-semibold text-tinta">{titulo}</h2>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

/** Um número grande com legenda (caixa, resultado, débitos por mês), no quadro azul dos indicadores do Cockpit. */
export function Numero({ legenda, valor, nota, sinal = false, href }: { legenda: string; valor: number | string; nota?: string; sinal?: boolean; href?: string }) {
  const cor = sinal && typeof valor === "number" && valor < 0 ? "text-ambar-texto" : "text-tinta";
  const corpo = (
    <>
      <p className="text-sm font-medium text-secundario">{legenda}</p>
      <p className={`numero mt-1 break-words text-[22px] font-bold leading-tight tracking-tight sm:text-3xl ${cor}`}>{typeof valor === "number" ? euros(valor) : valor}</p>
      {nota && <p className="mt-1 text-sm text-secundario">{nota}</p>}
    </>
  );
  const classe = "quadro-glossy block min-w-0 rounded-3xl p-4 sm:p-5";
  return href ? (
    <Link href={href} className={`${classe} hover:border-azul/30`}>
      {corpo}
    </Link>
  ) : (
    <div className={classe}>{corpo}</div>
  );
}

/** Seletor segmentado do Cockpit (Semana / Mês...), feito de ligações: o estado fica no endereço. */
export function Segmentos({ opcoes, atual }: { opcoes: { valor: string; texto: string; href: string; n?: number }[]; atual: string }) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-black/5 p-1" aria-label="Vista">
      {opcoes.map((o) => (
        <Link
          key={o.valor}
          href={o.href}
          aria-current={o.valor === atual ? "page" : undefined}
          className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-sm font-semibold ${o.valor === atual ? "bg-white text-tinta shadow-sm" : "text-secundario hover:text-tinta"}`}
        >
          {o.texto}
          {o.n ? <span className="numero rounded-full bg-azul px-1.5 text-[11px] leading-5 text-white">{o.n}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Valor em qualquer moeda (as faturas estrangeiras vêm em USD). */
export function emMoeda(c: number | null | undefined, moeda: string | null | undefined): string {
  if (c === null || c === undefined) return "Sem valor";
  if (!moeda || moeda === "EUR") return euros(c);
  return `${(c / 100).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moeda}`;
}

export function Valor({ c, className = "" }: { c: number; className?: string }) {
  return <span className={`numero whitespace-nowrap ${c > 0 ? "text-verde" : "text-tinta"} ${className}`}>{euros(c)}</span>;
}

export function Vazio({ texto, link, rotuloLink }: { texto: string; link?: string; rotuloLink?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-linha bg-white/60 p-6 text-center">
      <p className="text-base text-secundario">{texto}</p>
      {link && rotuloLink && (
        <Link href={link} className="mt-2 inline-block text-base font-semibold text-azul">
          {rotuloLink}
        </Link>
      )}
    </div>
  );
}

export function Etiqueta({ children, cor = "azul" }: { children: React.ReactNode; cor?: "azul" | "verde" | "ambar" | "cinza" }) {
  const c = { azul: "bg-azul-suave text-azul-escuro", verde: "bg-verde-suave text-tinta", ambar: "bg-ambar-fundo text-ambar-texto", cinza: "bg-black/5 text-secundario" }[cor];
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}
