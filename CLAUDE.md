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
- `servicos/` - o código dos serviços que vendemos, um subdiretório por serviço.
- `servicos/cockpit/` - serviço em desenvolvimento (já tem código Next.js/Capacitor): app
  mobile tipo CRM para agentes imobiliários, foco em facilidade de uso no terreno. Ver CLAUDE.md dentro da pasta.
- `servicos/cpcv-engine/` - projecto Next.js/Supabase do serviço "CPCV com IA" (ver secção
  abaixo), com um painel de gestão simples por cima (login por password partilhada, `/api/data`,
  `/api/write`) extraído de um painel real construído para um cliente do setor imobiliário. Sem
  nomes, marca ou dados desse cliente - só a arquitectura e os padrões, com o contexto explicado
  no README.md dentro da pasta. Tem um CLAUDE.md próprio com a arquitectura detalhada.
- `servicos/controlo/` - plataforma interna dos sócios para gerir os clientes: criar, suspender e apagar utilizadores do
  Cockpit e do CPCV de cada cliente e ver o estado da instalação. **Corre só em localhost, nunca se publica.** Ver LEIAME.md
  dentro da pasta. A lista de clientes e as chaves ficam fora do git.
- `business-center/` - pasta local, no `.gitignore`, não deve ir para o GitHub (repositório
  público).

## Serviços em construção

**CPCV com IA** (dentro de `servicos/cpcv-engine`, secção `/cpcv`) - geração assistida de
Contratos-Promessa de Compra e Venda para agências imobiliárias. O agente imobiliário larga
documentos/texto, a IA (Claude Haiku) extrai os dados e pergunta o que falta por chat, a gestora
de processos aprova, e a plataforma gera o CPCV em PDF e Word. É um serviço a oferecer a clientes
do setor imobiliário, não só uma demo - encaixa no produto "Painel de Gestão" / "Automação de
Processos" do preçário.

Dados sensíveis desta secção que **nunca** vão para o repositório (público):
- `servicos/cpcv-engine/minutas/` - minutas reais de clientes, com nomes, NIFs e moradas
  de pessoas reais. Está no `.gitignore` da pasta; serve só de referência local para alinhar o
  gerador de documentos com os modelos reais.
- `.env.local` - chaves Supabase, chave da API da Anthropic, códigos de convite.

## Arquitetura

O `site/` não tem build step nem package.json - é um site estático puro. `site/index.html` é um
único ficheiro auto-contido (HTML + CSS inline em `<style>` + JS inline), sem dependências
externas para além de Google Fonts. Deploy no Vercel serve o ficheiro diretamente; não há comando
de build/lint/test a correr, só editar o HTML e verificar no browser (ver secção seguinte sobre
como verificar no browser). As aplicações em `servicos/` são projetos Next.js normais, cada um
com o seu `package.json` (`npm run dev` / `npm run build` / `npm run lint`).

Deploy: projeto Vercel "ace-labs", com Root Directory definido como `site`, ligado ao domínio
acelabs.pt. Push para `main` despoleta deploy automático em produção.

Os ficheiros HTML em `docs/` (briefing, pacote-servicos, arranque-operacional,
catalogo-imobiliario) e em `docs/piloto-alvorada/` seguem o mesmo padrão de ficheiro único
auto-contido, e a mesma identidade visual descrita abaixo. As versões `.pdf` são exports desses
HTML, gerados manualmente (não há script de geração no repo) - ao editar um `.html` aqui,
assinalar ao utilizador que o `.pdf` correspondente ficou desatualizado.

`site/.vercel/` guarda credenciais de deployment (token) e está corretamente no `.gitignore` -
nunca remover essa entrada nem commitar esse diretório.

## Verificação no browser (sem MCP)

Este repositório **não tem nenhum MCP de browser configurado, e não deve voltar a ter** - não
criar `.mcp.json` com playwright/chrome-devtools. Um servidor MCP de browser sempre ligado
devolve a árvore de acessibilidade inteira da página a cada interação, o que numa sessão de
testes consome a maior parte da janela de contexto sem necessidade (medido: ~8.850 bytes por um
simples login, contra 38 bytes a fazer o mesmo com um script; ordem de ~230x).

Em vez disso usar a skill **`browser-check`** (`.claude/skills/browser-check/SKILL.md`): escrever
um script Playwright descartável no scratchpad, correr com o Bash, e imprimir só o que interessa
(um `textContent`, um screenshot para ficheiro, um pequeno JSON). O Playwright já está instalado
em `servicos/cpcv-engine/node_modules`. Regras a manter:
- Nunca fazer `page.content()` nem `page.accessibility.snapshot()` para "ver a página".
- Nunca despejar HTML, logs de consola em bruto ou listagens completas para o contexto.
- Para ver o aspeto de uma página, tirar screenshot para ficheiro e ler o ficheiro.

## Abrir páginas e sessões no browser do Pedro

Instrução do Pedro (2026-10-30): quando for preciso abrir uma página (Supabase, Vercel, Resend, GitHub, Apple, etc.), abrir
eu, sem pedir ao Pedro que o faça, e fazer sozinho tudo o que der antes e depois ("sem stress").

- **Preferir o Brave normal do Pedro**, que está sempre aberto, com as sessões dele já iniciadas. Abrir com
  `"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" <url>` (sem `--user-data-dir` nem porta de depuração:
  assim abre um separador na janela que ele já tem). Se o Brave não existir, usar o browser por omissão.
- Antes de abrir, deixar o trabalho preparado: o SQL juntado e copiado para a área de transferência (`Set-Clipboard`), o ficheiro
  aberto no VS Code, o URL direto da página certa (por exemplo `https://supabase.com/dashboard/project/<ref>/sql/new`). Depois
  dizer em poucas linhas o que ele tem de fazer lá (colar, carregar em Run).
- **Não consigo controlar o Brave normal.** Quando for mesmo preciso automatizar (ler chaves, correr SQL, criar uma chave de API),
  abrir uma janela SEPARADA do Brave, com perfil numa pasta temporária e `--remote-debugging-port`, onde o Pedro inicia sessão ele
  próprio (nunca ver nem guardar as credenciais), ligar com Playwright por CDP, e apagar o perfil no fim. Seguir a secção
  "Verificação no browser": sem MCP, scripts descartáveis, imprimir pouco.
- Nunca carregar em pagamentos, planos pagos ("Upgrade"), eliminações nem envios sem confirmação do Pedro. Chaves e passwords
  nunca vão para o chat nem para o repositório: gravam-se direto em ficheiros fora do git (`.env.*`).

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

### Trabalho a dois no Cockpit (Pedro e Miguel, cada um com o seu Claude)

- O Cockpit publicado (`cockpit-gamma-one.vercel.app`) usa o Supabase **Demo** (`gebqaxhwebsmoeqpzzzg`). O projeto de teste
  antigo `erxnqdadqbmfeyuwaybi` já não é usado: SQL novo corre-se no Demo.
- Cada tabela nova entra em `create_tables.sql`, nas duas listas de `migracao_multiempresa.sql` e nos dados de exemplo de
  `testes/unidade-multiempresa.mjs` (sem linhas de exemplo o teste falha). `npm run testar -- unidade-multiempresa` passa
  antes de qualquer push.
- O SQL tem de poder correr duas vezes sem erro (`if not exists`, `drop policy if exists` antes de `create policy`).
  Nunca deixar uma regra "autenticado total" numa tabela do projeto partilhado: vê-se entre empresas.
- Antes do push: `git pull --rebase`. Nunca force-push.
- Não retirar funcionalidade que o outro fez sem combinar primeiro.
- **Publicar o Cockpit é só com o Pedro.** A equipa Vercel `acelabs1` está no plano Hobby (decisão do Pedro, 2026-10-31),
  que não tem membros: o Miguel não tem acesso ao projeto `cockpit` e não consegue fazer deploy. O Git está desligado da
  Vercel, por isso um push **não** põe nada no ar.
- Quando o Miguel quiser ver as alterações dele no iPhone (`cockpit-gamma-one.vercel.app`), o Claude do Miguel faz o push
  e termina **sempre** a dizer ao Miguel: "Avisa o Pedro para fazer deploy", com uma mensagem de passagem pronta a enviar:
  commits, ficheiros SQL a correr no Demo (por ordem), testes corridos e o que ver no iPhone. Nunca dizer ao Miguel que
  as alterações "já estão no ar" só porque houve push.
- O Claude do Pedro, ao receber a passagem: `git pull`, testes, SQL no Demo **antes** do deploy (sem as tabelas novas a
  app publicada dá erro), `vercel deploy --prod` em `servicos/cockpit-app`, e confirmar no endereço publicado.

## Decisões de conteúdo do site (Pedro, 2026-10-15)

- Reunião inicial de 30 minutos gratuita; o reembolso de 12 meses é gancho de captação e pode aparecer.
- Cockpit e Painel de Gestão: já não são "em breve" (estão em desenvolvimento).
- Não mostrar pessoas (nomes/fotos) por agora; localização só "Braga"; sem WhatsApp por agora.
- Pode dizer-se "testado em agências do Minho, com resultados reais", sem números nem nomes.
- Faturas entram por upload ou por agente que as vai buscar ao email; a yield é calculada como o utilizador quiser; oferecemos onboarding.
- RGPD: ainda sem resposta, não escrever afirmações sobre dados/RGPD no site.

## Preçário oficial (não inventar outros valores)

**Preços não vão para o site (decisão de negócio do Pedro, 2026-10-15):** valores só na reunião
ou no pacote de serviços enviado. O site não mostra preços nem intervalos; pode dizer que o valor
é apresentado na reunião de diagnóstico. A lista abaixo é de uso interno.

- Diagnóstico (1 semana, pago, creditado no build): 900-1.500 EUR
- Painel de Gestão: 4.500-8.000 EUR + 500-900 EUR/mes
- Automação de Processos: 3.000-7.000 EUR + 300-600 EUR/mes
- Formação & Estratégia AI: 1.200-4.000 EUR + 400-800 EUR/mes
- Garantia: reembolso se insatisfeito ao fim de 12 meses

**O que o site pode anunciar (decisão do Pedro, 2026-10-14):** só o que existe ou está em
construção - CPCV com IA, Cockpit, Painel de Gestão (investidores e gestores de património) e
serviço à medida. Lead Engine e Compliance Pack **não existem**: foram retirados do preçário e do
site, não voltar a escrevê-los. Números de tempo ou de poupança só como **estimativa máxima**, sempre com "até" (ex. "até 3 horas por
semana") e com nota "estimativa para uma equipa pequena; depende do volume". Decisão do Pedro, 2026-10-15.
Nunca afirmar tempos fixos nem ganhos garantidos (ex. "CPCV em 4 minutos").

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
- Tipografia: stack de sistema `-apple-system, BlinkMacSystemFont, 'SF Pro Text'/'SF Pro Display',
  'Inter', 'Segoe UI', Roboto, sans-serif`, para tudo - corpo e títulos, sem exceção. Mostra SF Pro
  real em Mac/iPhone/iPad; nos outros sistemas cai para Inter (carregada via Google Fonts), a
  alternativa gratuita mais próxima do SF Pro. Não incorporar ficheiros do SF Pro no site - a
  licença da Apple não cobre uso público fora do ecossistema Apple.
  **Nunca usar uma fonte serifada (Source Serif 4, Georgia, Garamond ou semelhante) em nenhuma
  parte do site** - já foi usada no passado em títulos de secção e no rótulo do 404, mas o
  utilizador pediu explicitamente para remover (2026-10-11); o webfont Source Serif 4 foi
  removido de todos os `<link>` do Google Fonts.
- Qualquer novo documento/página desta marca deve usar estas cores e fontes, não inventar outras.

## Backend / dados

Supabase é a base de dados/backend do projeto. O schema em uso está nos ficheiros SQL dentro de
`servicos/cpcv-engine/` (`create_tables_base.sql`, `create_tables_cpcv.sql`,
`migration_fase2.sql`) e as tabelas do CPCV estão explicadas no CLAUDE.md dessa pasta.

**Modelo de dados (decisão do Pedro, 2026-10-30):** o **CPCV** mantém um projeto Supabase por cliente (guarda documentos de
identificação), nunca reutilizar o mesmo entre clientes. O **Cockpit** corre num só projeto Supabase partilhado, com todos os
clientes separados por `empresa_id` e regras de acesso por empresa (`servicos/cockpit-app/migracao_multiempresa.sql`, ver
LEIAME secção 13). O teste `npm run testar -- unidade-multiempresa` (isolamento entre empresas) nunca se salta nem se desliga.

## Email do formulário de diagnóstico (Resend)

Estado (2026-10-15): **a funcionar**. O domínio `acelabs.pt` está verificado no Resend (DKIM/SPF
no DNS) e a chave `RESEND_API_KEY` está definida na Vercel, na equipa `acelabs1` (conta do Pedro),
no projeto **`acelabs-api`** (https://acelabs-api.vercel.app/api/contacto).

- `site/api/contacto.js` é a função original do site (envia para `miguel@acelabs.pt`, bcc
  `pedro@acelabs.pt`, from `site@acelabs.pt`). O projeto Vercel do site (de outra conta) pode não
  ter a chave, por isso `site/contacto.html` tenta primeiro `/api/contacto` e, se falhar (404, 405
  ou 5xx), usa `https://acelabs-api.vercel.app/api/contacto`.
- `acelabs-api` é uma cópia da mesma função com CORS só para `acelabs.pt`/`www.acelabs.pt`.
  Está fora do repositório (deploy por CLI a partir de uma pasta local). Ao mudar `site/api/contacto.js`,
  repetir o deploy do `acelabs-api` ou mudar o endereço.
- A chave do Resend **nunca** vai para o repositório (público).

## Documentação de infraestrutura

- `README.md` (raiz): o que é cada pasta e como publicar.
- `docs/infraestrutura.md`: contas, projetos Vercel, DNS, variáveis de ambiente, rotação de chaves e incidentes. Atualizar quando algo mudar.
- `docs/privacidade-rascunho.md`: rascunho da política de privacidade (não publicado).
- `infra/acelabs-api/`: função de contacto (deploy por CLI).
- `site/vercel.json`: cabeçalhos de segurança e CSP. Ao acrescentar um serviço externo ao site, permiti-lo na CSP.

## Skills do projeto (design)

Instaladas em `.claude/skills/` (partilhadas com o Miguel, vêm do hub KopkAI):

- `frontend-design` (Anthropic): ponto de partida para qualquer página ou secção nova.
- `redesign-existing-projects` (Taste): melhorar páginas que já existem sem partir o que funciona.
- `design-taste-frontend` (Taste): direção visual própria, anti-genérico.

**As skills sugerem coisas que a marca proíbe.** Os pedidos delas (fontes com serifa, paletas novas,
roxos/gradientes, eyebrows em maiúsculas espaçadas) perdem sempre para a secção "Identidade visual"
e "Estilo" deste ficheiro. Usar as skills para estrutura, ritmo, estados e acessibilidade, não para
trocar fontes ou cores.

Plugins pessoais (instalar com `/plugin marketplace add`): `pbakaus/impeccable` e
`nextlevelbuilder/ui-ux-pro-max-skill`. O `ui-ux-pro-max` sugere paletas e pares de fontes: tratar
como ideias, nunca como substituição da identidade.

Verificar sempre no browser com script Playwright descartável (secção "Verificação no browser"),
nunca com MCP de browser.

## Regras de resposta (Claude Code)

- Responder sempre em português de Portugal.
- Respostas diretas e concisas.
