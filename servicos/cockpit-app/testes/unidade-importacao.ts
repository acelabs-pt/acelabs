import { lerNumero, lerTelemovel, lerData, lerTipologia, resolverZona, mapearAutomatico, daLista, validar } from "../lib/importar/validar";
import { paraCsv } from "../lib/exportarTudo";
import { lerCsv } from "../lib/importar/ficheiro";

let mal = 0;
const eq = (nome: string, obtido: unknown, esperado: unknown) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) mal++;
  console.log(ok ? "OK   " : "FALHA", nome, ok ? "" : `obtido=${JSON.stringify(obtido)} esperado=${JSON.stringify(esperado)}`);
};

eq("numero 250.000,00", lerNumero("250.000,00"), 250000);
eq("numero 250 000 €", lerNumero("250 000 €"), 250000);
eq("numero 250000", lerNumero("250000"), 250000);
eq("numero 250,5", lerNumero("250,5"), 250.5);
eq("numero 1.250.000", lerNumero("1.250.000"), 1250000);
eq("numero vazio", lerNumero(""), null);
eq("numero lixo", Number.isNaN(lerNumero("abc") as number), true);
eq("tel 9 digitos", lerTelemovel("912 345 678"), "+351912345678");
eq("tel com +351", lerTelemovel("+351 912-345-678"), "+351912345678");
eq("tel 00351", lerTelemovel("00351912345678"), "+351912345678");
eq("tel 351...", lerTelemovel("351912345678"), "+351912345678");
eq("tel estrangeiro", lerTelemovel("+34 612 345 678"), "+34612345678");
eq("tel invalido", lerTelemovel("12345"), undefined);
eq("tel vazio", lerTelemovel(""), null);
eq("data dd/mm/aaaa", lerData("15/09/2026"), "2026-09-15");
eq("data aaaa-mm-dd", lerData("2026-09-05"), "2026-09-05");
eq("data serie excel", lerData("46280"), "2026-09-15");
eq("data invalida 31/02", lerData("31/02/2026"), undefined);
eq("data vazia", lerData(""), null);
eq("tipologia t2", lerTipologia("t2"), "T2");
eq("tipologia T6", lerTipologia("T6"), "T5 ou mais");
eq("tipologia T5+", lerTipologia("T5+"), "T5 ou mais");
eq("tipologia lixo", lerTipologia("quarto"), null);
eq("tipo sem acento", daLista("armazem", ["Apartamento", "Armazém"]), "Armazém");
eq("zona completa", resolverZona("braga", "guimaraes", "creixomil").zona, { distrito: "Braga", concelho: "Guimarães", freguesia: "Creixomil" });
eq("zona so concelho descobre distrito", resolverZona("", "Guimarães", "").zona, { distrito: "Braga", concelho: "Guimarães", freguesia: "" });
eq("zona concelho errado", !!resolverZona("Braga", "Porto", "").erro, true);
eq("zona freguesia sem concelho", !!resolverZona("Braga", "", "Creixomil").erro, true);
eq("mapear cabecalhos livres", mapearAutomatico("compradores", ["Cliente", "Tlm", "E-mail", "Orçamento", "Zona"]).nome, 0);
const m = mapearAutomatico("compradores", ["Cliente", "Tlm", "E-mail", "Orçamento", "Concelho"]);
eq("mapear telemovel/email/valor/concelho", [m.telemovel, m.email, m.expectativa_valor, m.concelho], [1, 2, 3, 4]);
eq("csv ponto e virgula e aspas", lerCsv('Nome;Notas\r\n"Ana; Silva";"disse ""sim"""\r\nRui;ok\r\n'), [["Nome", "Notas"], ["Ana; Silva", 'disse "sim"'], ["Rui", "ok"]]);
eq("csv virgula (Google Sheets)", lerCsv("a,b,c\n1,2,3\n"), [["a", "b", "c"], ["1", "2", "3"]]);
eq("csv com BOM e linhas vazias", lerCsv("\uFEFFa;b\n\n1;2\n"), [["a", "b"], ["1", "2"]]);
// exportar e voltar a importar: o CSV da Conta entra no importador sem erros e sem perder valores
const nenhum = { telemoveis: new Set<string>(), emails: new Set<string>(), titulos: new Set<string>() };
const ida = paraCsv("compradores", [
  { nome: "Ana; Ferreira", telemovel: "+351912345678", email: "ana@exemplo", canal_origem: "Idealista", observacoes: "disse \"talvez\"\nligar à tarde", motivacao: "7", tipo_imovel: "Apartamento", distrito: "Braga", concelho: "Guimarães", freguesia: "Creixomil", outras_zonas: "Porto/Maia | Braga", tipologia_minima: "T2", expectativa_valor: "250000.5", financiamento: "Crédito pré-aprovado", precisa_vender: "Não", referencia_imovel: "REF-1", estado: "Visitas realizadas" },
]);
const [cab, ...corpo] = lerCsv(ida);
const volta = validar("compradores", corpo, mapearAutomatico("compradores", cab), nenhum)[0];
eq("ida e volta: sem erros", volta.erros, []);
eq("ida e volta: email incompleto fica com aviso", volta.avisos.some((a) => a.includes("ana@exemplo")) && volta.contacto?.email === "ana@exemplo", true);
eq("ida e volta: nome com ; e notas com aspas e mudança de linha", [volta.contacto?.nome, volta.contacto?.observacoes], ["Ana; Ferreira", "disse \"talvez\"\nligar à tarde"]);
eq("ida e volta: valores", [volta.dados.expectativa_valor, volta.dados.estado, volta.dados.precisa_vender, volta.dados.financiamento, volta.zonas.length], [250000.5, "visitas_realizadas", false, "Crédito pré-aprovado", 3]);

console.log(mal ? `${mal} FALHAS` : "todos ok");
