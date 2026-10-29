# Cockpit na App Store: textos para o App Store Connect

Rascunho para rever. Sem preços e sem afirmações sobre RGPD (ainda sem resposta). Os limites de caracteres são os da Apple
(confirmar no App Store Connect, podem mudar). Idioma principal: Português (Portugal).

## Nome e subtítulo

- **Nome (até 30):** Cockpit (se já estiver ocupado: "Cockpit Ace Labs" ou "Cockpit para imobiliário")
- **Subtítulo (até 30):** O teu dia no imobiliário
- **Categoria principal:** Negócios (alternativa: Produtividade)
- **Idade:** 4+ (sem conteúdo sensível)

## Texto promocional (até 170, pode mudar sem nova revisão)

O teu dia a dia no terreno, num só lugar: compradores, proprietários, angariações e agenda, com lembretes e Face ID.

## Descrição (até 4000)

O Cockpit é a app do consultor imobiliário que trabalha no terreno. Foi desenhada para ser usada com uma mão, entre
visitas, sem formação.

**O que podes fazer**
- Ver logo ao abrir o que tens para hoje: tarefas, visitas e avisos urgentes.
- Guardar compradores e proprietários, com zonas, orçamento, origem e histórico de chamadas.
- Ligar ou enviar WhatsApp a partir da ficha, sem copiar números.
- Acompanhar cada angariação com um plano de ações e datas, e partilhar o relatório com o proprietário.
- Receber alertas quando entra um imóvel que faz sentido para um comprador.
- Pôr visitas e tarefas na agenda do iPhone, com alarme.
- Escolher um contacto do telemóvel ao criar um comprador, sem dar acesso a toda a lista.
- Receber lembretes antes de cada marcação e um resumo das tarefas de manhã.
- Proteger a app com Face ID.

**Como se entra**
O Cockpit é fornecido pela Ace Labs a empresas e consultores. Para entrar precisas do código da tua empresa e do convite que
recebeste por email. Se ainda não tens, fala com a Ace Labs em acelabs.pt.

**Os teus dados**
Podes descarregar uma cópia dos teus dados em Excel e apagar a tua conta dentro da app, em Conta.

## Palavras-chave (até 100, separadas por vírgulas, sem espaços)

imobiliário,CRM,agente,angariação,compradores,proprietários,visitas,agenda,mediação,consultor

## Endereços (precisam de estar online antes de submeter)

- **Suporte:** https://acelabs.pt/contacto
- **Política de privacidade:** a publicar (ex.: https://acelabs.pt/privacidade). Partir de `docs/privacidade-rascunho.md`.
- **Marketing (opcional):** https://acelabs.pt

## O que há de novo (primeira versão)

Primeira versão do Cockpit para iPhone.

## Privacidade da app (App Privacy)

Dados ligados ao utilizador, usados para a funcionalidade da app, sem rastreio e sem publicidade:
- Informações de contacto: email (login) e nome.
- Contactos: os contactos de negócio que o utilizador introduz (compradores e proprietários). A lista de contactos do telemóvel
  só é lida quando o utilizador escolhe um contacto, através do seletor do sistema.
- Conteúdo do utilizador: notas, tarefas, angariações e documentos associados.
- Identificadores: token do aparelho para notificações.
- Calendário: só escrita, quando o utilizador põe uma marcação na agenda.

Confirmar cada categoria no formulário da Apple com a versão final da política de privacidade.

## Notas de revisão para a Apple (em inglês, a Apple lê em inglês)

> Cockpit is a business tool provided by Ace Labs (Portugal) to real estate agencies and consultants. It is not open to the
> public: each customer company has its own private database and users are invited by the company.
>
> On first launch the app asks for a company code. This is how a single app serves several customer companies (guideline
> 4.2.6: one app with a client chooser, not one app per client). Review account:
>
> - Company code: **[código do Demo]**
> - Email: **[email da conta de revisão]**
> - Password: **[password da conta de revisão]**
>
> The demo company contains fictional data only. Features that use device permissions are optional and requested in context:
> Face ID (app lock, can be turned off in Account), notifications (Account, "Ativar notificações"), calendar (write-only, when
> adding an appointment from a task) and the system contact picker (when creating a buyer).
>
> Account deletion: Account tab, "Apagar a minha conta" (bottom of the screen).
> The app loads its interface from https://cockpit.acelabs.pt inside the native shell; native features (notifications, Face ID,
> calendar, contacts, share sheet, haptics) are provided by the app.

## Capturas de ecrã

- Obrigatório: iPhone de 6,9 polegadas, 1320x2868. Script: `servicos/cockpit-app/testes/ferramentas/capturas-appstore.js`.
- Correr só no projeto Demo com a carteira de demonstração (`scripts/demo.ts`): os dados são fictícios. Nunca usar o projeto de
  teste nem o de um cliente.
- Ordem sugerida: Dashboard, Angariações, ficha do comprador, Calendário, relatório do proprietário.
- O ideal é refazê-las no simulador do Xcode, com a barra de estado real.

## Antes de submeter

- [ ] Política de privacidade e página de suporte online.
- [ ] Conta de revisão criada no Demo e testada de ponta a ponta, incluindo apagar a conta (com outra conta).
- [ ] Face ID, notificações, agenda e contactos testados num iPhone real.
- [ ] TestFlight interno sem erros durante alguns dias.
