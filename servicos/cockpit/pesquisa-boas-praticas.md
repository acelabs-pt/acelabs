# Cockpit - pesquisa de boas práticas (apps iOS/Android/Web)

Estudo feito com uma equipa de agentes de IA (4 pesquisas em paralelo) para informar as
decisões de arquitetura e produto do Cockpit. Ver também o CLAUDE.md desta pasta para o
contexto geral do serviço.

## Nota prévia: SaaS vs modelo da Ace Labs

Chamar ao Cockpit "software as a service" é uma mudança em relação ao modelo geral da empresa
("projetos à medida, não SaaS", ver CLAUDE.md da raiz). Faz sentido como excepção deliberada -
um produto horizontal, não um projeto por cliente - mas é uma decisão a assumir
conscientemente, porque implica isolamento multi-tenant, billing e manutenção diferentes de
tudo o resto que a Ace Labs já construiu (incluindo o cpcv-engine, que é um projeto Supabase
por cliente).

## 1. Arquitetura mobile: Capacitor, não PWA pura

A decisão inicial (documentada no CLAUDE.md desta pasta) era começar só por PWA e só avançar
para Capacitor/TestFlight se fosse preciso push fiável. A pesquisa recomenda avançar logo para
**Capacitor desde o início**, não ficar na fase PWA pura:

- Reaproveita cerca de 90% do código Next.js/React já existente - muito mais barato do que
  React Native (reescreve toda a UI) ou Flutter (stack novo, Dart).
- Resolve o maior risco identificado na pesquisa de PWA: em iOS, push notifications só
  funcionam de forma fiável depois de instalação manual no ecrã principal, não há
  sincronização em segundo plano (WebKit não implementa Background Sync/Fetch), e os dados
  gravados localmente são apagados ao fim de 7 dias sem interação se a PWA não estiver
  instalada no ecrã principal. Para o Cockpit, onde notificações de novo lead/mensagem são
  provavelmente a funcionalidade mais crítica, isto é um risco real de frustração logo no
  piloto.
- Dá acesso nativo direto a câmara/GPS/ficheiros sem reescrever nada.

Contrapartida aceitável: a WebView do Capacitor arranca mais lenta que nativo puro (500-1000ms
vs 200-400ms Flutter) e listas longas podem sentir-se menos fluidas - mitigável com scroll
virtual, DOM plano, animações em `transform`/`opacity` e lazy loading, testável desde já com a
skill `browser-check` já usada no projeto.

**Distribuição fora de loja:**
- Android: APK direto. A Google está a aumentar a fricção para apps de developers não
  verificados (avisos, atraso de segurança de 24h) - registar a Ace Labs como developer
  verificado reduz isto.
- iOS: TestFlight (99 USD/ano de conta Apple Developer, limite de 10.000 testers externos,
  revisão mais leve que a App Store). Importante: **builds expiram aos 90 dias**, é preciso
  reenviar periodicamente - tarefa operacional recorrente a prever, não distribuição
  "permanente sem loja".

Push notifications nativas (APNs/FCM) exigem o plugin `capacitor-community/fcm` para a ponte
entre o token APNs e a Firebase Console, e testam-se sempre em dispositivo físico (nunca em
simulador no caso do iOS).

## 2. Offline-first (uso no terreno com rede instável)

Arquitetura recomendada, por camadas:

1. **Base de dados local** (IndexedDB via Capacitor, ou SQLite) como fonte de verdade no
   dispositivo - leads, imóveis e agenda do dia disponíveis sem rede.
2. **Fila de sincronização** para escritas feitas offline (nota num lead, registo de visita,
   foto tirada), com metadados por registo (`syncStatus`, `lastModified`) para reconciliar
   quando a rede voltar.
3. **Resolução de conflitos simples**: "last-write-wins" por timestamp é suficiente para o
   volume de dados do Cockpit - CRDTs seriam sobre-engenharia para uma equipa de 2 pessoas.
4. **Feedback visual obrigatório**: o agente tem de ver claramente o que está "enviado" vs
   "pendente" (ex: fotos por sincronizar), para nunca ficar na dúvida se o trabalho no terreno
   foi guardado. Este foi sinalizado por duas pesquisas independentes como o ponto mais crítico
   de confiança na app.

Começar simples (fila de sincronização feita à mão sobre o Supabase já em uso) e só considerar
uma solução dedicada (ex: PowerSync) se a complexidade de sincronização crescer com mais
agentes em simultâneo.

**O que não prometer na v1** (limitações reais da plataforma, não falha de implementação):
sincronização ou envio de fotos com a app completamente fechada em segundo plano, geofencing
("sabe quando o agente chega a um imóvel sem abrir a app"), notificações data-only sem app
aberta. Capacitor atenua isto parcialmente face à PWA pura, mas estas limitações de fundo do
iOS mantêm-se relevantes para gerir expectativas internas e do cliente piloto.

## 3. Arquitetura web/SaaS multi-tenant (Supabase)

- **Isolamento**: schema partilhado com Row Level Security por `organizacao_id` em todas as
  tabelas, desde a primeira migração - não schema-per-tenant nem projeto-per-tenant (esse é o
  modelo usado noutros serviços da Ace Labs, mas não escala para um produto horizontal gerido
  por 2 pessoas). Nunca adicionar RLS depois de já haver dados - é a causa mais comum de fugas
  entre tenants. Indexar sempre `organizacao_id`.
- **Auth**: Supabase Auth, tenant = organização/agência (não o utilizador individual).
  Modelo mínimo: `organizacoes`, `membros_organizacao` (user_id, organizacao_id, role),
  `convites` (token por email, expiração a 7 dias, construído à mão - a própria Supabase não
  oferece isto nativamente). Roles: owner / admin / agente chega para o MVP.
- **Billing**: Stripe Checkout + Customer Portal + webhook de sincronização para tabelas
  Supabase. Com 1 a 3 clientes iniciais, nem vale a pena self-service - criar a subscrição
  manualmente no dashboard Stripe e só ligar o webhook de sincronização de estado.
- **Segurança**: RLS não é a única camada - validar `organizacao_id` também nas API routes do
  servidor. Chave `service_role` nunca no browser (disciplina já seguida no cpcv-engine).
  Aplicar RLS também aos buckets de Storage se o Cockpit vier a guardar documentos. Dados de
  clientes de agências são dados pessoais de terceiros - prever desde já um caminho simples
  para direito ao apagamento (RGPD).

**MVP vs depois**: self-service signup/checkout, funções `SECURITY DEFINER` otimizadas e
qualquer migração para schema-per-tenant ficam para depois de haver mais do que um cliente
pagante.

## 4. Produto: o que construir primeiro

Benchmarking (Follow Up Boss, kvCORE, Sierra Interactive, Lofty, e Vericasa em Portugal)
confirma a tese dos sócios: nenhuma ferramenta de referência vende "mais funcionalidades" como
diferencial, vendem **menos fricção a fazer o básico**. A Vericasa em particular é mais um
motor documental/legal (análise de documentos, certidões, IMPIC) do que uma app de terreno -
há espaço real para um Cockpit mobile-first que ela não cobre.

Anti-padrão mais citado: CRMs imobiliários tornam-se "um segundo emprego" quando exigem
demasiado registo manual - 83% das lideranças do setor apontam a adoção da equipa como o maior
desafio, não a escolha da ferramenta.

**MVP (resolve o dia a dia já na v1):**
1. Ficha de imóvel e ficha de lead/contacto, com acesso e edição offline.
2. Registo de visita num só toque (imóvel + lead + data/hora automáticos), notas estruturadas
   e opção de nota por voz.
3. Agenda com vista "hoje" e "próximos dias".
4. Click-to-call e click-to-WhatsApp com log automático da interação.
5. Lista de tarefas/follow-ups ligada a cada lead ou imóvel.
6. Sincronização offline-first com feedback visual claro de pendente/enviado.

**Fase 2+ (deixar para depois de validar o uso diário):**
- Automação comportamental de nurture de leads, power dialer, distribuição automática de leads.
- IA a qualificar/contactar leads automaticamente (tipo Sierra AI).
- Relatórios/dashboards analíticos avançados.
- Painel web completo (mantendo-o deliberadamente simples - a tese é mobile-first).
- **Integração com o CPCV com IA**: botão "gerar CPCV" a partir dos dados já na ficha do
  imóvel/lead no Cockpit. Diferencial forte (nem a Vericasa nem os CRMs americanos têm
  equivalente ao CPCV português), mas só depois de o Cockpit se provar como ferramenta de
  terreno - é o gancho natural de upsell quando o agente já confia na app.

## Próximos passos (decisões por tomar)

- Confirmar: Cockpit como excepção SaaS ao modelo da empresa, ou repensar para o modelo
  "projeto por cliente" habitual?
- Confirmar início direto em Capacitor (em vez de passar primeiro por PWA pura).
- Validar o MVP da secção 4 com o Miguel antes de desenhar schema/telas.
