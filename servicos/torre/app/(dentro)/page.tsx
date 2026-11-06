import Link from "next/link";
import { exigirSocio } from "@/lib/sessao";
import { carregar } from "@/lib/dados";
import { avisos, contaDeSocios, custoMensal, despesasPorOrigem, proximaCobranca, resumo, saldoConta, saldosSocios, somarDias } from "@/lib/calculos";
import { euros } from "@/lib/dinheiro";
import { data, hojeLisboa, nomeMes } from "@/lib/texto";
import { semFatura } from "@/lib/ligar";
import { autonomiaEmMeses, eventosFuturos, fixosMensais, mrr, pontoMaisBaixo, porReceber, preverCaixa, saidaMensalMedia } from "@/lib/tesouraria";
import { Cartao, Numero, Titulo, Vazio, botaoPrimario, botaoSecundario } from "@/components/ui";

export default async function Inicio() {
  const { s, socio } = await exigirSocio();
  const t = await carregar(s);
  const hoje = hojeLisboa();
  const mes = hoje.slice(0, 7);
  const ano = hoje.slice(0, 4);

  const hora = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Lisbon" }));
  const saudacao = `${hora < 13 ? "Bom dia" : hora < 20 ? "Boa tarde" : "Boa noite"}, ${socio.nome}.`;

  // Primeiros passos: aparecem enquanto a Torre está por montar e desaparecem sozinhos quando tudo estiver feito.
  const passos = [
    { feito: t.contas.length > 0, texto: "Criar as contas", detalhe: "A da empresa, a conjunta e as de cada sócio.", href: "/definicoes?s=contas", botao: "Criar contas" },
    { feito: t.movimentos.length > 0, texto: "Trazer os movimentos do banco", detalhe: "Importa um extrato em CSV, ou lança à mão.", href: "/movimentos/importar", botao: "Importar extrato" },
    { feito: t.faturas.length > 0, texto: "Carregar as primeiras faturas", detalhe: "PDF ou fotografia: o QR e a IA preenchem tudo.", href: "/faturas#caixa", botao: "Carregar faturas" },
    { feito: t.subscricoes.length > 0, texto: "Registar os débitos diretos", detalhe: "Vercel, Supabase, Google... de que conta saem.", href: "/debitos", botao: "Ver débitos" },
  ];
  const feitos = passos.filter((p) => p.feito).length;
  const primeiro = passos.find((p) => !p.feito);
  const checklist =
    feitos < passos.length ? (
      <Cartao titulo="Primeiros passos" acao={<span className="numero text-sm font-semibold text-secundario">{feitos} de {passos.length}</span>}>
        <div className="mb-4 h-2 rounded-full bg-black/5" role="progressbar" aria-valuemin={0} aria-valuemax={passos.length} aria-valuenow={feitos} aria-label="Primeiros passos feitos">
          <div className="h-2 rounded-full bg-azul transition-all" style={{ width: `${Math.max(4, (feitos / passos.length) * 100)}%` }} />
        </div>
        <ul className="divide-y divide-linha">
          {passos.map((p) => (
            <li key={p.texto} className="flex items-center gap-3 py-3">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${p.feito ? "bg-verde text-white" : "border-2 border-black/15"}`} aria-hidden>
                {p.feito && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-base ${p.feito ? "text-secundario line-through" : "font-medium text-tinta"}`}>{p.texto}</span>
                {!p.feito && <span className="block text-sm text-secundario">{p.detalhe}</span>}
              </span>
              {!p.feito && p === primeiro && (
                <Link href={p.href} className="shrink-0 rounded-full bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul-escuro">{p.botao}</Link>
              )}
            </li>
          ))}
        </ul>
      </Cartao>
    ) : null;

  if (!t.contas.length)
    return (
      <>
        <Titulo titulo="Início" texto={`${saudacao} Vamos montar a Torre.`} />
        {checklist}
      </>
    );

  const daEmpresa = t.contas.filter((c) => c.ativa && !contaDeSocios(c));
  const caixa = daEmpresa.reduce((x, c) => x + saldoConta(c, t.movimentos), 0);
  const doMes = resumo(t.movimentos, t.categorias, `${mes}-01`, `${mes}-31`);
  const doAno = resumo(t.movimentos, t.categorias, `${ano}-01-01`, `${ano}-12-31`);
  const ativas = t.subscricoes.filter((x) => x.ativa);
  const porMes = ativas.reduce((x, sub) => x + custoMensal(sub), 0);
  const saldos = saldosSocios(t.socios, t.contas, t.movimentos, t.sociosMov);
  const origem = despesasPorOrigem(t.movimentos, t.contas, t.socios, t.categorias, `${mes}-01`, `${mes}-31`);
  const daqui30 = somarDias(hoje, 30);
  const proximos = ativas
    .map((sub) => ({ sub, quando: proximaCobranca(sub, hoje) }))
    .filter((x) => x.quando <= daqui30)
    .sort((a, b) => (a.quando < b.quando ? -1 : 1));
  const nomeConta = new Map(t.contas.map((c) => [c.id, c.nome]));
  const porRever = t.faturas.filter((f) => f.estado === "rever").length;
  const semFat = semFatura(t.movimentos, t.faturas, t.categorias);
  // Tesouraria: o caixa vai ao negativo nos próximos 60 dias? E quanto tempo dura o dinheiro?
  const eventos = eventosFuturos({ hoje, dias: 60, subscricoes: t.subscricoes, contas: t.contas, faturas: t.faturas, contratos: t.contratos, entidades: t.entidades });
  const baixo = pontoMaisBaixo(preverCaixa(caixa, eventos, hoje, 60));
  const mensalidades = mrr(t.contratos, hoje);
  const saidaMensal = Math.max(saidaMensalMedia(t.movimentos, t.categorias, hoje, 3), fixosMensais(t.subscricoes, t.contas));
  const autonomia = autonomiaEmMeses(caixa, saidaMensal, mensalidades);
  const emAtraso = porReceber(t.faturas, hoje).filter((x) => x.atraso > 0);
  const valorAtraso = emAtraso.reduce((x, r) => x + Math.abs((r.fatura.moeda === "EUR" ? r.fatura.total : r.fatura.total_eur) ?? 0), 0);

  const lista = [
    ...(baixo.saldo < 0 ? [{ tipo: "atencao" as const, texto: `O caixa pode ficar negativo a ${data(baixo.dia)}`, link: "/tesouraria" }] : []),
    ...(emAtraso.length ? [{ tipo: "atencao" as const, texto: `${emAtraso.length} ${emAtraso.length === 1 ? "fatura emitida por receber, em atraso" : "faturas emitidas por receber, em atraso"} (${euros(valorAtraso)})`, link: "/faturas?ver=soltas" }] : []),
    ...(porRever ? [{ tipo: "info" as const, texto: `${porRever} ${porRever === 1 ? "fatura por rever" : "faturas por rever"}`, link: "/faturas?ver=rever" }] : []),
    ...(semFat.length ? [{ tipo: "info" as const, texto: `${semFat.length} ${semFat.length === 1 ? "despesa sem fatura" : "despesas sem fatura"}`, link: "/movimentos?sem=fatura" }] : []),
    ...avisos(t.subscricoes, t.movimentos, saldos, hoje),
  ];
  // O próximo passo: o que mais convém fazer agora, em destaque; as outras coisas ficam por baixo. Ordem: caixa em risco,
  // dinheiro por receber, faturas já lidas à espera de revisão, classificar movimentos (rápido, e ajuda a ligar faturas) e só
  // depois as despesas sem fatura.
  const prioridade = (link?: string) =>
    !link ? 9 : link.startsWith("/tesouraria") ? 0 : link.includes("ver=soltas") ? 1 : link.startsWith("/faturas") ? 2 : link.includes("sem=categoria") ? 3 : link.includes("sem=fatura") ? 4 : 5;
  lista.sort((a, b) => prioridade(a.link) - prioridade(b.link));
  // Enquanto os primeiros passos estão a meio, o botão deles é o próximo passo (dois botões a competir confundem).
  const proximo = checklist ? undefined : lista.find((a) => a.link);
  const outras = lista.filter((a) => a !== proximo);
  const botaoDe = (link: string) =>
    link.startsWith("/tesouraria") ? "Ver previsão" : link.includes("ver=soltas") ? "Ver faturas" : link.startsWith("/faturas") ? "Rever agora" : link.includes("sem=fatura") ? "Juntar faturas" : link.includes("sem=categoria") ? "Classificar" : "Abrir";

  return (
    <>
      <Titulo titulo="Início" texto={saudacao}>
        <Link href="/faturas#caixa" className={botaoPrimario}>Carregar faturas</Link>
        <Link href="/movimentos/importar" className={botaoSecundario}>Importar extrato</Link>
      </Titulo>

      {checklist}

      {proximo ? (
        <section className="quadro-glossy flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5 sm:p-6" aria-label="Próximo passo">
          <div className="min-w-0">
            <p className="text-sm font-medium text-secundario">Próximo passo</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-tinta sm:text-2xl">{proximo.texto.replace(/\.$/, "")}</p>
          </div>
          <Link href={proximo.link!} className={botaoPrimario}>{botaoDe(proximo.link!)}</Link>
        </section>
      ) : (
        !checklist && (
          <section className="flex items-center gap-3 rounded-3xl border border-linha bg-white p-5" aria-label="Estado">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-verde text-white" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 5 5 9-10" />
              </svg>
            </span>
            <p className="text-base font-medium text-tinta">Está tudo em dia. Nada à espera de ti.</p>
          </section>
        )
      )}

      {outras.length > 0 && (
        <Cartao titulo={proximo ? "Também precisa de atenção" : "Precisa de atenção"}>
          <ul className="divide-y divide-linha">
            {outras.map((a, i) => {
              const corpo = (
                <>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.tipo === "atencao" ? "bg-ambar" : "bg-azul"}`} aria-hidden />
                  <span className="min-w-0 flex-1 text-base text-tinta">{a.texto.replace(/\.$/, "")}</span>
                  {a.link && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 text-secundario" aria-hidden>
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  )}
                </>
              );
              return (
                <li key={i}>
                  {a.link ? (
                    <Link href={a.link} className="flex items-center gap-3 py-3 hover:bg-black/[0.02]">{corpo}</Link>
                  ) : (
                    <div className="flex items-center gap-3 py-3">{corpo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Cartao>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero legenda="Caixa da empresa" valor={caixa} sinal href="/tesouraria" nota={autonomia !== null ? `Dura cerca de ${autonomia.toLocaleString("pt-PT")} ${autonomia === 1 ? "mês" : "meses"}` : daEmpresa.length ? `${daEmpresa.length} ${daEmpresa.length === 1 ? "conta" : "contas"}` : "Sem contas da empresa"} />
        <Numero legenda={`Resultado de ${nomeMes(mes).split(" ")[0]}`} valor={doMes.resultado} nota={`${euros(doMes.proveitos)} entrou, ${euros(doMes.custos + doMes.porClassificar)} saiu`} sinal />
        {mensalidades > 0 ? <Numero legenda="Mensalidades (MRR)" valor={mensalidades} href="/contactos?ver=clientes" nota={`Resultado de ${ano}: ${euros(doAno.resultado)}`} /> : <Numero legenda={`Resultado de ${ano}`} valor={doAno.resultado} sinal />}
        <Numero legenda="Débitos por mês" valor={porMes} nota={`${ativas.length} ativos, ${euros(porMes * 12)} por ano`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Cartao titulo="Saldos" acao={<Link href="/definicoes" className="text-sm font-semibold text-azul">Contas</Link>}>
          <ul className="divide-y divide-linha">
            {t.contas
              .filter((c) => c.ativa)
              .map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/movimentos?conta=${c.id}`} className="min-w-0 truncate text-base text-tinta hover:text-azul">
                    {c.nome}
                  </Link>
                  {contaDeSocios(c) && c.tipo !== "conjunta" ? (
                    <span className="text-sm text-secundario">conta de sócio</span>
                  ) : (
                    <span className="numero text-base font-semibold text-tinta">{euros(saldoConta(c, t.movimentos))}</span>
                  )}
                </li>
              ))}
          </ul>
        </Cartao>

        <Cartao titulo="A empresa deve aos sócios" acao={<Link href="/socios" className="text-sm font-semibold text-azul">Sócios</Link>}>
          <ul className="divide-y divide-linha">
            {saldos.map((x) => (
              <li key={x.socio.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-base text-tinta">{x.socio.nome}</span>
                <span className="numero text-base font-semibold text-tinta">{euros(x.devido)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-secundario">Despesas pagas com dinheiro dos sócios e suprimentos, menos o que já foi devolvido.</p>
        </Cartao>

        <Cartao titulo={`De onde saiu o dinheiro em ${nomeMes(mes).split(" ")[0]}`}>
          {origem.length ? (
            <ul className="divide-y divide-linha">
              {origem.map((o) => (
                <li key={o.chave} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-base text-tinta">
                    {o.rotulo} <span className="text-sm text-secundario">({o.movimentos})</span>
                  </span>
                  <span className="numero text-base font-semibold text-tinta">{euros(o.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-secundario">Ainda sem despesas este mês.</p>
          )}
        </Cartao>

        <Cartao titulo="Próximos débitos (30 dias)" acao={<Link href="/debitos" className="text-sm font-semibold text-azul">Todos</Link>}>
          {proximos.length ? (
            <ul className="divide-y divide-linha">
              {proximos.map(({ sub, quando }) => (
                <li key={sub.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/debitos/${sub.id}`} className="min-w-0">
                    <span className="block truncate text-base text-tinta hover:text-azul">{sub.nome}</span>
                    <span className="text-sm text-secundario">
                      {data(quando)}
                      {sub.conta_id ? `, ${nomeConta.get(sub.conta_id)}` : ", conta por definir"}
                    </span>
                  </Link>
                  <span className="numero text-base font-semibold text-tinta">{sub.valor_previsto === null ? "?" : euros(sub.valor_previsto)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-secundario">Nenhum débito nos próximos 30 dias.</p>
          )}
        </Cartao>
      </div>
    </>
  );
}
