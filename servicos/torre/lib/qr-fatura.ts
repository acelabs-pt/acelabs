// Código QR das faturas portuguesas (Portaria 195/2020, especificação da AT). Todas as faturas emitidas em Portugal por
// software certificado o trazem desde 2022. Campos "CÓDIGO:valor" separados por "*", por exemplo:
//   A:500000000*B:999999990*C:PT*D:FT*E:N*F:20261015*G:FT A/123*H:JJ3X-123*I1:PT*I7:100.00*I8:23.00*N:23.00*O:123.00*Q:abcd*R:1234
// O que se lê daqui é exato (é o que foi comunicado à AT), por isso ganha sempre à leitura por IA.

import { paraCentimos } from "./dinheiro";

export type DadosQr = {
  emitente_nif: string;
  adquirente_nif: string | null;
  pais_adquirente: string | null;
  tipo_doc: string;
  /** N normal, A anulado, S autofaturação, F faturado... */
  estado_doc: string;
  data: string;
  numero: string;
  atcud: string | null;
  /** Base tributável somada de todas as taxas e espaços fiscais, mais o não sujeito (cêntimos). */
  base: number;
  /** IVA somado de todas as taxas (cêntimos). */
  iva: number;
  /** Total do documento com impostos (cêntimos). */
  total: number;
  retencao: number;
};

const TIPOS: Record<string, string> = {
  FT: "Fatura",
  FS: "Fatura simplificada",
  FR: "Fatura-recibo",
  NC: "Nota de crédito",
  ND: "Nota de débito",
  RG: "Recibo",
};

export function nomeTipoDoc(t: string | null | undefined): string {
  return (t && TIPOS[t]) || t || "Fatura";
}

/** Lê o texto de um código QR. Devolve null se não for um QR de fatura da AT (ex.: um QR de pagamento ou um URL). */
export function lerQrFatura(texto: string): DadosQr | null {
  const campos = new Map<string, string>();
  for (const parte of texto.trim().split("*")) {
    const i = parte.indexOf(":");
    if (i < 1) continue;
    campos.set(parte.slice(0, i).trim().toUpperCase(), parte.slice(i + 1).trim());
  }
  const a = campos.get("A");
  const f = campos.get("F");
  const g = campos.get("G");
  const o = campos.get("O");
  if (!a || !/^\d{9}$/.test(a) || !f || !/^\d{8}$/.test(f) || !g || !o) return null;

  const c = (k: string) => {
    const v = campos.get(k);
    if (!v) return 0;
    return paraCentimos(v) ?? 0;
  };
  // Bases: isenta (2), reduzida (3), intermédia (5), normal (7), em PT, Açores (J) e Madeira (K); mais não sujeito (L).
  let base = c("L");
  let iva = 0;
  for (const p of ["I", "J", "K"]) {
    base += c(`${p}2`) + c(`${p}3`) + c(`${p}5`) + c(`${p}7`);
    iva += c(`${p}4`) + c(`${p}6`) + c(`${p}8`);
  }
  const b = campos.get("B");
  return {
    emitente_nif: a,
    adquirente_nif: b && b !== "999999990" ? b : null,
    pais_adquirente: campos.get("C") ?? null,
    tipo_doc: campos.get("D") ?? "FT",
    estado_doc: campos.get("E") ?? "N",
    data: `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}`,
    numero: g,
    atcud: campos.get("H") && campos.get("H") !== "0" ? campos.get("H")! : null,
    base,
    iva,
    total: c("O"),
    retencao: c("P"),
  };
}

/** NIF português válido (dígito de controlo). */
export function nifValido(nif: string | null | undefined): boolean {
  if (!nif || !/^\d{9}$/.test(nif)) return false;
  const soma = nif
    .slice(0, 8)
    .split("")
    .reduce((s, d, i) => s + Number(d) * (9 - i), 0);
  const resto = soma % 11;
  const controlo = resto < 2 ? 0 : 11 - resto;
  return controlo === Number(nif[8]);
}
