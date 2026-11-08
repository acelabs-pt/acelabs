# Passagem do Miguel para o Pedro: Cockpit por publicar (08/11/2026, 5.ª entrega)

> **Estado: por publicar.** O Pedro só precisa de `git pull`, correr o SQL abaixo no Demo, testes e `vercel deploy --prod`.
> A 4.ª entrega (cfa395a, 06/11) já está publicada, ver mais abaixo.

## SQL no Demo (`gebqaxhwebsmoeqpzzzg`), antes do deploy, por esta ordem
1. `migration_documento_valor.sql`: `valor` em `comprador_documentos` (valor do cheque bancário).
2. `migration_proprietario_documentos.sql`: tabela nova `proprietario_documentos`, já com `empresa_id`, gatilho e regra por empresa.
   Corre-se depois de `migracao_multiempresa.sql` (já corrida no Demo). Entrou também em `create_tables.sql`, nas listas de
   `migracao_multiempresa.sql` e `migracao_seguranca.sql` e em `testes/unidade-multiempresa.mjs`.

3. `migration_tarefa_nao_feita.sql`: `nao_feita_em` em `tarefas` (tarefas dadas como "não feitas").

Podem correr-se duas vezes sem erro. Sem a 1.ª, guardar o valor do cheque dá erro. Sem a 2.ª, a ficha do proprietário não carrega os documentos.

## Verificado antes do push
- `node testes/unidade-multiempresa.mjs`: 170 verificações OK (inclui o isolamento de `proprietario_documentos`).
- `npm run lint`: sem erros. `next build`: passou (feito numa cópia, para não mexer no servidor de desenvolvimento).
- Não corri `testes/publicado.js` nem `testes/documentos.js` (precisam do servidor e das chaves de teste); `documentos.js` passou a esperar 2 documentos.

## O que mudou
- **Dashboard (novo desenho, substitui o "relevo definido" do 401f9c4):** fundo branco ligeiramente azulado só no Dashboard, cartões com
  cabeçalho (ícone, título, linha), cartão **Agenda** (Hoje ou Semana, filtros Todos, Compradores, Proprietários, Angariações,
  números, marcações e seguimentos), **Precisa de atenção** (junto, filtrável) e **Metas**. Os Seguimentos passaram para dentro da
  Agenda: "Em atraso (N)" fechado por defeito e a lista do período. Em "Angariações" aparece o painel "As minhas angariações" com o
  alerta de acções em atraso por angariação. Os avisos de proprietário dizem qual é o passo em atraso.
- **Semana de domingo a sábado:** o calendário (semana e mês), a Agenda do Dashboard e as metas da semana passam a contar a semana de
  domingo a sábado. A chave das tarefas semanais automáticas continua na semana ISO (segunda a domingo), para não duplicar tarefas.
- **Agenda do Dashboard:** painéis brancos; cada secção (Resumo, Marcações, Seguimentos) começa com um título a negrito na sua cor
  (azul, verde, âmbar) com uma linha por baixo.
- **"Não feito" nos seguimentos em atraso (Dashboard):** cada tarefa em atraso de um comprador ou proprietário tem o botão "Não feito"
  (com "Desfazer"). Fecha a tarefa sem avançar o cliente no funil e fica registada na ficha (proprietário: na lista dos próximos
  passos, com "Repor"; comprador: em "Não feitas (N)" nos próximos passos). As tarefas vindas de uma angariação não têm o botão.
  Sem a coluna `nao_feita_em`, o botão dá erro.
- **Dashboard, cartão "Seguimentos":** um só cartão, com duas secções, **Compradores** (o próximo passo de cada comprador pela fase,
  dos mais motivados para os menos, mais as tarefas com data) e **Proprietários** (as tarefas com data: em atraso, hoje ou até ao
  fim da semana). Respeita o filtro da Agenda. Os passos dos compradores vêm do estado do comprador, por isso aparecem sem ser preciso
  abrir o CRM; as tarefas semanais "Enviar opções" e "Propor visita" não se repetem nas tarefas com data. O Dashboard também lê as
  tabelas por páginas (limite de 1000 linhas do Supabase) e cria as tarefas semanais ao abrir.
- **Seguimentos dos compradores por motivação:** na lista de seguimentos os compradores vêm primeiro, dos mais motivados para os
  menos, e cada linha mostra "Motivação N/10". Os proprietários seguem por data, depois dos compradores.
- **Compradores:** próximos passos só com "Enviar novas opções" (uma linha), "Agendar escritura" (automação nova: com o CPCV fechado e
  o prazo da escritura definido, cria a tarefa; fecha ao agendar a escritura) e tarefas agendadas à mão. Nota de próximo passo por
  fase na lista. Documentos da escritura: "Documento de identificação" e "Cheque Bancário" (com valor).
- **Proprietários:** documentos (lista de 8) só quando está angariado, com imóvel angariado e escritura marcada; mensagem de
  agradecimento (só depois de marcar a reunião; assinatura = nome definido em Conta); etiqueta "Reunião há X dias" nas tarefas
  (acende ao marcar feita); cartões da reunião e do agradecimento fecham-se quando feitos; as chamadas aos 14 e 22 dias passam a
  "Ligar a (nome) para marcar a reunião de angariação".
- **Todas as fichas:** botão "Agendar tarefa" (título, dia e hora) nos Próximos passos; chamadas com botão "Adicionar chamada"
  (dia, hora e nota) e "Editar" no histórico; **Conta** ganha "O teu nome" (guarda-se na conta).
- **Horas das automações:** passam a ter 30 minutos de folga (9:00 às 19:00, aperta para 15 e 5 se o dia encher); nunca mexem em visitas,
  reuniões ou escrituras.
- **Simulação / demo:** retiradas as tarefas de teste que não são automações (Seguimento, Primeiro contacto, Contactar, Ligar a...).
  As que já estão numa base de dados só saem com um `delete` à parte (o Miguel já o correu no projecto dele; no Demo só se o Pedro quiser).

## O que ver no browser depois do deploy
- Dashboard: alternar Hoje e Semana, os filtros, "Em atraso" a abrir e "Angariações".
- Comprador com CPCV fechado e prazo da escritura: aparece "Agendar escritura" nos próximos passos.
- Proprietário: marcar a reunião e ver a mensagem de agradecimento (com o nome definido em Conta).

---

## (publicada em 06/11/2026) 4.ª entrega: cfa395a

> **Estado: publicado a 06/11/2026 pelo Pedro** (commit cfa395a). SQL corrido no Demo antes do deploy e colunas confirmadas;
> `unidade-multiempresa` passou (164 verificações); confirmado no endereço publicado com um utilizador temporário na Agência
> Ensaio (painel, "Tipo de negócio" no novo comprador e no novo proprietário, filtros do calendário; sem erros nem pedidos
> falhados). A passagem anterior (31/10, commit 87796d2) está no histórico do git.

Só o Pedro faz o deploy: `git pull`, testes, SQL no Demo, `vercel deploy --prod` em `servicos/cockpit-app`, e confirmar no
endereço publicado.

## SQL no Demo (`gebqaxhwebsmoeqpzzzg`), antes do deploy
1. `migration_tipo_negocio.sql`: `tipo_negocio` em `compradores` e `proprietarios`.
2. `migration_visita_hora.sql`: `visita_hora` em `comprador_imoveis`.

Podem correr-se duas vezes sem erro. Sem estas colunas, guardar comprador, proprietário ou visita dá erro.

## O que mudou
- **CRM:** "Tipo de negócio" (Habitação ou Comercial) em compradores e proprietários; o tipo de imóvel mostra só as opções desse
  negócio. Referência do imóvel retirada da ficha do comprador. Campos e listas mais pequenos. Simulação de crédito com
  "Em processamento".
- **Comprador com "Precisa de vender = Sim":** mostra a qualificação de proprietário e a caixa "Adicionar ao CRM de
  proprietários" (cria ou atualiza a ficha do mesmo contacto).
- **Visitas:** "Agendar visita" (data, hora e observações). Só ao confirmar fica "Visitado", e a visita vai para o calendário como
  evento de 1 hora.
- **Calendário:** filtros Todos, Compradores, Proprietários e Angariações; título da semana por extenso; tarefas fora da grelha
  de horas (contador por dia na semana, lista no dia); arrastar tarefas e marcações para outro dia (só no computador; no iPhone
  continua o "Adiar"); horas das tarefas automáticas novas distribuídas entre as 9:00 e as 18:45, sem colisões (nunca altera
  visitas, reuniões de angariação nem escrituras).
- **Simulação de 3 meses:** sem as tarefas de teste "Seguimento com (nome)". As que já estão na base de dados continuam lá.

## O que ver no iPhone
- Criar um comprador com negócio Comercial e "Precisa de vender = Sim", com a caixa marcada, e ver se aparece em Proprietários.
- Agendar uma visita num imóvel do comprador e ver o evento no calendário.
- No mês, arrastar uma tarefa para outro dia (no computador).

## Nota para os testes
`testes/publicado.js` cria o utilizador temporário sem empresa (`membros.empresa_id` é obrigatório desde a multiempresa), por isso
fica sem painel. Precisa de passar a pôr o utilizador numa empresa de ensaio.
