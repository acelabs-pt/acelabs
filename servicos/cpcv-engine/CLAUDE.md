# CLAUDE.md

Guia para o Claude Code ao trabalhar dentro de `servicos/cpcv-engine/`. O `CLAUDE.md` da
raiz do repositório continua a aplicar-se (contexto da Ace Labs, estilo, preçário); este ficheiro
é específico da arquitectura deste projecto.

## O que é esta pasta

Esqueleto Next.js 14 + Supabase reutilizável para o produto "Painel de Gestão". Ver `README.md`
para os padrões extraídos de um cliente real (autenticação simples por cookie, leitura agregada,
escrita centralizada por acção, totais recalculados, datas mensais como texto) - ler antes de
alterar `app/api/data/route.ts`, `app/api/write/route.ts` ou `lib/data.ts`.

Duas partes distintas convivem no mesmo projecto:

1. **Painel genérico** (`app/page.tsx`, `app/login/`, `app/api/data`, `app/api/write`,
   `components/AppLayout.tsx`) - password única partilhada, cookie assinado com `AUTH_SECRET`.
2. **`/cpcv` - "CPCV com IA"** (`app/cpcv/**`, `app/api/cpcv/**`) - feature completa e independente
   para gerar Contratos-Promessa de Compra e Venda assistidos por IA, com contas reais por
   utilizador via Supabase Auth (não a password partilhada do painel genérico).

## Arrancar

```bash
npm install
cp .env.example .env.local   # preencher Supabase + ANTHROPIC_API_KEY (só se /cpcv estiver activo)
npm run dev                   # localhost:3000
npm run build                 # correr sempre antes de dar como terminada uma alteração
npm run lint
```

Não há testes automatizados. `npm run build` (que corre `tsc` em modo estrito) é a única
validação de tipos - já apanhou um bug real (`Buffer` não atribuível a `BodyInit` numa
`NextResponse`) que passava despercebido em `npm run dev`.

## A secção /cpcv ("CPCV com IA")

### Autenticação e roles

- `middleware.ts` tem um segundo bloco (`cpcvMiddleware`) só para `/cpcv/**` e `/api/cpcv/**`,
  usando `@supabase/ssr` com `getUser()` (nunca `getSession()` - valida o token contra o servidor,
  importante num gate de acesso). Rotas públicas: `/cpcv/login`, `/cpcv/registo`,
  `/api/cpcv/registo`.
- Três roles em `profiles.role`: `agente` (só vê e edita os seus próprios processos), `gestora`
  (vê todos, aprova, pede alterações, gera documentos) e `admin` (herda tudo o que a gestora tem,
  mais gestão de utilizadores e convites - ver `lib/cpcv-auth.ts`, `temGestaoTotal()`). O role
  nunca deve ser confiado a partir do cliente - as rotas de API que exigem gestão total
  (`/api/cpcv/gerar`, `/api/cpcv/pedir-alteracoes`, `/api/cpcv/[id]/rascunho`,
  `/api/cpcv/[id]/fechar`) verificam `profiles.role` no servidor via `temGestaoTotal()` e
  devolvem 403, e a RLS do Supabase (`is_gestora()`/`is_admin()`, `migration_fase6.sql`) é a
  última linha de defesa mesmo que uma rota falhe a validar - testado em sessão de QA: pedido
  directo de um `agente` a um `processo_id` de outro utilizador devolve 404 (RLS), não os dados.
- `app/cpcv/layout.tsx` esconde o cabeçalho/rodapé quando não há sessão, e redirecciona
  `/cpcv/login`/`/cpcv/registo` para `/cpcv` quando já existe sessão activa (evita mostrar o
  formulário de login por baixo do cabeçalho autenticado).
- Contas de teste: `agente.teste@acelabs.pt` / `gestora.teste@acelabs.pt`, password
  `TesteCpcv-2026!`.
- `/cpcv/registo` nunca deixa escolher o papel livremente - vem sempre do código de convite.
  Ou bate com `CPCV_INVITE_ADMIN` (estático, bootstrap do primeiro admin - ou de outro mais
  tarde, por quem tiver acesso às env vars), ou é uma linha por usar em `cpcv_convites`
  (`app/api/cpcv/registo/route.ts`). Os convites normais (agente/gestora) geram-se dentro da
  app em `GerarConvite.tsx` - uma gestora só gera de `agente` (`/api/cpcv/convites` força isto
  no servidor, nunca confia no papel pedido pelo cliente); só o admin gera de `gestora`. Criar
  um admin novo nunca passa pela UI, só pelo código de bootstrap - fecha a porta a alguém se
  auto-promover por dentro da aplicação. Antes disto existiam `CPCV_INVITE_AGENTE`/
  `CPCV_INVITE_GESTORA`, dois segredos fixos e partilhados que deixavam qualquer pessoa
  escolher o próprio papel - substituídos por completo.
- `/cpcv/admin` (só para `role === "admin"`) gere utilizadores (mudar papel, activar/desactivar
  o login via `auth.admin.updateUserById`/`ban_duration` - não apaga a conta nem os processos
  que essa pessoa já criou) e mostra um resumo por gestora (`lib/cpcv-estatisticas.ts`,
  `resumoPorGestora()`) - limitado a quantos processos cada uma aprovou e a velocidade a que o
  fez, porque não existe hoje nenhuma "fila atribuída a uma gestora" antes da aprovação
  (qualquer gestora/admin aprova qualquer processo pendente).

### Estados e fluxo

`cpcv_processos.estado`: `em_preenchimento` → `pronto_para_aprovacao` → `aprovado`. Nunca é o
agente a fechar o processo - quando a IA não tem mais perguntas, o processo fica à espera da
gestora (que aprova e gera o documento, ou usa "Pedir alterações", que reabre o estado e injecta a
nota dela como se fosse mais uma pergunta pendente no mesmo mecanismo de chat).

`tipo_contrato` tem três valores, com regras diferentes sobre que dados recolher - o mais
importante é `comprador_nosso_angariacao_externa`: o CPCV em si vem de uma agência externa, por
isso a app nunca recolhe dados do vendedor (nem cria essa parte) - o grupo "Vendedor" fica
escondido tanto em `app/cpcv/novo/page.tsx` como em `DadosPartes.tsx` quando `tipo_contrato` é
este valor.

### Dados de vendedor/comprador (`lib/cpcv-partes-form.ts`, `app/cpcv/ParteCampos.tsx`)

Deixaram de vir da IA - antes a extracção fazia *delete-and-reinsert* de toda a `cpcv_partes` a
cada chamada (sem ids estáveis por pessoa), o que era frágil para dados legais (NIF, estado
civil). Agora são sempre um formulário manual, em blocos repetíveis por pessoa: em
`app/cpcv/novo/page.tsx` antes de o processo existir, e em `app/cpcv/[id]/DadosPartes.tsx`
depois de criado (único sítio onde se editam/adicionam/removem partes já existentes - faz
`update`/`insert`/`delete` directo em `cpcv_partes`, comparando a lista de ids actual com a lista
capturada na montagem). Os dois sítios partilham o componente `ParteCampos.tsx` (campos) e as
conversões/validação em `lib/cpcv-partes-form.ts` (`parteDraftParaLinha`, `nifValido` - dígito de
controlo mod 11, não havia validação de formato nenhuma antes disto). O `SYSTEM_PROMPT` das duas
rotas de IA (abaixo) é instruído a nunca perguntar nem devolver dados de partes, e
`cpcv-perguntas-filtro.ts` tem padrões de regex como rede de segurança caso pergunte na mesma -
mesmo padrão já usado para método de pagamento/reserva/etc.

### Extracção por IA (`app/api/cpcv/extrair`, `app/api/cpcv/responder`)

- Modelo: `claude-haiku-4-5` (`lib/anthropic.ts`, `EXTRACTION_MODEL`). Documentos (PDF/imagem) são
  enviados como content blocks nativos, não passam por OCR à parte.
- **Nunca confiar só no prompt para excluir tópicos.** Alguns campos (método de pagamento,
  reserva, condições suspensivas estruturadas, comodato, IBAN, emails) são preenchidos no
  formulário "Condições do negócio", não no chat - o `SYSTEM_PROMPT` diz à IA para nunca perguntar
  por eles, mas em testes reais o Haiku ocasionalmente perguntou na mesma. Por isso existe
  `lib/cpcv-perguntas-filtro.ts` - um filtro regex aplicado a `campos_em_falta` depois da resposta
  da IA, em ambas as rotas. Ao adicionar um novo campo estruturado ao formulário, actualizar os
  dois sítios (prompt E filtro), não confiar só no prompt.
- As duas rotas fazem *merge* com o estado actual em vez de sobrescrever (nunca apagam um campo já
  confirmado só porque uma ronda de análise não o devolveu).
- Testado contra injecção de prompt (texto do utilizador a tentar fazer a IA revelar o system
  prompt) - o modelo ignorou a instrução injectada e manteve-se na tarefa. Não é garantia para
  sempre, mas não é uma lacuna conhecida em aberto.
- `licenca_utilizacao`/`certificado_energetico` e `preco_total`/`valor_sinal` são o caso oposto
  dos campos acima: a IA tenta extraí-los (do chat/documentos), mas também são editáveis à mão
  em formulário - licença/certificado em "Documentos obrigatórios" (`DadosApoio.tsx`, sempre
  visível, separado de "Condições do negócio" porque não são condições a negociar), preço/sinal
  em "Condições do negócio" > "Valor do negócio" (mesmas colunas:
  `imovel_licenca_utilizacao`/`imovel_certificado_energetico`/`preco_total`/`valor_sinal`).
  Guardar um formulário não chama a IA, por isso cada um passa a remover as suas entradas de
  `campos_em_falta` directamente no cliente (`removerCamposPreenchidosNoFormulario` em
  `lib/cpcv-perguntas-filtro.ts`, chamada a partir dos dois componentes) - sem isto, a pergunta
  ficava visível no chat e a contar no "X por preencher" da lista de processos até à ronda
  seguinte de chat. O casamento é por palavras-chave (`licenca`+`utilizacao`,
  `certificado`+`energetic`, `preco`+`total`, `valor`+`sinal`), nunca por uma frase exacta -
  testado: o `campo` devolvido pela IA é um identificador estável (`imovel.certificado_energetico`),
  mas a `pergunta` em português varia de ronda para ronda (ex.: "classificação energética do
  imóvel (certificado)" não contém a frase "certificado energético"). Ao adicionar um novo campo
  editável nestes formulários que a IA também possa perguntar, repetir o mesmo padrão em
  `CAMPOS_TAMBEM_NO_FORMULARIO`.

### Geração de documentos

- O CPCV gerado reproduz o contrato de referência aprovado pelo cliente («CPCV 126601064-8
  Assinado.pdf», 16 cláusulas, Braga) - redacção verbatim, com variação só nos dados, no
  singular/plural dos outorgantes e nas condições aprovadas (hipoteca, fiel depositária,
  avaliação bancária, bens móveis, condomínio). Fonte única: `lib/cpcv-contrato.ts`
  (`montarContrato`) monta a estrutura inteira já com as cláusulas filtradas e numeradas, a partir
  do texto em `lib/cpcv-clausulas.ts`; `lib/cpcv-template.ts` (HTML → PDF) e `lib/cpcv-docx.ts`
  (Word) só formatam essa estrutura - nenhum dos dois decide o que entra. Não parafrasear nem
  "modernizar" texto de cláusula: `npm run verificar:clausulas` (correr com
  `npx tsx --env-file=.env.local scripts/comparar-clausulas-minutas.ts`) compara ponto a ponto
  contra o texto do PDF assinado, com a lista das únicas adaptações aprovadas, e corre os
  cenários A-H do pedido - correr depois de qualquer alteração a `cpcv-clausulas.ts`.
- Feedback da solicitadora (reunião de 25/10/2026, ver `docs/feedback_reuniao_cpcv_2510_margarida.docx`),
  já aplicado: negrito (nomes, valores em euros só os algarismos, artigo, descrição, licença, certificado,
  data da escritura) via marcas U+E000/U+E001 de `neg()` em `cpcv-clausulas.ts` (PDF troca por `<b>`, Word
  divide em runs - nunca escrever `<b>` nas cláusulas); fim de cada ponto "trancado" com sublinhados
  (PDF: `trancarFimDosPontos` em `cpcv-template.ts`, mede a última linha no browser; Word: tabulação com
  preenchimento sublinhado); email por parte na identificação e "ou através dos emails convencionados"
  na Cláusula Terceira; estado civil em minúsculas e sem "maior" para divorciado/viúvo (o solteiro mantém "maior"); casais
  em pares consecutivos (até 4 partes); reserva entra na Cláusula Segunda; segundo ponto de fiel
  depositária; hipotecas ("hipoteca voluntária", "um ónus de inalienabilidade"); distrate/protocolo APB na
  Sexta; certificado energético válido/isento/em execução; "situado em"/composição da certidão no ponto 1
  da Primeira; TEXTOS ALL CAPS passam por `capitalizarLocal`; local de assinatura = concelho do imóvel;
  ficheiro descarregado chama-se `CPCV-<id de angariação>`. Migração: `migration_fase15.sql`.
  Várias partes do mesmo lado numeram-se 1) 2) 3) (não A) B)); reserva conta para o sinal; código postal na
  morada de cada parte é obrigatório (`/api/cpcv/gerar` recusa sem ele).
- **Leitura final do Word gerado** (`lib/cpcv-leitor.ts`, chamada em `/api/cpcv/gerar` depois do Word): lê o .docx
  de ponta a ponta com verificações de regra (campos em branco, numeração, dados do processo ausentes do texto,
  datas/valores) e uma leitura por IA (`REVISAO_FINAL_MODEL`, Sonnet, ~9k tokens de entrada e ~4k de saída por
  leitura). Nunca bloqueia: os pontos vão na resposta (painel em `GerarDocumento.tsx`) e como mensagem do processo.
  `LER_IA=1 npx tsx --env-file=.env.local scripts/testar-contrato.ts` corre a leitura por IA no cenário 12.
- Feedback falado da solicitadora (reunião de 25/10/2026, transcrição): "maior" só no solteiro (divorciado e
  viúvo não levam); casais ligados à mão no formulário (coluna `cpcv_partes.casal`, "Casal 1/2/3"), com a
  deteção automática só como alternativa; `extrair-pessoa` usa `LEITURA_PESSOA_MODEL` (Sonnet), confere o nome
  contra a banda MRZ (`nome_mrz`) e avisa quando o ficheiro tem mais do que uma pessoa (`outros_titulares`);
  uma nova leitura só substitui campos vazios ou ainda iguais à leitura anterior da IA (`ultimaLeitura` em
  `ParteCampos.tsx`), nunca o que o agente editou; a página `/cpcv/entrega/[token]` tem versão inglesa
  (`?lang=en`) e aceita passaporte/título de residência; o dashboard pesquisa por cliente e ID de angariação.
- `npm run comparar:final -- <gerado.docx> <final.docx> [relatorio.md]` compara o Word gerado com o Word final
  editado pela solicitadora (parágrafo a parágrafo e palavra a palavra, com % de fidelidade): é a medida da
  melhoria. Pedir-lhe os dois ficheiros de cada contrato.
- O Word gerado foi exportado para PDF com o próprio Word (COM, `ExportAsFixedFormat`) e tem as mesmas 7 páginas
  do PDF do cenário 12, com negrito e traços de fim de ponto corretos.
  Redação nova a confirmar com a solicitadora: ponto da reserva, segundo ponto de fiel depositária, "em
  execução, a entregar até à escritura".
- Informação que a app recolhe mas não entra em nenhuma das 16 cláusulas (reforços,
  mobília, comodato, observações, ...) nunca gera cláusulas: `lib/cpcv-alertas.ts`
  lista-a para a gestora/solicitadora (`AlertasSolicitadora.tsx` na página do processo e nos
  avisos de `/api/cpcv/gerar`). Decisão do cliente - não voltar a acrescentar cláusulas por campo.
- Mediadora fixa no código (`AGENCIA_NOME`/`AGENCIA_AMI` em `cpcv-clausulas.ts`); o local de
  assinatura é o concelho do imóvel ("Braga" só se faltar, em `cpcv-contrato.ts`). Só IBAN/banco/email da agência vêm do `.env`.
- Número de páginas no texto final: o PDF é gerado em duas passagens (`lib/cpcv-pdf.ts` - gera,
  conta os `/Type /Page`, volta a gerar com o número por extenso); o Word usa um campo
  `NUMPAGES \* CardText \* Upper` com o número do PDF como valor em cache, que o Word recalcula
  sozinho. Por isso o Word passa sempre pelo PDF, mesmo quando só se pede o `.docx`.
- Fonte Arial obrigatória nos dois formatos. No HTML/PDF há `@font-face "Arial"` com
  `local("Arial")` e fallback para a Arimo embutida (`lib/fonts/arimo.ts`, SIL OFL, métrica igual à
  Arial) - é o que garante a mesma paginação num servidor sem Arial (Vercel). Nunca incluir a
  Arial da Microsoft no repositório (público).
- Campos opcionais que podem estar vazios (`naturalidade`, etc.) devem ser omitidos da frase
  gerada quando `null` - nunca preencher com uma frase-placeholder tipo "naturalidade não
  indicada", fica com má cadência para um documento legal.
- `/api/cpcv/[id]/rascunho` gera PDF/Word em memória a qualquer momento (só gestora, não grava
  nada) para pré-visualizar; `/api/cpcv/[id]/download` serve os ficheiros já gerados e gravados no
  Storage após aprovação. Ambos devolvem o buffer como `new Uint8Array(buffer)` na `NextResponse`
  - passar um `Buffer` diretamente falha o typecheck do `next build` (`BodyInit`), mesmo resultando
  em runtime funcional no `next dev`.

### UI

`app/cpcv/ui.tsx` tem as classes de botão partilhadas (`btnPrimary`, `btnAccent`, `btnSecondary`,
`btnAccentOutline`, `btnGhost`, `btnDanger`, `btnLink`) e o componente `Spinner` - usar sempre
estas em vez de estilos ad-hoc num botão novo, para manter consistência (hover, foco, disabled,
micro-interacção ao clicar) em toda a secção.

### Perfis (utilizadores da plataforma)

| Perfil | Pode | Como se cria |
|---|---|---|
| `agente` | Criar e preencher os seus processos, entregar para aprovação, gerar links de entrega ao cliente, rever os documentos recebidos | Convite gerado pela gestora ou admin (`GerarConvite.tsx`), registo em `/cpcv/registo` com o código |
| `gestora` | Tudo o que o agente faz, em todos os processos, mais aprovar, pedir alterações, gerar PDF/Word, fechar, convidar agentes | Convite gerado pelo admin |
| `admin` | Tudo o da gestora, mais gerir utilizadores (`/cpcv/admin`) e convidar gestoras | Só via `CPCV_INVITE_ADMIN` (variável de ambiente), nunca pela UI |

O comprador e o vendedor **não têm conta**: entregam documentos por link privado (ver abaixo).
Ainda não há atribuição de um processo a uma gestora específica (qualquer gestora ou admin aprova).

### Entrega de documentos pelo cliente (`migration_fase14.sql`)

- O agente gera, na página do processo, um link por parte (comprador ou vendedor), válido 14 dias
  (`DocumentosCliente.tsx`, `POST /api/cpcv/[id]/links`). O token só é mostrado uma vez; na base de
  dados fica o hash SHA-256 (`cpcv_links_cliente.token_hash`). Revogar: `DELETE` na mesma rota.
- A página pública `/cpcv/entrega/[token]` (sem login) tem a zona de drop. Cada ficheiro vai para
  `POST /api/cpcv/entrega/[token]` (rota pública no `CPCV_PUBLIC_PATHS` do `middleware.ts`), que valida
  token, tipo (`lib/cpcv-links-cliente.ts`), extensão, tamanho (4 MB) e limite por link (30).
- Armazenamento: bucket `cpcv-documentos`, caminho `<dono>/<processo>/portal/<papel>/<uuid>-<nome>`.
  Entram em `cpcv_ficheiros` com `origem='cliente'` e `estado_revisao='pendente'`.
- Staging: a IA (`/api/cpcv/extrair`) e a lista de documentos só usam `estado_revisao='aceite'`. O
  agente aceita ou rejeita em "Documentos do cliente". Aplicar a migração antes de fazer deploy do
  código, senão as queries por `estado_revisao` falham.
- RGPD, versão mínima (decisão do Pedro, 2026-10-15): a página de entrega tem uma linha de informação;
  ficheiros rejeitados são apagados do Storage; sem prazo de retenção automático nem DPA por agora.
  A região do Supabase não está documentada (confirmar no painel).

### Teste do contrato (PDF e Word)

`npm run testar:contrato` (`scripts/testar-contrato.ts`) gera PDF e Word para 11 cenários fictícios
(partes singulares e coletivas, regimes de bens, hipoteca, financiamento, nomes com acentos, valores
grandes, etc.) e verifica: sem `undefined`/`null`/`NaN`, sem travessões, PDF e Word com o mesmo texto,
valores e nomes presentes. Os ficheiros ficam na pasta temporária do sistema. Correr sempre depois de
mexer em `cpcv-clausulas.ts`, `cpcv-contrato.ts`, `cpcv-template.ts` ou `cpcv-docx.ts`. Precisa de
`pdftotext` (Poppler) no PATH. Não substitui a comparação com a minuta real da agência.
Lacunas conhecidas: dados do procurador e valor da comissão não entram no contrato.

## Cuidados gerais

- Preencher um `<textarea>`/`<select>` controlado pelo React via automação (Playwright/DevTools)
  requer disparar o evento `input`/`change` através do *setter nativo* do elemento
  (`Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set`), não só atribuir
  `.value` - o tracker interno do React ignora a mudança caso contrário e o estado fica
  dessincronizado do DOM.
- Este repositório é partilhado com o Miguel - antes de mexer, `git pull`; commit e push só com
  confirmação explícita do utilizador antes de cada execução (ver `CLAUDE.md` da raiz).
- Um componente client (`"use client"`) que recebe um filtro/valor inicial via prop e o guarda em
  `useState(propInicial)` só lê essa prop na primeira montagem - se a navegação for do lado do
  cliente (`next/link`, `router.push`) o componente não remonta, por isso mudanças na prop depois
  disso são ignoradas. Já aconteceu (`ListaProcessos.tsx`, filtro vindo de `?estado=` na URL): a
  correcção é sincronizar com `useEffect(() => setEstado(propInicial), [propInicial])`, não confiar
  só no valor inicial do `useState`.
- Ler um ficheiro do Storage (`.storage.from(...).download(path)`) através do cliente Supabase da
  sessão normal do utilizador (`sbUserServer()`), logo a seguir a um `upload(..., { upsert: true })`
  no mesmo caminho, por vezes devolvia a versão anterior do ficheiro - confirmado em sessão de QA
  (Fase 12): descarregar um CPCV logo depois de o regerar (ex.: corrigir e reaprovar) trazia o
  PDF/Word antigo, mesmo com `export const dynamic = "force-dynamic"` na rota, `Cache-Control:
  no-store` na resposta, e um `fetch` com `cache: "no-store"` injectado no cliente - nada disto
  resolveu. O mesmo pedido através do cliente de serviço (`sbServer()` em `lib/supabase.ts`)
  devolveu sempre o conteúdo actual em todos os testes, o que aponta para o Storage da Supabase
  servir pedidos autenticados (não de serviço) a partir de uma camada com propagação mais lenta
  após um upsert - não é um problema do Next.js nem deste código. Padrão usado em
  `app/api/cpcv/[id]/download/route.ts`: validar o acesso ao processo com o cliente da sessão
  (lê `pdf_path`/`docx_path`, já protegido por RLS), e só então ler os bytes do ficheiro com o
  cliente de serviço - nunca o inverso, e nunca usar o cliente de serviço para decidir se o
  utilizador pode ver o processo.
