# Passagem do Miguel para o Pedro: Cockpit por publicar (31/10/2026, 3.ª entrega)

> **Estado: por publicar.** As entregas 1 e 2 (018a93b e 401f9c4) já foram publicadas pelo Pedro. Esta é a seguinte.
> **Tem SQL novo (uma coluna), a correr no Demo ANTES do deploy:** `migration_google_calendar.sql`.

Só o Pedro faz o deploy: `git pull`, `npm install`, `npx tsc --noEmit`, `npx next lint`, `node testes/unidade-multiempresa.mjs`,
SQL no Demo, `vercel deploy --prod` em `servicos/cockpit-app`, e confirmar no endereço publicado (tamanho de iPhone).

## SQL no Demo (`gebqaxhwebsmoeqpzzzg`), antes do deploy
1. `migration_google_calendar.sql`: `alter table tarefas add column if not exists google_calendar_em timestamptz;` (repetível; já está
   também no `create_tables.sql`). Sem esta coluna, marcar a caixa "Google Calendar" mostra um aviso e não guarda.
2. Opcional (limpeza de dados antigos): `delete from tarefas where chave_automacao like 'proprietario:%:aviso' and feita = false;`
   apaga os avisos "Daqui a 2 horas" que ficaram de antes por fazer (o plano novo já não os cria).

## O que mudou
- **Dashboard, Seguimentos da semana:** cada linha mostra o nome do cliente, uma etiqueta do que fazer ("Follow up", "Reunião",
  "Agradecer", "Enviar dossier", "Enviar opções", "Ligar"...) e, só nos proprietários, o imóvel (tipologia, freguesia, concelho). O texto
  completo da tarefa saiu; atrás da seta fica só a data, a hora e "em atraso".
- **Ficha do proprietário:** cabeçalho com nome, fase e Editar, e uma seta que abre o resto (imóvel, preço, zona, contactos, Ligar e WhatsApp).
  Nova ordem: Próximos passos, Funil, Fechar angariação (se aplicável), Reunião de angariação, Chamadas (histórico atrás de uma seta),
  Compradores com interesse, Exportar e Apagar.
- **Automações dos proprietários (`lib/proprietario.ts`):**
  - quando o proprietário fica **angariado** (fechar angariação na ficha, criar angariação com proprietário existente, associar proprietário a
    uma angariação), apagam-se as automações dele que estão por fazer (as feitas ficam no histórico); tarefas manuais e as do plano da
    angariação não se tocam. Ao marcar "não angariado" (perdido) só a chamada de angariação fica feita, como antes;
  - o plano deixou de criar o **aviso de 2 horas antes**; a reunião continua no calendário; a **mensagem de agradecimento** passou de 2 horas
    para **5 horas depois** da reunião. Ao reagendar a reunião apagam-se os avisos antigos por fazer desse proprietário.
- **Caixa "Google Calendar"** em cada tarefa por fazer, nos Próximos passos do **proprietário** e do **comprador**: ao marcar, abre o Google
  Calendar do agente com a marcação preenchida (título, dia, hora) e guarda o visto em `tarefas.google_calendar_em`. Não há ligação à
  conta Google (sem OAuth): o Cockpit não sabe se o agente guardou o evento nem o atualiza se a data mudar; desmarcar só tira o visto cá.
  Código em `lib/googleCalendar.ts`.
- **Ficha do comprador, Próximos passos:** sem formulário Visita/Tarefa (já tinha ido na entrega anterior); mantém só a lista.

## O que ver no iPhone depois do deploy
Dashboard (Seguimentos com nome, etiqueta e imóvel; seta com a data), ficha de um proprietário (seta no cabeçalho, ordem das secções, caixa
"Google Calendar" nas tarefas por fazer, marcar a caixa e ver abrir o Google Calendar), ficha de um comprador (a mesma caixa), e uma reunião
nova de proprietário (o plano já não tem o aviso de 2 horas e o agradecimento fica às 5 horas).

## Notas
- Não há tabelas novas nem mudanças nas regras de acesso: o teste de isolamento por empresa não deve ser afetado.
- A caixa Google Calendar não está nas tarefas das angariações nem no Calendário: só se o Miguel pedir.
