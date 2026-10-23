# Cockpit: instalar para um cliente

Modelo: **um projeto Supabase e uma instalação por cliente** (consultor individual). Nada se partilha entre clientes.
Cada cliente tem o seu endereço, a sua base de dados e os seus utilizadores. Fazer esta lista por ordem.

## 1. Base de dados (Supabase)

1. Criar um projeto novo com o nome do cliente, numa região da UE (ex.: Irlanda, `eu-west-1`).
2. No **SQL Editor**, correr por esta ordem, cada ficheiro uma vez:
   1. `create_tables.sql`
   2. `migracao_zonas_correspondencias.sql`
   3. `migracao_escala.sql`
3. Copiar o **Project URL** e a chave **anon** (Settings, API). Estas duas vão para a Vercel. A chave `service_role` **nunca** vai para a Vercel nem para o repositório.

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

## O que ainda não existe

- **Vários utilizadores no mesmo cliente** (agência com agentes e gestor): hoje quem entra vê tudo. Está desenhado, não construído.
- **Exportar os dados de um contacto** (pedido do RGPD): a app apaga contactos, não exporta.
- Contrato de tratamento de dados e política de privacidade publicada: ver `docs/privacidade-rascunho.md`.
