# Passagem do Miguel para o Pedro: Cockpit por publicar (06/11/2026, 4.ª entrega)

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
