# Testes do Cockpit

Testes automáticos que abrem a app num browser (Playwright), fazem o que um agente faria e confirmam o resultado
na base de dados. Correm contra o servidor local e o Supabase **de teste**. Criam utilizadores e dados temporários
(marcados `claude-teste-` e `ZZ`) e apagam-nos no fim.

## Correr

1. Arrancar a app: `npx next dev -p 3001`
2. Ter um `.env.testes` nesta pasta do Cockpit (não vai para o Git):

   ```
   SUPABASE_SERVICE_ROLE_KEY=<chave de administrador do projeto de TESTE>
   TESTES_PERMITIDOS_EM=<referência do projeto de teste, ex.: erxnqdadqbmfeyuwaybi>
   ```

3. `npm run testar` (todos) ou `npm run testar -- pesquisa funis` (só alguns).

**Proteção:** os testes recusam correr se o `.env.local` apontar para outro projeto que não o de
`TESTES_PERMITIDOS_EM`. Escrevem dados: nunca os apontar à base de um cliente.

## O que cada um verifica

| Ficheiro | Verifica |
| --- | --- |
| `unidade-importacao.ts` | Números em formato português, telemóveis, datas, tipologias, zonas, CSV |
| `unidade-correspondencias.ts` | A regra que decide se um imóvel serve a um comprador |
| `unidade-ics.ts` | Ficheiro de calendário: horas, dia inteiro em Lisboa, mudança de hora, alarmes, linhas longas |
| `conta.js` | Login, link de recuperação, escolher password, sair, mudar password |
| `dashboard.js` | Esqueleto ao carregar, frase-resumo, primeiros passos, desfazer ao marcar e ao adiar |
| `gestos.js` | Deslizar tarefas (feita, adiar), mudar de dia, botão +, fechar folhas |
| `gestos-crm.js` | Deslizar entre Compradores e Proprietários |
| `pesquisa.js` | Pesquisa por nome, zona e telefone; filtros atrás do botão |
| `chamadas.js` | Registo de chamadas, último contacto, ordenar, ligar por swipe regista |
| `proximos-comprador.js` | Ficha do comprador: marcar visita a um imóvel enviado e tarefa, feita com desfazer, aparece no calendário |
| `funis.js` | Taxas de passagem e origens batem com a base; tocar numa fase filtra a lista |
| `calendario.js` | Vistas de mês, semana e lista de tarefas |
| `calendario-telemovel.js` | "Pôr no calendário do telemóvel": .ics com alarme e telefone, sem nomes no endereço, fechado sem sessão |
| `exportar.js` | Exportar os dados de um contacto bate com a base |
| `exportar-tudo.js` | CSV da Conta batem com a base e voltam a entrar no importador sem erros; cópia completa sem cortes |
| `semrede.js` | Lista do dia guardada para a página sem rede, com ligar; não mostra outro dia; sair apaga |
| `whatsapp.js` | Enviar um imóvel ao comprador a partir de um alerta |
| `importar.js` | Importar CSV e Excel, com erros, duplicados, planos e alertas |
| `documentos.js` | Lista habitual de documentos da escritura |
| `acessibilidade.js` | Regras WCAG A e AA (axe) em 14 páginas |
| `publicado.js` | O endereço publicado (só a pedido: `BASE=https://... npm run testar -- publicado`) |

## Outras ferramentas

- `escala/semear.js`, `escala/medir.js`, `escala/limpar.js`: põem 1000 compradores, 1000 proprietários e
  1000 angariações com plano (cerca de 120 mil linhas), medem os tempos e apagam tudo. Correr sempre o `limpar` no fim.
- `ferramentas/screenshots.js`: screenshots de todas as páginas (largura em `W`, ex.: `W=1280`).
- `ferramentas/iphone-webkit.js`: percorre as 11 páginas num iPhone 14 com o motor do Safari (WebKit), vê erros, páginas que deslizam de lado e campos com menos de 16px (o Safari faz zoom). Usar com a versão compilada (`NEXT_DIST_DIR=.next-build npx next build` e `next start -p 3001`), não com `next dev`.
- `ferramentas/relatorio-pdf.js`: gera o PDF do relatório de uma angariação, como o proprietário o recebe.

Para correr estas, exportar as variáveis do `.env.local` e do `.env.testes` e `SP=testes/resultados`.
