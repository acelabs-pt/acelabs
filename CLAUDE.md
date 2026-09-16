# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Ace Labs - contexto do projeto

Empresa de serviços de IA para pequenos empresários (sócios: Miguel e Pedro Roque), foco de
arranque no setor imobiliário. Nome da empresa: **Ace Labs** (não usar "IGNITE", nome antigo,
descontinuado). Domínio: **acelabs.pt** (o `.com` e o `.ai` já estão ocupados por terceiros, não
tentar registar).

- Modelo: projetos à medida (consultoria + automação), não SaaS.
- Segmentos em teste: agências imobiliárias e investidores/gestores de património.
- Aquisição: outbound frio.

## Estrutura da pasta

- `site/` - site público, deployado no Vercel. `index.html` tem de se chamar sempre `index.html`
  (já aconteceu um upload manual pelo GitHub web UI deixar o ficheiro como `index (15).html` e
  partir o site - evitar uploads pela interface web do GitHub, usar sempre git normal).
- `docs/` - plano de negócio, briefing, pacote de serviços (html/pdf/md).
- `docs/piloto-alvorada/` - proposta, app demo e powerpoint de um piloto para um cliente
  hipotético ("Alvorada Imóveis"), usado como material de vendas de exemplo.
- `painel-gestao-base/` - esqueleto Next.js/Supabase reutilizável para o produto "Painel de
  Gestão" (ver preçário abaixo), extraído de um painel real construído para um cliente do setor
  imobiliário. Sem nomes, marca ou dados desse cliente - só a arquitetura e os padrões, com o
  contexto explicado no README.md dentro da pasta.
- `business-center/` - pasta local, no `.gitignore`, não deve ir para o GitHub (repositório
  público).

## Arquitetura

Não há build step nem package.json - é um site estático puro. `site/index.html` é um único
ficheiro auto-contido (HTML + CSS inline em `<style>` + JS inline), sem dependências externas
para além de Google Fonts. Deploy no Vercel serve o ficheiro diretamente; não há comando de
build/lint/test a correr, só editar o HTML e verificar no browser (ou com o MCP do Playwright,
já configurado em `.mcp.json`, para screenshots/navegação automatizados).

Deploy: projeto Vercel "ace-labs", com Root Directory definido como `site`, ligado ao domínio
acelabs.pt. Push para `main` despoleta deploy automático em produção.

Os ficheiros HTML em `docs/` (briefing, pacote-servicos, arranque-operacional,
catalogo-imobiliario) e em `docs/piloto-alvorada/` seguem o mesmo padrão de ficheiro único
auto-contido, e a mesma identidade visual descrita abaixo. As versões `.pdf` são exports desses
HTML, gerados manualmente (não há script de geração no repo) - ao editar um `.html` aqui,
assinalar ao utilizador que o `.pdf` correspondente ficou desatualizado.

`site/.vercel/` guarda credenciais de deployment (token) e está corretamente no `.gitignore` -
nunca remover essa entrada nem commitar esse diretório.

## Conteúdo do site

Secção "Como trabalhamos": Diagnóstico Estratégico -> Mapeamento de Oportunidades -> Desenho da
Solução -> Implementação -> Acompanhamento de Arranque (4 semanas).

## Fluxo de git

Repositório principal (org): **github.com/acelabs-pt/acelabs** (mudou de
github.com/pedroroque98/acelabs a 13/09/2026; o antigo fica acessível como remote
`pedro-pessoal` na cópia do Pedro, mas deixa de receber pushes novos).

Este repositório é partilhado entre o Pedro e o Miguel, cada um com o seu próprio Claude Code
a apontar para a sua cópia local. Antes de mexer: `git pull`. Não há edição em tempo real, é
sincronização assíncrona.

Commit e push apenas com confirmação explícita do utilizador antes de cada execução (push para
`main` despoleta deploy automático em produção, ver secção Arquitetura).

## Preçário oficial (não inventar outros valores)

- Diagnóstico (1 semana, pago, creditado no build): 900-1.500 EUR
- Lead Engine (build): 3.500-5.500 EUR + 400-700 EUR/mes
- Painel de Gestão: 4.500-8.000 EUR + 500-900 EUR/mes
- Compliance Pack: 5.000-9.000 EUR + 600-1.200 EUR/mes
- Bundle Lead Engine + Painel: 7.500-11.000 EUR + 900-1.400 EUR/mes
- Automação de Processos: 3.000-7.000 EUR + 300-600 EUR/mes
- Formação & Estratégia AI: 1.200-4.000 EUR + 400-800 EUR/mes
- Garantia: reembolso se insatisfeito ao fim de 12 meses

## Estilo

- Nunca usar travessão (—) em textos escritos para este projeto (documentos, copy do site,
  propostas); usar hífen (-) no lugar. Isto aplica-se mesmo a ficheiros que outra pessoa tenha
  escrito, sinalizar em vez de reescrever sem avisar.
- Português de Portugal, com acentos e cedilhas corretos sempre (não escrever "nao", "acao",
  "imoveis", etc. sem acento). Reler o texto final à procura de acentos em falta antes de dar
  como terminado, já aconteceu um documento inteiro sair sem nenhum acento.

## Identidade visual (extraída de site/index.html, a fonte da verdade)

- Cores: fundo claro #ffffff / #f5f5f7, bege quente #EDEBE5, tinta #1d1d1f, texto secundário
  #6e6e73, azul de marca #0071e3 (escuro #0059b3), secções escuras #0a1620, verde #1fae5a,
  âmbar #ff9f0a (par suave: fundo #fff4e5, texto #9a5b00).
- Tipografia: Inter (sans, corpo e títulos) + Source Serif 4 (serifada, usada no logo "Ace Labs·"
  e em títulos de destaque).
- Qualquer novo documento/página desta marca deve usar estas cores e fontes, não inventar outras.

## Backend / dados

Supabase está a ser adotado como base de dados/backend do projeto (ainda em configuração,
setembro 2026). Quando existir schema definido, documentar aqui as tabelas principais.

## Regras de resposta (Claude Code)

- Responder sempre em português de Portugal.
- Respostas diretas e concisas.
</content>
