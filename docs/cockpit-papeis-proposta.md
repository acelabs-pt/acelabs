# Cockpit: papéis numa agência (proposta para decidir)

Hoje o Cockpit serve um consultor ou uma equipa pequena onde todos os membros veem tudo (`membros` e `e_membro()`).
Para uma agência com vários agentes e um gestor falta decidir quem vê o quê. Duas opções, da mais simples à mais completa.

## Opção A: todos veem tudo, o gestor pode mais (recomendada para começar)

- Acrescenta-se `membros.papel` com `gestor` ou `agente` (por omissão `agente`; o primeiro membro de cada projeto é `gestor`).
- Todos continuam a ver e editar os mesmos contactos, angariações e tarefas. Não muda nenhuma tabela de dados.
- Só o gestor pode: importar listas, descarregar a cópia completa, apagar contactos e convidar (hoje pela plataforma de controlo).
- Trabalho: uma coluna, uma função `e_gestor()`, e esconder/recusar 3 ou 4 ações. Cerca de meio dia, com testes.
- Serve bem equipas onde os agentes partilham carteira (equipas RE/MAX, grupos de consultores). Não serve se cada agente
  quer a sua carteira privada.

## Opção B: cada agente vê só o que é seu, o gestor vê tudo

- `responsavel_id` (utilizador) em `compradores`, `proprietarios`, `angariacoes`, `tarefas` e `chamadas`, preenchido com
  `auth.uid()` ao criar.
- As regras de acesso (RLS) passam a: agente vê `responsavel_id = auth.uid()`; gestor vê tudo.
- O Dashboard, os alertas de oportunidades (correspondência comprador a angariação) e o resumo de angariações têm de respeitar a
  regra. Atenção: um alerta cruza compradores de um agente com angariações de outro; é preciso decidir se isso é visível
  (muitas agências querem, outras não).
- Importação precisa de escolher o responsável. Passar contactos de um agente para outro (saída de um agente) precisa de ecrã.
- Trabalho: cerca de 3 a 5 dias com testes, e migração dos dados existentes (todos ficam do gestor).

## Recomendação

Opção A agora, porque o primeiro cliente real é um consultor ou uma equipa pequena e a Opção B só se justifica quando uma agência
a pedir. A Opção A não fecha a porta: a coluna `papel` serve também a Opção B depois.

## Decisões que preciso de vocês

1. A ou B para a primeira versão?
2. Se B: os alertas de oportunidades cruzam carteiras de agentes diferentes, sim ou não?
3. Quem é o gestor por omissão num cliente novo (a pessoa que assinou o contrato)?
4. O gestor pode apagar a conta de um agente (e o que acontece aos contactos dele)?
