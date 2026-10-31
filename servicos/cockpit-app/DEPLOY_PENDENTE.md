# Passagem do Miguel para o Pedro: Cockpit por publicar (31/10/2026, 2.ª entrega)

> **Estado: publicado a 31/10/2026 pelo Pedro** (commit 401f9c4; TypeScript e lint limpos, isolamento entre empresas com 164
> verificações a passar). Confirmado no endereço publicado, em tamanho de iPhone: Dashboard com os dois discos e os três indicadores,
> data "31 de outubro", sem deslizar de lado; `/crm` com os dois cartões; ficha do comprador com Próximos passos, Funil e Imóveis por
> esta ordem e "Chamadas anteriores" com seta (também no proprietário); `.relevo` só no Dashboard. Nenhum erro da base de dados.

Só o Pedro faz o deploy: `git pull`, `npm install`, `npx tsc --noEmit`, `npx next lint`, `node testes/unidade-multiempresa.mjs`,
`vercel deploy --prod` em `servicos/cockpit-app`, e confirmar no endereço publicado (tamanho de iPhone).

## O que mudou (tudo no Dashboard e no CRM)
- **Dashboard, novo estilo "relevo definido"** (classe `.relevo`, em `app/globals.css`, só no Dashboard): cartões brancos sobre fundo
  cinzento-claro, com aresta de luz em cima, linha escura por baixo, fio de brilho (azul claro nos dois cartões grandes, âmbar nos
  discos e nos três indicadores) e halo. Medido contra uma imagem de referência do Miguel. Botões finos e com sombra curta.
- **Dashboard, Metas:** Angariações e Faturação são dois discos (um por baixo do outro, à esquerda) com anel de progresso; Reuniões de
  angariação, Visitas e Transações ficam alinhadas na vertical à direita. Cartões das Metas e dos Seguimentos com a mesma largura
  (máx. 576 px, centrados) e mais espaço entre eles. O valor da faturação desce de tamanho quando é comprido.
- **Dashboard, correções:** a data aparecia "31 De Outubro" (corrigido); no telemóvel a página era mais larga que o ecrã por causa dos
  títulos longos dos seguimentos (corrigido com `min-w-0`).
- **CRM:** a entrada (`/crm`) mostra dois cartões grandes, Compradores à esquerda e Proprietários à direita, em vez de abrir a lista.
  Ficha do comprador: ordem Cabeçalho, Próximos passos, Funil, Imóveis, Chamadas...; o cartão "Próximos passos" deixou de ter o
  formulário Visita/Tarefa; as chamadas anteriores ficam atrás de uma seta (também na ficha do proprietário).
- Não alterei Supabase, tabelas, rotas de API nem a lógica de dados.

## O que ver no iPhone depois do deploy
Dashboard (discos e indicadores, botões, espaçamentos, sem deslizar de lado), `/crm` com os dois cartões, ficha de um comprador
(Funil e Imóveis logo a seguir aos Próximos passos; "Chamadas anteriores" com seta). O estilo `.relevo` não deve aparecer fora do Dashboard.

## Notas
- Para estender o estilo a outro ecrã basta acrescentar `relevo` ao contentor da página. Não foi pedido ainda.
- Dados de teste: a simulação de 3 meses (`scripts/simulacao-3-meses.ts`) só foi corrida na base antiga `erxnqdadqbmfeyuwaybi`; o utilizador de
  teste `teste.design@acelabs.pt` existe só nessa base. Não correr em bases de clientes.
