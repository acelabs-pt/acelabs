import Link from "next/link";

const CARTOES = [
  {
    href: "/crm/compradores",
    titulo: "Compradores",
    texto: "Quem procura casa",
    icone: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
      </>
    ),
  },
  {
    href: "/crm/proprietarios",
    titulo: "Proprietários",
    texto: "Quem vende casa",
    icone: (
      <>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </>
    ),
  },
];

// Entrada do CRM: dois cartões grandes, compradores à esquerda e proprietários à direita.
export default function Page() {
  return (
    <div className="grid min-h-[55vh] grid-cols-2 gap-4 py-6 md:gap-6">
      {CARTOES.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="quadro-glossy flex flex-col items-center justify-center gap-4 rounded-3xl px-3 py-10 text-center transition-transform active:scale-[0.98] md:py-16"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-14 w-14 text-azul md:h-20 md:w-20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {c.icone}
          </svg>
          <span>
            <span className="block text-lg font-semibold text-tinta md:text-2xl">{c.titulo}</span>
            <span className="mt-1 block text-xs text-secundario md:text-sm">{c.texto}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
