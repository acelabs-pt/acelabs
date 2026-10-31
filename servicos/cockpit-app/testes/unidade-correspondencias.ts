import { corresponde, zonaCobre } from "../lib/oportunidades";
const imo = { tipo_imovel: "Apartamento", tipologia: "T3", distrito: "Braga", concelho: "Guimarães", freguesia: "Azurém", valor: 200000 };
const c = { tipo_imovel: "Apartamento", tipologia_minima: "T2", expectativa_valor: 190000 };
const casos: [string, boolean, boolean][] = [
  ["distrito todo", corresponde(c, [{ distrito: "Braga", concelho: null, freguesia: null }], imo), true],
  ["concelho certo", corresponde(c, [{ distrito: "Braga", concelho: "Guimarães", freguesia: null }], imo), true],
  ["freguesia errada", corresponde(c, [{ distrito: "Braga", concelho: "Guimarães", freguesia: "Creixomil" }], imo), false],
  ["varias zonas, a 2a serve", corresponde(c, [{ distrito: "Porto", concelho: null, freguesia: null }, { distrito: "Braga", concelho: "Guimarães", freguesia: null }], imo), true],
  ["sem zonas", corresponde(c, [], imo), false],
  ["tipo diferente", corresponde({ ...c, tipo_imovel: "Moradia" }, [{ distrito: "Braga", concelho: null, freguesia: null }], imo), false],
  ["tipologia abaixo do minimo", corresponde({ ...c, tipologia_minima: "T4" }, [{ distrito: "Braga", concelho: null, freguesia: null }], imo), false],
  ["preco ate +10% (200k vs 190k)", corresponde(c, [{ distrito: "Braga", concelho: null, freguesia: null }], imo), true],
  ["preco acima de +10% (215k vs 190k)", corresponde(c, [{ distrito: "Braga", concelho: null, freguesia: null }], { ...imo, valor: 215000 }), false],
  ["dados em falta nao excluem", corresponde({ tipo_imovel: null, tipologia_minima: null, expectativa_valor: null }, [{ distrito: "Braga", concelho: null, freguesia: null }], imo), true],
  ["imovel sem distrito", zonaCobre({ distrito: "Braga", concelho: null, freguesia: null }, { ...imo, distrito: null }), false],
];
let mal = 0;
for (const [nome, obtido, esperado] of casos) { const ok = obtido === esperado; if (!ok) mal++; console.log(ok ? "OK  " : "FALHA", nome); }
console.log(mal ? `${mal} falhas` : "todos ok");
