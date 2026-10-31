# Infraestrutura e operação

Última revisão: 2026-10-15. Manter este ficheiro atualizado quando algo mudar.
**Nunca escrever aqui valores de chaves**, só onde vivem.

## Mapa

| Peça | Onde | Quem gere | Notas |
|---|---|---|---|
| Código | GitHub `acelabs-pt/acelabs` (público) | Ambos | `main` publica em produção |
| Site `www.acelabs.pt` | Vercel, projeto `ace-labs`, Root Directory `site` | Miguel (conta dele) | Pedro sem acesso ainda; pedir convite à equipa |
| API de contacto | Vercel, projeto `acelabs-api`, equipa `acelabs1` (Pedro) | Pedro | `https://acelabs-api.vercel.app/api/contacto`; código em `infra/acelabs-api/` |
| Email transacional | Resend, domínio `acelabs.pt` (região Irlanda) | Pedro | Verificado em 2026-10-14 |
| Email da equipa | Google Workspace (MX `smtp.google.com`) | Ambos | Caixas `miguel@` e `pedro@acelabs.pt` |
| DNS | Registo do domínio `acelabs.pt` | Pedro | Ver "DNS" abaixo |
| CPCV com IA | Vercel `cpcv-engine` (equipa `acelabs1`) + Supabase | Pedro | Chave Anthropic na Vercel |
| Cockpit (ensaio) | Vercel `cockpit` (equipa `acelabs1`), `https://cockpit-gamma-one.vercel.app`; Supabase Demo (desde 2026-10-30; antes o de teste "Cockpit") | Pedro | Publicado por CLI (`vercel deploy --prod` em `servicos/cockpit-app`), com o Git **desligado** de propósito: um push não atualiza nenhum cliente. Um projeto Vercel e um Supabase por cliente. Passos em `servicos/cockpit-app/LEIAME.md` |

## Aplicações, bases de dados e pastas (revisto em 2026-10-28)

Regra (revista em 2026-10-30): **CPCV: um projeto Supabase por cliente. Cockpit: um projeto Supabase partilhado, com várias
empresas isoladas por `empresa_id`** (`servicos/cockpit-app/migracao_multiempresa.sql`); a Ace Labs tem ainda um projeto de teste. Só se
escrevem aqui nomes e endereços públicos, nunca chaves.

| Aplicação | Pasta | Supabase (ref) | Vercel | Estado |
|---|---|---|---|---|
| CPCV com IA (e painel genérico) | `servicos/cpcv-engine` | `txlrzhltxrjkopjwrdsd` | projeto `cpcv-engine`, equipa `acelabs1`, deploy automático do `main` | Em uso para testes com a solicitadora; migrações até `migration_fase15.sql` corridas em 2026-10-28 |
| Cockpit (a que fica) | `servicos/cockpit-app` | `gebqaxhwebsmoeqpzzzg` ("Demo", projeto partilhado de ensaio, com várias empresas, notificações e administração aplicadas; desde 2026-10-30 é o que a Vercel usa). O antigo `erxnqdadqbmfeyuwaybi` (carteira de demonstração) ficou sem uso na Vercel e sem as migrações novas | projeto `cockpit`, equipa `acelabs1`, `https://cockpit-gamma-one.vercel.app` (ensaio, deploy por CLI) | Ainda sem cliente real. Aplicadas: segurança, notificações, multiempresa e administração. A 2026-10-31: SQL do Miguel (tabelas `visitas_externas` e `propostas_externas` com a regra "da minha empresa", colunas novas em `comprador_imoveis`, `referencia` em `angariacoes`), chaves VAPID das notificações web (Vercel e segredos das funções) e empresa "ensaio" com contas de teste. SQL dos lembretes automáticos (pg_cron) entregue ao Pedro a 2026-10-31: confirmar que correu. Vercel no plano Hobby: só o Pedro publica. Último deploy: 2026-10-31, commit `401f9c4` do Miguel (antes, no mesmo dia, o `018a93b`), sem SQL novo (o Demo já tinha as tabelas e colunas; `migration_externas_empresa.sql` não se corre no Demo, é da base antiga do Miguel) |
| Notificações Android | Firebase, projeto `ace-labs-cockpit` (plano Spark, conta Google do Pedro; falta acrescentar o Miguel como proprietário) | Pedro | App Android `pt.acelabs.cockpit`. `google-services.json` em `servicos/cockpit-app/android/app/` e chave de conta de serviço em `.env.fcm-chave.json`, ambos fora do git. A chave está também como segredo `FCM_SERVICE_ACCOUNT` no Supabase Demo, onde estão publicadas as funções `enviar-teste`, `enviar-lembretes` e `admin` (2026-10-30). Token de acesso da CLI do Supabase (`acelabs-cli-permanente`, sem expiração, só Demo: funções e segredos) em `servicos/cockpit-app/.env.supabase-cli`, fora do git |
| Controlo (interno) | `servicos/controlo` | nenhum próprio (administra o de cada cliente) | **nunca publicado**: corre em `localhost:3002` no computador de cada sócio | Convidar, suspender e apagar utilizadores do Cockpit e do CPCV de cada cliente e ver o estado da instalação. Ver `servicos/controlo/LEIAME.md` |
| Cockpit antigo | `servicos/cockpit` | o mesmo de teste | nenhum | A eliminar quando o Pedro confirmar |
| Site | `site/` | nenhum | projeto `ace-labs`, conta do Miguel | `main` publica em produção |
| API de contacto | `infra/acelabs-api/` | nenhum | `acelabs-api`, equipa `acelabs1` | Resend |

**Ainda não existem (a criar):** Supabase "Ace Labs Demo" (sempre ligado, para a Apple e demonstrações), Supabase do
primeiro cliente real do Cockpit, projeto Vercel Pro com `cockpit.acelabs.pt`, conta Apple Developer, chave de
notificações da Apple, política de privacidade publicada.

**Onde vive cada segredo** (nomes das variáveis):
- CPCV: `.env.local` e Vercel `cpcv-engine`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `DASHBOARD_PASSWORD`, `AUTH_SECRET`, `CPCV_INVITE_ADMIN`,
  `CPCV_AGENCIA_NOME`, `CPCV_AGENCIA_AMI`.
- Cockpit: `.env.local` e Vercel `cockpit`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e, para as
  notificações, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. A `service_role` do Cockpit
  nunca vai para a Vercel (só para os testes locais, em `.env.testes`).
  Com um só deploy para vários clientes (app da App Store): em vez do par `NEXT_PUBLIC_SUPABASE_*` fixo, `COCKPIT_CLIENTES`
  (JSON com código, nome, endereço do Supabase e chave anon de cada cliente; só chaves públicas). Ver `servicos/cockpit-app/LEIAME.md`.
- Os valores nunca vão para o git (`.env*` está no `.gitignore`).

**Ficheiros locais que não vão para o git** (repositório público): `docs/PLATAFORMA CPCV.zip` e
`docs/feedback_reuniao_*.docx` (dados reais de clientes), `servicos/cpcv-engine/minutas/`, `business-center/`.

## Fluxo do formulário de contacto

1. `site/contacto.html` valida (nome, mensagem e telefone ou email) e faz `POST /api/contacto`.
2. Se esse endpoint do site falhar (404/405/5xx), repete para `https://acelabs-api.vercel.app/api/contacto`.
3. A função valida de novo (limites de tamanho, honeypot), e envia por Resend para
   `miguel@acelabs.pt` (bcc `pedro@acelabs.pt`), `from: Ace Labs <site@acelabs.pt>`.

Se parar de funcionar: ver "Incidentes".

## Variáveis de ambiente

| Nome | Onde | Para quê |
|---|---|---|
| `RESEND_API_KEY` | Vercel `acelabs-api` (Production). Opcional também em `ace-labs`. | Enviar o email do formulário |
| `ANTHROPIC_API_KEY` | Vercel `cpcv-engine` e `servicos/cpcv-engine/.env.local` | Extração de dados do CPCV |
| Supabase (URL e chaves) | Vercel `cpcv-engine` e `.env.local` | Base de dados do CPCV |
| `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel `cockpit` (Production, tipo "config") e `servicos/cockpit-app/.env.local` | Ligação do Cockpit ao Supabase. A chave anon é pública por desenho. A `service_role` nunca vai para a Vercel |

CPCV: um projeto Supabase por cliente. Cockpit: um projeto partilhado com várias empresas. Nunca reutilizar chaves entre projetos diferentes.

## DNS (registos relevantes)

- **MX**: Google Workspace.
- **Resend**: `resend._domainkey` (DKIM), e registos `send` (MX e SPF) no subdomínio `send`.
- **Em falta (a fazer)**: SPF no apex (`v=spf1 include:_spf.google.com ~all`) e DMARC em `_dmarc`
  (`v=DMARC1; p=none; rua=mailto:...` e depois endurecer).
- O apex `acelabs.pt` redireciona (308) para `www.acelabs.pt`.

## Rotação de chaves

1. Resend: criar nova chave com permissão **Sending access** limitada ao domínio; atualizar na Vercel
   (`vercel env rm` e `vercel env add RESEND_API_KEY production`, em `infra/acelabs-api`); redeploy;
   testar; revogar a antiga.
2. Anthropic: criar nova, atualizar `cpcv-engine` e `.env.local`, redeploy, revogar a antiga.
3. Rodar sempre que uma chave tenha passado por chat, ecrã partilhado ou ficheiro temporário.

## Incidentes

- **Formulário não envia**: abrir https://acelabs-api.vercel.app/api/contacto com um `POST` de teste
  (`curl`). `400` = validação OK. `500 server_misconfigured` = falta `RESEND_API_KEY`. `502` = Resend
  recusou (ver Resend → Logs e se o domínio continua verificado).
- **Site em baixo ou página partida**: reverter o último commit em `main` (`git revert <sha>` e push).
- **Chave exposta**: revogar primeiro, depois criar nova, depois atualizar.
- **Fonte ou serviço externo bloqueado**: a CSP está em `site/vercel.json`; ver consola do browser.

## Segurança: estado e pendentes

Feito: HTTPS com HSTS, cabeçalhos de segurança, CSP, honeypot e limites no formulário, sem analytics
nem cookies, segredos fora do git, dados de clientes no `.gitignore`.

Pendente (ver também a lista do admin):
- SPF e DMARC no DNS.
- 2FA em Vercel, GitHub, Resend e no registo do domínio, para os dois sócios.
- Proteção do ramo `main` (impedir force-push; idealmente pull request).
- Política de privacidade publicada (rascunho em `docs/privacidade-rascunho.md`).
- Passar a equipa Vercel de Hobby para Pro (uso comercial), ou consolidar tudo numa equipa.
- Fontes: auto-alojar o Inter para não depender do Google Fonts.
