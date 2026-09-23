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
  /inclu[ií]do.*im[oó]vel/i,
];

export function filtrarCamposEmFalta<T extends { campo: string; pergunta: string }>(
  campos: T[]
): T[] {
  return campos.filter(
    (c) => !PADROES_PROIBIDOS.some((padrao) => padrao.test(c.campo) || padrao.test(c.pergunta))
  );
}

// Licença de utilização e certificado energético não estão na lista acima porque a IA tenta
// extraí-los de documentos/texto normalmente. Mas também são editáveis directamente no
// formulário "Condições do negócio" - se o agente os preencher aí antes de responder no chat,
// a pergunta correspondente ficava visível e a contar como pendente até à ronda seguinte de
// chat (testado: guardar o formulário não mexe em campos_em_falta). Isto remove-as de imediato
// quando o formulário é guardado com um valor não vazio.
//
// O "campo" devolvido pela IA é normalmente o identificador estável do JSON (ex.:
// "imovel.certificado_energetico"), mas a "pergunta" em português varia de ronda para ronda
// (testado: numa chamada saiu "classificação energética do imóvel (certificado)", que não
// contém a frase exacta "certificado energético") - por isso o casamento verifica o campo por
// nome e a pergunta por palavras-chave soltas, não por uma frase fixa.
const CAMPOS_TAMBEM_NO_FORMULARIO: {
  correspondeA: (texto: string) => boolean;
  preenchido: (v: { licencaUtilizacao: string; certificadoEnergetico: string }) => boolean;
}[] = [
  {
    correspondeA: (t) => /licenca_utilizacao/i.test(t) || (/licen[çc]a/i.test(t) && /utiliza[çc][ãa]o/i.test(t)),
    preenchido: (v) => v.licencaUtilizacao.trim().length > 0,
  },
  {
    correspondeA: (t) =>
      /certificado_energetico/i.test(t) ||
      (/certificado/i.test(t) && /energ[ée]tic/i.test(t)) ||
      (/classifica[çc][ãa]o/i.test(t) && /energ[ée]tic/i.test(t)),
    preenchido: (v) => v.certificadoEnergetico.trim().length > 0,
  },
];

export function removerCamposPreenchidosNoFormulario<T extends { campo: string; pergunta: string }>(
  campos: T[],
  valores: { licencaUtilizacao: string; certificadoEnergetico: string }
): T[] {
  return campos.filter(
    (c) =>
      !CAMPOS_TAMBEM_NO_FORMULARIO.some(
        ({ correspondeA, preenchido }) => preenchido(valores) && (correspondeA(c.campo) || correspondeA(c.pergunta))
      )
  );
}
