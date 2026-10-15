# Política de privacidade (RASCUNHO, não publicar sem validação)

Estado: rascunho técnico. Os campos entre [colchetes] têm de ser preenchidos por quem tem os dados
legais da empresa, e o texto final convém ser revisto por quem acompanha o RGPD.

---

## 1. Quem somos

**[Denominação social da entidade]**, NIPC **[NIPC]**, com sede em **[morada]**, é a responsável
pelo tratamento dos dados pessoais recolhidos neste site (marca Ace Labs).

Contacto para questões de privacidade: **[email de contacto]**.

## 2. Que dados recolhemos e para quê

Só recolhemos dados através do formulário de contacto "Marcar diagnóstico":

| Dado | Obrigatório | Finalidade |
|---|---|---|
| Nome | Sim | Identificar quem pede contacto |
| Telefone ou email (pelo menos um) | Sim | Responder ao pedido |
| Mensagem | Sim | Perceber o que pretende |
| Perfil (agente, agência, investidor, outro) | Não | Preparar a conversa |
| Empresa, melhor horário, contacto preferido | Não | Preparar a conversa |

**Base legal:** diligências pré-contratuais a pedido do titular e interesse legítimo em responder a
pedidos de contacto (art. 6.º, n.º 1, alíneas b e f do RGPD).

Não usamos cookies de rastreio nem ferramentas de analítica neste site.

## 3. Com quem partilhamos

Os dados são tratados por prestadores que atuam em nosso nome:

- **Resend** (envio do email do formulário), servidores na União Europeia (Irlanda).
- **Vercel** (alojamento do site e da função que processa o formulário).
- **Google Workspace** (caixa de correio onde recebemos o pedido).

Não vendemos nem cedemos os dados a terceiros para fins de marketing.

## 4. Durante quanto tempo guardamos

[Definir prazo, por exemplo: durante o tempo necessário para responder e, se não houver relação
comercial, até 12 meses após o último contacto.]

## 5. Os seus direitos

Pode pedir acesso, retificação, apagamento, limitação, oposição e portabilidade dos seus dados, e
retirar o consentimento quando aplicável, escrevendo para **[email]**. Tem também o direito de
apresentar reclamação à CNPD (www.cnpd.pt).

## 6. Segurança

O site é servido por HTTPS e os dados do formulário são enviados por ligação cifrada. O acesso às
caixas de correio é restrito aos sócios.

## 7. Alterações

Esta política pode ser atualizada. A versão em vigor é a publicada nesta página.

*Última atualização: [data]*

---

## Notas para quem publicar

- Criar `site/privacidade.html` com o mesmo estilo das outras páginas.
- Acrescentar o link "Privacidade" ao rodapé de todas as páginas e ao aviso por baixo do botão do
  formulário (hoje diz "Nunca partilhados com terceiros", que tem de passar a "Ver política de
  privacidade", porque Resend e Vercel tratam os dados).
- Atualizar `site/sitemap.xml`.
