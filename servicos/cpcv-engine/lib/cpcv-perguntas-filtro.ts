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
  // Dados de vendedor/comprador vêm de um formulário próprio, não da IA (ver
  // lib/cpcv-partes-form.ts) - rede de segurança igual à de cima, caso o modelo pergunte
  // na mesma apesar de instruído a não o fazer.
  /\bnif\b/i,
  /estado civil/i,
  /regime de bens/i,
  /naturalidade/i,
  /cart[ãa]o de cidad[ãa]o/i,
  /passaporte/i,
  /t[ií]tulo de resid[eê]ncia/i,
  /n[uú]mero de (?:documento|identifica[çc][ãa]o)/i,
  /dados (?:do|da|dos|das) (?:vendedor|comprador)/i,
  /identifica[çc][ãa]o (?:do|da) (?:vendedor|comprador)/i,
  /morada (?:do|da) (?:vendedor|comprador)/i,
];

export function filtrarCamposEmFalta<T extends { campo: string; pergunta: string }>(
  campos: T[]
): T[] {
  return campos.filter(
    (c) => !PADROES_PROIBIDOS.some((padrao) => padrao.test(c.campo) || padrao.test(c.pergunta))
  );
}

// Alguns campos que a IA tenta extrair de documentos/texto também são editáveis directamente
// em formulários próprios - licença/certificado em "Documentos obrigatórios", preço e sinal em
// "Condições do negócio" > "Valor do negócio". Se forem preenchidos aí antes de responder no
// chat, a pergunta correspondente ficava visível e a contar como pendente até à ronda seguinte
// de chat (testado: guardar um formulário não mexe em campos_em_falta por si só). Isto
// remove-as de imediato quando um desses formulários é guardado com um valor não vazio - cada
// chamador passa só as chaves que tem (as outras ficam undefined e não casam com nada).
//
// O "campo" devolvido pela IA é normalmente o identificador estável do JSON (ex.:
// "negocio.preco_total", "imovel.certificado_energetico"), mas a "pergunta" em português varia
// de ronda para ronda (testado: numa chamada saiu "classificação energética do imóvel
// (certificado)", que não contém a frase exacta "certificado energético") - por isso o
// casamento verifica o campo por nome e a pergunta por palavras-chave soltas, não por uma frase
// fixa.
const CAMPOS_TAMBEM_NO_FORMULARIO: {
  chave: string;
  correspondeA: (texto: string) => boolean;
}[] = [
  {
    chave: "licencaUtilizacao",
    correspondeA: (t) => /licenca_utilizacao/i.test(t) || (/licen[çc]a/i.test(t) && /utiliza[çc][ãa]o/i.test(t)),
  },
  {
    chave: "certificadoEnergetico",
    correspondeA: (t) =>
      /certificado_energetico/i.test(t) ||
      (/certificado/i.test(t) && /energ[ée]tic/i.test(t)) ||
      (/classifica[çc][ãa]o/i.test(t) && /energ[ée]tic/i.test(t)),
  },
  {
    chave: "precoTotal",
    correspondeA: (t) => /preco_total/i.test(t) || (/pre[çc]o/i.test(t) && /total/i.test(t)),
  },
  {
    chave: "valorSinal",
    correspondeA: (t) => /valor_sinal/i.test(t) || (/valor/i.test(t) && /\bsinal\b/i.test(t)),
  },
];

export function removerCamposPreenchidosNoFormulario<T extends { campo: string; pergunta: string }>(
  campos: T[],
  valores: Record<string, string>
): T[] {
  return campos.filter(
    (c) =>
      !CAMPOS_TAMBEM_NO_FORMULARIO.some(
        ({ chave, correspondeA }) =>
          (valores[chave] ?? "").trim().length > 0 && (correspondeA(c.campo) || correspondeA(c.pergunta))
      )
  );
}
