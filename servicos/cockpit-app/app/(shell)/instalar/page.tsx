import EstadoInstalacao from "@/components/EstadoInstalacao";
import AtivarNotificacoes from "@/components/AtivarNotificacoes";

const cartao = "space-y-3 rounded-3xl border border-linha bg-white p-5";

function Passos({ itens }: { itens: string[] }) {
  return (
    <ol className="space-y-3">
      {itens.map((t, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-azul text-sm font-bold text-white">{i + 1}</span>
          <span className="pt-0.5 text-base text-tinta">{t}</span>
        </li>
      ))}
    </ol>
  );
}

export default function Instalar() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-tinta md:text-5xl">Instalar no telemóvel</h1>
        <p className="mt-1 text-base text-secundario">O Cockpit instala-se no ecrã inicial, como uma app. Não precisas da App Store nem da Google Play.</p>
      </div>

      <div data-so-web><EstadoInstalacao /></div>

      <AtivarNotificacoes />

      <section className={cartao} data-so-web>
        <h2 className="text-lg font-semibold text-tinta">iPhone</h2>
        <p className="text-sm text-secundario">Tem de ser no Safari.</p>
        <Passos
          itens={[
            "Abre este endereço no Safari.",
            "Toca em Partilhar (o quadrado com a seta para cima).",
            'Escolhe "Adicionar ao ecrã principal" e toca em Adicionar.',
            "Abre pelo ícone Cockpit. Abre em ecrã inteiro, sem a barra do browser.",
          ]}
        />
      </section>

      <section className={cartao} data-so-web>
        <h2 className="text-lg font-semibold text-tinta">Android</h2>
        <p className="text-sm text-secundario">No Chrome.</p>
        <Passos
          itens={[
            "Abre este endereço no Chrome.",
            'Toca nos três pontos e em "Instalar app" (ou "Adicionar ao ecrã inicial").',
            "Confirma. O ícone aparece no ecrã inicial.",
          ]}
        />
      </section>

      <section className={cartao} data-so-web>
        <h2 className="text-lg font-semibold text-tinta">Bom saber</h2>
        <ul className="space-y-2 text-sm text-secundario">
          <li>Precisa de internet. Sem ligação aparece um aviso e volta ao normal quando ela voltar.</li>
          <li>No iPhone, as notificações só funcionam depois de instalar e abrir pelo ícone (iOS 16.4 ou mais recente).</li>
          <li>As atualizações chegam sozinhas. Não tens de fazer nada.</li>
          <li>Se limpares os dados do browser, tens de voltar a entrar.</li>
          <li>No computador usa-se no browser, no mesmo endereço.</li>
        </ul>
      </section>
    </div>
  );
}
