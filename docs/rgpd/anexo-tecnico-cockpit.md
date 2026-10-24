# Anexo técnico do contrato de tratamento de dados: Cockpit (RASCUNHO)

> **Rascunho.** Descreve o Cockpit tal como está construído em outubro de 2026. Os pontos marcados
> **[a confirmar]** dependem de contas e planos dos fornecedores e têm de ser verificados antes de assinar.

## 1. Categorias de titulares

- **Clientes e contactos do Cliente:** compradores e proprietários de imóveis.
- **Utilizadores do Cockpit:** o próprio agente (e, no futuro, a sua equipa).

## 2. Dados tratados

| Onde, no Cockpit | Dados |
| --- | --- |
| Contactos | Nome, telemóvel, email, canal de origem (ex.: Idealista), observações livres |
| Compradores | O que procura (tipo, tipologia, zonas, orçamento), financiamento, se precisa de vender, motivação de 0 a 10, fase do negócio, datas e valores de CPCV, escritura e comissão |
| Imóveis enviados a um comprador | Ligação ou descrição do imóvel e datas de envio, visita e proposta |
| Documentos da escritura | **Só o nome do documento e se foi entregue.** O Cockpit não guarda cópias de documentos |
| Proprietários | Imóvel (tipo, tipologia, zona, preço, ligação do anúncio), fase, data da reunião |
| Angariações | Imóvel, preço, regime, datas do contrato, ações de divulgação feitas e notas de feedback |
| Chamadas e tarefas | Data e hora, notas, a quem dizem respeito |
| Alertas de correspondência | Que comprador pode interessar-se por que imóvel |
| Metas | Objetivos do agente (visitas, reuniões, angariações, transações, faturação) |
| Utilizadores | Email e password (guardada pelo Supabase de forma cifrada, nunca em texto) |

**Não são tratados:** números de identificação (NIF, CC), cópias de documentos, dados de saúde ou outras
categorias especiais. As notas livres podem conter o que o agente escrever; o Cliente compromete-se a não
escrever categorias especiais de dados.

## 3. Onde ficam os dados e quem os trata (subcontratantes ulteriores)

| Fornecedor | Para quê | Onde | Notas |
| --- | --- | --- | --- |
| **Supabase** | Base de dados e autenticação (logins) | Região UE: Irlanda (`eu-west-1`), sobre a Amazon Web Services | Um projeto separado por cliente. **[a confirmar]** DPA do Supabase assinado; plano com cópias de segurança diárias (o plano gratuito não as tem) |
| **Vercel** | Alojamento da aplicação (as páginas e o controlo de acesso) | Rede global da Vercel; empresa nos EUA | Os dados vão do telemóvel diretamente ao Supabase; pela Vercel passam as páginas e a verificação da sessão. **[a confirmar]** DPA da Vercel e mecanismo de transferência; ponderar fixar a região das funções na UE |
| **Resend** | Emails de convite e de recuperação da password | Domínio `acelabs.pt` configurado na região UE (Irlanda) | Só o email do utilizador. **[a confirmar]** DPA do Resend |

O Cockpit **não** usa serviços de inteligência artificial, ferramentas de analítica nem cookies de rastreio.

## 4. Medidas técnicas e organizativas

**Separação e acesso**
- Cada cliente tem o seu próprio projeto de base de dados. Os dados de um cliente nunca estão na base de outro.
- Ligações sempre cifradas (HTTPS).
- Regras de acesso na base de dados (RLS): sem sessão iniciada não se lê nada. Verificado automaticamente
  (`npm run seguranca`).
- Entrada só por convite: o registo público está **desligado** e só utilizadores na lista de membros veem
  dados. **[a confirmar por cliente]** `npm run seguranca` sem alertas.
- A chave de administrador da base de dados nunca está na aplicação publicada nem no repositório de código;
  só é usada pela Ace Labs, a partir de computadores dos sócios, para convidar utilizadores e dar apoio.
- Passwords com mínimo de 8 caracteres, guardadas cifradas pelo Supabase. Recuperação por link de uso único.
- No telemóvel do agente fica guardada apenas a lista de tarefas do dia (título, hora e telefone do contacto,
  no máximo 20), para a mostrar quando não há rede. Só é mostrada se for do próprio dia e apaga-se ao sair
  da conta ou quando a sessão termina.

**Direitos dos titulares**
- Em cada ficha de comprador e de proprietário: **exportar** todos os dados da pessoa (ficheiro JSON) e
  **apagar** a pessoa com tudo o que lhe está associado.
- Na Conta: descarregar as listas em CSV e uma cópia completa de todas as tabelas (JSON), que é o que se
  entrega ao Cliente no fim do contrato.

**Continuidade e fim do contrato**
- Cópias de segurança: as do plano do Supabase **[a confirmar: frequência e retenção]**.
- No fim do contrato: exportação completa entregue ao Cliente e apagamento do projeto, incluindo cópias,
  no prazo acordado no contrato.

**Organização**
- Acesso técnico limitado aos dois sócios da Ace Labs, com dois fatores de autenticação nas contas dos
  fornecedores **[a confirmar: ativar em Vercel, Supabase, GitHub e Resend]**.
- Alterações à aplicação são testadas automaticamente antes de publicadas (`npm run testar`).

## 5. Contactos

- Ace Labs, proteção de dados: [email]
- Cliente, proteção de dados: [email]
