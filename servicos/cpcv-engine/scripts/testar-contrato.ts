import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
const JSZip = require("jszip");

const ROOT = path.resolve(__dirname, "..").split(path.sep).join("/");
const OUT = path.join(require("os").tmpdir(), "cpcv-testes-contrato");
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const { gerarPdfCpcv } = await import("file:///" + ROOT + "/lib/cpcv-pdf.ts");
  const { gerarDocxCpcv } = await import("file:///" + ROOT + "/lib/cpcv-docx.ts");
  const { lerContrato } = await import("file:///" + ROOT + "/lib/cpcv-leitor.ts");
  // LER_IA=1 faz também a leitura por IA (gasta créditos da Anthropic) no cenário do feedback.
  const lerComIA = process.env.LER_IA === "1";

  const base: any = {
    imovel_morada: "Rua do Alto do Sobreiro, n.º 222", imovel_codigo_postal: "4800-123", imovel_localidade: "Azurém",
    imovel_freguesia: "Azurém", imovel_concelho: "Guimarães", imovel_distrito: "Braga", imovel_tipologia: "T3",
    imovel_artigo_matricial: "1234", imovel_descricao_predial: "5678/20010101", imovel_certificado_energetico: "SCE123456789",
    imovel_licenca_utilizacao: "45/2001", imovel_area: 120, imovel_anexos: "garagem e arrumo", imovel_estado: "usado",
    imovel_condominio: false, imovel_e_fracao_autonoma: false, imovel_conservatoria: "Conservatória do Registo Predial de Guimarães",
    imovel_licenca_data_emissao: "2001-05-10", imovel_licenca_entidade_emissora: "Câmara Municipal de Guimarães",
    imovel_certificado_validade: "2032-03-01", imovel_certificado_classe: "C", hipotecas_verificadas: true,
    preco_total: 222000, valor_sinal: 22200, prazo_escritura: "2026-12-15", metodo_pagamento: "capital_proprio",
    destino_sinal: "vendedor", iban_sinal: "PT50003500000000000000000", conta_sinal_banco: "Banco Exemplo",
    conta_sinal_titular: "Maria João Ação", condicionado_avaliacao: false, condicionado_financiamento: false,
    comodato: false, tem_bens_moveis: false, data_assinatura_contrato: "2026-10-20", reserva: false,
    email_proprietario_contrato: "vendedor@exemplo.pt", email_comprador_contrato: "comprador@exemplo.pt",
  };
  const pessoa = (papel: string, nome: string, extra: any = {}): any => ({
    papel, tipo_pessoa: "singular", nome, estado_civil: "solteiro", regime_bens: null, nacionalidade: "portuguesa",
    naturalidade: "Braga", nif: "123456789", morada: "Rua das Flores, n.º 10, 4700-001 Braga", documento_tipo: "Cartão de Cidadão",
    documento_numero: "12345678 9 ZZ1", documento_validade: "2030-01-31", ...extra,
  });
  const V = (n = "José Ação Mendonça") => pessoa("vendedor", n);
  const C = (n = "Ana Conceição d'Ávila") => pessoa("comprador", n);

  type Cen = { nome: string; proc: any; partes: any[]; hip?: any[]; espera: string[]; naoEspera?: string[]; negrito?: string[] };
  const cen: Cen[] = [
    { nome: "01-singulares", proc: base, partes: [V(), C()], espera: ["José Ação Mendonça", "Ana Conceição d'Ávila", "222.000,00", "Guimarães", "solteiro, maior, titular"] },
    { nome: "02-varios", proc: base, partes: [V("João Pereira"), V("Maria Pereira"), C("Rui Costa"), C("Sara Costa"), C("Tiago Costa")], espera: ["OS PRIMEIROS OUTORGANTES", "OS SEGUNDOS OUTORGANTES", "Tiago Costa"] },
    { nome: "03-coletiva", proc: base, partes: [pessoa("vendedor", "Construções Silva & Filhos, Lda.", { tipo_pessoa: "coletiva", representante_nome: "Carlos Silva", representante_cargo: "gerente", certidao_permanente: "1234-5678-9012" }), C()], espera: ["Construções Silva & Filhos, Lda.", "Carlos Silva", "1234-5678-9012"] },
    { nome: "04-regimes", proc: base, partes: [pessoa("vendedor", "Paulo Faria", { estado_civil: "casado", regime_bens: "comunhão de adquiridos" }), pessoa("vendedor", "Rita Faria", { estado_civil: "casada", regime_bens: "comunhão de adquiridos" }), pessoa("comprador", "Luís Neto", { estado_civil: "casado", regime_bens: "separação de bens" }), pessoa("comprador", "Inês Neto", { estado_civil: "casada", regime_bens: "separação de bens" })], espera: ["adquiridos", "separação de bens"] },
    { nome: "05-procurador", proc: base, partes: [pessoa("vendedor", "Manuel Rocha", { tem_procuracao: true, procurador_nome: "Fernando Dias", procurador_documento: "CC 11111111" }), C()], espera: ["Manuel Rocha"], info: ["Fernando Dias", "CC 11111111"], info: ["Fernando Dias", "CC 11111111"] },
    { nome: "06-externa", proc: { ...base, tipo_contrato: "comprador_nosso_angariacao_externa" }, partes: [C()], espera: ["Ana Conceição d'Ávila"] },
    { nome: "07-hipoteca-bens", proc: { ...base, tem_bens_moveis: true, incluidos_no_imovel: "cozinha equipada, frigorifico e maquina de lavar", imovel_condominio: true, imovel_e_fracao_autonoma: true, imovel_fracao_letra: "B", imovel_andar_fracao: "2.º andar", imovel_finalidade: "habitação" }, partes: [V(), C()], hip: [{ entidade_credora: "Banco Hipotecário SA", natureza: "hipoteca voluntária", numero_apresentacao: "Ap. 1234", data_registo: "2015-04-02" }], espera: ["Banco Hipotecário SA", "cozinha equipada", "Condomínio"] },
    { nome: "08-sinal-financiamento", proc: { ...base, metodo_pagamento: "financiamento", condicionado_financiamento: true, valor_financiamento_minimo: 150000, prazo_financiamento_dias: 60, condicionado_avaliacao: true, valor_avaliacao_minimo: 222000, avaliacao_prazo_data: "2026-11-30", avaliacao_contacto_email: "avaliacao@exemplo.pt", reforcos_sinal: [{ valor: 10000, data: "2026-11-01" }, { valor: 5000, data: "2026-12-01" }] }, partes: [V(), C()], espera: ["financiamento", "avaliacao@exemplo.pt", "10.000,00"] },
    { nome: "09-agencia-comissao", proc: { ...base, destino_sinal: "agencia", iban_sinal: null, conta_sinal_banco: null, comissao_modalidade: "no ato da escritura", comissao_valor: 11070 }, partes: [V(), C()], espera: ["Guimarães"], info: ["11.070,00"] },
    { nome: "10-nomes-estranhos", proc: base, partes: [V("Maria da Conceição Ângela Ximenes de Albuquerque e Vasconcelos Peixoto da Fonseca Ñandú"), C("João d'Ávila-O'Brien Ç")], espera: ["Albuquerque", "Ñandú", "O'Brien"] },
    // Feedback da solicitadora (25/10/2026): 4 vendedores em 2 casais, emails, estado civil sem "maior",
    // isencao de certificado, reserva, hipoteca + onus, situado em/composicao, nomes em maiusculas.
    {
      nome: "12-feedback-solicitadora",
      proc: {
        ...base, imovel_certificado_estado: "isento", imovel_certificado_isencao_numero: "ISE-998877", imovel_certificado_data_emissao: "2024-03-05",
        imovel_conservatoria: "CONSERVATÓRIA DO REGISTO PREDIAL DE GUIMARÃES", imovel_concelho: "GUIMARÃES", imovel_freguesia: "AZURÉM",
        imovel_situado_em: "RUA ÁLVARO AURÉLIO DO CÉU OLIVEIRA, N.ºS 312, 356 E RUA SAMUEL GRAMACHO, N.º 10", imovel_composicao: "Dois edifícios ligados por um aparcamento central, destinando-se a cave a aparcamentos.",
        reserva: true, valor_reserva: 2500, reserva_ate_data: "2026-10-14", destino_sinal: "agencia", iban_sinal: "PT50003500000000000000001", conta_sinal_banco: "Banco Exemplo",
        comissao_modalidade: "no ato da escritura", comissao_valor: 11070,
      },
      partes: [
        pessoa("vendedor", "Ana Novais", { estado_civil: "casada", regime_bens: "comunhão de adquiridos", email: "ana@exemplo.pt" }),
        pessoa("vendedor", "Rui Novais", { estado_civil: "casado", regime_bens: "comunhão de adquiridos", email: "rui@exemplo.pt", documento_numero: "99999999 1 ZZ2" }),
        pessoa("vendedor", "Berta Lobos", { estado_civil: "casada", regime_bens: "separação de bens", email: "berta@exemplo.pt" }),
        pessoa("vendedor", "Tomás Lobos", { estado_civil: "casado", regime_bens: "separação de bens", email: "tomas@exemplo.pt" }),
        pessoa("comprador", "Pedro Pinto", { estado_civil: "Divorciado", email: "pedro@exemplo.pt", morada: "Rua A, 1, 4700-001 BRAGA" }),
        pessoa("comprador", "Sofia Viúva Reis", { estado_civil: "Viúva" }),
      ],
      hip: [
        { entidade_credora: "Caixa Geral de Depósitos, S.A.", natureza: "voluntária", numero_apresentacao: "AP. 2696", data_registo: "2025-10-02" },
        { entidade_credora: "decorrente do mútuo garantido pela hipoteca voluntária objeto da AP. 2696 de 02-10-2025", natureza: "Ónus de Inalienabilidade", numero_apresentacao: "AP. 2698", data_registo: null },
      ],
      espera: [
        "ana@exemplo.pt e rui@exemplo.pt, respetivamente", "berta@exemplo.pt e tomas@exemplo.pt, respetivamente", "com o email: pedro@exemplo.pt",
        "uma hipoteca voluntária registada a favor da Caixa Geral de Depósitos, S.A., através da AP. 2696 de 02-10-2025, incidindo ainda um ónus de inalienabilidade decorrente do mútuo",
        "através da AP. 2698, cujo cancelamento terá de ser assegurado pelos primeiros outorgantes",
        // Dois casais vendedores: letras A) e B); dois compradores sozinhos: "1 - " e "2 - ".
        "A) ANA NOVAIS", "B) BERTA LOBOS", "1 - PEDRO PINTO", "2 - SOFIA VIÚVA REIS",
        "isenção n.º ISE-998877", "Rua Álvaro Aurélio do Céu Oliveira, n.ºs 312, 356 e Rua Samuel Gramacho", "do prédio urbano, composto por dois edifícios",
        "Conservatória do Registo Predial de Guimarães", "C.P. 4700-001",
        // Reserva: primeira parte do sinal, já entregue, e o resto como reforço na data do contrato.
        "No dia 14 de outubro do corrente ano, os segundos outorgantes entregaram, a título de sinal e princípio de pagamento, a quantia de 2.500,00",
        "Na presente data, os segundos outorgantes terão de entregar, a título de reforço de sinal e sempre por conta do pagamento do preço, a quantia de 19.700,00",
        "nomeiam a Agência House Culture, Lda, para ficar como fiel depositária", "nos termos do artigo 18.º da Lei n.º 15/2013", "para a conta dos primeiros outorgantes",
        "ou através dos emails convencionados, com pelo menos 15 (quinze) dias",
        "distrate/protocolo APB para o cancelamento da referida hipoteca e o custo a esta associado", "Guimarães, 20 de outubro de 2026",
      ],
      naoEspera: ["divorciado, maior", "viúva, maior", "Divorciado", "CERTIFICADO DE DESEMPENHO ENERGÉTICO N", "ambos maiores", "bem como o cancelamento do referido ónus", "A título de reserva", "convencionados ("],
      negrito: ["ANA NOVAIS", "TOMÁS LOBOS", "PEDRO PINTO", "ISE-998877", "222.000,00", "5678", "1234", "45/2001", "15 de dezembro de 2026"],
    },
    // Casais ligados à mão (campo "casal"), com a ordem das partes a misturar os dois casais e regimes
    // iguais (o que enganaria a deteção automática).
    {
      nome: "14-casais-ligados",
      proc: base,
      partes: [
        pessoa("vendedor", "Ana Novais", { estado_civil: "casada", regime_bens: "comunhão de adquiridos", casal: 1 }),
        pessoa("vendedor", "Berta Lobos", { estado_civil: "casada", regime_bens: "comunhão de adquiridos", casal: 2 }),
        pessoa("vendedor", "Rui Novais", { estado_civil: "casado", regime_bens: "comunhão de adquiridos", casal: 1 }),
        pessoa("vendedor", "Tomás Lobos", { estado_civil: "casado", regime_bens: "comunhão de adquiridos", casal: 2 }),
        C(),
      ],
      espera: ["A) ANA NOVAIS, NIF 123 456 789, e marido, RUI NOVAIS", "B) BERTA LOBOS, NIF 123 456 789, e marido, TOMÁS LOBOS"],
    },
    // Cenários 16-18: a estrutura dos três contratos finais da solicitadora (31/10/2026), com dados fictícios.
    // 16: um vendedor, uma compradora (feminino), fração com hipoteca, reserva + reforço, avaliação, licença em texto.
    {
      nome: "16-final-compradora",
      proc: {
        ...base, imovel_e_fracao_autonoma: true, imovel_fracao_letra: "F", imovel_andar_fracao: "bloco B, rés-do-chão, lado esquerdo-traseiras", imovel_finalidade: "habitação",
        imovel_condominio: true, imovel_morada: "Rua Fontes Exemplo, n.ºs 1 e 3", imovel_codigo_postal: "4760-337", imovel_localidade: "VILA NOVA DE FAMALICÃO",
        imovel_freguesia: "UNIÃO DAS FREGUESIAS DE VILA NOVA DE FAMALICÃO E CALENDÁRIO", imovel_concelho: "VILA NOVA DE FAMALICÃO",
        imovel_conservatoria: "Vila Nova de Famalicão", imovel_descricao_predial: "526/19910122",
        imovel_licenca_utilizacao: "resposta à comunicação prévia para utilização após operação urbanística, emitida pela Câmara Municipal de Vila Nova de Famalicão",
        preco_total: 215000, valor_sinal: 25000, reserva: true, valor_reserva: 2500, reserva_ate_data: "2026-10-12",
        destino_sinal: "agencia", iban_sinal: "PT50000000000000000000001", conta_sinal_banco: "Novo Banco", comissao_modalidade: "integral_escritura", comissao_valor: 6000,
        metodo_pagamento: "financiamento", condicionado_avaliacao: true, valor_avaliacao_minimo: 215000, avaliacao_prazo_data: "2026-10-30", avaliacao_contacto_email: "agencia@exemplo.pt",
        tem_bens_moveis: true, incluidos_no_imovel: "cozinha mobiliada e equipada com placa, forno, exaustor, frigorífico e micro-ondas", prazo_escritura: "2026-12-31",
      },
      partes: [
        pessoa("vendedor", "Paulo Exemplo Lima", { estado_civil: "Solteiro", email: "paulo@exemplo.pt", morada: "Rua Fontes Exemplo, n.º nº 3, R/C Traseiro, 4760-337, freguesia de Calendário, concelho de Vila Nova de Famalicão" }),
        pessoa("comprador", "Cláudia Exemplo Saraiva", { estado_civil: "Divorciada", email: "claudia@exemplo.pt", morada: "Rua Eng. Exemplo, n.º 113, 4730-762, freguesia de Vila Verde, concelho de Vila Verde" }),
      ],
      hip: [{ entidade_credora: "CAIXA GERAL DE DEPÓSITOS, S.A.", natureza: "Hipoteca Voluntária", numero_apresentacao: "Ap. 555", data_registo: "2025-11-06" }],
      espera: [
        "SEGUNDA OUTORGANTE – PROMITENTE COMPRADORA:", "A SEGUNDA OUTORGANTE:", "n.º 3, R/C Traseiro, C.P. 4760-337", "com o email: claudia@exemplo.pt",
        "designada pela letra “F”, bloco B, rés-do-chão, lado esquerdo-traseiras, destinado a habitação",
        "sito em Rua Fontes Exemplo, n.ºs 1 e 3, da União das Freguesias de Vila Nova de Famalicão e Calendário, concelho de Vila Nova de Famalicão, descrito na Conservatória do Registo Predial de Vila Nova de Famalicão sob o n.º 526, inscrito",
        "com a resposta à comunicação prévia para utilização após operação urbanística, emitida pela Câmara Municipal de Vila Nova de Famalicão, com o certificado",
        "incide uma hipoteca voluntária registada a favor da Caixa Geral de Depósitos, S.A., através da AP. 555 de 06-11-2025",
        "No dia 12 de outubro do corrente ano, a segunda outorgante entregou", "a título de reforço de sinal", "22.500,00",
        "até ao resultado da avaliação relativa ao financiamento que a segunda outorgante está a recorrer", "em caso de avaliação positiva, o valor entregue, ao primeiro outorgante",
        "devendo esta avisar o primeiro outorgante", "à segunda outorgante, esta sujeita-se", "aos promitentes compradores, a quantia total", "Condomínio", "FEITO EM DOIS EXEMPLARES",
        "Vila Nova de Famalicão, 20 de outubro de 2026",
      ],
      naoEspera: ["n.º nº", "/19910122", "Ap. 555", "CAIXA GERAL", "licença de utilização n.º resposta", "ao promitente comprador,", "o segundo outorgante", "deduzida"],
      negrito: ["PAULO EXEMPLO LIMA", "CLÁUDIA EXEMPLO SARAIVA", "215.000,00", "526", "1234", "31 de dezembro de 2026"],
    },
    // 17: dois vendedores divorciados (pagamento a cada um), casal comprador, sem financiamento, 8 dias de aviso.
    {
      nome: "17-final-dois-vendedores",
      proc: {
        ...base, imovel_situado_em: "Lugar da Exemplar, atual Rua do Forno, n.º 10", imovel_composicao: "casa de cave e rés-do-chão", imovel_freguesia: "TURIZ", imovel_concelho: "VILA VERDE",
        imovel_conservatoria: "Conservatória do Registo Predial de VILA VERDE", imovel_licenca_entidade_emissora: "Câmara Municipal de VILA VERDE",
        preco_total: 575000, valor_sinal: 57500, reserva: true, valor_reserva: 2500, reserva_ate_data: "2026-10-14",
        destino_sinal: "agencia", iban_sinal: "PT50000000000000000000001", conta_sinal_banco: "Novo Banco", comissao_modalidade: "integral_escritura", comissao_valor: 15000,
        escritura_aviso_dias: 8, prazo_escritura: "2026-12-19",
      },
      partes: [
        pessoa("vendedor", "Regina Exemplo Lopes", { estado_civil: "Divorciada", email: "regina@exemplo.pt", morada: "Rua Exemplo V, n.º 276, 4730-068, freguesia de Exemplar, concelho de Vila Verde" }),
        pessoa("vendedor", "António Exemplo Novais", { estado_civil: "Divorciado", email: "antonio@exemplo.pt" }),
        pessoa("comprador", "Antónia Exemplo Pinto", { estado_civil: "Casada", regime_bens: "adquiridos", email: "pinto@exemplo.pt", casal: 1 }),
        pessoa("comprador", "Augusto Exemplo Pinto", { estado_civil: "Casado", regime_bens: "adquiridos", documento_numero: "08343981 1ZZ1", casal: 1 }),
      ],
      espera: [
        "1 - REGINA EXEMPLO LOPES", "2 - ANTÓNIO EXEMPLO NOVAIS", "Rua Exemplo V, n.º 276, C.P. 4730-068", "SEGUNDOS OUTORGANTES – PROMITENTES COMPRADORES:",
        "casados sob o regime de adquiridos, titulares, respetivamente, dos cartões de cidadão n.º", "e do cartão de cidadão n.º 08343981 1ZZ1",
        "do prédio urbano, composto por casa de cave e rés-do-chão, sito em Lugar da Exemplar, atual Rua do Forno, n.º 10, da freguesia de Turiz, concelho de Vila Verde",
        "descrito na Conservatória do Registo Predial de Vila Verde sob o n.º", "pela Câmara Municipal de Vila Verde",
        "Os segundos outorgantes nomeiam a Agência House Culture, Lda, para ficar como fiel depositária, nos termos do artigo 18.º da Lei n.º 15/2013",
        "na proporção de metade, para a conta de cada um dos primeiros outorgantes, depois de deduzido o valor da comissão devida",
        "através de dois cheques bancários, um cheque para cada um dos primeiros outorgantes", "55.000,00",
        "com antecedência mínima de 8 (oito) dias", "com pelo menos 8 (oito) dias de antecedência", "FEITO EM TRÊS EXEMPLARES", "Vila Verde, 20 de outubro de 2026",
      ],
      naoEspera: ["ambos maiores", "VILA VERDE,", "Avaliação Bancária", "1) "],
    },
    // 18: casal vendedor e casal comprador no estrangeiro, financiamento sem avaliação, duas hipotecas e um ónus,
    // mobília com valor em inventário anexo e outra agência no negócio.
    {
      nome: "18-final-casais-financiamento",
      proc: {
        ...base, imovel_morada: "RUA DE S. EXEMPLO, n.º 18", imovel_codigo_postal: "4700-019", imovel_localidade: "PALMEIRA", imovel_freguesia: "PALMEIRA", imovel_concelho: "BRAGA",
        imovel_composicao: "casa de r/c e andar, com logradouro", imovel_conservatoria: "1ª Conservatória do Registo Predial de Braga", imovel_descricao_predial: "2698",
        imovel_licenca_entidade_emissora: "Câmara Municipal de BRAGA", preco_total: 565000, valor_mobilia: 25000, valor_sinal: 56500,
        destino_sinal: "agencia", iban_sinal: "PT50000000000000000000001", conta_sinal_banco: "Novo Banco", comissao_modalidade: "integral_escritura", comissao_valor: 15000,
        metodo_pagamento: "financiamento", condicionado_financiamento: true, avaliacao_prazo_data: "2026-10-30", avaliacao_contacto_email: "agencia@exemplo.pt",
        reforcos_sinal: [{ valor: 56500, data: null }], tem_bens_moveis: true,
        incluidos_no_imovel: "com os móveis integrados no inventário anexo ao presente contrato e que dele faz parte integrante",
        agencia_parceira_nome: "Mediadora Exemplo, Lda", agencia_parceira_ami: "99999",
      },
      partes: [
        pessoa("vendedor", "Luísa Exemplo Veloso", { estado_civil: "Casada", regime_bens: "comunhão de adquiridos", casal: 1 }),
        pessoa("vendedor", "Hugo Exemplo Mlauzi", { estado_civil: "Casado", regime_bens: "comunhão de adquiridos", email: "hugo@exemplo.pt", casal: 1 }),
        pessoa("comprador", "Sónia Exemplo Amorim", { estado_civil: "Casada", regime_bens: "comunhão de adquiridos", morada: "Rue de Exemple 4, 1530 Cidade, Suíça", casal: 1 }),
        pessoa("comprador", "João Exemplo Silva", { estado_civil: "Casado", regime_bens: "comunhão de adquiridos", morada: "Rue de Exemple 4, 1530 Cidade, Suíça", email: "joao@exemplo.pt", casal: 1 }),
      ],
      hip: [
        { entidade_credora: "Caixa Geral de Depósitos, S.A.", natureza: "voluntária", numero_apresentacao: "AP. 2696", data_registo: "2025-10-02" },
        { entidade_credora: "Caixa Geral de Depósitos, S.A.", natureza: "voluntária", numero_apresentacao: "AP. 2697", data_registo: "2025-10-02" },
        { entidade_credora: "decorrente do mútuo garantido pela hipoteca voluntária objeto da AP. 2696 de 2025/10/02", natureza: "Ónus de Inalienabilidade", numero_apresentacao: "AP. 2698", data_registo: null },
      ],
      espera: [
        "PRIMEIROS OUTORGANTES – PROMITENTES VENDEDORES:", "residentes em Rue de Exemple 4, 1530 Cidade, Suíça, com o email: joao@exemplo.pt",
        "do prédio urbano, composto por casa de r/c e andar, com logradouro, sito em Rua de S. Exemplo, n.º 18, da freguesia de Palmeira, concelho de Braga",
        "descrito na 1ª Conservatória do Registo Predial de Braga sob o n.º 2698",
        "incidem duas hipotecas voluntárias, ambas registadas a favor da Caixa Geral de Depósitos, S.A., através da AP. 2696 de 02-10-2025 e da AP. 2697 de 02-10-2025, incidindo ainda um ónus de inalienabilidade",
        "correspondendo a quantia de 540.000,00", "ao recheio integrado no prédio urbano, conforme cláusula quinta e anexo do presente contrato de promessa",
        "até resposta da aprovação do financiamento", "condicionado à aprovação do referido financiamento", "se o referido financiamento foi aprovado",
        "Que o imóvel é vendido com os móveis integrados no inventário anexo", "distrate/protocolo APB para o cancelamento das referidas hipotecas",
        "titular da licença AMI 21596 e pela agência Mediadora Exemplo, Lda, titular da licença AMI 99999", "PÁGINAS E ANEXO", "FEITO EM DOIS EXEMPLARES", "Braga, 20 de outubro de 2026",
      ],
      naoEspera: ["com com", "4700-019", "Palmeira, composto", "RUA DE S", "BRAGA,", "A) LUÍSA", "A) SÓNIA", "1 - LUÍSA"],
    },
    // Compradores estrangeiros: passaporte e título de residência (nunca "emitido pela República Portuguesa").
    {
      nome: "15-documentos-estrangeiros",
      proc: base,
      partes: [
        V(),
        pessoa("comprador", "John Michael Smith", { nacionalidade: "britânica", documento_tipo: "Passaporte", documento_numero: "123456789", morada: "Rua das Flores, 5, 4700-001 Braga" }),
        pessoa("comprador", "Olga Petrova", { nacionalidade: "ucraniana", documento_tipo: "Título de Residência", documento_numero: "PT-998877" }),
      ],
      espera: ["titular do passaporte n.º 123456789", "titular do título de residência n.º PT-998877"],
      naoEspera: ["passaporte n.º 123456789, válido até 31-01-2030, emitido pela República Portuguesa"],
    },
    { nome: "13-certificado-em-execucao", proc: { ...base, imovel_certificado_estado: "em_execucao", imovel_certificado_energetico: null, imovel_certificado_validade: null, imovel_certificado_classe: null }, partes: [V(), C()], espera: ["em execução, a entregar ao segundo outorgante e a quem realize a escritura"], naoEspera: ["classe energética"] },
    { nome: "11-valores-grandes", proc: { ...base, preco_total: 1250000.5, valor_sinal: 125000.05 }, partes: [V(), C()], espera: ["1.250.000,50", "125.000,05"] },
  ];

  const bad = /undefined|\bnull\b|\[object|NaN|\{\{|\}\}|\[\]/;

  let falhas = 0;
  for (const c of cen) {
    const probs: string[] = [];
    let paginas = 0;
    try {
      const r = await gerarPdfCpcv(c.proc, c.partes, c.hip ?? []);
      paginas = r.paginas;
      const docx = await gerarDocxCpcv(c.proc, c.partes, c.hip ?? [], r.paginas);
      const pdfF = path.join(OUT, c.nome + ".pdf"), docxF = path.join(OUT, c.nome + ".docx");
      fs.writeFileSync(pdfF, r.pdf); fs.writeFileSync(docxF, docx);

      const pdfTxt = spawnSync("pdftotext", ["-enc", "UTF-8", pdfF, "-"], { encoding: "utf8" }).stdout;
      const zip = await JSZip.loadAsync(docx);
      const xml = await zip.file("word/document.xml")!.async("string");
      const dxTxt = xml.replace(/<\/w:p>/g, "\n").replace(/<w:tab\/>/g, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
      fs.writeFileSync(path.join(OUT, c.nome + ".pdf.txt"), pdfTxt); fs.writeFileSync(path.join(OUT, c.nome + ".docx.txt"), dxTxt);

      for (const [lab, t] of [["PDF", pdfTxt], ["Word", dxTxt]] as const) {
        const m = t.match(bad); if (m) probs.push(`${lab} contem "${m[0]}"`);
        if (t.includes("\u2014")) probs.push(`${lab} contem travessao`);
        if (/\uFFFD/.test(t)) probs.push(`${lab} tem caracteres partidos`);
        const sl = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
        for (const e of c.espera) if (!sl(t).includes(sl(e))) probs.push(`${lab} sem "${e}"`);
        for (const e of (c as any).info ?? []) if (!sl(t).includes(sl(e))) console.log(`      i ${c.nome}: ${lab} nao mostra "${e}"`);
        for (const e of c.naoEspera ?? []) if (t.includes(e)) probs.push(`${lab} nao devia ter "${e}"`);
      }
      // Negrito (Word): cada texto esperado tem de estar num run a negrito; e o extenso do preco nao.
      if (c.negrito) {
        const negritos = [...xml.matchAll(/<w:r>(?:(?!<\/w:r>)[\s\S])*?<w:b\/>(?:(?!<\/w:r>)[\s\S])*?<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
        for (const e of c.negrito) if (!negritos.some((t) => t.includes(e))) probs.push(`Word sem negrito em "${e}"`);
        if (negritos.some((t) => /Duzentos e Vinte/i.test(t) && !/^(CL|OUTORG)/.test(t))) probs.push("Word tem o extenso do preço a negrito");
      }
      // PDF: as marcas de negrito nao podem ter ficado no texto.
      if (/[\uE000\uE001]/.test(pdfTxt) || /[\uE000\uE001]/.test(dxTxt)) probs.push("marcas de negrito soltas no texto");
      // Compara só letras e números: o pdftotext parte hífenes no fim de linha, o que daria falsos positivos.
      const sl2 = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      const a = sl2(pdfTxt.replace(/Página \d+ de \d+/g, "")), b = sl2(dxTxt);
      if (a !== b) { let i = 0; while (i < a.length && a[i] === b[i]) i++; probs.push(`PDF e Word diferem na posicao ${i}: pdf="${a.slice(i, i + 30)}" word="${b.slice(i, i + 30)}"`); }
      // Leitor final (regras; IA só com LER_IA=1 e só no cenário 12): nada de "alta" nos cenários completos.
      const leitura = await lerContrato(docx, c.proc, c.partes, c.hip ?? [], { ia: lerComIA && c.nome.startsWith("12") });
      fs.writeFileSync(path.join(OUT, c.nome + ".leitura.json"), JSON.stringify(leitura, null, 2));
      // 06 (sem vendedor) e 09 (sem IBAN) têm campos em branco de propósito.
      const emBrancoDePropósito = c.nome.startsWith("06") || c.nome.startsWith("09");
      for (const pr of leitura.problemas.filter((x) => x.gravidade === "alta" && !(emBrancoDePropósito && /em branco/.test(x.problema)))) probs.push(`leitor [${pr.origem}] ${pr.onde}: ${pr.problema}`);
      const clausulas = (pdfTxt.match(/CL[ÁA]USULA/gi) ?? []).length;
      console.log(`${probs.length ? "FALHA" : "OK   "} ${c.nome}  paginas=${paginas} clausulas(PDF)=${clausulas}`);
    } catch (e: any) {
      probs.push("erro: " + String(e?.message ?? e).split("\n")[0]);
      console.log(`FALHA ${c.nome}`);
    }
    probs.forEach((p) => console.log("      - " + p));
    if (probs.length) falhas++;
  }
  console.log(`\n${cen.length - falhas}/${cen.length} cenarios sem problemas. Ficheiros em ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
