# Ace Labs Controlo

Plataforma interna dos sócios (Pedro e Miguel) para gerir os clientes: **quem tem acesso** ao Cockpit e ao CPCV de cada
cliente, e **se a instalação deles está em ordem**. **Corre só no computador de cada sócio. Nunca se publica.**

Um cliente = um projeto Supabase próprio (regra do projeto). Aqui regista-se cada um e, a partir daí, cria-se, suspende-se
e apaga-se utilizadores sem entrar no painel do Supabase.

## Arrancar

1. `npm install`
2. `npm run password -- "uma password com 12 ou mais caracteres"` e copiar as duas linhas para `.env.local`
   (`CONTROLO_PASSWORD_HASH` e `CONTROLO_SEGREDO`). Cada sócio escolhe a sua.
3. `npm run dev` e abrir http://localhost:3002

## Dois modos de administrar um cliente

| Modo | Como funciona | Quando usar |
|---|---|---|
| **Função** (recomendado) | A app assina o pedido (Ed25519, válido 2 minutos, só para esse projeto) e envia-o à função `admin` publicada no Supabase do cliente. A chave de administrador nunca sai de lá. | Sempre que possível, e em todos os clientes reais |
| **Chave** (provisório) | A app usa a chave `service_role` do cliente, guardada em `.env.local` como `CHAVE_<ID DO CLIENTE>` | Para começar já, enquanto a função não está publicada |

### Preparar o modo função (uma vez, mais uma vez por cliente)

1. **Par de chaves da equipa**, uma vez: `npm run chaves`. A linha `CONTROLO_CHAVE_PRIVADA=...` vai para o `.env.local` de cada
   sócio (nunca para o git). A chave pública vai para cada cliente.
2. **Em cada cliente**, com a CLI do Supabase ligada ao projeto dele (`supabase link --project-ref <ref>`), dentro desta pasta:
   ```
   supabase functions deploy admin --no-verify-jwt
   supabase secrets set CONTROLO_CHAVE_PUBLICA="<chave pública>" PRODUTO=cockpit APP_URL=https://cockpit.acelabs.pt APP_CODIGO=<código do cliente na app, só se a app tiver vários clientes>
   ```
   (`PRODUTO` é `cockpit` ou `cpcv`.) Depois, em "Novo cliente", escolher "Função no Supabase do cliente".

## O que se faz em cada cliente

- **Estado da instalação:** tabelas e migrações em falta, registo público ainda ligado, contas fora da lista de membros.
  Cada ponto por resolver diz o que fazer.
- **Utilizadores:** lista com papel, último acesso e estado.
  - **Cockpit:** convite por email (a pessoa escolhe a própria password) ou password temporária. Fica logo na lista de membros.
  - **CPCV:** cria a conta com password temporária (mostrada uma única vez) e o perfil com o papel: `agente`, `gestora` ou `admin`.
  - **Suspender / reativar:** impede ou devolve o acesso sem apagar nada.
  - **Apagar:** remove a conta (pede confirmação).
- Se a conta é criada mas o perfil falha (por exemplo, falta uma migração), a conta é anulada: nunca fica uma conta a meio.

## Segurança

- A lista de clientes (`dados/clientes.json`) e o `.env.local` estão no `.gitignore`. O repositório é público.
- A lista não tem segredos (a chave `anon` é pública por definição). A chave de administrador só existe no modo "chave", em `.env.local`.
- Entrada com password (guardada só como hash) e cookie assinado de 8 horas; 5 tentativas erradas bloqueiam 1 minuto.
- Os pedidos assinados não têm proteção contra repetição dentro dos 2 minutos de validade (aceitável para um uso interno em localhost).
- Se uma chave privada de um sócio for exposta: `npm run chaves` de novo e atualizar `CONTROLO_CHAVE_PUBLICA` em cada cliente.

## Testes

`npm run testar` corre as assinaturas e usa a app num browser contra os projetos Supabase de **teste** (os de `cockpit-app` e
`cpcv-engine`; recusa correr noutro). Cria contas de teste e apaga-as no fim. Cobre: login, a lista, o fluxo completo (criar,
entrar com a password temporária, suspender, reativar, apagar) em modo chave e em modo função (com um servidor local a fazer de
função `admin`), e o aviso de migrações em falta.

## O que ainda falta

- Publicar a função `admin` em cada cliente (precisa da CLI do Supabase e do projeto de cada um).
- **Convidar para o CPCV por email:** o CPCV ainda não tem o ecrã "escolher password" do convite, por isso hoje a conta é criada com password temporária. Quem a recebe pode trocá-la em `/cpcv/conta` (link "Conta" no cabeçalho do CPCV).
- **Papéis do Cockpit para agências** (gestor e agente): o Cockpit ainda só tem "membro". Quando existir, acrescentar em `PAPEIS` (`supabase/functions/_shared/nucleo.ts`).
- Ecrã para correr as migrações SQL a partir daqui (hoje corre-se no SQL Editor do Supabase).
