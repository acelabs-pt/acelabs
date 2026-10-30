# Cockpit: instalar para um cliente

Modelo: **um projeto Supabase e uma instalação por cliente** (consultor individual). Nada se partilha entre clientes.
Cada cliente tem o seu endereço, a sua base de dados e os seus utilizadores. Fazer esta lista por ordem.

## 1. Base de dados (Supabase)

1. Criar um projeto novo com o nome do cliente, numa região da UE (ex.: Irlanda, `eu-west-1`).
2. No **SQL Editor**, correr por esta ordem, cada ficheiro uma vez:
   1. `create_tables.sql`
   2. `migracao_zonas_correspondencias.sql`
   3. `migracao_escala.sql`
   4. `migracao_seguranca.sql` (só membros convidados veem dados; ler o topo do ficheiro antes)
   5. `migracao_notificacoes.sql` (só a parte de cima; ver a secção das notificações)
   6. `migracao_apagar_conta.sql` ("Apagar a minha conta" em Conta; a Apple exige-o na App Store)
   Atalho para um projeto novo e vazio: `npm run sql` junta os seis ficheiros, pela ordem certa, em `instalar_tudo.sql` (fora do git), para colar de uma vez.
3. **Segurança, antes de ligar o SMTP:** em Authentication (Sign In / Providers), **desligar "Allow new users to sign up"**.
   Vem ligado por defeito e, com o SMTP a funcionar, qualquer pessoa com a chave pública (que está no browser) podia criar
   conta. Os convites continuam a funcionar com o registo desligado. Confirmar: `GET <Project URL>/auth/v1/settings`
   com a chave anon tem de dizer `"disable_signup": true`.
4. Copiar o **Project URL** e a chave **anon** (Settings, API). Estas duas vão para a Vercel. A chave `service_role` **nunca** vai para a Vercel nem para o repositório.
5. **Confirmar tudo de uma vez:** com o `.env.local` a apontar para este projeto, `npm run seguranca`. Diz que migrações
   faltam correr e que definições de segurança estão por mudar, e só usa a chave pública (não altera nada).
   Tem de acabar em "Tudo em ordem.".

## 2. Emails de convite e de recuperação de password

O Supabase traz um serviço de email de teste que só entrega a pessoas da própria equipa Supabase e limita os envios.
**Para clientes reais é preciso configurar um SMTP próprio** (Authentication, SMTP Settings). Usar o Resend, que já temos com o
domínio `acelabs.pt` verificado: servidor `smtp.resend.com`, porta `465`, utilizador `resend`, password a chave da API do Resend,
remetente `cockpit@acelabs.pt`. (Confirmar estes passos nas páginas do Supabase e do Resend, podem mudar.)

Em **Authentication, URL Configuration**:
- **Site URL**: o endereço da app deste cliente.
- **Redirect URLs**: o endereço da app e `<endereço>/nova-password`. Para testar em local, acrescentar `http://localhost:3001/**` e tirar depois.

Em **Authentication, Emails, Templates**, trocar os textos em inglês pelos de `emails/`:

| Modelo do Supabase | Assunto | Corpo |
| --- | --- | --- |
| Invite user | Convite para o teu Cockpit | `emails/convite.html` |
| Reset password | Recuperar a password do Cockpit | `emails/recuperar.html` |

## 3. Publicar (Vercel)

1. Projeto novo na Vercel, a partir da pasta `servicos/cockpit-app`.
2. Variáveis de ambiente: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (as do projeto **deste** cliente).
3. Depois do primeiro deploy, confirmar o endereço no Supabase (passo 2).

## 4. Dar acesso ao cliente

Convidar por email. O cliente abre o link e escolhe a própria password. Não se partilha nenhuma password.

```
SUPABASE_SERVICE_ROLE_KEY=<chave service_role deste cliente> \
NEXT_PUBLIC_SUPABASE_URL=<url deste cliente> \
node scripts/convidar.mjs ana@exemplo.pt https://endereco-da-app-do-cliente
```

A chave de administrador fica só no ambiente do terminal, nunca num ficheiro que vá para o Git.
O cliente pode depois mudar a password, ou recuperá-la, em **Conta** e em **Esqueci a password**.

## 5. Primeiros dados

- Em **Conta, Importar lista** (ou no botão +): carregar as listas de compradores, proprietários e angariações
  a partir de Excel (`.xlsx`) ou CSV. Há modelos para descarregar na própria página. A importação não usa IA.
- Pôr as metas do ano no Dashboard.

## 6. Instalar no telemóvel

Abrir o endereço no telemóvel: no iPhone, Safari, Partilhar, Adicionar ao ecrã principal; no Android, Chrome, Instalar app.
Não passa pelas lojas.

## 7. Antes de entregar, confirmar

- Fazer login, sair e voltar a entrar.
- O convite chega ao email do cliente e o link abre "Escolhe a tua password".
- Criar um comprador com zona e uma angariação na mesma zona: aparece o alerta no Dashboard.
- Marcar uma tarefa como feita e adiá-la com o gesto de deslizar.

## 8. Notificações no telemóvel (push)

Funcionam no Android e no iPhone (iOS 16.4 ou mais recente). No iPhone **só com o Cockpit instalado no ecrã principal e
aberto pelo ícone**, e só num endereço com HTTPS (a Vercel já dá). O consultor liga-as em Conta, "Ativar notificações".

1. Gerar as chaves deste cliente: `node scripts/gerar-vapid.mjs`. Guardar as três linhas fora do repositório.
2. Na Vercel: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`. Voltar a publicar.
3. No Supabase, SQL Editor: correr `migracao_notificacoes.sql` (só a parte de cima; a parte comentada é o passo 5).
4. Testar: no telemóvel, Conta, "Ativar notificações" e depois "Enviar teste".
5. Lembretes automáticos (30 minutos antes de cada evento e resumo das tarefas às 08:30): publicar a função
   `supabase/functions/enviar-lembretes` com a CLI do Supabase (`supabase functions deploy enviar-lembretes --no-verify-jwt`),
   definir os segredos (`supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=... CRON_SECRET=<texto aleatório>`),
   ligar as extensões `pg_cron` e `pg_net` e correr o bloco comentado no fim de `migracao_notificacoes.sql` com o
   `PROJECT_REF` e o `CRON_SECRET` deste cliente.

Trocar as chaves VAPID obriga cada telemóvel a voltar a ligar as notificações. `npm run seguranca` confirma se a tabela existe.

## 9. App para o iPhone (Capacitor)

A app da App Store é uma casca nativa (`ios/`) que abre o endereço publicado (`cockpit.acelabs.pt`), por isso as
correções de ecrã chegam pela Vercel, sem nova revisão da Apple. A parte nativa está em `lib/nativo.ts` (push, Face ID,
agenda, contactos, partilha, vibração) e `components/PonteNativa.tsx`; configuração em `capacitor.config.ts`.
Dentro da app a página fica marcada `<html data-app="nativa">` e o que tem `data-so-web` (instruções de instalar) esconde-se.

**No Mac (do Miguel), uma vez:**
1. `git pull`, depois em `servicos/cockpit-app`: `npm install`.
2. `npm run cap:sync` (copia a configuração para o projeto iOS). Para testar contra o computador em vez da produção:
   `CAP_SERVER_URL=http://<ip do PC>:3001 npm run cap:sync`.
3. `npm run cap:abrir` abre o Xcode. Em **Signing & Capabilities**: escolher a equipa Apple; confirmar que aparecem
   **Push Notifications** e **Associated Domains** (vêm do `App.entitlements`). Correr num iPhone ou no simulador.
4. Cada vez que se acrescentar um plugin ou mudar `capacitor.config.ts`: `npm run cap:sync`.
5. Se se mexer nas permissões ou entitlements: editar `scripts/configurar-ios.mjs` e correr `node scripts/configurar-ios.mjs`.

**Antes de publicar (a fazer):** trocar `TEAMID` em `public/.well-known/apple-app-site-association` pelo Team ID da conta
Apple; pôr o ícone de 1024x1024 em `ios/App/App/Assets.xcassets/AppIcon.appiconset`; chave APNs (.p8) da conta Apple.

**Piloto pelo TestFlight (antes da App Store):** plano, textos e lista de testes em `docs/cockpit-testflight-piloto.md`.

**Notificações nativas:** `migracao_notificacoes.sql` já aceita aparelhos `ios`. Publicar as funções `enviar-teste` e
`enviar-lembretes` (usam `supabase/functions/_shared/push.ts`) e acrescentar aos segredos da função: `APNS_KEY_ID`,
`APNS_TEAM_ID`, `APNS_KEY_P8` (conteúdo do .p8), `APNS_TOPIC=pt.acelabs.cockpit`, `APNS_ENV=sandbox` (compilações a partir do Xcode no iPhone) ou `production` (TestFlight e loja).

**Estado:** escrito e a compilar em TypeScript; a web comporta-se bem dentro do invólucro (`npm run testar -- nativo`, que
simula o WebView do iOS). **Ainda não testado num iPhone nem no simulador:** Face ID, agenda, contactos, partilha, push
nativo e o envio à Apple, e a navegação para o endereço remoto com a ponte nativa. Convém confirmar tudo isto no primeiro dia com o Mac.
Ligado na interface: Face ID ao abrir a app e ao voltar depois de 1 minuto (opção em Conta, `components/BloqueioFaceId.tsx`),
"Escolher do telemóvel" no novo comprador, "Partilhar" no relatório do proprietário, "Pôr no telemóvel" na agenda do iPhone, vibração
ao concluir tarefas e notificações. **Se um plugin nativo faltar no projeto iOS** (esquecido o `npm run cap:sync`), o Face ID
deixa de bloquear em vez de congelar a app (o Capacitor entra num ciclo infinito ao chamar um plugin que não existe).

### 9b. App para Android (APK)

A casca Android (`android/`, também no repositório) é a mesma ideia da do iPhone: abre `cockpit.acelabs.pt` num WebView, com as
funções nativas pelos mesmos plugins (push, impressão digital ou rosto, agenda, contactos, partilha). `npm run cap:sync`
atualiza as duas plataformas. Ícones e ecrã de arranque já são os do Cockpit; o `applicationId` é `pt.acelabs.cockpit`.

**Compilar o APK (qualquer PC com Java 21 e o Android SDK 36; no do Pedro estão em `C:Userspedroandroid-tools`):**
1. `npm run cap:sync`.
2. Em `android/`, criar `local.properties` com `sdk.dir=C:/caminho/do/sdk` (não vai para o git) e correr
   `./gradlew assembleDebug` (com `JAVA_HOME` no Java 21). O ficheiro sai em `android/app/build/outputs/apk/debug/app-debug.apk`.
3. Instalar: copiar o APK para o telemóvel e abri-lo (aceitar "instalar apps desconhecidas"), ou `adb install -r app-debug.apk`.
   Para testar contra o PC: `CAP_SERVER_URL=http://<ip do PC>:3001 npm run cap:sync` antes de compilar.

**Notificações no Android (FCM)** precisam de um projeto Firebase (gratuito) da Ace Labs:
1. console.firebase.google.com, criar o projeto, acrescentar uma app Android com o nome de pacote `pt.acelabs.cockpit`.
2. Descarregar o `google-services.json` para `android/app/` (**fora do git**, já está no .gitignore) e voltar a compilar.
3. Em Definições do projeto, Contas de serviço, gerar uma chave privada nova (JSON). Guardá-la como segredo da função:
   `supabase secrets set FCM_SERVICE_ACCOUNT="$(cat chave.json)"` e publicar de novo `enviar-teste` e `enviar-lembretes`.
4. No Supabase correr `migracao_notificacoes.sql` outra vez (acrescenta o tipo `android` e a função `registar_push_nativo`).
Sem o `google-services.json` a app funciona na mesma, só não recebe notificações.

**Antes de pôr na Google Play (a fazer):** conta de programador Google (25 USD, uma vez; para empresa pede também D-U-N-S),
chave de assinatura própria (`keytool -genkey` e `android/keystore.properties`, nunca no git), `./gradlew bundleRelease`
(ficheiro .aab) e a ficha da loja. Para o piloto chega distribuir o APK diretamente.

**Estado:** o APK de debug compila e o manifesto está validado (permissões, nome, ícone). **Ainda não testado num telemóvel
nem num emulador:** arranque, impressão digital, agenda, contactos, partilha e push.

## 10. Um só deploy para vários clientes (escolha do cliente por código)

Para a app da App Store (e para um único `cockpit.acelabs.pt`), em vez de um deploy por cliente: na Vercel define-se UMA variável
`COCKPIT_CLIENTES` com a lista, e cada pessoa escreve o código da sua empresa no primeiro arranque.

```
COCKPIT_CLIENTES=[{"codigo":"alvorada","nome":"Alvorada Imóveis","url":"https://xxx.supabase.co","anon":"<chave anon>"}]
```

- Só a chave pública (anon). **Nunca** a service_role. Cada cliente continua com o seu Supabase e os seus dados.
- Sem `COCKPIT_CLIENTES` tudo funciona como antes, com `NEXT_PUBLIC_SUPABASE_URL` e `_ANON_KEY` fixos (um deploy por cliente).
- O código escolhido fica num cookie (`cockpit-cliente`, 1 ano). Quem ainda não escolheu vai para `/cliente`; no login há "Mudar de empresa".
- Convites: o link do email tem de abrir `https://cockpit.acelabs.pt/convite/<código>`, que escolhe o cliente e segue para escolher a password.
  Acrescentar `https://cockpit.acelabs.pt/convite/*` aos Redirect URLs do Supabase desse cliente. A plataforma de controlo faz isto sozinha
  se o cliente tiver o campo "código na app" preenchido (na função `admin`, o segredo `APP_CODIGO`).
- As chaves VAPID das notificações web são as mesmas para todos os clientes do deploy.
- A política de segurança de conteúdos aceita só o Supabase de cada cliente da lista (`next.config.mjs`): mudar a lista pede novo deploy.
- Gerar o valor sem erros de JSON: `npm run clientes` lê `clientes-cockpit.json` (fora do git), confere cada entrada e imprime a
  linha para colar na Vercel. Recusa a chave `service_role`, e a app também ignora uma entrada com essa chave (`eChaveSecreta` em `lib/clientes.ts`).
- Teste: `npm run testar -- clientes` (arranca o seu próprio servidor na porta 3003).

## 11. Apagar a conta

Em Conta, "Apagar a minha conta" chama a função `apagar_minha_conta()` (`migracao_apagar_conta.sql`), que apaga o utilizador e, em cascata,
o registo de membro e os aparelhos de notificações. Os contactos, compradores e angariações ficam na empresa (são dados dela, partilhados
pelos membros). Não deixa apagar o último membro. Ainda por testar contra um Supabase com a migração corrida.

## 13. Um projeto Supabase partilhado, com várias empresas (o modelo a usar)

**Decisão (2026-10-30):** o Cockpit passa a correr num só projeto Supabase, com todos os clientes lá dentro, separados por
`empresa_id`. É mais barato (sem custo fixo por cliente), um cliente novo demora minutos e as migrações correm uma só vez.
Os projetos "um Supabase por cliente" das secções anteriores continuam a funcionar (uma base com uma só empresa
comporta-se como antes). O CPCV mantém um projeto por cliente.

- `migracao_multiempresa.sql` (a última de `npm run sql`): cria `empresas`, liga cada membro a UMA empresa (`membros.empresa_id`),
  põe `empresa_id` em todas as 14 tabelas de dados e troca a regra de acesso para "da minha empresa". Os pedidos da app não
  mudam: a base de dados filtra sozinha, e a empresa é preenchida sozinha em cada INSERT. Em bases que já tinham dados, tudo
  passa para uma empresa chamada `padrao`.
- **Isolamento:** `npm run testar -- unidade-multiempresa` corre as migrações reais num Postgres em memória e prova, nas 14 tabelas,
  que uma empresa não vê, não altera, não apaga nem passa linhas para outra, que quem não é membro não vê nada, que uma empresa
  suspensa perde o acesso, e que a migração de uma base antiga e duas corridas seguidas são seguras. **Nunca saltar este teste.**
- Gerir empresas: `node scripts/empresa.mjs listar | criar <código> "<nome>" | suspender | reativar | apagar <código> --confirmo`
  (`--env .env.xxx` para outro projeto). Convidar: `node scripts/convidar.mjs <email> <endereço da app> <código da empresa>`.
- **Quem escreve com a chave de administrador** (scripts, testes, plataforma de controlo) tem de indicar a empresa quando existe
  mais do que uma: sem `empresa_id` o INSERT falha de propósito, nunca escolhe uma ao acaso. Com uma só empresa usa essa.
- **Plataforma de controlo:** cada cliente leva o campo "código da empresa". Com ele, só vê e só mexe em contas dessa empresa
  (recusa agir sobre contas de outra), e o código vai dentro do pedido assinado à função `admin`.
- Notificações: `enviar-lembretes` envia a cada empresa só os lembretes das suas tarefas, para os aparelhos dos seus membros.
- Uma empresa **suspensa** (`suspensa = true`) deixa de ver dados; nada se apaga. Apagar uma empresa apaga os dados dela
  (cascata) e o `apagar` do script apaga as contas de login dos membros.
- A demonstração da Apple vive numa empresa própria (`demo`) dentro do mesmo projeto, com a conta de revisão como membro.
- Como o projeto é único, **não se usa `COCKPIT_CLIENTES` nem o ecrã do código da empresa**: a Vercel só leva
  `NEXT_PUBLIC_SUPABASE_URL` e `_ANON_KEY`. (A escolha por código continua no código para quem precisar de projetos separados.)
- Limitações conhecidas: restaurar a cópia de segurança de UM cliente isoladamente é trabalhoso (a cópia é do projeto inteiro);
  uma linha pode apontar para o id de uma linha de outra empresa (não lê nada, os ids não se adivinham), mas não há verificação
  entre tabelas.

**Para migrar um projeto que já existe:** correr `migracao_multiempresa.sql` no SQL Editor, `node scripts/empresa.mjs listar`
para confirmar a empresa `padrao`, e `npm run seguranca` (tem de acabar em "Tudo em ordem.").

## 12. Montar o projeto Demo (e a conta de revisão), passo a passo

O Demo serve a Apple (TestFlight e App Store) e as demonstrações. Dados só fictícios. Sempre ligado, projeto Supabase próprio.

1. Supabase, Project Settings, API: anotar o URL, a chave `anon` e a `service_role`.
2. Criar `servicos/cockpit-app/.env.demo` (fora do git, nunca partilhar):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<referência>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
   SUPABASE_SERVICE_ROLE_KEY=<service_role>
   DEMO_PERMITIDO_EM=<referência, a parte antes de .supabase.co>
   ```
3. `npm run sql` e colar `instalar_tudo.sql` no SQL Editor do Demo (Run). Cria tabelas, segurança, notificações e apagar conta.
4. Supabase, Authentication, Sign In / Providers: desligar "Allow new users to sign up".
5. `node scripts/verificar-seguranca.mjs .env.demo` tem de acabar em "Tudo em ordem.".
6. Semear a carteira fictícia: `npx tsx --tsconfig tsconfig.json scripts/demo.ts` (usa o `.env.demo`; `--limpar` apaga o que criou).
7. Conta de revisão: `node scripts/revisao-apple.mjs` (email `revisao.apple@acelabs.pt`, ou outro como argumento). Imprime a
   password uma vez e guarda-a em `.demo-revisao.txt` (fora do git). Ir para as notas de revisão do TestFlight e da App Store.
8. No projeto partilhado (secção 13) não há lista de clientes: o `demo.ts` e o `revisao-apple.mjs` usam a empresa `demo` (criada
   sozinha). Se o Demo foi montado ANTES da migração multiempresa, depois de a correr: `node scripts/empresa.mjs renomear padrao demo "Ace Labs Demo"`.
   (`npm run clientes` e `COCKPIT_CLIENTES` só servem para o modo de projetos separados.)
9. SMTP (Resend) e Redirect URLs do Demo: secções 2 e 10 acima.

## O que ainda não existe

- **Vários utilizadores no mesmo cliente** (agência com agentes e gestor): hoje quem entra vê tudo. Está desenhado, não construído.
- **Pedidos de acesso e de apagamento de dados de uma pessoa**: na ficha de cada comprador e proprietário há "Exportar os dados deste contacto" (descarrega um ficheiro JSON com tudo o que a app guarda sobre a pessoa) e "Apagar". Falta o contrato de tratamento de dados com o cliente, que é o que os enquadra.
- Contrato de tratamento de dados e política de privacidade publicada: ver `docs/privacidade-rascunho.md`.
