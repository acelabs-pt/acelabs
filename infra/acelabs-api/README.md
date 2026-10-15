# acelabs-api

Função serverless que recebe o formulário de contacto do site e envia o email via Resend.

- Projeto Vercel: `acelabs-api`, equipa `acelabs1` (https://acelabs-api.vercel.app/api/contacto).
- Variável de ambiente (Production): `RESEND_API_KEY`. **Nunca** vai para o repositório.
- CORS: só `https://www.acelabs.pt` e `https://acelabs.pt`.
- Aceita telefone **ou** email (pelo menos um) e tem limites de tamanho por campo.

## Deploy

A pasta não está ligada ao GitHub; faz-se por CLI a partir desta pasta:

```bash
cd infra/acelabs-api
npx vercel link --project acelabs-api --scope acelabs1   # primeira vez
npx vercel deploy --prod --scope acelabs1
```

Esta função é uma cópia de `site/api/contacto.js` com CORS. Ao alterar uma, alterar a outra.
