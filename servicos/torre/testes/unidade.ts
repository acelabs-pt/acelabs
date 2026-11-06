// Testes sem rede da lógica da Torre: dinheiro, extratos, regras, débitos diretos e contas dos sócios. Dados inventados.
import assert from "node:assert/strict";
import { dividir, euros, paraCentimos } from "../lib/dinheiro";
import { chavesDeDuplicado, encontrarCabecalho, interpretar, lerCsv, lerData, sugerirMapa, type Mapa } from "../lib/extrato";
import { aplicarRegras, avisos, chaveDescricao, cobrancaAnterior, custoMensal, despesasPorOrigem, detetarRecorrentes, proximaCobranca, resumo, saldosSocios } from "../lib/calculos";
import { lerQrFatura, nifValido, nomeTipoDoc } from "../lib/qr-fatura";
import { encontrarEntidade, ligacaoSegura, nomeCombina, semFatura, sugerirCategoria, sugerirMovimentos } from "../lib/ligar";
import { calcularResultados, ivaPorTrimestre, ultimosMeses } from "../lib/resultados";
import { problemaDoPin, senhaDoPin } from "../lib/pin";
import { autonomiaEmMeses, datasMensais, eventosFuturos, mrr, pontoMaisBaixo, porReceber, preverCaixa, saidaMensalMedia } from "../lib/tesouraria";
import { resumirEntidades } from "../lib/entidades";
import type { Categoria, Conta, Contrato, Fatura, Movimento, Socio, SocioMovimento, Subscricao } from "../lib/tipos";

let n = 0;
function teste(nome: string, f: () => void) {
  f();
  n++;
  console.log(`  ok  ${nome}`);
}

export function correrUnidade() {
  console.log("Unidade");

  teste("valores em vários formatos", () => {
    assert.equal(paraCentimos("1.234,56"), 123456);
    assert.equal(paraCentimos("1234.56"), 123456);
    assert.equal(paraCentimos("1,234.56"), 123456);
    assert.equal(paraCentimos("-12,30 €"), -1230);
    assert.equal(paraCentimos("(12,30)"), -1230);
    assert.equal(paraCentimos("12,30-"), -1230);
    assert.equal(paraCentimos("1.234"), 123400);
    assert.equal(paraCentimos("1.234.567"), 123456700);
    assert.equal(paraCentimos("12.5"), 1250);
    assert.equal(paraCentimos("0,07"), 7);
    assert.equal(paraCentimos("+20"), 2000);
    assert.equal(paraCentimos("abc"), null);
    assert.equal(paraCentimos(""), null);
    assert.equal(paraCentimos("1.2.3,4,5"), null);
  });

  teste("formato e divisão ao cêntimo", () => {
    assert.match(euros(123456), /1234,56\s€|1\s?234,56\s€/);
    assert.doesNotMatch(euros(-0), /-/);
    assert.deepEqual(dividir(1001, 2), [501, 500]);
    assert.deepEqual(dividir(-1001, 2), [-501, -500]);
    assert.deepEqual(dividir(100, 3), [34, 33, 33]);
    assert.equal(dividir(999, 4).reduce((a, b) => a + b, 0), 999);
  });

  teste("datas dos extratos", () => {
    assert.equal(lerData("31/10/2026"), "2026-10-31");
    assert.equal(lerData("31-10-26"), "2026-10-31");
    assert.equal(lerData("2026-10-31"), "2026-10-31");
    assert.equal(lerData("1.2.2026"), "2026-02-01");
    assert.equal(lerData("31/02/2026"), null);
    assert.equal(lerData("Saldo final"), null);
  });

  // Extrato inventado ao estilo de um banco português: linhas antes da tabela, separador ";", débito e crédito separados,
  // aspas com ";" dentro, linha de totais no fim e duas linhas iguais no mesmo dia.
  const csv = [
    "Extrato de conta;;;;",
    "Conta;PT50 0000 0000 0000 0000 0000 0;;;",
    "",
    "Data Mov.;Data Valor;Descrição;Débito;Crédito;Saldo",
    '02/10/2026;02/10/2026;"DD VERCEL INC; REF 1234";20,00;;1.980,00',
    "05/10/2026;05/10/2026;TRF CLIENTE ALFA;;1.500,00;3.480,00",
    "07/10/2026;07/10/2026;COMPRA CAFE CENTRAL;1,20;;3.478,80",
    "07/10/2026;07/10/2026;COMPRA CAFE CENTRAL;1,20;;3.477,60",
    "08/10/2026;08/10/2026;LINHA ESTRAGADA;abc;;",
    ";;Total;22,40;1.500,00;",
  ].join("\r\n");

  teste("ler um extrato com cabeçalho no meio e débito/crédito", () => {
    const linhas = lerCsv(csv);
    const i = encontrarCabecalho(linhas);
    assert.equal(i, 2);
    const mapa = sugerirMapa(linhas[i]);
    assert.deepEqual(mapa, { data: 0, descricao: 2, debito: 3, credito: 4 });
    const { movimentos, erros } = interpretar(linhas.slice(i + 1), mapa as Mapa);
    assert.equal(movimentos.length, 4);
    assert.deepEqual(movimentos[0], { data: "2026-10-02", descricao: "DD VERCEL INC; REF 1234", valor: -2000 });
    assert.equal(movimentos[1].valor, 150000);
    assert.deepEqual(erros, [{ linha: 5, motivo: "valor ilegível" }]);
  });

  teste("coluna única de montante e separador vírgula", () => {
    const linhas = lerCsv('Date,Description,Amount\n2026-10-01,"Anthropic, PBC",-18.45\n2026-10-03,Refund,5.00\n');
    const mapa = sugerirMapa(linhas[encontrarCabecalho(linhas)]);
    assert.deepEqual(mapa, { data: 0, descricao: 1, valor: 2 });
    const { movimentos } = interpretar(linhas.slice(1), mapa as Mapa);
    assert.deepEqual(movimentos.map((m) => m.valor), [-1845, 500]);
    assert.equal(movimentos[0].descricao, "Anthropic, PBC");
  });

  teste("importar o mesmo extrato duas vezes dá as mesmas chaves, e dois cafés iguais não colidem", () => {
    const linhas = lerCsv(csv);
    const { movimentos } = interpretar(linhas.slice(3), sugerirMapa(linhas[2]) as Mapa);
    const a = chavesDeDuplicado("conta-1", movimentos);
    const b = chavesDeDuplicado("conta-1", movimentos);
    assert.deepEqual(a, b);
    assert.equal(new Set(a).size, movimentos.length);
    assert.notEqual(chavesDeDuplicado("conta-2", movimentos)[0], a[0]);
  });

  teste("regras: a frase mais específica ganha, sem acentos nem maiúsculas", () => {
    const regras = [
      { id: "1", texto: "vercel", categoria_id: "aloj", entidade_id: null, subscricao_id: null },
      { id: "2", texto: "VERCEL INC", categoria_id: "outra", entidade_id: null, subscricao_id: "sub" },
      { id: "3", texto: "café", categoria_id: "refeicoes", entidade_id: null, subscricao_id: null },
    ];
    assert.equal(aplicarRegras("DD Vercel Inc ref 99", regras)?.id, "2");
    assert.equal(aplicarRegras("COMPRA CAFE CENTRAL", regras)?.id, "3");
    assert.equal(aplicarRegras("Supabase", regras), undefined);
  });

  teste("próxima cobrança e custo mensal", () => {
    const mensal = { inicio: "2026-01-31", periodicidade: "mensal" as const, dia: 31 };
    assert.equal(proximaCobranca(mensal, "2026-02-10"), "2026-02-28");
    assert.equal(proximaCobranca(mensal, "2026-03-01"), "2026-03-31");
    assert.equal(proximaCobranca({ inicio: "2026-01-20", periodicidade: "mensal", dia: 5 }, "2026-01-01"), "2026-02-05");
    assert.equal(proximaCobranca({ inicio: "2025-03-15", periodicidade: "anual", dia: 15 }, "2026-11-06"), "2027-03-15");
    assert.equal(cobrancaAnterior({ inicio: "2026-01-10", periodicidade: "mensal", dia: 10 }, "2026-11-06"), "2026-10-10");
    assert.equal(cobrancaAnterior({ inicio: "2026-12-01", periodicidade: "mensal", dia: 1 }, "2026-11-06"), null);
    assert.equal(custoMensal({ valor_previsto: 9900, periodicidade: "anual" }), 825);
    assert.equal(custoMensal({ valor_previsto: null, periodicidade: "mensal" }), 0);
  });

  // Caso com números conhecidos para as contas dos sócios.
  const socios: Socio[] = [
    { id: "p", user_id: "u1", nome: "Pedro", email: null, ativo: true },
    { id: "m", user_id: "u2", nome: "Miguel", email: null, ativo: true },
  ];
  const conta = (id: string, tipo: Conta["tipo"], titular: string | null, saldo_inicial = 0): Conta => ({ id, nome: id, tipo, titular, banco: null, ultimos4: null, saldo_inicial, modelo_extrato: null, ativa: true });
  const contas = [conta("emp", "empresa", null, 100000), conta("conj", "conjunta", null), conta("pp", "pessoal", "p"), conta("cm", "cartao", "m")];
  const cat = (id: string, tipo: Categoria["tipo"]): Categoria => ({ id, nome: id, tipo, grupo: id, ordem: 0, ativa: true });
  const categorias = [cat("aloj", "custo"), cat("mens", "proveito"), cat("transf", "interno")];
  let k = 0;
  const mov = (conta_id: string, data: string, valor: number, extra: Partial<Movimento> = {}): Movimento => ({ id: String(++k), conta_id, data, descricao: "x", valor, categoria_id: "aloj", entidade_id: null, subscricao_id: null, socio_id: null, reembolsavel: conta_id !== "emp", origem: "manual", notas: null, ...extra });
  const movimentos = [
    mov("emp", "2026-10-02", -2000),
    mov("emp", "2026-10-05", 150000, { categoria_id: "mens" }),
    mov("emp", "2026-10-06", -50000, { categoria_id: "transf" }),
    mov("conj", "2026-10-07", -1001),
    mov("pp", "2026-10-08", -3000),
    mov("pp", "2026-10-09", 500),
    mov("cm", "2026-10-10", -7000, { reembolsavel: false }),
    mov("cm", "2026-10-11", -400, { categoria_id: null }),
    mov("emp", "2026-11-01", -999),
  ];
  const sociosMov: SocioMovimento[] = [
    { id: "a", socio_id: "p", tipo: "reembolso", data: "2026-10-20", valor: 1000, conta_id: "emp", notas: null },
    { id: "b", socio_id: "m", tipo: "suprimento", data: "2026-10-01", valor: 20000, conta_id: "emp", notas: null },
    { id: "c", socio_id: "m", tipo: "capital", data: "2026-10-01", valor: 250000, conta_id: "emp", notas: null },
  ];

  teste("quanto a empresa deve a cada sócio", () => {
    const s = saldosSocios(socios, contas, movimentos, sociosMov);
    const pedro = s.find((x) => x.socio.id === "p")!;
    const miguel = s.find((x) => x.socio.id === "m")!;
    // Pedro: metade da conjunta (501) + 3000 - estorno 500 = 3001; menos reembolso 1000 = 2001.
    assert.equal(pedro.adiantado, 3001);
    assert.equal(pedro.devido, 2001);
    // Miguel: metade da conjunta (500) + 400 (o de 7000 não é reembolsável) + suprimento 20000 = 20900. Capital não é dívida.
    assert.equal(miguel.adiantado, 900);
    assert.equal(miguel.devido, 20900);
    assert.equal(miguel.capital, 250000);
  });

  teste("resultado do mês sem movimentos internos (um estorno reduz o custo)", () => {
    const r = resumo(movimentos, categorias, "2026-10-01", "2026-10-31");
    assert.equal(r.proveitos, 150000);
    assert.equal(r.custos, 2000 + 1001 + 3000 - 500 + 7000);
    assert.equal(r.porClassificar, 400);
    assert.equal(r.resultado, 150000 - 12501 - 400);
  });

  teste("despesas por origem do dinheiro", () => {
    const d = despesasPorOrigem(movimentos, contas, socios, categorias, "2026-10-01", "2026-10-31");
    assert.deepEqual(
      d.map((x) => [x.chave, x.total]),
      [
        ["empresa", 2000],
        ["conjunta", 1001],
        ["socio:m", 7400],
        ["socio:p", 3000],
      ],
    );
  });

  teste("pagamentos repetidos sugerem débitos diretos", () => {
    const ms = [
      mov("emp", "2026-08-02", -2000, { descricao: "DD VERCEL INC REF 111" }),
      mov("emp", "2026-09-02", -2000, { descricao: "DD VERCEL INC REF 222" }),
      mov("emp", "2026-10-02", -2100, { descricao: "DD VERCEL INC REF 333" }),
      mov("emp", "2026-10-03", -1200, { descricao: "COMPRA CAFE 03/10" }),
      mov("emp", "2026-10-09", -5000, { descricao: "COMPRA CAFE 09/10" }),
      mov("emp", "2026-09-01", -1845, { descricao: "ANTHROPIC", subscricao_id: "ja" }),
      mov("emp", "2026-10-01", -1845, { descricao: "ANTHROPIC", subscricao_id: "ja" }),
    ];
    assert.equal(chaveDescricao("DD VERCEL INC REF 111"), "vercel inc");
    const r = detetarRecorrentes(ms);
    assert.equal(r.length, 1);
    assert.equal(r[0].ocorrencias, 3);
    assert.equal(r[0].periodicidade, "mensal");
    assert.equal(r[0].valorMedio, 2033);
  });

  teste("avisos: por classificar, valor diferente, pagamento em falta, dívida a sócios", () => {
    const sub = (id: string, extra: Partial<Subscricao>): Subscricao => ({ id, nome: id, entidade_id: null, categoria_id: null, conta_id: "emp", valor_previsto: 2000, moeda: "EUR", periodicidade: "mensal", dia: 2, inicio: "2026-01-02", padrao: null, debito_direto: true, ativa: true, notas: null, ...extra });
    const ms = [mov("emp", "2026-08-02", -2600, { subscricao_id: "cara" }), mov("emp", "2026-10-02", -2000, { subscricao_id: "certa" }), mov("emp", "2026-10-03", -10, { categoria_id: null })];
    const a = avisos([sub("cara", {}), sub("certa", {}), sub("nova", { valor_previsto: null })], ms, saldosSocios(socios, contas, movimentos, sociosMov), "2026-11-06");
    const textos = a.map((x) => x.texto);
    assert.ok(textos.includes("1 movimento por classificar."));
    assert.ok(textos.includes("cara: o último pagamento foi mais alto do que o previsto."));
    assert.ok(textos.includes("cara: não encontrei o pagamento previsto para 02/10/2026."));
    assert.ok(!textos.some((t) => t.startsWith("certa:")));
    assert.ok(textos.includes("nova: falta o valor previsto."));
    assert.equal(textos.filter((t) => t.startsWith("A empresa deve")).length, 2);
  });

  teste("código QR da AT: campos, somas de bases e IVA, e QR que não são de faturas", () => {
    const q = lerQrFatura("A:509442013*B:999999990*C:PT*D:FT*E:N*F:20261015*G:FT 2026A/123*H:JJ3XZK2M-123*I1:PT*I3:10.00*I4:0.60*I7:100.00*I8:23.00*N:23.60*O:133.60*Q:abcd*R:1234");
    assert.ok(q);
    assert.equal(q.emitente_nif, "509442013");
    assert.equal(q.adquirente_nif, null); // 999999990 = consumidor final
    assert.equal(q.data, "2026-10-15");
    assert.equal(q.numero, "FT 2026A/123");
    assert.equal(q.atcud, "JJ3XZK2M-123");
    assert.equal(q.base, 11000);
    assert.equal(q.iva, 2360);
    assert.equal(q.total, 13360);
    assert.equal(lerQrFatura("https://exemplo.pt/pagar?x=1"), null);
    assert.equal(lerQrFatura("A:12*F:20261015*G:x*O:1.00"), null);
    assert.equal(nomeTipoDoc("FR"), "Fatura-recibo");
  });

  teste("NIF: dígito de controlo", () => {
    assert.ok(nifValido("509442013"));
    assert.ok(nifValido("999999990"));
    assert.ok(!nifValido("509442014"));
    assert.ok(!nifValido("12345"));
  });

  teste("fatura e movimento: valor, fornecedor e data; ligação automática só sem empate", () => {
    let k = 0;
    const m = (data: string, valor: number, descricao: string, extra: Partial<Movimento> = {}): Movimento => ({ id: `m${++k}`, conta_id: "emp", data, descricao, valor, categoria_id: null, entidade_id: null, subscricao_id: null, socio_id: null, reembolsavel: false, origem: "extrato", notas: null, ...extra });
    const ms = [m("2026-10-15", -13360, "DD MEO SA 4417"), m("2026-10-15", -13360, "COMPRA CONTINENTE"), m("2026-10-02", -2000, "DD VERCEL INC"), m("2026-12-20", -13360, "DD MEO SA"), m("2026-10-16", 13360, "TRF RECEBIDA")];
    const fatura = { sentido: "recebida" as const, total: 13360, total_eur: null, moeda: "EUR", data: "2026-10-14", entidade_id: null, emitente_nome: "MEO - Serviços de Comunicações e Multimédia, S.A." };
    const s = sugerirMovimentos(fatura, ms, new Set());
    assert.equal(s[0].movimento.id, "m1"); // valor + nome + data
    assert.ok(!s.some((x) => x.movimento.id === "m4")); // dois meses depois: fora
    assert.ok(!s.some((x) => x.movimento.id === "m5")); // é uma entrada
    assert.equal(ligacaoSegura(s)?.movimento.id, "m1");
    // Já ligado a outra fatura: não se sugere.
    assert.ok(!sugerirMovimentos(fatura, ms, new Set(["m1"])).some((x) => x.movimento.id === "m1"));
    // Fatura em USD sem total em euros: só pelo nome e data, e nunca liga sozinha (sem o valor).
    const usd = sugerirMovimentos({ ...fatura, moeda: "USD", total: 2000, emitente_nome: "Vercel Inc.", data: "2026-10-01" }, ms, new Set());
    assert.equal(usd[0].movimento.id, "m3");
    assert.equal(ligacaoSegura(usd), null);
  });

  teste("fornecedor por NIF ou nome, categoria do histórico, despesas sem fatura", () => {
    const ents = [{ id: "e1", nome: "Vercel Inc.", nif: null, email: null, tipo: "fornecedor" as const }, { id: "e2", nome: "MEO", nif: "504615947", email: null, tipo: "fornecedor" as const }];
    assert.equal(encontrarEntidade("504615947", "outro nome", ents)?.id, "e2");
    assert.equal(encontrarEntidade(null, "VERCEL INC", ents)?.id, "e1");
    assert.equal(encontrarEntidade(null, "Anthropic, PBC", ents), null);
    assert.ok(nomeCombina("Anthropic, PBC", "CARD ANTHROPIC SAN FRANCISCO"));
    assert.ok(!nomeCombina("Google Ireland", "DD VERCEL INC"));
    const cats: Categoria[] = [cat("aloj", "custo"), cat("ia", "custo"), cat("trf", "interno"), { ...cat("banco", "custo"), grupo: "Taxas e impostos" }];
    const ms: Movimento[] = [
      { ...mov("emp", "2026-10-01", -2000), id: "a", entidade_id: "e1", categoria_id: "aloj" },
      { ...mov("emp", "2026-10-02", -500), id: "b", categoria_id: "trf" },
      { ...mov("emp", "2026-10-03", -100), id: "c", categoria_id: "banco" },
      { ...mov("emp", "2026-10-04", -3000), id: "d", categoria_id: null },
    ];
    assert.equal(sugerirCategoria("e1", "APIs de IA", [], ms, cats), "aloj");
    assert.equal(sugerirCategoria(null, "ia", [], ms, cats), "ia");
    assert.deepEqual(semFatura(ms, [], cats).map((x) => x.id), ["a", "d"]);
  });

  teste("resultados: sem IVA quando há fatura, internos de fora, por classificar à parte", () => {
    const cats: Categoria[] = [cat("aloj", "custo"), cat("mens", "proveito"), cat("trf", "interno")];
    const ms: Movimento[] = [
      { ...mov("emp", "2026-10-02", -12300), id: "x1", categoria_id: "aloj" },
      { ...mov("emp", "2026-10-05", 50000), id: "x2", categoria_id: "mens" },
      { ...mov("emp", "2026-10-06", -100000), id: "x3", categoria_id: "trf" },
      { ...mov("emp", "2026-11-01", -700), id: "x4", categoria_id: null },
    ];
    const fat = { id: "f1", movimento_id: "x1", estado: "confirmada", moeda: "EUR", total: 12300, iva: 2300 } as unknown as Parameters<typeof calcularResultados>[1][number];
    const r = calcularResultados(ms, [fat], cats, ultimosMeses("2026-11", 2));
    assert.deepEqual(r.meses, ["2026-10", "2026-11"]);
    assert.equal(r.custos["2026-10"], 10000);
    assert.equal(r.ivaDedutivel["2026-10"], 2300);
    assert.equal(r.proveitos["2026-10"], 50000);
    assert.equal(r.resultado["2026-10"], 40000);
    assert.equal(r.porClassificar["2026-11"], -700);
    assert.deepEqual(ultimosMeses("2026-02", 3), ["2025-12", "2026-01", "2026-02"]);
  });

  teste("tesouraria: eventos futuros, previsão diária, MRR, autonomia e faturas por receber", () => {
    const sub = (id: string, extra: Partial<Subscricao>): Subscricao => ({ id, nome: id, entidade_id: null, categoria_id: null, conta_id: "emp", valor_previsto: 2000, moeda: "EUR", periodicidade: "mensal", dia: 10, inicio: "2026-01-10", padrao: null, debito_direto: true, ativa: true, notas: null, ...extra });
    const contrato = (extra: Partial<Contrato>): Contrato => ({ id: "c", entidade_id: "cli", produto: "cockpit", nome: null, estado: "ativo", setup: 0, mensalidade: 50000, inicio: "2026-11-01", fim: null, dia: 5, notas: null, ...extra });
    const fat = (extra: Partial<Fatura>): Fatura => ({ id: "f", sentido: "recebida", estado: "confirmada", entidade_id: null, emitente_nome: "X", emitente_nif: null, adquirente_nif: null, numero: null, atcud: null, tipo_doc: "FT", data: "2026-11-01", vencimento: null, moeda: "EUR", base: null, iva: null, total: 10000, total_eur: null, descricao: null, categoria_id: null, movimento_id: null, origem_dados: "manual", fontes: {}, duvidas: [], ficheiro: null, ficheiro_nome: null, ficheiro_tipo: null, notas: null, criado_em: "2026-11-01", ...extra });
    const ents = [{ id: "cli", nome: "Alvorada", nif: null, email: null, tipo: "cliente" as const }, { id: "forn", nome: "MEO", nif: null, email: null, tipo: "fornecedor" as const }];
    const base = { hoje: "2026-11-06", dias: 60, contas, entidades: ents };

    // Débito de 20 € no dia 10 (2 vezes em 60 dias: 10/11 e 10/12) e um de uma conta de sócio que não conta.
    const e1 = eventosFuturos({ ...base, subscricoes: [sub("a", {}), sub("b", { conta_id: "pp" })], faturas: [], contratos: [] });
    assert.deepEqual(e1.map((e) => [e.data, e.valor]), [["2026-11-10", -2000], ["2026-12-10", -2000]]);

    // Contrato: arranque de 1000 € em 1/12 e mensalidade de 500 € no dia 5 (5/12 e 5/1 caem dentro de 60 dias; 5/11 já passou).
    const e2 = eventosFuturos({ ...base, subscricoes: [], faturas: [], contratos: [contrato({ setup: 100000, inicio: "2026-11-01" }), contrato({ id: "c2", setup: 100000, inicio: "2026-12-01", mensalidade: 0 })] });
    assert.deepEqual(e2.filter((e) => e.origem === "contrato").map((e) => [e.data, e.valor]), [["2026-12-01", 100000], ["2026-12-05", 50000], ["2027-01-05", 50000]]);
    assert.equal(eventosFuturos({ ...base, subscricoes: [], faturas: [], contratos: [contrato({ estado: "pausado" })] }).length, 0);

    // Faturas sem movimento: por receber (vencida conta para hoje), por pagar (sem vencimento: 30 dias depois da data), e a de
    // um fornecedor com débito direto não se conta duas vezes.
    const e3 = eventosFuturos({
      ...base,
      subscricoes: [sub("meo", { entidade_id: "forn", valor_previsto: 1000 })],
      contratos: [],
      faturas: [fat({ id: "1", sentido: "emitida", total: 30000, vencimento: "2026-10-20" }), fat({ id: "2", total: 5000, data: "2026-11-01" }), fat({ id: "3", entidade_id: "forn", total: 1000 }), fat({ id: "4", movimento_id: "m1" }), fat({ id: "5", estado: "anulada" })],
    });
    assert.deepEqual(e3.filter((e) => e.origem === "a_receber").map((e) => [e.data, e.valor]), [["2026-11-06", 30000]]);
    assert.deepEqual(e3.filter((e) => e.origem === "a_pagar").map((e) => [e.data, e.valor]), [["2026-12-01", -5000]]);

    // Previsão diária: 1000 € hoje, -20 € no dia 10 e +300 € hoje (a fatura vencida).
    const pontos = preverCaixa(100000, e3.filter((e) => e.origem !== "debito" || e.data === "2026-11-10"), "2026-11-06", 10);
    assert.equal(pontos.length, 11);
    assert.equal(pontos[0].saldo, 130000);
    assert.equal(pontos[4].dia, "2026-11-10");
    assert.equal(pontos[4].saldo, 130000 - 1000);
    assert.equal(pontoMaisBaixo(pontos).saldo, 129000);

    // MRR só dos contratos ativos e dentro do prazo.
    assert.equal(mrr([contrato({}), contrato({ id: "x", mensalidade: 10000, fim: "2026-10-31" }), contrato({ id: "y", estado: "proposta" }), contrato({ id: "z", inicio: "2027-01-01" })], "2026-11-06"), 50000);
    assert.deepEqual(datasMensais(31, "2026-02-01", "2026-04-30"), ["2026-02-28", "2026-03-31", "2026-04-30"]);

    // Saída média: últimos 3 meses fechados (ago, set, out), sem internos nem entradas.
    const ms = [mov("emp", "2026-08-10", -30000), mov("emp", "2026-09-10", -60000), mov("emp", "2026-10-10", -90000), mov("emp", "2026-10-11", -500000, { categoria_id: "transf" }), mov("emp", "2026-10-12", 70000, { categoria_id: "mens" }), mov("emp", "2026-11-02", -99999)];
    assert.equal(saidaMensalMedia(ms, categorias, "2026-11-06"), 60000);
    assert.equal(autonomiaEmMeses(300000, 60000, 0), 5);
    assert.equal(autonomiaEmMeses(300000, 60000, 20000), 7.5);
    assert.equal(autonomiaEmMeses(300000, 60000, 60000), null); // a entrada cobre a saída
    assert.equal(autonomiaEmMeses(300000, 0, 0), null);

    const pr = porReceber([fat({ id: "a", sentido: "emitida", vencimento: "2026-11-01" }), fat({ id: "b", sentido: "emitida", vencimento: "2026-10-01" }), fat({ id: "c", sentido: "emitida", vencimento: "2026-12-01" }), fat({ id: "d" })], "2026-11-06");
    assert.deepEqual(pr.map((x) => [x.fatura.id, x.atraso]), [["b", 36], ["a", 5], ["c", -25]]);
  });

  teste("clientes e fornecedores: pago, recebido, em aberto, contratos; IVA por trimestre", () => {
    const ents = [{ id: "cli", nome: "Alvorada", nif: null, email: null, tipo: "cliente" as const }, { id: "forn", nome: "MEO", nif: null, email: null, tipo: "fornecedor" as const }];
    const ms: Movimento[] = [
      { ...mov("emp", "2026-03-01", -1000), id: "e1", entidade_id: "forn" },
      { ...mov("emp", "2025-12-01", -4000), id: "e2", entidade_id: "forn" },
      { ...mov("emp", "2026-10-05", 90000), id: "e3", entidade_id: "cli" },
    ];
    const fats = [
      { id: "f1", entidade_id: "forn", estado: "confirmada", movimento_id: "e1", moeda: "EUR", total: 1000, total_eur: null, data: "2026-03-01" },
      { id: "f2", entidade_id: "forn", estado: "rever", movimento_id: null, moeda: "EUR", total: 2500, total_eur: null, data: "2026-11-01" },
      { id: "f3", entidade_id: "forn", estado: "rever", movimento_id: null, moeda: "USD", total: 2000, total_eur: null, data: "2026-11-02" },
      { id: "f4", entidade_id: "forn", estado: "anulada", movimento_id: null, moeda: "EUR", total: 999, total_eur: null, data: "2026-11-03" },
    ] as unknown as Fatura[];
    const cts = [{ id: "k", entidade_id: "cli", produto: "painel", nome: null, estado: "ativo", setup: 0, mensalidade: 70000, inicio: "2026-10-01", fim: null, dia: 1, notas: null }] as Contrato[];
    const r = resumirEntidades(ents, ms, fats, cts, "2026-11-06");
    const forn = r.find((x) => x.entidade.id === "forn")!;
    assert.deepEqual([forn.pago, forn.pagoAno, forn.nMovimentos, forn.nFaturas, forn.emAberto, forn.nEmAberto, forn.ultima], [5000, 1000, 2, 3, 2500, 2, "2026-11-02"]);
    const cli = r.find((x) => x.entidade.id === "cli")!;
    assert.deepEqual([cli.recebido, cli.recebidoAno, cli.mrr, cli.contratos.length], [90000, 90000, 70000, 1]);

    const iva = ivaPorTrimestre({
      meses: ["2026-01", "2026-02", "2026-04", "2026-10", "2026-11"],
      ivaLiquidado: { "2026-01": 0, "2026-02": 0, "2026-04": 0, "2026-10": 4600, "2026-11": 0 },
      ivaDedutivel: { "2026-01": 300, "2026-02": 200, "2026-04": 0, "2026-10": 1000, "2026-11": 500 },
    });
    assert.deepEqual(iva, [{ trimestre: "2026 T1", liquidado: 0, dedutivel: 500, saldo: -500 }, { trimestre: "2026 T4", liquidado: 4600, dedutivel: 1500, saldo: 3100 }]);
  });

  teste("PIN: 6 algarismos, sem os óbvios; a password deriva do PIN, do email e do segredo", () => {
    assert.equal(problemaDoPin("483915"), null);
    assert.ok(problemaDoPin("12345"));
    assert.ok(problemaDoPin("12a456"));
    assert.ok(problemaDoPin("000000"));
    assert.ok(problemaDoPin("123456"));
    assert.ok(problemaDoPin("987654"));
    const antes = process.env.TORRE_PIN_SEGREDO;
    process.env.TORRE_PIN_SEGREDO = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";
    try {
      const a = senhaDoPin("Pedro@AceLabs.pt", "483915");
      assert.equal(a, senhaDoPin("pedro@acelabs.pt", "483915")); // o email não depende de maiúsculas
      assert.notEqual(a, senhaDoPin("pedro@acelabs.pt", "483916"));
      assert.notEqual(a, senhaDoPin("miguel@acelabs.pt", "483915"));
      assert.ok(a.length > 60 && a.length <= 72); // o Supabase aceita até 72
      process.env.TORRE_PIN_SEGREDO = "outro-segredo-de-teste-com-mais-de-trinta-e-dois";
      assert.notEqual(a, senhaDoPin("pedro@acelabs.pt", "483915"));
      process.env.TORRE_PIN_SEGREDO = "curto";
      assert.throws(() => senhaDoPin("pedro@acelabs.pt", "483915"));
    } finally {
      process.env.TORRE_PIN_SEGREDO = antes;
    }
  });

  console.log(`  ${n} testes passaram`);
}

if (require.main === module) correrUnidade();
