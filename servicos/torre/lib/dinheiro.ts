// Dinheiro sempre em cêntimos inteiros (nunca floats na base de dados nem nas contas).

const FORMATO = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

/** 123456 -> "1234,56 €" (formato português). */
export function euros(centimos: number): string {
  // "+ 0" troca o -0 por 0 (senão aparece "-0,00 €").
  return FORMATO.format(centimos / 100 + 0);
}

/**
 * Lê um valor escrito à mão ou vindo de um extrato: "1.234,56", "1234.56", "-12,30 €", "(12,30)", "1,234.56".
 * Devolve cêntimos, ou null se não for um número.
 */
export function paraCentimos(texto: string | null | undefined): number | null {
  if (texto == null) return null;
  let s = String(texto).replace(/\s| |€|EUR/gi, "");
  if (!s) return null;
  let sinal = 1;
  if (/^\(.*\)$/.test(s)) {
    sinal = -1;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    sinal = -sinal;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  if (s.endsWith("-")) {
    sinal = -sinal;
    s = s.slice(0, -1);
  }
  if (!/^[\d.,]+$/.test(s)) return null;

  const ultimoPonto = s.lastIndexOf(".");
  const ultimaVirgula = s.lastIndexOf(",");
  let inteiro: string;
  let decimal = "";
  if (ultimoPonto >= 0 && ultimaVirgula >= 0) {
    // O separador que aparece por último é o decimal.
    // A parte inteira só pode ter o outro separador, em grupos de 3 ("1.234.567,89").
    const sep = ultimoPonto > ultimaVirgula ? "." : ",";
    const milhar = sep === "." ? "," : ".";
    const i = s.lastIndexOf(sep);
    const bruto = s.slice(0, i);
    if (!new RegExp(`^\\d{1,3}(\\${milhar}\\d{3})*$`).test(bruto)) return null;
    inteiro = bruto.replace(/[.,]/g, "");
    decimal = s.slice(i + 1);
  } else if (ultimaVirgula >= 0) {
    // Só vírgulas: nos bancos portugueses é o decimal. Várias vírgulas = milhares.
    if ((s.match(/,/g) ?? []).length > 1) inteiro = s.replace(/,/g, "");
    else [inteiro, decimal] = s.split(",");
  } else if (ultimoPonto >= 0) {
    // Só pontos: "1.234" e "1.234.567" são milhares; "12.5" e "1234.56" são decimais.
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) inteiro = s.replace(/\./g, "");
    else [inteiro, decimal] = s.split(".");
  } else inteiro = s;

  if (!/^\d*$/.test(inteiro) || !/^\d*$/.test(decimal) || (!inteiro && !decimal)) return null;
  const cent = Math.round(Number(`${inteiro || "0"}.${decimal || "0"}`) * 100);
  return Number.isFinite(cent) ? sinal * cent : null;
}

/** Divide um valor em n partes inteiras que somam o total (o resto vai para as primeiras). */
export function dividir(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.trunc(total / n);
  let resto = total - base * n;
  return Array.from({ length: n }, () => {
    if (resto === 0) return base;
    const passo = Math.sign(resto);
    resto -= passo;
    return base + passo;
  });
}
