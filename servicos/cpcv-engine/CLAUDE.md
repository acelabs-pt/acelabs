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
isso a app nunca recolhe dados do vendedor (nem cria essa parte). Isto tem de estar reflectido em
**dois sítios**: no `SYSTEM_PROMPT` da IA (para não perguntar) e no filtro server-side (ver
abaixo, para o caso de a IA perguntar na mesma).

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
- `licenca_utilizacao` e `certificado_energetico` são o caso oposto dos campos acima: a IA tenta
  mesmo extraí-los (do chat/documentos), mas também são editáveis à mão no formulário "Condições
  do negócio" (mesmas colunas, `imovel_licenca_utilizacao`/`imovel_certificado_energetico`).
  Guardar o formulário não chama a IA, por isso passou a remover essas entradas de
  `campos_em_falta` directamente no cliente (`removerCamposPreenchidosNoFormulario` em
  `lib/cpcv-perguntas-filtro.ts`) - sem isto, a pergunta ficava visível no chat e a contar no "X
  por preencher" da lista de processos até à ronda seguinte de chat. O casamento é por
  palavras-chave (`licenca`+`utilizacao`, `certificado`+`energetic`), nunca por uma frase exacta -
  testado: o `campo` devolvido pela IA é um identificador estável (`imovel.certificado_energetico`),
  mas a `pergunta` em português varia de ronda para ronda (ex.: "classificação energética do
  imóvel (certificado)" não contém a frase "certificado energético").

### Geração de documentos

- `lib/cpcv-template.ts` (PDF, via HTML → Playwright `chromium.launch()` + `page.pdf()`) e
  `lib/cpcv-docx.ts` (Word, via `docx`) duplicam a mesma lógica de composição de cláusulas a partir
  dos campos estruturados - uma alteração num dos dois quase sempre implica a mesma alteração no
  outro (ex.: a cláusula de condições suspensivas é composta a partir de
  `condicionado_avaliacao`/`condicionado_financiamento`/`dias_condicionamento`, não de texto livre).
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
