// Formas cinzentas no lugar do conteúdo enquanto ele carrega. Mostram onde as coisas vão aparecer e dão
// a sensação de a app responder logo, ao contrário de um "A carregar..." solto. Não animam com "reduzir movimento".
const base = "rounded-lg bg-black/[0.06] motion-safe:animate-pulse";

export function Bloco({ className = "" }: { className?: string }) {
  return <div className={`${base} ${className}`} />;
}

/** Lista de cartões (compradores, proprietários, angariações, tarefas). */
export function EsqueletoLista({ n = 5 }: { n?: number }) {
  return (
    <ul className="space-y-2" role="status" aria-label="A carregar">
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="space-y-3 rounded-2xl border border-linha bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <Bloco className="h-4 w-1/2" />
            <Bloco className="h-6 w-20 rounded-full" />
          </div>
          <Bloco className="h-3 w-3/4" />
          <Bloco className="h-2 w-full rounded-full" />
        </li>
      ))}
    </ul>
  );
}

/** O dashboard: um cartão de tarefas, um grande e dois mais pequenos. */
export function EsqueletoDashboard() {
  return (
    <div className="space-y-4" role="status" aria-label="A carregar">
      <div className="space-y-4 rounded-3xl border border-linha bg-white p-5">
        <Bloco className="h-4 w-16" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Bloco className="h-6 w-6 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bloco className="h-3.5 w-4/5" />
              <Bloco className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-5 rounded-3xl border border-linha bg-white p-5">
        <Bloco className="h-4 w-14" />
        <div className="flex items-center gap-6">
          <Bloco className="h-40 w-40 shrink-0 rounded-full" />
          <div className="flex-1 space-y-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Bloco key={i} className="h-5 w-full" />
            ))}
          </div>
        </div>
        <Bloco className="h-10 w-2/3" />
        <Bloco className="h-36 w-full" />
      </div>
      <div className="space-y-3 rounded-3xl border border-linha bg-white p-5">
        <Bloco className="h-4 w-28" />
        <Bloco className="h-9 w-1/2" />
        <Bloco className="h-4 w-full rounded-full" />
      </div>
    </div>
  );
}
