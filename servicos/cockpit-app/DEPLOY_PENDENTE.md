# Passagem do Miguel para o Pedro: Cockpit por publicar (31/10/2026)

> **Estado: publicado a 31/10/2026 pelo Pedro** (TypeScript e lint limpos, isolamento entre empresas com 164 verificações a passar).
> Sem SQL novo: o Demo já tinha todas as tabelas e colunas. Confirmado no endereço publicado, em tamanho de iPhone: plano no topo
> da angariação, "Visita +" e "Proposta +", relatório, "ID do imóvel" na nova angariação, seguimentos do dashboard com Compradores
> e Proprietários, listas do CRM e ficha do comprador com Editar. Nenhum erro da base de dados.

O `main` tem tudo, mas o Cockpit publicado (`cockpit-gamma-one.vercel.app`) ainda tem a versão antiga. Falta o deploy, que só o Pedro faz.

## O que o Miguel mudou desde a tua última junção (3272909 e da9ff7e)
- Angariação: plano logo a seguir aos três cartões do topo; botões "Visita +" e "Proposta +" (o formulário só abre no +); relatório com as
  visitas e propostas (nome do cliente, data e observações; as de outros consultores aparecem como "Cliente de X").
- Dashboard: seguimentos da semana com botões Compradores e Proprietários, e os detalhes de cada seguimento atrás de uma seta.
- CRM: listas de compradores e de proprietários mais limpas (nome, último contacto, imóvel e fase; o resto atrás de uma seta);
  ficha do comprador com nome, fase, motivação e Editar à vista, e o resto atrás de uma seta.
- `scripts/simulacao-3-meses.ts`: gera SQL com 3 meses de uso FICTÍCIO (emails `@exemplo.pt`) para encontrar bugs. Foi corrido só na base
  antiga `erxnqdadqbmfeyuwaybi` do Miguel (limpa, com o João Carvalho como único dado real). Não correr em bases de clientes.

## SQL no Demo (`gebqaxhwebsmoeqpzzzg`), por esta ordem, antes do deploy
Sem tabelas novas a app publicada dá erro. Todos podem correr duas vezes.
1. Só se o Demo ainda não os tiver: `migration_visitas_angariacao.sql`, `migration_sem_interesse.sql`, `migration_visitas_externas.sql`,
   `migration_propostas.sql`, `migration_referencia_angariacao.sql`.
2. `migracao_multiempresa.sql` (já inclui `visitas_externas` e `propostas_externas`). Se as duas tabelas tiverem sido criadas antes desta
   migração, `migration_externas_empresa.sql` liga-as ao `empresa_id` (o Miguel precisou dela na base antiga: sem ela a inserção falha
   com "column empresa_id does not exist").

## O que ver no iPhone depois do deploy
Ficha de uma angariação (plano em cima, "Visita +", "Proposta +"), relatório da angariação, Dashboard (seguimentos), listas de
compradores e de proprietários com a seta, ficha do comprador com a seta.
