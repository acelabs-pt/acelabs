# Conta Apple Developer como Organização: D-U-N-S passo a passo

Decisão do Pedro (2026-10-29): a conta Apple é de **Organização** (aparece "Ace Labs" na loja e no TestFlight). O D-U-N-S é o
número que a Apple usa para confirmar que a empresa existe, o nome legal e a morada. Os requisitos abaixo são os que a Apple
publica hoje; confirmar na página de inscrição, podem mudar.

## O bloqueio: a empresa tem de existir primeiro

A Apple só aceita entidades legais registadas (sociedade, Lda.). Nomes comerciais, "marca" ou pessoa singular com nome
fantasia não servem. A Ace Labs ainda não está constituída, por isso a ordem é esta:

1. Constituir a **Ace Labs, Lda.** (caminho e custos em `business-center/estrategia-pme/`: Empresa Online, cerca de 220 EUR,
   capital 5.000 EUR, Pedro e Miguel 50/50).
2. Pedir ou confirmar o **D-U-N-S** (grátis, ver abaixo).
3. Inscrever a Ace Labs no Apple Developer Program (99 USD por ano).
4. Só depois: Team ID, Bundle ID, chave APNs, App Store Connect, TestFlight.

## O que a Apple exige da empresa

| Requisito | Estado da Ace Labs |
|---|---|
| Entidade legal registada (Lda. serve) | Por constituir |
| D-U-N-S com o mesmo nome legal e a mesma morada do registo | Por pedir (depende da empresa) |
| Website público, a funcionar, com domínio da empresa | acelabs.pt existe; ver nota abaixo |
| Email de trabalho no domínio da empresa (não Gmail) | pedro@acelabs.pt e miguel@acelabs.pt já existem |
| Quem se inscreve tem poderes para vincular a empresa (gerente) | Pedro ou Miguel, como gerentes |
| Telefone da sede (a Apple pode ligar para confirmar) | A escolher: um número que atenda |
| Conta Apple com autenticação em dois fatores | Criar uma dedicada (sugestão: com o email @acelabs.pt) |

**Nota sobre o website:** a Apple recusa sites com pouco conteúdo ou que mostrem um aviso do registador. O acelabs.pt tem
conteúdo, mas convém que mostre o **nome legal** (Ace Labs, Lda.) e a morada da empresa no rodapé ou na página de contacto,
para a Apple ligar o domínio à entidade. Isto é uma mudança ao site, que só se faz com a tua confirmação (push para `main`
publica em produção) e sem nomes de pessoas nem preços.

## Pedir o D-U-N-S

1. Na página da Apple de pesquisa de D-U-N-S (developer.apple.com/enroll/duns-lookup), pesquisar a empresa pelo nome legal.
   Pode já existir, porque a Dun & Bradstreet cria números a partir de registos públicos.
2. Se não existir, preencher o pedido nessa mesma página. É gratuito. Dados pedidos:
   - nome legal exato (tal como na certidão ou no registo comercial) e NIPC;
   - morada da sede e morada postal;
   - nome, cargo, email e telefone da pessoa de contacto.
3. A Apple indica **até 5 dias úteis** para receber o número, e pedir urgência não encurta. Pagar para acelerar também não.
4. Receber o número por email e **conferir** que o nome e a morada na ficha da D&B são iguais ao registo. Se estiverem
   diferentes, corrigir na D&B antes de se inscrever, senão a inscrição é recusada.

## Inscrever-se

1. Com a conta Apple dedicada, ir a developer.apple.com/programs/enroll e escolher **Organização**.
2. Preencher o nome legal e o D-U-N-S exatamente como na ficha da D&B, o website, o telefone da sede.
3. Pagar os 99 USD (a renovação é anual; pagar com um cartão da empresa quando existir conta bancária).
4. Atender o telefone nos dias seguintes: a Apple pode ligar. Dar a resposta no email que enviarem, se pedirem prova de poderes.
5. Quando aprovado: anotar o **Team ID** (Membership), registar o Bundle ID `pt.acelabs.cockpit` com Push Notifications e
   Associated Domains, criar a chave APNs, e pôr o Team ID no `apple-app-site-association`
   (ver `docs/cockpit-testflight-piloto.md`).

Prazo total a contar: constituição da empresa (dias) + D-U-N-S (até 5 dias úteis) + aprovação da Apple (a Apple não publica
o prazo; contar com alguns dias). Por isso a empresa é o primeiro passo e o caminho crítico do piloto.

## Enquanto a empresa e o D-U-N-S não chegam

Dá para adiantar, sem conta Apple: Supabase Demo (já criado) e do cliente piloto, SQL, SMTP, Vercel Pro com
`cockpit.acelabs.pt`, `COCKPIT_CLIENTES`, funções do Supabase (sem os segredos APNs), conta de revisão e dados do Demo. A conta
Apple só é precisa para o Mac do Miguel assinar a build e para o App Store Connect.

## Se a empresa demorar muito

Existe a conta **Individual** (sem D-U-N-S, em dias, mas com o nome da pessoa na loja). A Apple permite transferir uma app
entre contas; o Team ID muda e obriga a refazer o `apple-app-site-association` e a chave APNs. Fica registado só como
plano B, não como alteração à decisão da conta de Organização.

## Fontes

- [Apple: inscrição no Developer Program](https://developer.apple.com/programs/enroll/)
- [Apple: D-U-N-S Number](https://apple.co/308Ikbq)
- [Guia: como obter o D-U-N-S com a ferramenta da Apple](https://prompt-engage.helpscoutdocs.com/article/2287-apple-developer-enrollment-how-to-get-a-d-u-n-s-number-using-apples-d-u-n-s-number-look-up-tool)
