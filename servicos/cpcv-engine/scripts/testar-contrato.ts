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
        "ana@exemplo.pt e rui@exemplo.pt, respetivamente", "berta@exemplo.pt e tomas@exemplo.pt, respetivamente", "com o email pedro@exemplo.pt",
        "uma hipoteca voluntária registada a favor da Caixa Geral de Depósitos, S.A., através da AP. 2696 de 02-10-2025; e um ónus", "cujos cancelamentos terão de ser assegurados", "em partes iguais, para a conta de cada um dos primeiros outorgantes", "1) ANA NOVAIS", "2) BERTA LOBOS", "conta para o sinal acima referido",
        "um ónus de inalienabilidade registado através da AP. 2698, decorrente do mútuo",
        "isenção n.º ISE-998877", "Rua Álvaro Aurélio do Céu Oliveira", "composto por Dois edifícios",
        "Conservatória do Registo Predial de Guimarães", "A título de reserva", "2.500,00", "4700-001",
        "nomeiam a Agência House Culture, Lda, para ficar como fiel depositária", "nos termos do artigo 18.º da Lei n.º 15/2013",
        "ou através dos emails convencionados (ana@exemplo.pt, rui@exemplo.pt, berta@exemplo.pt e tomas@exemplo.pt)",
        "distrate/protocolo APB para o cancelamento da referida hipoteca", "bem como o cancelamento do referido ónus", "Guimarães, 20 de outubro de 2026",
      ],
      naoEspera: ["divorciado, maior", "viúva, maior", "Divorciado", "CERTIFICADO DE DESEMPENHO ENERGÉTICO N"],
      negrito: ["ANA NOVAIS", "TOMÁS LOBOS", "PEDRO PINTO", "ISE-998877", "222.000,00", "5678/20010101", "1234", "45/2001", "15 de dezembro de 2026"],
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
      espera: ["1) ANA NOVAIS, NIF 123 456 789, e marido, RUI NOVAIS", "2) BERTA LOBOS, NIF 123 456 789, e marido, TOMÁS LOBOS"],
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
