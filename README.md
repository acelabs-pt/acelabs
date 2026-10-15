# Ace Labs

IA para o setor imobiliário. Sócios: Miguel e Pedro Roque. Site público: https://www.acelabs.pt

Este repositório é **público**: nunca pôr aqui chaves, tokens, dados de clientes nem minutas reais.

## O que há aqui

| Pasta | O que é |
|---|---|
| `site/` | Site público (HTML estático, sem build). Publicado na Vercel a partir de `main`. |
| `infra/acelabs-api/` | Função de contacto (Resend) deployada por CLI. Ver o README da pasta. |
| `servicos/cpcv-engine/` | App Next.js/Supabase do serviço "CPCV com IA" (tem README e CLAUDE.md próprios). |
| `servicos/cockpit/` | App do Cockpit, em desenvolvimento (tem CLAUDE.md próprio). |
| `docs/` | Plano de negócio, briefing, catálogo, manuais e a documentação de infraestrutura. |
| `.claude/skills/` | Skills partilhadas do Claude Code (design, verificação no browser). |

Regras de trabalho, identidade visual e preçário: ver `CLAUDE.md`.

## Publicar o site

Push para `main` publica em produção (Vercel, Root Directory `site`). Antes de fazer push:

```bash
git pull
# verificar no browser (script Playwright descartável, ver .claude/skills/browser-check)
git add <ficheiros>
git commit -m "..."
git push origin main
```

Não editar nem enviar ficheiros pela interface web do GitHub (já partiu o site uma vez com um nome
de ficheiro trocado). `site/index.html` tem de se chamar sempre `index.html`.

## Ver o site localmente

```bash
cd site
npx serve -l 4173 .
# http://localhost:4173
```

## Onde está cada coisa

Contas, projetos, DNS, variáveis de ambiente e o que fazer em caso de incidente:
**`docs/infraestrutura.md`**.

## Segurança

- O site envia cabeçalhos de segurança (CSP, X-Frame-Options, etc.) definidos em `site/vercel.json`.
  Ao acrescentar um serviço externo (analytics, fontes, vídeo), é preciso permiti-lo na CSP.
- Segredos só em variáveis de ambiente da Vercel e em ficheiros `.env.local` fora do git.
- Dados pessoais recolhidos: só o formulário de contacto (nome, telefone/email, mensagem), enviados
  por email via Resend. Ver `docs/privacidade-rascunho.md`.
