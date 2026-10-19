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

  type Cen = { nome: string; proc: any; partes: any[]; hip?: any[]; espera: string[]; naoEspera?: string[] };
  const cen: Cen[] = [
    { nome: "01-singulares", proc: base, partes: [V(), C()], espera: ["José Ação Mendonça", "Ana Conceição d'Ávila", "222.000,00", "Guimarães"] },
    { nome: "02-varios", proc: base, partes: [V("João Pereira"), V("Maria Pereira"), C("Rui Costa"), C("Sara Costa"), C("Tiago Costa")], espera: ["OS PRIMEIROS OUTORGANTES", "OS SEGUNDOS OUTORGANTES", "Tiago Costa"] },
    { nome: "03-coletiva", proc: base, partes: [pessoa("vendedor", "Construções Silva & Filhos, Lda.", { tipo_pessoa: "coletiva", representante_nome: "Carlos Silva", representante_cargo: "gerente", certidao_permanente: "1234-5678-9012" }), C()], espera: ["Construções Silva & Filhos, Lda.", "Carlos Silva", "1234-5678-9012"] },
    { nome: "04-regimes", proc: base, partes: [pessoa("vendedor", "Paulo Faria", { estado_civil: "casado", regime_bens: "comunhão de adquiridos" }), pessoa("vendedor", "Rita Faria", { estado_civil: "casada", regime_bens: "comunhão de adquiridos" }), pessoa("comprador", "Luís Neto", { estado_civil: "casado", regime_bens: "separação de bens" }), pessoa("comprador", "Inês Neto", { estado_civil: "casada", regime_bens: "separação de bens" })], espera: ["adquiridos", "separação de bens"] },
    { nome: "05-procurador", proc: base, partes: [pessoa("vendedor", "Manuel Rocha", { tem_procuracao: true, procurador_nome: "Fernando Dias", procurador_documento: "CC 11111111" }), C()], espera: ["Manuel Rocha"], info: ["Fernando Dias", "CC 11111111"], info: ["Fernando Dias", "CC 11111111"] },
    { nome: "06-externa", proc: { ...base, tipo_contrato: "comprador_nosso_angariacao_externa" }, partes: [C()], espera: ["Ana Conceição d'Ávila"] },
    { nome: "07-hipoteca-bens", proc: { ...base, tem_bens_moveis: true, incluidos_no_imovel: "cozinha equipada, frigorifico e maquina de lavar", imovel_condominio: true, imovel_e_fracao_autonoma: true, imovel_fracao_letra: "B", imovel_andar_fracao: "2.º andar", imovel_finalidade: "habitação" }, partes: [V(), C()], hip: [{ entidade_credora: "Banco Hipotecário SA", natureza: "hipoteca voluntária", numero_apresentacao: "Ap. 1234", data_registo: "2015-04-02" }], espera: ["Banco Hipotecário SA", "cozinha equipada", "Condomínio"] },
    { nome: "08-sinal-financiamento", proc: { ...base, metodo_pagamento: "financiamento", condicionado_financiamento: true, valor_financiamento_minimo: 150000, prazo_financiamento_dias: 60, condicionado_avaliacao: true, valor_avaliacao_minimo: 222000, avaliacao_prazo_data: "2026-11-30", avaliacao_contacto_email: "avaliacao@exemplo.pt", reforcos_sinal: [{ valor: 10000, data: "2026-11-01" }, { valor: 5000, data: "2026-12-01" }] }, partes: [V(), C()], espera: ["financiamento", "avaliacao@exemplo.pt", "10.000,00"] },
    { nome: "09-agencia-comissao", proc: { ...base, destino_sinal: "agencia", iban_sinal: null, conta_sinal_banco: null, comissao_modalidade: "no ato da escritura", comissao_valor: 11070 }, partes: [V(), C()], espera: ["Guimarães"], info: ["11.070,00"] },
    { nome: "10-nomes-estranhos", proc: base, partes: [V("Maria da Conceição Ângela Ximenes de Albuquerque e Vasconcelos Peixoto da Fonseca Ñandú"), C("João d'Ávila-O'Brien Ç")], espera: ["Albuquerque", "Ñandú", "O'Brien"] },
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
      // Compara só letras e números: o pdftotext parte hífenes no fim de linha, o que daria falsos positivos.
      const sl2 = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      const a = sl2(pdfTxt.replace(/Página \d+ de \d+/g, "")), b = sl2(dxTxt);
      if (a !== b) { let i = 0; while (i < a.length && a[i] === b[i]) i++; probs.push(`PDF e Word diferem na posicao ${i}: pdf="${a.slice(i, i + 30)}" word="${b.slice(i, i + 30)}"`); }
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
