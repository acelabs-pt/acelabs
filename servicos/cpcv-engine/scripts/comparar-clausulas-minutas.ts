// Compara o texto das cláusulas "boilerplate" geradas pela app contra o texto canónico
// documentado em minutas/_extraido/analise-boilerplate.md (extraído das 15 minutas reais),
// e imprime as cláusulas dinâmicas de alguns processos-fixture para leitura lado a lado.
// Não há framework de testes no projecto (ver CLAUDE.md) - este script é standalone,
// corrido manualmente (`npm run verificar:clausulas`), não faz parte do build.

import {
  clausulaProtecaoDados,
  clausulaAlteracoes,
  clausulaNotificacoes,
  clausulaEncargosDespesas,
  clausulaLeiAplicavelForo,
  clausulaReconhecimentoAssinaturas,
  clausulaPreviaAnalise,
  clausulaDireitoPreferencia,
  clausulaIntervencaoImobiliaria,
} from "../lib/cpcv-clausulas";
import { gerarHtmlCpcv } from "../lib/cpcv-template";
import type { Parte, Processo } from "../lib/cpcv-types";

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos para a comparação ser tolerante a OCR/typos
    .replace(/\s+/g, " ")
    .trim();
}

// Texto canónico copiado de minutas/_extraido/analise-boilerplate.md (síntese das 15 minutas
// reais). Cláusulas com "Variação: Nenhuma" no documento - comparação estrita faz sentido.
// Direito de Preferência e Intervenção Imobiliária têm variação documentada, por isso
// comparam-se aqui só contra o padrão principal (13/15 e "sempre", respectivamente).
const CANONICO: Record<string, string[]> = {
  "Proteção de Dados": [
    "Os dados pessoais, recolhidos no presente documento destinam-se ao cumprimento do dever de identificação previsto na Lei nº83/2017, de 18 de agosto e Lei nº58/2019 de 08 de agosto e no Regulamento 276/2019, de 26 de Março e serão processados informaticamente e conservados pelo período de 7 anos.",
    "As partes, enquanto titulares dos dados, têm o direito de aceder a todos os seus dados e o direito de exigir a sua limitação, retificação, oposição ou apagamento nos limites legalmente impostos.",
    "As partes declaram para os devidos efeitos, sob o compromisso de honra:",
    "a. Que são verdadeiros os elementos indicados, e",
    "b. Que autorizam a reprodução dos documentos de identificação bem como qualquer outro documento necessário à concretização do negócio, em suporte físico e/ou eletrónico.",
  ],
  "Alterações": [
    "Eventuais alterações, anulações, aditamentos ou acordos de revogação do presente contrato só serão válidos se forem efetuados por escrito e assinados por todos os outorgantes, sendo nulos e ineficazes e sem qualquer validade jurídica acordos verbais.",
  ],
  "Notificações": [
    "Todas as notificações que venham a ser necessárias fazer na vigência do presente contrato, serão feitas para as moradas supra indicadas e em caso de alteração, devem ser comunicadas por escrito, através de carta registada com aviso de receção, à contraparte, no prazo máximo de 5 dias contados da data em que ocorrer a respetiva alteração.",
    "O envio de carta registada com aviso de receção para a morada das partes será prova bastante para demonstrar que se efetuou qualquer notificação, ou seja se realizou a interpelação daquela para a realização da escritura definitiva de compra e venda, sendo este o caso.",
  ],
  "Lei Aplicável e Foro Competente": [
    "Para a resolução de qualquer litígio eventualmente decorrente do presente contrato, e que as partes não consigam resolver por mútuo acordo, fica desde já convencionado, com a exclusão de qualquer outro, que é competente o foro da comarca do imóvel.",
    "O presente contrato promessa é exclusivamente regulado pela legislação portuguesa em vigor, nomeadamente pelo Código Civil.",
  ],
  "Reconhecimento de Assinaturas": [
    "Os outorgantes acordam em prescindir livre e mutuamente das formalidades exigidas pelo artigo 410.º, nº 3 do Código Civil, abdicando assim do reconhecimento presencial das respetivas assinaturas, renunciando expressamente a invocar a nulidade deste contrato pela omissão de tais requisitos para todos os efeitos legais, tendo sido informados pela Mediadora Imobiliária das consequências inerentes.",
  ],
  "Prévia Análise": [
    "As cláusulas que integram o presente Contrato Promessa de Compra e Venda de imóveis resultaram de um modelo prévio e atempadamente apresentado e discutido entre as partes, a quem foi dada a possibilidade de alterar, adaptar ou de qualquer forma influenciar a sua redação final.",
  ],
  // As minutas reais escrevem "promitente vendedora"/"promitentes compradores" (género/número
  // fixo por documento), mas o gerador usa deliberadamente os placeholders genéricos
  // PRIMEIRO(S)/SEGUNDO(S) OUTORGANTE(S) (mesma convenção usada em todo o resto do documento,
  // incluindo a definição destes termos na identificação das partes) para não precisar de lógica
  // de concordância de género/número - por isso o canónico abaixo já reflecte essa adaptação
  // intencional, não o texto literal de uma minuta específica.
  "Direito de Preferência": [
    "Considerando que diversas entidades públicas são titulares de direito de preferência na aquisição do Imóvel objeto deste contrato, fica acordado pelos outorgantes que, caso o referido direito seja exercido, o presente contrato cessa automaticamente os seus efeitos, obrigando-se o(s) PRIMEIRO(S) OUTORGANTE(S) a devolver, no prazo máximo de 8 (oito) dias contados da data da comunicação ou ofício da entidade respetiva, ao(s) SEGUNDO(S) OUTORGANTE(S), a quantia total entregue a título de sinal, não havendo lugar a qualquer outra indemnização ou compensação.",
    "Sendo o caso disso, compete ao(s) PRIMEIRO(S) OUTORGANTE(S) a instrução do anúncio destinado à comunicação das condições da presente promessa às entidades preferentes através do site www.casapronta.mj.pt.",
  ],
  "Intervenção Imobiliária": [
    "O presente negócio teve intervenção imobiliária levada a cabo pela {{AGENCIA_NOME}}, titular da licença AMI {{AGENCIA_AMI}}.",
    "As partes declaram expressamente que foram informadas da obrigação de utilização de meio de pagamento específico por se tratar de transação de montante igual ou superior a 3.000,00€ (Três Mil Euros), para residentes em Portugal ou 10.000,00€ (Dez Mil Euros), para não residentes, conforme estipulado na Lei nº 92/2017 de 22/08/2017.",
  ],
  // Não estava em analise-boilerplate.md (cláusula acabada de adicionar ao gerador) - texto
  // canónico adaptado de minutas/_extraido/*.txt (parágrafo 2, o único 100% idêntico entre as
  // 15 variantes a menos do género/número dos outorgantes) para os placeholders OUTORGANTE(S)
  // já usados no resto do documento; o parágrafo 1 varia na lista de documentos consoante o
  // processo, por isso não entra na comparação estrita.
  "Encargos e Despesas (parágrafo 2)": [
    "São por conta do(s) SEGUNDO(S) OUTORGANTE(S) todos os encargos notariais, registais e fiscais inerentes à qualidade de adquirente(s).",
  ],
};

function comparar(nome: string, gerado: string[], esperado: string[]): boolean {
  const g = gerado.map(normalizar).join(" | ");
  const e = esperado.map(normalizar).join(" | ");
  const ok = g === e || g.includes(e) || e.includes(g);
  console.log(`${ok ? "PASS" : "DIVERGE"}  ${nome}`);
  if (!ok) {
    console.log(`  gerado:   ${g}`);
    console.log(`  esperado: ${e}`);
  }
  return ok;
}

console.log("=== Cláusulas boilerplate: gerador vs. minutas reais ===\n");

let falhas = 0;
falhas += comparar("Proteção de Dados", clausulaProtecaoDados(), CANONICO["Proteção de Dados"]) ? 0 : 1;
falhas += comparar("Alterações", clausulaAlteracoes(), CANONICO["Alterações"]) ? 0 : 1;
falhas += comparar("Notificações", clausulaNotificacoes(), CANONICO["Notificações"]) ? 0 : 1;
falhas += comparar(
  "Lei Aplicável e Foro Competente",
  clausulaLeiAplicavelForo(),
  CANONICO["Lei Aplicável e Foro Competente"]
)
  ? 0
  : 1;
falhas += comparar(
  "Reconhecimento de Assinaturas",
  clausulaReconhecimentoAssinaturas(),
  CANONICO["Reconhecimento de Assinaturas"]
)
  ? 0
  : 1;
falhas += comparar("Prévia Análise", clausulaPreviaAnalise(), CANONICO["Prévia Análise"]) ? 0 : 1;
falhas += comparar("Direito de Preferência", clausulaDireitoPreferencia(), CANONICO["Direito de Preferência"])
  ? 0
  : 1;
// Intervenção Imobiliária tem placeholders {{AGENCIA_NOME}}/{{AGENCIA_AMI}} no canónico -
// substituir pelos valores de ambiente (ou pelo fallback "____________" do gerador) antes de
// comparar, senão diverge sempre por causa do nome da agência.
const agenciaNome = process.env.CPCV_AGENCIA_NOME || "____________";
const agenciaAmi = process.env.CPCV_AGENCIA_AMI || "____________";
const intervencaoEsperada = CANONICO["Intervenção Imobiliária"].map((p) =>
  p.replace("{{AGENCIA_NOME}}", agenciaNome).replace("{{AGENCIA_AMI}}", agenciaAmi)
);
falhas += comparar("Intervenção Imobiliária", clausulaIntervencaoImobiliaria(), intervencaoEsperada) ? 0 : 1;

// Cláusula nova - só o parágrafo 2 é canónico entre as 15 minutas, o parágrafo 1 varia.
const encargos = clausulaEncargosDespesas();
falhas += comparar("Encargos e Despesas (parágrafo 2)", [encargos[1]], CANONICO["Encargos e Despesas (parágrafo 2)"])
  ? 0
  : 1;

console.log(`\n${falhas === 0 ? "Todas as cláusulas boilerplate coincidem." : `${falhas} cláusula(s) divergente(s).`}\n`);

console.log("=== Cláusulas dinâmicas: gerar 3 processos-fixture para leitura lado a lado ===\n");

const parteBase: Parte = {
  papel: "vendedor",
  tipo_pessoa: "singular",
  nome: "João Manuel Silva",
  estado_civil: "solteiro",
  regime_bens: null,
  nacionalidade: "portuguesa",
  naturalidade: "Lisboa",
  nif: "123456789",
  morada: "Rua das Flores, n.º 10, 1000-001 Lisboa",
  documento_tipo: "Cartão de Cidadão",
  documento_numero: "12345678 9ZZ0",
  documento_validade: "2030-01-01",
};

const processoBase: Processo = {
  imovel_morada: "Rua das Flores, n.º 10",
  imovel_freguesia: "Alvalade",
  imovel_concelho: "Lisboa",
  imovel_distrito: "Lisboa",
  imovel_tipologia: "T3",
  imovel_artigo_matricial: "1234",
  imovel_descricao_predial: "5678",
  imovel_certificado_energetico: "B",
  imovel_licenca_utilizacao: "L-9876",
  imovel_area: 120,
  imovel_anexos: null,
  imovel_estado: "bom estado de conservação",
  imovel_condominio: false,
  preco_total: 250000,
  valor_sinal: 25000,
  forma_pagamento_sinal: null,
  prazo_pagamento_sinal: null,
  prazo_escritura: "2026-12-31",
  condicoes_suspensivas: null,
  penalizacao_incumprimento: null,
  metodo_pagamento: "capital_proprio",
  tem_fracoes_multiplas: false,
  valor_fracao_principal: null,
  valor_fracao_secundaria: null,
  valor_mobilia: null,
  reforco_sinal: null,
  iban_sinal: null,
  reserva: false,
  valor_reserva: null,
  condicionado_avaliacao: false,
  valor_avaliacao_minimo: null,
  avaliacao_prazo_data: null,
  avaliacao_contacto_email: null,
  condicionado_financiamento: false,
  condicionado_outra_situacao: null,
  dias_condicionamento: null,
  dias_condicionamento_tipo: null,
  comodato: false,
  tempo_comodato: null,
  incluidos_no_imovel: null,
  email_proprietario_contrato: null,
  email_comprador_contrato: null,
  data_assinatura_contrato: null,
  observacoes_adicionais: null,
};

const compradorBase: Parte = {
  ...parteBase,
  papel: "comprador",
  nome: "Maria Ana Costa",
  estado_civil: "solteira",
};

type Fixture = { nome: string; processo: Processo; partes: Parte[] };

const fixtures: Fixture[] = [
  {
    nome: "1. Solteiro a vender a solteira (caso simples)",
    processo: processoBase,
    partes: [
      { ...parteBase, papel: "vendedor" },
      { ...compradorBase, papel: "comprador" },
    ],
  },
  {
    nome: "2. Empresa a vender a casal, com financiamento e avaliação bancária",
    processo: {
      ...processoBase,
      condicionado_financiamento: true,
      condicionado_avaliacao: true,
      valor_avaliacao_minimo: 250000,
      avaliacao_prazo_data: "2026-03-01",
      avaliacao_contacto_email: "gestora@agencia.pt",
    },
    partes: [
      {
        ...parteBase,
        papel: "vendedor",
        tipo_pessoa: "coletiva",
        nome: "Imobiliária Exemplo, Lda",
        nif: "500123456",
        morada: "Av. da República, n.º 1, Lisboa",
        certidao_permanente: "1234-5678-9012",
        representante_nome: "Carlos Mendes",
        representante_cargo: "gerente",
      },
      { ...compradorBase, papel: "comprador", nome: "Pedro Alves", regime_bens: "comunhão de adquiridos" },
      {
        ...compradorBase,
        papel: "comprador",
        nome: "Rita Alves",
        regime_bens: "comunhão de adquiridos",
        estado_civil: "casada",
      },
    ],
  },
  {
    nome: "3. Herdeiros a vender, com comodato e condomínio",
    processo: {
      ...processoBase,
      imovel_condominio: true,
      comodato: true,
      tempo_comodato: "3 meses após a escritura",
      observacoes_adicionais: "Imóvel arrendado até à data da escritura, com contrato a cessar nessa data.",
    },
    partes: [
      { ...parteBase, papel: "vendedor", nome: "Herdeiro Um" },
      { ...parteBase, papel: "vendedor", nome: "Herdeiro Dois", estado_civil: "casado" },
      { ...compradorBase, papel: "comprador" },
    ],
  },
];

for (const f of fixtures) {
  console.log(`\n--- ${f.nome} ---`);
  const html = gerarHtmlCpcv(f.processo, f.partes);
  const semTags = html
    .replace(/<style>[\s\S]*?<\/style>/, "")
    .replace(/<[^>]+>/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
  console.log(semTags);
}

console.log(
  "\nLeitura lado a lado feita acima - comparar manualmente contra minutas/_extraido/*.txt para os casos equivalentes."
);

process.exit(falhas === 0 ? 0 : 1);
