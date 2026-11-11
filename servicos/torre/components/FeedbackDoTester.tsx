import { feedbackConfigurado, lerFeedback, type Reporte } from "@/lib/feedback";
import { estadoFeedback } from "@/app/acoes";
import { Cartao, Etiqueta } from "@/components/ui";

const ESTADO: Record<Reporte["estado"], { texto: string; cor: "azul" | "verde" | "ambar" | "cinza" }> = {
  novo: { texto: "Novo", cor: "ambar" },
  visto: { texto: "Visto", cor: "azul" },
  resolvido: { texto: "Resolvido", cor: "verde" },
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Os reportes que este tester fez no Cockpit (texto, captura do ecrã, áudio), ligados pelo email. */
export default async function FeedbackDoTester({ email }: { email: string | null }) {
  if (!email) {
    return (
      <Cartao titulo="Feedback">
        <p className="text-base text-secundario">Põe o email do tester (o mesmo com que entra no Cockpit) para aqui aparecer o que ele reporta.</p>
      </Cartao>
    );
  }
  if (!feedbackConfigurado()) {
    return (
      <Cartao titulo="Feedback">
        <p className="text-base text-secundario">Ainda não está ligado ao Cockpit. O Pedro tem de publicar a função ler-feedback e pôr o endereço e o segredo na Torre (ver LEIAME, secção Feedback dos testers).</p>
      </Cartao>
    );
  }
  const { reportes, erro } = await lerFeedback();
  const meus = reportes.filter((r) => r.email?.toLowerCase() === email.toLowerCase());

  return (
    <Cartao titulo="Feedback" acao={<span className="text-sm text-secundario">{meus.length}</span>}>
      {erro ? (
        <p role="alert" className="rounded-xl bg-ambar-fundo px-4 py-3 text-sm text-ambar-texto">{erro}</p>
      ) : meus.length === 0 ? (
        <p className="text-base text-secundario">Ainda não reportou nada. Quando usar o botão “Reportar um problema” no Cockpit com o email {email}, aparece aqui.</p>
      ) : (
        <ul className="divide-y divide-linha">
          {meus.map((r) => (
            <li key={r.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Etiqueta cor={r.tipo === "erro" ? "ambar" : "azul"}>{r.tipo === "erro" ? "Erro" : "Sugestão"}</Etiqueta>
                <Etiqueta cor={ESTADO[r.estado].cor}>{ESTADO[r.estado].texto}</Etiqueta>
                <span className="text-sm text-secundario">{quando(r.criado_em)}</span>
              </div>
              {r.texto ? <p className="whitespace-pre-wrap text-base text-tinta">{r.texto}</p> : <p className="text-base text-secundario">Sem texto.</p>}
              {r.audio && (
                <div>
                  <p className="mb-1 text-sm font-medium text-tinta">Áudio</p>
                  <audio controls preload="none" src={r.audio} className="w-full max-w-md" />
                </div>
              )}
              {r.captura && (
                <div>
                  <p className="mb-1 text-sm font-medium text-tinta">Captura do ecrã</p>
                  <a href={r.captura} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.captura} alt="Captura do ecrã enviada pelo tester" className="max-h-80 rounded-xl border border-linha" />
                  </a>
                </div>
              )}
              <p className="text-xs text-secundario">
                {r.pagina ? `Página ${r.pagina} · ` : ""}versão {r.versao ?? "?"}
              </p>
              <div className="flex flex-wrap gap-2">
                {(["visto", "resolvido", "novo"] as const)
                  .filter((e) => e !== r.estado)
                  .map((e) => (
                    <form key={e} action={estadoFeedback}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="estado" value={e} />
                      <button type="submit" className="min-h-[40px] rounded-full border border-linha bg-white px-4 text-sm font-semibold text-tinta hover:bg-black/5">
                        {e === "visto" ? "Marcar como visto" : e === "resolvido" ? "Resolvido" : "Voltar a novo"}
                      </button>
                    </form>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}
