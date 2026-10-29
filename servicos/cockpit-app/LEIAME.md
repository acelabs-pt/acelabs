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

**Notificações nativas:** `migracao_notificacoes.sql` já aceita aparelhos `ios`. Publicar as funções `enviar-teste` e
`enviar-lembretes` (usam `supabase/functions/_shared/push.ts`) e acrescentar aos segredos da função: `APNS_KEY_ID`,
`APNS_TEAM_ID`, `APNS_KEY_P8` (conteúdo do .p8), `APNS_TOPIC=pt.acelabs.cockpit`, `APNS_ENV=sandbox` (ou `production` na loja).

**Estado:** escrito e a compilar em TypeScript; a web comporta-se bem dentro do invólucro (`npm run testar -- nativo`, que
simula o WebView do iOS). **Ainda não testado num iPhone nem no simulador:** Face ID, agenda, contactos, partilha, push
nativo e o envio à Apple, e a navegação para o endereço remoto com a ponte nativa. Convém confirmar tudo isto no primeiro dia com o Mac.
Ligado na interface: Face ID ao abrir a app e ao voltar depois de 1 minuto (opção em Conta, `components/BloqueioFaceId.tsx`),
"Escolher do telemóvel" no novo comprador, "Partilhar" no relatório do proprietário, "Pôr no telemóvel" na agenda do iPhone, vibração
ao concluir tarefas e notificações. **Se um plugin nativo faltar no projeto iOS** (esquecido o `npm run cap:sync`), o Face ID
deixa de bloquear em vez de congelar a app (o Capacitor entra num ciclo infinito ao chamar um plugin que não existe).

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
- A política de segurança de conteúdos passa a aceitar `*.supabase.co` quando `COCKPIT_CLIENTES` existe.
- Teste: `npm run testar -- clientes` (arranca o seu próprio servidor na porta 3003).

## 11. Apagar a conta

Em Conta, "Apagar a minha conta" chama a função `apagar_minha_conta()` (`migracao_apagar_conta.sql`), que apaga o utilizador e, em cascata,
o registo de membro e os aparelhos de notificações. Os contactos, compradores e angariações ficam na empresa (são dados dela, partilhados
pelos membros). Não deixa apagar o último membro. Ainda por testar contra um Supabase com a migração corrida.

## O que ainda não existe

- **Vários utilizadores no mesmo cliente** (agência com agentes e gestor): hoje quem entra vê tudo. Está desenhado, não construído.
- **Pedidos de acesso e de apagamento de dados de uma pessoa**: na ficha de cada comprador e proprietário há "Exportar os dados deste contacto" (descarrega um ficheiro JSON com tudo o que a app guarda sobre a pessoa) e "Apagar". Falta o contrato de tratamento de dados com o cliente, que é o que os enquadra.
- Contrato de tratamento de dados e política de privacidade publicada: ver `docs/privacidade-rascunho.md`.
