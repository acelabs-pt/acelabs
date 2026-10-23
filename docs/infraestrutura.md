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
| Cockpit (ensaio) | Vercel `cockpit` (equipa `acelabs1`), `https://cockpit-gamma-one.vercel.app`; Supabase de teste "Cockpit" | Pedro | Publicado por CLI (`vercel deploy --prod` em `servicos/cockpit-app`), com o Git **desligado** de propósito: um push não atualiza nenhum cliente. Um projeto Vercel e um Supabase por cliente. Passos em `servicos/cockpit-app/LEIAME.md` |

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

Um projeto Supabase por cliente. Nunca reutilizar chaves entre projetos.

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
