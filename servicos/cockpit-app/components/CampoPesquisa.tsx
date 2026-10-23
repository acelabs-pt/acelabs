"use client";

// Campo de pesquisa das listas: lupa à esquerda, botão para limpar à direita.
export default function CampoPesquisa({
  valor,
  onChange,
  placeholder = "Nome ou telefone",
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secundario"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Pesquisar"
        autoComplete="off"
        enterKeyHint="search"
        className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-10 text-base"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar a pesquisa"
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-xl leading-none text-secundario hover:bg-black/5"
        >
          &times;
        </button>
      )}
    </div>
  );
}
