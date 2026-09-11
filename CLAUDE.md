# Ace Labs - contexto do projeto

Empresa de automacao/IA para PMEs (Pedro + Miguel), foco de arranque no setor imobiliario.
Nome da empresa: **Ace Labs** (nao usar "IGNITE", nome antigo, descontinuado). Dominio: **acelabs.pt**
(o `.com` e o `.ai` ja estao ocupados por terceiros, nao tentar registar).

## Estrutura da pasta

- `site/` - site publico, deployado no Vercel. `index.html` tem de se chamar sempre `index.html`
  (ja aconteceu um upload manual pelo GitHub web UI deixar o ficheiro como `index (15).html` e
  partir o site - evitar uploads pela interface web do GitHub, usar sempre git normal).
- `docs/` - plano de negocio, briefing, pacote de servicos (html/pdf/md).
- `docs/piloto-alvorada/` - proposta, app demo e powerpoint de um piloto para um cliente
  hipotetico ("Alvorada Imoveis"), usado como material de vendas de exemplo.

## Fluxo de git

Este repositorio e partilhado entre o Pedro e o Miguel, cada um com o seu proprio Claude Code
a apontar para a sua copia local. Antes de mexer: `git pull`. Depois de terminar: `git add -A
&& git commit -m "..." && git push`. Nao ha edicao em tempo real, e sincronizacao assincrona.

## Preçario oficial (nao inventar outros valores)

- Diagnostico (1 semana, pago, creditado no build): 900-1.500 EUR
- Lead Engine (build): 3.500-5.500 EUR + 400-700 EUR/mes
- Painel de Gestao: 4.500-8.000 EUR + 500-900 EUR/mes
- Compliance Pack: 5.000-9.000 EUR + 600-1.200 EUR/mes
- Bundle Lead Engine + Painel: 7.500-11.000 EUR + 900-1.400 EUR/mes
- Automacao de Processos: 3.000-7.000 EUR + 300-600 EUR/mes
- Formacao & Estrategia AI: 1.200-4.000 EUR + 400-800 EUR/mes
- Garantia: reembolso se insatisfeito ao fim de 12 meses

## Estilo

- Nunca usar travessao (-) em textos escritos para este projeto (documentos, copy do site,
  propostas); usar hifen (-) no lugar. Isto aplica-se mesmo a ficheiros que outra pessoa tenha
  escrito, sinalizar em vez de reescrever sem avisar.
- Portugues de Portugal, com acentos e cedilhas corretos sempre (nao escrever "nao", "acao",
  "imoveis", etc. sem acento). Reler o texto final a procura de acentos em falta antes de dar
  como terminado, ja aconteceu um documento inteiro sair sem nenhum acento.

## Identidade visual (extraida de site/index.html, a fonte da verdade)

- Cores: fundo claro #ffffff / #f5f5f7, bege quente #EDEBE5, tinta #1d1d1f, texto secundario
  #6e6e73, azul de marca #0071e3 (escuro #0059b3), seccoes escuras #0a1620, verde #1fae5a,
  ambar #ff9f0a (par suave: fundo #fff4e5, texto #9a5b00).
- Tipografia: Inter (sans, corpo e titulos) + Source Serif 4 (serifada, usada no logo "Ace Labs·"
  e em titulos de destaque).
- Qualquer novo documento/pagina desta marca deve usar estas cores e fontes, nao inventar outras.

## Backend / dados

Supabase esta a ser adotado como base de dados/backend do projeto (ainda em configuracao,
setembro 2026). Quando existir schema definido, documentar aqui as tabelas principais.
