import Link from "next/link";

const cartao = "space-y-3 rounded-3xl border border-linha bg-white p-5";

const PASSOS = [
  {
    titulo: "Trazer os teus contactos",
    texto: "Em Importar, descarrega o modelo de Excel (já traz uma linha de exemplo), preenche-o com a tua lista e escolhe o ficheiro. Podes também usar o teu próprio ficheiro: o Cockpit reconhece os nomes de coluna mais comuns e mostra-te o resultado antes de guardar.",
    href: "/importar",
    rotulo: "Abrir o importador",
  },
  {
    titulo: "Criar um comprador",
    texto: "No CRM, em Compradores, cria o primeiro com o nome e o telemóvel. O resto pode ficar para depois. Quando o comprador tem zona, tipologia e valor, o Cockpit avisa-te dos imóveis que combinam.",
    href: "/crm/compradores",
    rotulo: "Ir para os compradores",
  },
  {
    titulo: "Criar uma angariação",
    texto: "Em Angariações, cria o imóvel com a morada, o preço e a duração do contrato. O ecrã mostra em que dia do contrato estás e o que falta fazer.",
    href: "/angariacoes?novo=1",
    rotulo: "Nova angariação",
  },
  {
    titulo: "Marcar uma visita ou uma tarefa",
    texto: "No Calendário, toca no + para marcar visitas, reuniões e tarefas. Com as notificações ligadas, recebes um lembrete antes de cada uma e o resumo do dia de manhã.",
    href: "/calendario",
    rotulo: "Abrir o calendário",
  },
  {
    titulo: "Definir as metas do ano",
    texto: "No Dashboard, define as metas de visitas, reuniões, angariações e faturação. Os anéis mostram quanto já fizeste.",
    href: "/dashboard#metas",
    rotulo: "Ir para as metas",
  },
];

export default function Ajuda() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-tinta md:text-5xl">Ajuda</h1>
        <p className="mt-1 text-base text-secundario">Cinco passos para começar a usar o Cockpit no dia a dia.</p>
      </div>

      {PASSOS.map((p, i) => (
        <section key={p.titulo} className={cartao}>
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-azul text-sm font-bold text-white" aria-hidden="true">
              {i + 1}
            </span>
            <h2 className="text-base font-semibold text-tinta">{p.titulo}</h2>
          </div>
          <p className="text-base text-tinta">{p.texto}</p>
          <Link href={p.href} className="block rounded-full bg-black/5 py-3 text-center text-base font-medium text-tinta">
            {p.rotulo}
          </Link>
        </section>
      ))}

      <section className={cartao}>
        <h2 className="text-base font-semibold text-tinta">Notificações e Face ID</h2>
        <p className="text-base text-tinta">Em Conta podes ligar as notificações neste telemóvel e, na app, o desbloqueio com Face ID ou impressão digital.</p>
        <Link href="/conta" className="block rounded-full bg-black/5 py-3 text-center text-base font-medium text-tinta">
          Abrir a conta
        </Link>
      </section>

      <section className={cartao}>
        <h2 className="text-base font-semibold text-tinta">Ficou alguma dúvida?</h2>
        <p className="text-base text-secundario">Fala com a pessoa da Ace Labs que te acompanha no arranque. Se algo não funcionar, diz-nos o que estavas a fazer e em que ecrã.</p>
      </section>
    </div>
  );
}
