# RUNBOOK-CLIENTE.md

Guia operacional interno da Ace Labs (Pedro e Miguel) para pôr o produto "CPCV com IA" a
funcionar para um cliente novo, do zero até à entrega. **Não é para o cliente final** - o
documento para agentes/gestoras é `docs/manual-cpcv-ia.html`/`.pdf` na raiz do repositório (ver
secção 6).

Este ficheiro assume que já leste `README.md` e `CLAUDE.md` desta pasta (arquitectura Next.js 14
+ Supabase, painel genérico + secção `/cpcv` com Supabase Auth e três papéis
agente/gestora/admin).

## 1. Pré-requisitos

- **Projecto Supabase novo e dedicado a este cliente.** Nunca reutilizar um projecto Supabase
  entre clientes (regra do `CLAUDE.md` da raiz do repositório) - dados de processos, documentos e
  contas de utilizadores de um cliente nunca podem estar acessíveis a partir de outro.
- **Conta Anthropic com créditos para a API do Claude.** A extracção de dados (`app/api/cpcv/extrair`,
  `app/api/cpcv/responder`) usa o modelo `claude-haiku-4-5` (`EXTRACTION_MODEL` em
  `lib/anthropic.ts`) e consome créditos por processo criado/actualizado.

## 2. Base de dados

Correr os ficheiros `.sql` da raiz de `servicos/cpcv-engine` no SQL Editor do Supabase, **por esta
ordem exacta** (confirmada na pasta em 2026-09-23):

1. `create_tables_base.sql` - tabelas de exemplo do painel genérico (`clientes`,
   `atividade_mensal`). Só é relevante se este cliente também usar o painel genérico
   (`app/page.tsx`, `app/api/data`, `app/api/write`) além do `/cpcv`. Se o cliente só contratou
   "CPCV com IA", este ficheiro pode ser ignorado - nada em `app/cpcv/**` ou `app/api/cpcv/**`
   depende destas tabelas (confirmado por busca no código).
2. `create_tables_cpcv.sql` - schema base do `/cpcv`: `profiles` (com a função auxiliar
   `is_gestora()`), `cpcv_processos`, `cpcv_partes` (vendedores/compradores), `cpcv_ficheiros`
   (documentos despejados pelo agente), `cpcv_mensagens` (conversa IA <-> agente), e o bucket
   privado de Storage para ficheiros e documentos gerados. Obrigatório.
3. `migration_fase2.sql` - fluxo real de aprovação: novos campos em `cpcv_processos`, renomeação
   dos estados (com o `check constraint` antigo largado antes do update), suporte a pessoa
   colectiva em `cpcv_partes`, e o autor "gestora" em `cpcv_mensagens`.
4. `migration_fase3.sql` - alinhamento com as minutas reais da agência: cargo do representante de
   uma pessoa colectiva em `cpcv_partes`, mecanismo de avaliação bancária (prazo + email de
   contacto) e sinalização de imóvel em condomínio constituído em `cpcv_processos`.
5. `migration_fase4.sql` - fecho do processo depois de aprovado: estados terminais "concluido"
   (só a partir de "aprovado") e "cancelado" (a partir de qualquer estado não terminal).
6. `migration_fase5.sql` - cópia automática no Google Drive: guarda o link da pasta onde o
   PDF/Word ficam também guardados quando a gestora aprova e gera o CPCV. Só é útil se as
   variáveis `GOOGLE_*` (secção 4) forem preenchidas.
7. `migration_fase6.sql` - papel "admin" (acesso total + gestão de utilizadores e convites),
   função `is_admin()`, alargamento das policies de RLS que hoje só cobriam a gestora, coluna de
   quem aprovou/gerou cada CPCV, e a tabela `cpcv_convites` (convites dinâmicos de
   agente/gestora, substituem os antigos códigos fixos `CPCV_INVITE_AGENTE`/
   `CPCV_INVITE_GESTORA`). Obrigatório - sem isto não existe papel admin nem convites dinâmicos.

Todas as migrações a partir da `fase2` são aditivas sobre o schema anterior, por isso têm de
correr pela ordem numérica acima - não saltar nenhuma nem correr fora de ordem.

## 3. Deploy

**Lacuna a esclarecer antes de usar este runbook a sério:** nem o `README.md` nem o `CLAUDE.md`
desta pasta, nem o `CLAUDE.md` da raiz do repositório, dizem explicitamente como se faz o deploy
do `cpcv-engine` em produção para um cliente. O `CLAUDE.md` da raiz só descreve o deploy do
`site/` (projecto Vercel "ace-labs", Root Directory `site`, domínio acelabs.pt, push para `main`
despoleta deploy automático) - não há equivalente documentado para `cpcv-engine`. O único indício
no código é `lib/cpcv-browser.ts`, que verifica `process.env.VERCEL` para decidir usar o Chromium
leve em produção, o que confirma que a plataforma alvo é a Vercel, mas não diz se cada cliente
tem o seu próprio projecto Vercel separado (mais provável, dado que cada cliente já tem o seu
próprio projecto Supabase) ou se há um único projecto Vercel multi-tenant. Decidir isto com o
Pedro antes do primeiro deploy real a um cliente e depois actualizar esta secção.

Passos assumidos até essa decisão (a confirmar):
- Criar um novo projecto Vercel dedicado a este cliente, Root Directory `servicos/cpcv-engine`.
- Ligar o repositório `github.com/acelabs-pt/acelabs` (mono-repo partilhado com o `site/`).
- Preencher as variáveis de ambiente da secção 4 nas definições do projecto Vercel (nunca no
  código nem no repositório).
- Correr `npm run build` localmente antes do primeiro deploy, para apanhar erros de tipo (não há
  testes automatizados - `npm run build`, que corre `tsc` em modo estrito, é a única validação).

## 4. Variáveis de ambiente

Lista a partir de `.env.example` (ler o ficheiro real antes de preencher, não confiar de memória):

- `NEXT_PUBLIC_SUPABASE_URL` - URL do projecto Supabase dedicado a este cliente (painel do
  Supabase, secção API).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - chave pública (anon) do mesmo projecto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` - chave de service role do mesmo projecto Supabase (acesso
  privilegiado, usada só em API routes do lado do servidor - nunca expor no browser).
- `DASHBOARD_PASSWORD` - password de entrada no painel genérico (qualquer valor à escolha, só
  relevante se este cliente também usar essa parte do produto).
- `AUTH_SECRET` - valor fixo usado para assinar o cookie de sessão do painel genérico (qualquer
  string à escolha).
- `ANTHROPIC_API_KEY` - chave da API da Anthropic, da conta com créditos (pré-requisito da secção
  1). Só necessária se a secção `/cpcv` estiver activa, o que é sempre o caso para este produto.
- `CPCV_INVITE_ADMIN` - código de arranque para criar a primeira conta admin em `/cpcv/registo`.
  **Tem de ser único por cliente** - nunca reutilizar o mesmo valor entre clientes, e nunca
  reutilizar o valor usado nas contas de teste internas (`agente.teste@acelabs.pt` /
  `gestora.teste@acelabs.pt`). É estático e reutilizável de propósito dentro do mesmo cliente
  (serve também para criar outro admin mais tarde, por quem tiver acesso a estas env vars no
  Vercel), mas cruzar o valor entre clientes diferentes dava a um cliente acesso de admin ao
  ambiente de outro caso os dois alguma vez partilhassem o mesmo valor por engano.
- `CPCV_AGENCIA_NOME` - nome legal da agência cliente, tal como deve aparecer na cláusula de
  Intervenção Imobiliária do CPCV gerado (formato exemplo: "Nome da Agência, Lda"). **Tem de ser
  o nome legal exacto e correcto** - entra directamente num documento legal (contrato-promessa),
  um erro aqui é um erro no contrato, não um erro cosmético.
- `CPCV_AGENCIA_AMI` - número de licença AMI da agência cliente, mesma cláusula. **Mesmo cuidado
  que o nome**: confirmar o número real junto do cliente antes de preencher, nunca assumir ou
  copiar de outro processo.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` - opcionais, para a cópia
  automática do CPCV aprovado numa pasta do Google Drive do cliente (ver `lib/google-drive.ts` e
  `scripts/obter-refresh-token-google.mjs` para os obter). Sem estas, a app funciona na mesma, só
  sem essa cópia.
- `GOOGLE_DRIVE_ROOT_FOLDER_ID` - opcional, ID da pasta-mãe no Drive onde as pastas de cada
  processo são criadas. Sem isto, ficam na raiz ("O meu Drive") da conta ligada.

## 5. Criar o primeiro admin

O cliente (tipicamente o dono da agência) regista-se em `/cpcv/registo` usando o código
`CPCV_INVITE_ADMIN` definido na secção 4. Isto cria a primeira conta com `profiles.role = admin`.
A partir daí, o próprio cliente:

- convida gestoras a partir de `/cpcv/admin` (só admin gera convites de "gestora");
- e as gestoras (ou o próprio admin) convidam agentes a partir de `GerarConvite.tsx` dentro da
  app normal.

Sem precisar mais da Ace Labs para criar contas novas - o único momento em que a Ace Labs
intervém directamente na gestão de utilizadores é este primeiro admin, via `CPCV_INVITE_ADMIN`.

## 6. Entrega ao cliente

Entregar ao cliente:

- o link da app (URL do deploy, ver secção 3);
- o código `CPCV_INVITE_ADMIN` gerado para este cliente (secção 4), para ele se registar como
  primeiro admin (secção 5).

**Nunca entregar o código em claro por Slack ou email** - mesma regra já usada no `.env.example`
para os convites internos da app. Usar um canal com encriptação/expiração (ex.: gestor de
passwords partilhado com o cliente, ou uma chamada) em vez de texto plano persistente.

Informar o cliente de que o manual de utilização da aplicação (para agentes e gestoras no
dia-a-dia: como criar um processo, aprovar, gerar o documento) existe em
`docs/manual-cpcv-ia.html`/`.pdf` na raiz do repositório. Este `RUNBOOK-CLIENTE.md` é só para uso
interno da Ace Labs e não deve ser partilhado com o cliente.

## 7. Questão em aberto - a decidir com o Pedro antes de usar este runbook a sério

Depois da entrega, quem fica com uma cópia do código `CPCV_INVITE_ADMIN`: só o cliente, ou também
a Ace Labs guarda uma cópia (por exemplo, num gestor de passwords da empresa) para o caso de o
cliente perder o acesso de admin e precisar de recuperação? Esta decisão não foi tomada e não
deve ser assumida por conta própria - decidir com o Pedro e actualizar esta secção com a resposta
antes de entregar a um cliente real.
