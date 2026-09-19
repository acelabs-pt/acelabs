import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from "docx";

type Parte = {
  papel: string;
  tipo_pessoa?: string | null;
  nome: string;
  estado_civil: string | null;
  regime_bens: string | null;
  nacionalidade: string | null;
  naturalidade?: string | null;
  nif: string | null;
  morada: string | null;
  documento_tipo: string | null;
  documento_numero: string | null;
  documento_validade: string | null;
  representante_nome?: string | null;
  certidao_permanente?: string | null;
};

type Processo = Record<string, unknown> & {
  imovel_morada: string | null;
  imovel_freguesia: string | null;
  imovel_concelho: string | null;
  imovel_distrito: string | null;
  imovel_tipologia: string | null;
  imovel_artigo_matricial: string | null;
  imovel_descricao_predial: string | null;
  imovel_certificado_energetico: string | null;
  imovel_licenca_utilizacao: string | null;
  imovel_area: number | null;
  imovel_anexos: string | null;
  imovel_estado: string | null;
  preco_total: number | null;
  valor_sinal: number | null;
  forma_pagamento_sinal: string | null;
  prazo_pagamento_sinal: string | null;
  prazo_escritura: string | null;
  condicoes_suspensivas: string | null;
  penalizacao_incumprimento: string | null;
  metodo_pagamento: string | null;
  tem_fracoes_multiplas: boolean | null;
  valor_fracao_principal: number | null;
  valor_fracao_secundaria: number | null;
  valor_mobilia: number | null;
  reforco_sinal: string | null;
  iban_sinal: string | null;
  reserva: boolean | null;
  valor_reserva: number | null;
  condicionado_avaliacao: boolean | null;
  valor_avaliacao_minimo: number | null;
  condicionado_financiamento: boolean | null;
  condicionado_outra_situacao: string | null;
  dias_condicionamento: number | null;
  dias_condicionamento_tipo: string | null;
  comodato: boolean | null;
  tempo_comodato: string | null;
  incluidos_no_imovel: string | null;
  email_proprietario_contrato: string | null;
  email_comprador_contrato: string | null;
  data_assinatura_contrato: string | null;
  observacoes_adicionais: string | null;
};

function v(value: unknown, fallback = "____________"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function euros(value: number | null): string {
  if (value === null || value === undefined) return "____________";
  return `${value.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function dataPT(iso: string | null): string {
  if (!iso) return "____________";
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

const METODO_PAGAMENTO_LABEL: Record<string, string> = {
  capital_proprio: "capital próprio",
  financiamento: "recurso a financiamento bancário",
  misto: "capital próprio e recurso a financiamento bancário",
};

function regimeBensValido(regimeBens: string | null): boolean {
  if (!regimeBens) return false;
  return !/n[ãa]o\s*aplic[aá]vel|n\/a/i.test(regimeBens);
}

function identificacaoParte(p: Parte): string {
  if (p.tipo_pessoa === "coletiva") {
    return `${v(p.nome)}, pessoa colectiva com o NIF ${v(p.nif)}, com sede em ${v(p.morada)}${
      p.certidao_permanente ? `, matriculada com o código de certidão permanente ${v(p.certidao_permanente)}` : ""
    }, aqui representada por ${v(p.representante_nome, "representante com poderes para o acto")}`;
  }
  return `${v(p.nome)}, ${v(p.estado_civil, "estado civil não indicado")}${
    regimeBensValido(p.regime_bens) ? `, casado sob o regime de ${p.regime_bens}` : ""
  }${p.naturalidade ? `, natural de ${p.naturalidade}` : ""}, de nacionalidade ${v(
    p.nacionalidade,
    "não indicada"
  )}, contribuinte fiscal n.º ${v(p.nif)}, residente em ${v(
    p.morada
  )}, titular do ${v(p.documento_tipo, "documento de identificação")} n.º ${v(p.documento_numero)}, válido até ${dataPT(
    p.documento_validade
  )}`;
}

function corpo(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 200 },
    children: [new TextRun({ text, size: 24 })],
  });
}

function titulo(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, bold: true, size: 24 })],
  });
}

const PARTE_EM_BRANCO: Parte = {
  papel: "",
  tipo_pessoa: "singular",
  nome: "",
  estado_civil: null,
  regime_bens: null,
  nacionalidade: null,
  naturalidade: null,
  nif: null,
  morada: null,
  documento_tipo: null,
  documento_numero: null,
  documento_validade: null,
  representante_nome: null,
  certidao_permanente: null,
};

function clausulaCondicoesSuspensivas(processo: Processo): string {
  if (processo.condicoes_suspensivas) return v(processo.condicoes_suspensivas);

  const condicoes: string[] = [];
  if (processo.condicionado_avaliacao) {
    condicoes.push(
      `avaliação do Imóvel em valor igual ou superior a ${
        processo.valor_avaliacao_minimo ? euros(processo.valor_avaliacao_minimo) : "____________"
      }`
    );
  }
  if (processo.condicionado_financiamento) {
    condicoes.push("obtenção de financiamento bancário pelo(s) SEGUNDO(S) OUTORGANTE(S)");
  }
  if (processo.condicionado_outra_situacao) {
    condicoes.push(processo.condicionado_outra_situacao);
  }

  if (condicoes.length === 0) {
    return "Não foram estipuladas condições suspensivas para o presente contrato.";
  }

  const prazo = processo.dias_condicionamento
    ? ` no prazo de ${processo.dias_condicionamento} dias ${
        processo.dias_condicionamento_tipo === "corridos" ? "corridos" : "úteis"
      } a contar da data de assinatura do presente contrato`
    : "";

  const listaCondicoes =
    condicoes.length === 1
      ? condicoes[0]
      : condicoes.map((c, i) => `${i + 1}) ${c}`).join("; ");

  return `O presente contrato fica sujeito às seguintes condições suspensivas: ${listaCondicoes}${prazo}.`;
}

export async function gerarDocxCpcv(processo: Processo, partes: Parte[]): Promise<Buffer> {
  const vendedores = partes.filter((p) => p.papel === "vendedor");
  const compradores = partes.filter((p) => p.papel === "comprador");
  if (vendedores.length === 0) vendedores.push(PARTE_EM_BRANCO);
  if (compradores.length === 0) compradores.push(PARTE_EM_BRANCO);

  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: "Contrato-Promessa de Compra e Venda", bold: true, size: 32 })],
    }),
    corpo("Entre:"),
    ...vendedores.map((p, i) =>
      corpo(
        `${vendedores.length > 1 ? `${i + 1}.º Outorgante - ` : ""}${identificacaoParte(
          p
        )}, doravante designado(a) PRIMEIRO OUTORGANTE ou PROMITENTE(S) VENDEDOR(A/ES).`
      )
    ),
    corpo("e"),
    ...compradores.map((p, i) =>
      corpo(
        `${compradores.length > 1 ? `${i + 1}.º Outorgante - ` : ""}${identificacaoParte(
          p
        )}, doravante designado(a) SEGUNDO OUTORGANTE ou PROMITENTE(S) COMPRADOR(A/ES).`
      )
    ),
    corpo("é celebrado o presente contrato-promessa de compra e venda, que se rege pelas cláusulas seguintes:"),

    titulo("Cláusula Primeira (Objecto)"),
    corpo(
      `O(s) PRIMEIRO(S) OUTORGANTE(S) é/são legítimo(s) proprietário(s) e possuidor(es) do prédio urbano sito em ${v(
        processo.imovel_morada
      )}, freguesia de ${v(processo.imovel_freguesia)}, concelho de ${v(
        processo.imovel_concelho
      )}, distrito de ${v(processo.imovel_distrito)}, com a tipologia ${v(
        processo.imovel_tipologia
      )}, inscrito na matriz predial urbana sob o artigo n.º ${v(processo.imovel_artigo_matricial)}${
        processo.imovel_descricao_predial
          ? `, descrito na Conservatória do Registo Predial sob o n.º ${v(processo.imovel_descricao_predial)}`
          : ""
      }, com a área de ${processo.imovel_area ? `${processo.imovel_area} m²` : "____________"}, doravante designado por "Imóvel".`
    ),
  ];

  if (processo.tem_fracoes_multiplas) {
    children.push(
      corpo(
        `O Imóvel é composto por duas fracções, sendo atribuído à fracção principal o valor de ${euros(
          processo.valor_fracao_principal
        )} e à segunda fracção (garagem/arrumo) o valor de ${euros(processo.valor_fracao_secundaria)}.`
      )
    );
  }

  children.push(
    titulo("Cláusula Segunda (Promessa)"),
    corpo(
      "Pela presente, o(s) PRIMEIRO(S) OUTORGANTE(S) promete(m) vender, livre de ónus ou encargos, e o(s) SEGUNDO(S) OUTORGANTE(S) promete(m) comprar o Imóvel identificado na Cláusula Primeira, nas condições constantes do presente contrato."
    ),

    titulo("Cláusula Terceira (Preço e Condições de Pagamento)"),
    corpo(
      `O preço global e convencionado para a presente promessa de compra e venda é de ${euros(
        processo.preco_total
      )}, a pagar através de ${v(
        METODO_PAGAMENTO_LABEL[processo.metodo_pagamento ?? ""],
        "meio de pagamento a definir"
      )}, da seguinte forma:`
    ),
    corpo(
      `a) A título de sinal e princípio de pagamento, a quantia de ${euros(processo.valor_sinal)}, paga ${v(
        processo.forma_pagamento_sinal,
        "na data da assinatura do presente contrato"
      )}${processo.prazo_pagamento_sinal ? `, ${v(processo.prazo_pagamento_sinal)}` : ""}${
        processo.iban_sinal ? `, para o IBAN ${v(processo.iban_sinal)}` : ""
      }${processo.reforco_sinal ? `, com reforço de sinal de ${v(processo.reforco_sinal)}` : ""};`
    ),
    corpo(
      "b) O remanescente do preço será pago na data da celebração da escritura pública de compra e venda, através de meio de pagamento idóneo."
    )
  );

  if (processo.reserva) {
    children.push(
      corpo(
        `Foi entregue pelo(s) SEGUNDO(S) OUTORGANTE(S), a título de reserva, a quantia de ${euros(
          processo.valor_reserva
        )}, a deduzir ao valor do sinal referido na alínea a).`
      )
    );
  }

  if (processo.valor_mobilia) {
    children.push(
      corpo(`É atribuído à mobília e aos bens móveis incluídos na transacção o valor de ${euros(processo.valor_mobilia)}.`)
    );
  }

  children.push(
    titulo("Cláusula Quarta (Escritura Pública)"),
    corpo(
      `A escritura pública de compra e venda, ou documento particular autenticado equivalente, será celebrada até ${dataPT(
        processo.prazo_escritura
      )}, em local, dia e hora a acordar entre as partes, devendo o(s) PRIMEIRO(S) OUTORGANTE(S) ser notificado(s) com uma antecedência mínima de 8 (oito) dias.`
    ),

    titulo("Cláusula Quinta (Condições Suspensivas)"),
    corpo(clausulaCondicoesSuspensivas(processo)),

    titulo("Cláusula Sexta (Incumprimento)"),
    corpo(
      v(
        processo.penalizacao_incumprimento,
        "Em caso de incumprimento definitivo do presente contrato por causa imputável ao PRIMEIRO OUTORGANTE, este restituirá ao SEGUNDO OUTORGANTE o valor do sinal em dobro; em caso de incumprimento definitivo por causa imputável ao SEGUNDO OUTORGANTE, perderá este, a favor do PRIMEIRO OUTORGANTE, o valor do sinal já entregue, nos termos gerais do artigo 442.º do Código Civil."
      )
    ),

    titulo("Cláusula Sétima (Estado do Imóvel e Licenciamento)"),
    corpo(
      `O Imóvel é transaccionado no estado de conservação em que actualmente se encontra${
        processo.imovel_estado ? `: ${v(processo.imovel_estado)}` : ""
      }, o qual é do conhecimento do(s) SEGUNDO(S) OUTORGANTE(S), dispõe de licença de utilização n.º ${v(
        processo.imovel_licenca_utilizacao
      )} e de certificado energético com a classificação ${v(processo.imovel_certificado_energetico)}${
        processo.imovel_anexos ? `, possuindo ainda os seguintes anexos: ${v(processo.imovel_anexos)}` : ""
      }.`
    )
  );

  if (processo.incluidos_no_imovel) {
    children.push(corpo(`Ficam incluídos na transacção: ${v(processo.incluidos_no_imovel).replace(/\.+$/, "")}.`));
  }

  children.push(
    titulo("Cláusula Oitava (Disposições Finais)"),
    corpo(
      "O presente contrato rege-se pelo disposto nos artigos 410.º e seguintes do Código Civil, e demais legislação aplicável, e é celebrado de boa fé por ambas as partes, que o subscrevem em sinal de aceitação e concordância com todas as suas cláusulas."
    )
  );

  if (processo.email_proprietario_contrato || processo.email_comprador_contrato) {
    children.push(
      corpo(
        `Para efeitos de comunicação relativa ao presente contrato: proprietário - ${v(
          processo.email_proprietario_contrato
        )}; comprador - ${v(processo.email_comprador_contrato)}.`
      )
    );
  }

  if (processo.comodato) {
    children.push(
      titulo("Cláusula Nona (Comodato)"),
      corpo(
        `O(s) PRIMEIRO(S) OUTORGANTE(S) permanecerá(ão) no Imóvel a título de comodato após a escritura, por um período de ${v(
          processo.tempo_comodato,
          "____________"
        )}, findo o qual entregará(ão) o Imóvel livre de pessoas e bens ao(s) SEGUNDO(S) OUTORGANTE(S).`
      )
    );
  }

  if (processo.observacoes_adicionais) {
    children.push(
      titulo(`Cláusula ${processo.comodato ? "Décima" : "Nona"} (Observações Adicionais)`),
      corpo(v(processo.observacoes_adicionais))
    );
  }

  children.push(
    corpo("Feito em dois exemplares, ficando cada uma das partes na posse de um exemplar."),
    corpo(
      `Local e data: ${v(processo.imovel_concelho, "____________")}, ${
        processo.data_assinatura_contrato ? dataPT(processo.data_assinatura_contrato) : "____ de ____________ de ________"
      }`
    ),
    new Paragraph({ spacing: { before: 600 }, children: [new TextRun({ text: "" })] }),
    new Paragraph({
      spacing: { before: 600 },
      children: [new TextRun({ text: "_______________________________________", size: 24 })],
    }),
    corpo("O(s) Promitente(s) Vendedor(a/es)"),
    new Paragraph({
      spacing: { before: 600 },
      children: [new TextRun({ text: "_______________________________________", size: 24 })],
    }),
    corpo("O(s) Promitente(s) Comprador(a/es)")
  );

  const doc = new Document({ sections: [{ children }] });

  return Packer.toBuffer(doc);
}
