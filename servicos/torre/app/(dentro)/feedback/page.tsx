import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { feedbackConfigurado, lerFeedback, type Reporte } from "@/lib/feedback";
import { estadoFeedback } from "../../acoes";
import { Cartao, Etiqueta, Numero, Segmentos, Titulo, Vazio } from "@/components/ui";

const ESTADO: Record<Reporte["estado"], { texto: string; cor: "azul" | "verde" | "ambar" | "cinza" }> = {
  novo: { texto: "Novo", cor: "ambar" },
  visto: { texto: "Visto", cor: "azul" },
  resolvido: { texto: "Resolvido", cor: "verde" },
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function Feedback({ searchParams }: { searchParams: { ver?: string } }) {
  const { s } = await exigirSocio();
  const ver = searchParams.ver === "todos" || searchParams.ver === "resolvidos" ? searchParams.ver : "novos";
  const [{ reportes, erro }, t] = await Promise.all([lerFeedback(), carregar(s)]);
  const { data: dt } = await s.from("testers").select("nome, email");
  const testerPorEmail = new Map(((dt ?? []) as { nome: string; email: string | null }[]).filter((x) => x.email).map((x) => [x.email!.toLowerCase(), x.nome]));
  void t;

  const novos = reportes.filter((r) => r.estado === "novo");
  const lista = reportes.filter((r) => (ver === "todos" ? true : ver === "resolvidos" ? r.estado === "resolvido" : r.estado !== "resolvido"));

  return (
    <>
      <Titulo titulo="Feedback dos testers" texto="O que os testers reportam no Cockpit: texto, capturas do ecrã e áudios." />

      {!feedbackConfigurado() || erro ? (
        <Cartao titulo="Ligar ao Cockpit">
          <div className="space-y-2 text-base text-secundario">
            {erro && erro !== "sem-configuracao" && <p role="alert" className="rounded-xl bg-ambar-fundo px-4 py-3 text-sm text-ambar-texto">{erro}</p>}
            <p>Para ver aqui o feedback, o Pedro tem de fazer três coisas, uma vez:</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Publicar a função no Supabase do Cockpit: <span className="numero text-tinta">supabase functions deploy ler-feedback --no-verify-jwt</span></li>
              <li>Criar o segredo lá: <span className="numero text-tinta">supabase secrets set FEEDBACK_LEITURA_TOKEN=&lt;texto longo aleatório&gt;</span></li>
              <li>Pôr na Torre (Vercel e <span className="numero">.env.local</span>) <span className="numero text-tinta">COCKPIT_FEEDBACK_URL</span> (o endereço da função) e <span className="numero text-tinta">COCKPIT_FEEDBACK_TOKEN</span> (o mesmo texto).</li>
            </ol>
          </div>
        </Cartao>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Numero legenda="Novos" valor={String(novos.length)} />
            <Numero legenda="Erros" valor={String(reportes.filter((r) => r.tipo === "erro" && r.estado !== "resolvido").length)} nota="Por resolver" />
            <Numero legenda="Sugestões" valor={String(reportes.filter((r) => r.tipo === "sugestao" && r.estado !== "resolvido").length)} nota="Por ver" />
            <Numero legenda="Resolvidos" valor={String(reportes.filter((r) => r.estado === "resolvido").length)} />
          </div>

          <Segmentos
            atual={ver}
            opcoes={[
              { valor: "novos", texto: "Por tratar", href: "/feedback?ver=novos", n: reportes.filter((r) => r.estado !== "resolvido").length },
              { valor: "resolvidos", texto: "Resolvidos", href: "/feedback?ver=resolvidos" },
              { valor: "todos", texto: "Todos", href: "/feedback?ver=todos" },
            ]}
          />

          {lista.length ? (
            <div className="space-y-4">
              {lista.map((r) => {
                const tester = r.email ? testerPorEmail.get(r.email.toLowerCase()) : null;
                return (
                  <Cartao key={r.id}>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Etiqueta cor={r.tipo === "erro" ? "ambar" : "azul"}>{r.tipo === "erro" ? "Erro" : "Sugestão"}</Etiqueta>
                        <Etiqueta cor={ESTADO[r.estado].cor}>{ESTADO[r.estado].texto}</Etiqueta>
                        <span className="text-sm text-secundario">
                          {quando(r.criado_em)} · {tester ?? r.email ?? "sem utilizador"}
                          {r.empresa ? ` · ${r.empresa}` : ""}
                        </span>
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
                        {r.pagina ? `Página ${r.pagina} · ` : ""}
                        versão {r.versao ?? "?"}
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
                    </div>
                  </Cartao>
                );
              })}
            </div>
          ) : (
            <Vazio texto={ver === "resolvidos" ? "Ainda não há reportes resolvidos." : "Não há reportes por tratar."} />
          )}
        </>
      )}
    </>
  );
}
