# Cockpit: guia interno do beta (Pedro e Miguel)

Escrito a 2026-11-10. Para quem dá acesso aos agentes do beta e acompanha o teste. Nunca escrever aqui passwords nem chaves:
só onde vivem. O processo completo de um cliente (linha do tempo D-3 a D+30) está em `docs/cockpit-admin-e-onboarding.md`; a
instalação técnica em `servicos/cockpit-app/LEIAME.md`; a plataforma de controlo em `servicos/controlo/LEIAME.md`.

Para o agente há uma página própria: `docs/cockpit-beta-guia-agente.html`.

## 1. Ponto da situação e o que falta

A empresa Ace Labs é constituída na sexta-feira, 2026-11-13. O que depende dela está assinalado.

| O quê | Estado | Dono | Quando |
|---|---|---|---|
| **DNS de `cockpit.acelabs.pt`** | Falta. O domínio já está ligado ao projeto `cockpit` na Vercel, mas a Vercel pede dois registos no DNS do `acelabs.pt` (servidores `host-redirect.com`): **CNAME** `cockpit` -> `4285a9310e08654c.vercel-dns-017.com.` e **TXT** `_vercel` com o valor de verificação que aparece na Vercel (projeto `cockpit` > Settings > Domains > View DNS configuration). **Sem isto a app Android, a app do iPhone e os emails de convite (o Site URL do Supabase) não funcionam.** | Pedro | Antes de tudo o resto |
| Confirmar o domínio | Depois do DNS: carregar em "Refresh" na Vercel e abrir `https://cockpit.acelabs.pt/login`. O TXT pode apagar-se depois de verificado. | Pedro | Logo a seguir |
| **Conta Google Play pessoal** | Por criar (25 USD, uma vez). O teste interno (até 100 pessoas, sem revisão) fica logo disponível. A produção, numa conta pessoal, exige antes um teste fechado com 12 testadores durante 14 dias seguidos. | Pedro | Esta semana |
| Passar a app para a conta da empresa | Quando a Ace Labs tiver D-U-N-S (pede-se depois de constituída; pode demorar dias ou semanas). A Google permite transferir a app entre contas. | Pedro | Depois de 2026-11-13 |
| **APK assinado por link direto** | Enquanto a Play não está pronta. Compila-se com a mesma chave de produção (`android/cockpit-release.keystore`, só no PC do Pedro) e põe-se num link. O agente instala e mais tarde passa para a Play sem perder nada. Link: **https://gebqaxhwebsmoeqpzzzg.supabase.co/storage/v1/object/public/apk/cockpit-beta.apk** | Pedro | Esta semana |
| **Teste num Android real** | Nunca foi feito. Antes do primeiro agente: arranque, login, convite, notificações, impressão digital, agenda, contactos, partilha. | Pedro ou Miguel (quem tiver um Android) | Antes do 1.º convite |
| iPhone | Agora: abrir o Cockpit no Safari > Partilhar > Adicionar ao ecrã principal (notificações a partir do iOS 16.4, só aberto pelo ícone). TestFlight quando houver conta Apple de organização (ver `docs/cockpit-testflight-piloto.md`). | Miguel (Mac) | TestFlight depois da empresa |
| Ficha da Play Store | Pronta em `servicos/cockpit-app/loja/` (ícone, imagem de destaque, capturas, textos). Política de privacidade publicada em `https://www.acelabs.pt/privacidade-cockpit.html`. | Feito | |
| **Reportar um problema** (botão de ajuda dentro da app: texto, captura do ecrã e áudio, aviso por email ao Pedro e ao Miguel) | Em construção | Pedro (com o Claude) | Antes do 1.º convite |
| **Registo de acessos** (página "Acessos" na Torre: que serviços, que conta, onde está cada credencial, nunca a password) | Em construção | Pedro (com o Claude) | Esta semana |

## 2. Dar acesso a um agente

Todos os agentes do beta entram no projeto Supabase partilhado `gebqaxhwebsmoeqpzzzg` (na consola: "Cockpit - partilhado"). Cada
pessoa pertence a uma só empresa e só vê os dados dessa empresa.

### 2.1 Escolher ou criar a empresa

- Uma agência = uma empresa. Um agente sozinho também é uma empresa.
- **Nunca** pôr agentes reais na empresa `demo` (tem a conta de revisão da Apple) nem na `ensaio` (é onde correm os testes).
- Pela plataforma de controlo (recomendado, fica no registo de ações): `cd servicos/controlo && npm run dev`, abrir
  `http://localhost:3002`, Painel do Cockpit > nova empresa. Pôr o estado **piloto** e quem acompanha (pedro ou miguel).
- Ou pela linha de comandos, dentro de `servicos/cockpit-app`:

  ```
  node scripts/empresa.mjs listar --env .env.demo
  node scripts/empresa.mjs criar <código> "<Nome da agência>" --env .env.demo
  ```

  O `.env.demo` é o ficheiro (fora do git) com o URL e a chave de administrador do projeto partilhado. O `.env.local` já aponta
  para o mesmo projeto, mas não tem a chave de administrador.

### 2.2 Convidar a pessoa

**Opção A, convite por email (recomendada):** a pessoa recebe um email, abre o link e escolhe a própria password. Nenhuma
password passa por nós.

- Na plataforma de controlo: página da empresa > Utilizadores > Convidar.
- Ou na linha de comandos, dentro de `servicos/cockpit-app`. Atenção: o `convidar.mjs` lê o `.env.local`, que não tem a chave
  de administrador; é preciso passar as duas variáveis do projeto partilhado:

  ```
  export NEXT_PUBLIC_SUPABASE_URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.demo | cut -d= -f2-)
  export SUPABASE_SERVICE_ROLE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.demo | cut -d= -f2-)
  node scripts/convidar.mjs <email> https://cockpit.acelabs.pt <código da empresa>
  ```

  Tem de dizer "Convite enviado" e "Juntado à lista de membros". Enquanto o DNS de `cockpit.acelabs.pt` não estiver feito, usar
  `https://cockpit-gamma-one.vercel.app` como endereço.

**Opção B, password temporária:** na plataforma de controlo, página da empresa > Utilizadores > password temporária. É
mostrada uma única vez: passá-la à pessoa por telefone ou em mão, nunca por escrito no mesmo canal que o email. A pessoa troca-a
em Conta.

### 2.3 Se o link do convite não funcionar

- **O link só funciona uma vez.** Se a pessoa o abriu duas vezes, ou o programa de email o abriu sozinho para o verificar, o
  segundo clique dá `otp_expired` ("Email link is invalid or has expired").
- Não se pode convidar o mesmo email outra vez (o Supabase responde "already been registered"). Enviar antes o email de
  recuperação de password, que leva à mesma página de escolher password:
  - Na plataforma de controlo: Utilizadores > enviar link de recuperação.
  - Ou a própria pessoa: no ecrã de login, "Esqueci a password".
- Se o link abre um endereço que não existe (`DNS_PROBE_FINISHED_NXDOMAIN` em `cockpit.acelabs.pt`): é o DNS da secção 1 que
  falta. Os endereços aceites pelo Supabase estão em Authentication > URL Configuration (hoje: `cockpit.acelabs.pt`,
  `cockpit-gamma-one.vercel.app/**` e `localhost:3001/**`).

### 2.4 Mensagem para enviar ao agente

> Olá [nome]. Obrigado por testares o Cockpit, a app da Ace Labs para o dia a dia do consultor imobiliário.
> 1. Vais receber um email "Convite para o teu Cockpit". Abre o link **uma só vez**, no telemóvel, e escolhe a tua password.
> 2. Instala a app: Android https://gebqaxhwebsmoeqpzzzg.supabase.co/storage/v1/object/public/apk/cockpit-beta.apk / iPhone: abre https://cockpit.acelabs.pt no Safari, toca em Partilhar e em "Adicionar ao ecrã principal".
> 3. Entra com o teu email e a password.
> O guia rápido está aqui: [LINK_GUIA]. Se alguma coisa falhar ou não fizer sentido, usa o botão de ajuda no canto inferior
> esquerdo da app (podes escrever, tirar a captura do ecrã ou gravar um áudio). Qualquer dúvida, pedro@acelabs.pt.

## 3. Checklist antes de convidar o primeiro agente

- [ ] DNS de `cockpit.acelabs.pt` feito e `https://cockpit.acelabs.pt/login` abre o Cockpit.
- [ ] Último deploy do Cockpit feito, com o SQL pendente corrido antes (ver `servicos/cockpit-app/DEPLOY_PENDENTE.md`).
- [ ] `node scripts/verificar-seguranca.mjs .env.demo` acaba em "Tudo em ordem." e `npm run testar -- unidade-multiempresa` passa.
- [ ] APK assinado instalado e testado num Android real (lista "O que testar" de `docs/cockpit-testflight-piloto.md`, adaptada).
- [ ] No iPhone, a app no ecrã principal entra, recebe a notificação de teste (Conta > Enviar teste).
- [ ] "Reportar um problema" funciona: um reporte de teste chega por email ao Pedro e ao Miguel com captura e áudio.
- [ ] Empresa do agente criada (estado piloto, quem acompanha definido), nunca a `demo` nem a `ensaio`.
- [ ] Um convite de teste para um email nosso chega e o link leva a "escolhe a tua password".
- [ ] Analytics: decidir e ligar (PostHog ou outro) antes do primeiro agente, ou aceitar começar só com o painel do controlo.
- [ ] Guia do agente com os links certos (nenhum marcador do tipo LINK_ por preencher; os de APK e app já estão feitos, falta o do guia).
- [ ] Combinado quem responde aos reportes e em quanto tempo.

## 4. Acompanhar o beta

### Duração e ritmo

4 a 6 semanas, 5 a 15 agentes de 2 ou 3 agências diferentes (nunca só uma).

| Quando | O quê | Onde |
|---|---|---|
| Todos os dias (5 minutos) | Reportes de erro novos: responder ao agente no mesmo dia, mesmo que seja "visto, vamos corrigir" | Email do reporte |
| D+1 de cada agente | Entrou? Importou contactos? Tem notificações? Se não, ligar | Plataforma de controlo > Painel |
| Semanas 1 e 2 | Sessão de arranque de 20 a 45 minutos e primeira tarefa guiada (ver `docs/cockpit-admin-e-onboarding.md`) | Videochamada ou presencial |
| Semanas 3 e 4 | Check-in semanal de 10 minutos (WhatsApp ou chamada): o que usou, o que irritou, o que falta | Notas na Torre ou no Excel de tarefas |
| Semanas 5 e 6 | Entrevista final e NPS ("De 0 a 10, recomendarias o Cockpit a um colega?") | Chamada |

### Métricas de sucesso

- 70% ou mais dos agentes usam a app pelo menos 3 vezes por semana a partir da semana 3.
- Pelo menos 2 agentes fecham o ciclo completo: comprador, angariação e um alerta de correspondência resolvido.
- NPS de 7 ou mais em pelo menos 60% das respostas.
- Zero erros críticos (perda de dados, não conseguir entrar) a partir da semana 3.
- Também a ver: tempo até ao primeiro registo útil, funções nunca tocadas, número de reportes por semana (deve descer).

O painel da plataforma de controlo já mostra último acesso, telemóveis com notificações, contagens e novos registos dos
últimos 7 dias por empresa. Para medir uso por função é preciso analytics (por decidir).

### No fim do beta

- Agradecer e perguntar se querem continuar (passa a cliente, com contrato e acordo de tratamento de dados).
- Quem não continua: descarregar a cópia dos dados da empresa e entregá-la se a pedirem; **suspender** a empresa (os membros
  deixam de ver dados, nada se apaga):

  ```
  node scripts/empresa.mjs suspender <código> --env .env.demo
  ```

  ou na plataforma de controlo, estado "terminada". Apagar só no prazo combinado e escrevendo o código para confirmar
  (`node scripts/empresa.mjs apagar <código> --confirmo --env .env.demo` apaga os dados e as contas de login dos membros).
- Um agente sozinho que sai de uma agência que continua: na plataforma de controlo, Utilizadores > suspender ou apagar só essa conta.
