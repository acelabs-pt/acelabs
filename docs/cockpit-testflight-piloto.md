# Cockpit: piloto pelo TestFlight (antes da App Store)

Decisão do Pedro (2026-10-29): o piloto corre primeiro pelo TestFlight; a submissão à App Store vem depois, com o que o
piloto ensinar. Este documento é o plano. Os números da Apple (limites, prazos) são os que conhecemos hoje: confirmar no
App Store Connect, podem mudar.

## Porquê TestFlight primeiro

- A app instala-se no iPhone dos agentes do piloto sem passar pela revisão completa da App Store.
- Os erros que só aparecem num iPhone real (Face ID, notificações, agenda, contactos) apanham-se com poucas pessoas.
- Cada nova versão da casca vai para os testadores em minutos. O ecrã da app atualiza-se sozinho pela Vercel, sem build.
- Não bloqueia na política de privacidade nem nas capturas de ecrã, que a App Store exige (ver "O que o piloto dispensa").

## Os dois tipos de testadores

| | Interno | Externo |
|---|---|---|
| Quem | Até 100 pessoas que são utilizadores do App Store Connect da Ace Labs | Até 10.000 pessoas, por email ou por ligação pública |
| Revisão da Apple | Nenhuma | "Beta App Review" na primeira build de cada versão (costuma ser rápida, mas sem garantia) |
| Para quem serve | Pedro e Miguel | Os agentes do cliente piloto |
| Ressalva | Dar acesso ao App Store Connect a clientes não é boa ideia | Builds expiram 90 dias depois do envio |

**Recomendação:** Pedro e Miguel como testadores internos (testam logo que a build chega) e os agentes do piloto como
externos, por ligação pública (cada um instala a app TestFlight, abre a ligação e toca em Instalar). Nunca dar acesso ao
App Store Connect a quem é cliente.

## O que é preciso antes (por esta ordem)

1. **Conta Apple Developer** (99 USD/ano). Individual é mais rápido; Organização exige empresa e D-U-N-S. Decisão pendente.
2. **Bundle ID** `pt.acelabs.cockpit` com Push Notifications e Associated Domains.
3. **Chave APNs (.p8)** e o **Team ID**; o Team ID entra no ficheiro `public/.well-known/apple-app-site-association`
   (substituir `TEAMID`) e o `.p8` nos segredos das funções `enviar-teste` e `enviar-lembretes`. Para builds do TestFlight
   o ambiente das notificações é o de **produção** (`APNS_ENV=production`), não o sandbox.
4. **Backend do piloto**: o projeto Supabase partilhado (empresa `demo` e a do cliente piloto, ver LEIAME secção 13), SQL corrido,
   SMTP, URLs, Vercel Pro com `cockpit.acelabs.pt` ligado. É o mesmo que a App Store pede: não se evita, mas faz-se uma vez.
5. **Mac do Miguel** com Xcode: `git pull`, `npm install`, `npm run cap:sync`, `npm run cap:abrir`.
6. **App criada no App Store Connect** (nome Cockpit, português de Portugal, bundle acima).

## Estado do projeto iOS para o TestFlight

- Feito: `ITSAppUsesNonExemptEncryption = false` no `Info.plist` (a app só usa HTTPS normal), para o App Store Connect não
  perguntar sobre encriptação em cada build.
- Feito: textos de pedido de permissões (Face ID, agenda, contactos), modo de fundo para notificações, ícone 1024,
  manifestos de privacidade do Capacitor.
- Versão `1.0`, build `1`. **Cada build enviada tem de ter um número de build novo** (Xcode, separador General, Build).
  Regra simples: 1, 2, 3... e a versão só muda quando se muda de fase (1.0 piloto, 1.1 depois).
- Falta no Mac: escolher a equipa em Signing & Capabilities, confirmar as capacidades, Product > Archive, Distribute App >
  App Store Connect > Upload.

## Passo a passo do primeiro envio (Miguel, no Mac)

1. Ligar o iPhone, escolher a equipa Apple, correr no aparelho e passar a lista "O que testar" abaixo.
2. Product > Destination > Any iOS Device (arm64); Product > Archive.
3. Organizer > Distribute App > App Store Connect > Upload. Esperar o email "build processada" (alguns minutos).
4. App Store Connect > TestFlight > Test Information: descrição da beta, email de feedback (suporte da Ace Labs), contacto
   de revisão e conta de revisão (a do Demo, ver abaixo). O texto está na secção seguinte.
5. Criar o grupo interno (Pedro e Miguel) e o grupo externo "Piloto" com a ligação pública, limite igual ao número de
   agentes do piloto. Adicionar a build ao grupo externo: isto envia-a para a Beta App Review.
6. Quando aprovada, enviar a ligação aos agentes com a mensagem da secção "Mensagem para os agentes".

## Texto para o TestFlight (Test Information)

**Beta App Description (em português):**
O Cockpit é a app do consultor imobiliário que trabalha no terreno: compradores, proprietários, angariações, tarefas e agenda
num só lugar, com lembretes e Face ID. Esta versão de teste é para o piloto. Diz-nos o que não percebeste ou o que falhou.

**What to Test (em português, aparece na app TestFlight, atualizar a cada build):**
Entra com o teu email e a password que escolheste no convite. Experimenta: ver o dia, criar um comprador, ligar a partir da
ficha, pôr uma visita na agenda, ativar as notificações e o Face ID em Conta. Se algo falhar ou for confuso, tira uma
captura de ecrã dentro do TestFlight e escreve uma linha.

**Review notes (em inglês, para a Beta App Review):**
> Cockpit is a business tool provided by Ace Labs (Portugal) to real estate agencies and consultants. It is not open to the
> public: users are invited by their company, and each user only sees the data of their own company. Use the demo company
> below (fictional data only).
>
> - Email: **[email da conta de revisão]**
> - Password: **[password da conta de revisão]**
>
> The app loads its interface from https://cockpit.acelabs.pt inside the native shell; Face ID, notifications, calendar
> (write-only) and the contact picker are provided by the app and are optional. Account deletion: Account tab, "Apagar a
> minha conta".

Isto é o mesmo texto que depois serve à App Store (ver `docs/cockpit-app-store-textos.md`).

## Mensagem para os agentes do piloto

> Olá [nome]. Vais testar o Cockpit, a app que a Ace Labs está a construir para o dia a dia no terreno.
> 1. No iPhone, instala a app TestFlight (da Apple, na App Store).
> 2. Abre esta ligação no iPhone e toca em Instalar: [ligação pública].
> 3. Abre o convite que recebeste por email e escolhe a tua password. Depois abre o Cockpit e entra com o teu email e essa
>    password.
> 4. Usa-o no teu dia normal durante duas semanas. Se algo falhar ou não perceberes, tira uma captura de ecrã (na app
>    TestFlight, "Enviar feedback") ou responde a este email.
> A app de teste expira ao fim de 90 dias; avisamos antes e mandamos a nova.

## O que testar num iPhone real (antes de convidar o cliente)

- [ ] Abre e mostra o login (sem ecrã de código).
- [ ] O convite por email leva a "escolhe a tua password" (abre no Safari); depois a app entra com o email e a password.
- [ ] Duas contas de empresas diferentes nunca veem dados uma da outra (usar o Demo e uma conta de teste de outra empresa).
- [ ] Login, Dashboard, criar comprador, escolher contacto do telefone, ligar e WhatsApp a partir da ficha.
- [ ] Face ID: pede ao reabrir depois de 30 segundos fora; o ecrã nunca fica visível antes de desbloquear.
- [ ] Agenda: visita ou tarefa passa para a agenda do iPhone com alarme.
- [ ] Notificações: ativar em Conta, "Enviar teste", lembrete automático 30 minutos antes de um evento, chega com a app fechada.
- [ ] Sem rede: aparece o ecrã de "sem ligação" com a lista do dia e volta quando há rede.
- [ ] Mudar de empresa e sair: o aparelho deixa de receber notificações de quem saiu.
- [ ] Apagar a minha conta com uma conta de teste (não a do Demo): fecha a sessão e o último membro fica protegido.

## Quando o piloto passa à App Store

- A mesma app, o mesmo bundle: submete-se uma build que já correu no piloto (menos risco de rejeição).
- Entram os requisitos que o TestFlight dispensa: política de privacidade publicada, App Privacy, classificação etária,
  capturas de ecrã 6,9 polegadas, descrição e palavras-chave (tudo em `docs/cockpit-app-store-textos.md`).
- Pedir a distribuição **não listada** (Unlisted App), para os clientes instalarem por ligação sem a app aparecer na pesquisa.
- Se a Apple recusar (regra 4.2: a app não pode ser "só um site"), o argumento é o das funções nativas (Face ID,
  notificações, agenda, contactos, partilha) e o modelo B2B com conta de revisão.

## O que o piloto dispensa (para não bloquear)

- Capturas de ecrã e descrição longa da App Store.
- Classificação etária e App Privacy.
- A política de privacidade pode ser exigida para os testadores externos: **confirmar no App Store Connect, no separador
  TestFlight, ao preencher Test Information**. Se for, o bloqueio do RGPD (ver Excel, Decisões) passa a ser anterior ao
  piloto externo; a alternativa é o piloto só com testadores internos, o que não serve para um cliente.

## Atualizações durante o piloto

- Mudanças de ecrã e lógica web: push para `main` e deploy do Cockpit na Vercel. Os testadores veem-nas logo, sem nova build.
- Mudanças na casca (plugins, permissões, ícone, entitlements): nova build com número maior, Archive, Upload, e adicionar
  ao grupo "Piloto". Builds seguintes da mesma versão costumam entrar sem revisão completa.
- A cada 60 dias, enviar uma build nova (mesmo sem alterações) para nunca expirar durante o piloto.
- Feedback: TestFlight > Feedback mostra capturas e comentários; passar o que for relevante para o Excel de tarefas.
