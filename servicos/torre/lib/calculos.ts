import { dividir, euros } from "./dinheiro";
import { data, normalizar } from "./texto";
import type { Categoria, Conta, Movimento, Periodicidade, Regra, Socio, SocioMovimento, Subscricao } from "./tipos";

// Contas da Torre, sem rede: tudo o que aparece no Início e nos Sócios sai daqui (e é testado em testes/unidade.ts).

/** A conta é dinheiro dos sócios (pessoal, cartão pessoal ou a conjunta), não da empresa. */
export function contaDeSocios(c: Pick<Conta, "tipo" | "titular">): boolean {
  return c.tipo === "conjunta" || c.titular !== null;
}

/** Por omissão, uma despesa paga com dinheiro dos sócios é para a empresa devolver. */
export function reembolsavelPorOmissao(c: Pick<Conta, "tipo" | "titular">): boolean {
  return contaDeSocios(c);
}

const MESES_DE: Record<Periodicidade, number> = { mensal: 1, trimestral: 3, anual: 12 };

function somarMeses(iso: string, meses: number, dia: number): string {
  const [a, m] = iso.split("-").map(Number);
  const total = a * 12 + (m - 1) + meses;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(Math.min(dia, ultimo)).padStart(2, "0")}`;
}

/** Próxima cobrança de uma subscrição a partir de hoje (inclusive). */
export function proximaCobranca(s: Pick<Subscricao, "inicio" | "periodicidade" | "dia">, hoje: string): string {
  const passo = MESES_DE[s.periodicidade];
  for (let i = 0; i < 1200; i++) {
    const d = somarMeses(s.inicio, passo * i, s.dia);
    if (d >= s.inicio && d >= hoje) return d;
  }
  return hoje;
}

/** Custo mensal equivalente (uma anual de 120 EUR = 10 EUR por mês). */
export function custoMensal(s: Pick<Subscricao, "valor_previsto" | "periodicidade">): number {
  return Math.round((s.valor_previsto ?? 0) / MESES_DE[s.periodicidade]);
}

/** Primeira regra cuja frase aparece na descrição (as frases mais compridas ganham, por serem mais específicas). */
export function aplicarRegras(descricao: string, regras: Regra[]): Regra | undefined {
  const d = normalizar(descricao);
  return [...regras].sort((a, b) => b.texto.length - a.texto.length).find((r) => r.texto.trim() && d.includes(normalizar(r.texto)));
}

export type SaldoSocio = {
  socio: Socio;
  /** Despesas da empresa pagas com dinheiro deste sócio (inclui a parte dele da conjunta), por devolver. */
  adiantado: number;
  suprimentos: number;
  reembolsos: number;
  capital: number;
  /** Quanto a empresa deve a este sócio hoje. */
  devido: number;
};

/**
 * Quanto a empresa deve a cada sócio. Uma despesa reembolsável de uma conta pessoal conta toda para o titular; da conjunta,
 * divide-se em partes iguais pelos sócios ativos. Entradas reembolsáveis (um estorno) descontam.
 */
export function saldosSocios(socios: Socio[], contas: Conta[], movimentos: Movimento[], sociosMov: SocioMovimento[]): SaldoSocio[] {
  const ativos = socios.filter((s) => s.ativo);
  const r = new Map(socios.map((s) => [s.id, { socio: s, adiantado: 0, suprimentos: 0, reembolsos: 0, capital: 0, devido: 0 }]));
  const porConta = new Map(contas.map((c) => [c.id, c]));
  for (const m of movimentos) {
    if (!m.reembolsavel) continue;
    const c = m.conta_id ? porConta.get(m.conta_id) : undefined;
    const valor = -m.valor;
    if (!c) {
      // Sem conta de banco: ficou para quem pagou.
      const s = m.socio_id ? r.get(m.socio_id) : undefined;
      if (s) s.adiantado += valor;
      continue;
    }
    if (c.titular) {
      const s = r.get(c.titular);
      if (s) s.adiantado += valor;
    } else if (c.tipo === "conjunta") {
      dividir(valor, ativos.length).forEach((parte, i) => {
        r.get(ativos[i].id)!.adiantado += parte;
      });
    } else if (m.socio_id) {
      // Conta da empresa marcada à mão como reembolsável (raro): fica para quem a fez.
      const s = r.get(m.socio_id);
      if (s) s.adiantado += valor;
    }
  }
  for (const sm of sociosMov) {
    const s = r.get(sm.socio_id);
    if (!s) continue;
    if (sm.tipo === "suprimento") s.suprimentos += sm.valor;
    else if (sm.tipo === "reembolso") s.reembolsos += sm.valor;
    else s.capital += sm.valor;
  }
  return [...r.values()].map((s) => ({ ...s, devido: s.adiantado + s.suprimentos - s.reembolsos }));
}

export type Resumo = { proveitos: number; custos: number; porClassificar: number; resultado: number };

/**
 * Proveitos e custos de um período pelos movimentos (ótica de caixa; com as faturas passa a ser pela data da fatura).
 * Movimentos internos (transferências, capital, reembolsos a sócios) não entram. Saídas sem categoria ficam à parte.
 */
export function resumo(movimentos: Movimento[], categorias: Categoria[], de: string, ate: string): Resumo {
  const tipo = new Map(categorias.map((c) => [c.id, c.tipo]));
  const r = { proveitos: 0, custos: 0, porClassificar: 0, resultado: 0 };
  for (const m of movimentos) {
    if (m.data < de || m.data > ate) continue;
    const t = m.categoria_id ? tipo.get(m.categoria_id) : undefined;
    if (t === "interno") continue;
    if (t === "proveito") r.proveitos += m.valor;
    else if (t === "custo") r.custos -= m.valor;
    else if (m.valor < 0) r.porClassificar -= m.valor;
    else r.proveitos += m.valor;
  }
  r.resultado = r.proveitos - r.custos - r.porClassificar;
  return r;
}

export type LinhaOrigem = { chave: string; rotulo: string; total: number; movimentos: number };

/**
 * Despesas da empresa por origem do dinheiro: conta da empresa, conjunta, ou conta de cada sócio. Responde a "quem pagou
 * o quê e de onde saiu". Exclui movimentos internos e entradas.
 */
export function despesasPorOrigem(movimentos: Movimento[], contas: Conta[], socios: Socio[], categorias: Categoria[], de: string, ate: string): LinhaOrigem[] {
  const tipo = new Map(categorias.map((c) => [c.id, c.tipo]));
  const porConta = new Map(contas.map((c) => [c.id, c]));
  const nome = new Map(socios.map((s) => [s.id, s.nome]));
  const r = new Map<string, LinhaOrigem>();
  for (const m of movimentos) {
    if (m.valor >= 0 || m.data < de || m.data > ate) continue;
    if (m.categoria_id && tipo.get(m.categoria_id) === "interno") continue;
    const c = m.conta_id ? porConta.get(m.conta_id) : undefined;
    const dono = c ? c.titular : m.socio_id;
    if (!c && !dono) continue;
    const [chave, rotulo] = dono
      ? [`socio:${dono}`, `Dinheiro do ${nome.get(dono) ?? "sócio"}`]
      : c!.tipo === "conjunta"
        ? ["conjunta", "Conta conjunta"]
        : ["empresa", "Contas da empresa"];
    const l = r.get(chave) ?? { chave, rotulo, total: 0, movimentos: 0 };
    l.total -= m.valor;
    l.movimentos++;
    r.set(chave, l);
  }
  const ordem = (k: string) => (k === "empresa" ? 0 : k === "conjunta" ? 1 : 2);
  return [...r.values()].sort((a, b) => ordem(a.chave) - ordem(b.chave) || a.rotulo.localeCompare(b.rotulo, "pt"));
}

/** Saldo atual das contas da empresa e da conjunta (nas pessoais só se registam despesas da empresa, o saldo não diz nada). */
export function saldoConta(c: Conta, movimentos: Movimento[]): number {
  return c.saldo_inicial + movimentos.filter((m) => m.conta_id === c.id).reduce((t, m) => t + m.valor, 0);
}

export type Aviso = { tipo: "atencao" | "info"; texto: string; link?: string };

/** O que merece atenção, em linguagem simples, para o Início. */
export function avisos(subs: Subscricao[], movimentos: Movimento[], saldos: SaldoSocio[], hoje: string): Aviso[] {
  const a: Aviso[] = [];
  const porClassificar = movimentos.filter((m) => !m.categoria_id).length;
  if (porClassificar) a.push({ tipo: "atencao", texto: porClassificar === 1 ? "1 movimento por classificar." : `${porClassificar} movimentos por classificar.`, link: "/movimentos?sem=categoria" });

  for (const s of subs.filter((x) => x.ativa)) {
    if (s.valor_previsto === null) {
      a.push({ tipo: "info", texto: `${s.nome}: falta o valor previsto.`, link: `/debitos/${s.id}` });
      continue;
    }
    const pagos = movimentos.filter((m) => m.subscricao_id === s.id && m.valor < 0).sort((x, y) => (x.data < y.data ? 1 : -1));
    const ultimo = pagos[0];
    if (!ultimo) continue;
    if (s.valor_previsto > 0) {
      const dif = -ultimo.valor - s.valor_previsto;
      if (Math.abs(dif) > Math.max(100, s.valor_previsto * 0.05)) {
        a.push({ tipo: "atencao", texto: `${s.nome}: o último pagamento foi ${dif > 0 ? "mais alto" : "mais baixo"} do que o previsto.`, link: `/debitos/${s.id}` });
      }
    }
    // Só se avisa de um pagamento em falta quando já há pagamentos ligados (sinal de que esta conta se importa).
    const anterior = cobrancaAnterior(s, somarDias(hoje, -7));
    if (anterior && ultimo.data < somarDias(anterior, -10)) {
      a.push({ tipo: "atencao", texto: `${s.nome}: não encontrei o pagamento previsto para ${data(anterior)}.`, link: `/debitos/${s.id}` });
    }
  }

  for (const s of saldos) {
    if (s.devido > 0) a.push({ tipo: "info", texto: `A empresa deve ${euros(s.devido)} ao ${s.socio.nome}.`, link: "/socios" });
  }
  return a;
}

export function somarDias(iso: string, dias: number): string {
  return new Date(Date.parse(iso) + dias * 86_400_000).toISOString().slice(0, 10);
}

/** Última cobrança prevista até `ate` (inclusive), ou null se a subscrição ainda não tinha começado. */
export function cobrancaAnterior(s: Pick<Subscricao, "inicio" | "periodicidade" | "dia">, ate: string): string | null {
  const passo = MESES_DE[s.periodicidade];
  let anterior: string | null = null;
  for (let i = 0; i < 1200; i++) {
    const d = somarMeses(s.inicio, passo * i, s.dia);
    if (d < s.inicio) continue;
    if (d > ate) break;
    anterior = d;
  }
  return anterior;
}

export type Recorrente = { chave: string; exemplo: string; valorMedio: number; ocorrencias: number; ultimo: string; conta_id: string | null; periodicidade: Periodicidade };

/** Tira da descrição o que muda de mês para mês (datas, números, referências) para juntar pagamentos do mesmo serviço. */
export function chaveDescricao(d: string): string {
  return normalizar(d)
    .replace(/\d+/g, " ")
    .replace(/\b(compra|pagamento|pag|trf|transf|dd|debito direto|debito|ref|mb way|mbway|c\/c|cartao|visa|mastercard|ct|n)\b/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");
}

/**
 * Pagamentos que se repetem e ainda não estão ligados a nenhum débito direto: mesma descrição (sem números), valores
 * parecidos (15%) e em meses diferentes. Servem para sugerir "criar débito direto".
 */
export function detetarRecorrentes(movimentos: Movimento[]): Recorrente[] {
  const grupos = new Map<string, Movimento[]>();
  for (const m of movimentos) {
    if (m.valor >= 0 || m.subscricao_id) continue;
    const k = chaveDescricao(m.descricao);
    if (k.length < 3) continue;
    const g = grupos.get(`${m.conta_id}|${k}`) ?? [];
    g.push(m);
    grupos.set(`${m.conta_id}|${k}`, g);
  }
  const r: Recorrente[] = [];
  for (const [chave, g] of grupos) {
    const meses = new Set(g.map((m) => m.data.slice(0, 7)));
    if (meses.size < 2) continue;
    const valores = g.map((m) => -m.valor).sort((a, b) => a - b);
    const mediana = valores[Math.floor(valores.length / 2)];
    if (valores.some((v) => Math.abs(v - mediana) > mediana * 0.15)) continue;
    const datas = g.map((m) => m.data).sort();
    const dias = (Date.parse(datas[datas.length - 1]) - Date.parse(datas[0])) / 86_400_000 / (datas.length - 1);
    const periodicidade: Periodicidade = dias > 300 ? "anual" : dias > 75 ? "trimestral" : "mensal";
    r.push({
      chave,
      exemplo: g[g.length - 1].descricao,
      valorMedio: Math.round(valores.reduce((t, v) => t + v, 0) / valores.length),
      ocorrencias: g.length,
      ultimo: datas[datas.length - 1],
      conta_id: g[0].conta_id,
      periodicidade,
    });
  }
  return r.sort((a, b) => b.valorMedio - a.valorMedio);
}
