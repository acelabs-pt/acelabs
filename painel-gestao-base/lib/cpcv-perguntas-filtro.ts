// Rede de segurança: o system prompt já instrui a IA a nunca perguntar por estes
// campos (preenchidos à parte no formulário "Condições do negócio"), mas modelos
// nem sempre cumprem a instrução à letra - isto filtra essas perguntas mesmo que
// a IA as devolva, em vez de confiar só no prompt.
const PADROES_PROIBIDOS = [
  /m[eé]todo de pagamento/i,
  /reserva/i,
  /condi[cç][aã]o(?:es)? suspensiva/i,
  /avalia[cç][aã]o do im[oó]vel/i,
  /financiamento banc[aá]rio/i,
  /comodato/i,
  /iban/i,
  /e-?mail/i,
];

export function filtrarCamposEmFalta<T extends { campo: string; pergunta: string }>(
  campos: T[]
): T[] {
  return campos.filter(
    (c) => !PADROES_PROIBIDOS.some((padrao) => padrao.test(c.campo) || padrao.test(c.pergunta))
  );
}
