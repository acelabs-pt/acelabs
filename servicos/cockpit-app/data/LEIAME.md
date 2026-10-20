# localizacoes.json

Distritos, concelhos e freguesias de Portugal (29 "distritos" - as ilhas dos Açores e da Madeira
aparecem como tal na fonte -, 308 concelhos, 3259 freguesias).

- Fonte: Aldeias Portuguesas, dataset v2026.2 (`core.csv`), https://aldeiasportuguesas.pt/dados/
  Republica a CAOP 2025 da DGT. Licença indicada pela fonte: CC BY-SA 4.0 (atribuição obrigatória).
  Confirmar com o Miguel/Pedro se a licença é compatível com a venda da app antes de a entregar a clientes.
- Verificação cruzada: Lisboa (24 freguesias) e Guimarães (55) coincidem com a geoapi.pt.
- Inclui 302 freguesias marcadas "restauradas" (reposição de freguesias de 2025).
- Formato: { "Distrito": { "Concelho": ["Freguesia", ...] } }, ordenado alfabeticamente.
- Para atualizar: voltar a descarregar `core.csv` e regenerar o JSON (agrupar por distrito/concelho).
