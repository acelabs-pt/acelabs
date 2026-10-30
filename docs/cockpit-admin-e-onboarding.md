# Cockpit: página de administração (Pedro e Miguel) e onboarding de clientes

**Estado (2026-10-30):** a Fase 1 da secção 3 está construída e testada (Painel, página da empresa, utilizadores, estado, dados
internos e registo de ações; só em localhost, como recomendado). Ver `servicos/controlo/LEIAME.md`. Falta a Fase 2 (lista de
arranque dentro do Cockpit, Ajuda, emails e guias) e a Fase 3. As decisões da secção 4 seguiram a recomendação (localhost; nós
convidamos todos; os quatro estados; responsável por empresa pedro ou miguel); o contacto de suporte fica por decidir.

Proposta para decidir. Parte do que já existe: a plataforma de controlo (`servicos/controlo`, só em localhost), o projeto
Supabase partilhado com várias empresas (`migracao_multiempresa.sql`) e as funções assinadas do Supabase.

## 1. Página de administração

### Princípios
- **A base de dados é a fonte da verdade.** Hoje a lista de clientes vive num ficheiro local de cada computador
  (`dados/clientes.json`): o Pedro e o Miguel podem ver coisas diferentes. No projeto partilhado, as empresas já estão na
  tabela `empresas`, por isso os dois vêem sempre o mesmo.
- **Fora da internet pública.** Corre no computador de cada sócio (localhost), como agora. A chave de administrador nunca sai do
  Supabase: a página só envia pedidos assinados (cada sócio com a sua chave), a função `admin` verifica e executa. Se um dia
  for preciso aceder do telemóvel, publica-se atrás de um login forte (passkey + lista de emails); não é para já.
- **Tudo o que se faz fica registado** (quem, quando, o quê). Com dois administradores é o que evita "quem apagou isto?".

### Ecrãs
1. **Painel**: uma linha por empresa com estado (piloto, ativa, suspensa), número de utilizadores, último acesso, atividade dos
   últimos 7 dias, progresso do onboarding e alertas (convite por aceitar há mais de 3 dias, ninguém entrou há 7 dias, nenhum
   aparelho com notificações). Em cima: totais (empresas, utilizadores, convites pendentes).
2. **Empresa**:
   - dados (nome, código, pessoa de contacto, início, notas internas);
   - utilizadores: convidar, reenviar convite, enviar link de recuperação de password, suspender, remover, mudar de empresa;
   - lista de arranque (ver secção 2), preenchida sozinha a partir dos dados;
   - uso (compradores, proprietários, angariações, tarefas; atividade por semana) e aparelhos com notificações;
   - zona de perigo: suspender, descarregar a cópia dos dados, apagar (escrevendo o código da empresa para confirmar).
3. **Utilizadores** (todas as empresas): pesquisa por email, contas sem empresa (convite aceite mas sem acesso), contas suspensas.
4. **Saúde do projeto**: migrações aplicadas, registo público desligado, SMTP, última execução dos lembretes, erros de push.
5. **Registo de ações**: tabela de quem fez o quê (Pedro ou Miguel), filtrável por empresa.

CPCV: continua um projeto por cliente. Aparece na mesma página como "projetos" (hoje vêm do ficheiro local; mais tarde também
podem ir para a base).

### O que é preciso construir
- **Base de dados** (uma migração): em `empresas` acrescentar estado, contacto, notas e data de início; tabela `auditoria`
  (só a função de administração escreve); tabela `onboarding_marcos` (marcos feitos por empresa); função `resumo_empresas()`
  só para a chave de administrador, que junta número de utilizadores, último acesso, contagens e aparelhos por empresa.
- **Função `admin`** do projeto partilhado: aceitar as chaves públicas dos dois sócios (cada um assina com a sua) e registar cada
  ação em `auditoria`. As ações novas: listar empresas, criar, suspender, reativar, apagar, mover utilizador, reenviar convite.
- **Plataforma de controlo**: os ecrãs acima, reaproveitando os de utilizadores e de estado que já existem.
- **Testes**: como nos outros pontos, com um Supabase simulado e um passo no projeto real, incluindo o isolamento (a página de uma
  empresa nunca mostra nem altera contas de outra).

### Mais tarde
- Gestor da empresa a convidar e a remover os seus agentes dentro do Cockpit (autonomia do cliente, menos trabalho para vocês).
  Depende de decidir os papéis (`docs/cockpit-papeis-proposta.md`, opção A).
- Avisos automáticos para vocês (por email) quando uma empresa fica parada.

## 2. Onboarding de um cliente

### Linha do tempo
| Quando | O quê | Quem | Como se sabe que está feito |
|---|---|---|---|
| Antes | Contrato e acordo de tratamento de dados assinados | Pedro e Miguel | (depende da resposta RGPD) |
| D-3 | Criar a empresa na página de administração e convidar o gestor e os agentes | Pedro ou Miguel | Empresa criada, convites enviados |
| D-3 | Email de boas-vindas: o que vai acontecer, link da app (TestFlight ou loja), guia de 1 página, contacto de suporte | Pedro ou Miguel | Email enviado |
| D0 | Sessão de arranque de 45 minutos (vídeo ou presencial): instalar, aceitar o convite, escolher a password, Face ID, notificações; importar contactos; definir as metas; criar ao vivo o 1.º comprador e a 1.ª angariação | Pedro e Miguel | Convites aceites, contactos importados, metas definidas |
| D+1 | Ver na página de administração: entraram? importaram? têm notificações? Se não, ligar | Quem tratou do cliente | Painel sem alertas |
| D+7 | Conversa de 15 minutos: dúvidas, ajustar funis, pedir feedback | Quem tratou do cliente | Feedback registado |
| D+30 | Balanço: quantas pessoas usam, volume de dados, ganhos que o cliente nota; decidir continuidade e faturação | Pedro e Miguel | Balanço feito |
| Fim | Descarregar a cópia dos dados, suspender e apagar no prazo acordado | Pedro e Miguel | Registo de ações |

### Dentro do Cockpit (a construir)
- **Lista de arranque no Dashboard** de cada empresa nova, com progresso e possível de fechar: importar contactos, definir as
  metas do ano, ativar notificações, ativar o Face ID (na app), criar o primeiro comprador, convidar a equipa (para o gestor,
  quando existirem papéis). Cada passo vai a ecrã certo e marca-se sozinho quando se cumpre.
- **Modelo de Excel para importar contactos** com uma linha de exemplo e instruções (o importador já existe).
- **Estados vazios que ensinam**: cada lista vazia diz o que fazer a seguir, num botão.
- **Página Ajuda**: 5 pequenos passos com imagem (instalar, importar, comprador, angariação, calendário) e o contacto de suporte.

### Materiais a escrever
- Email de boas-vindas e emails de acompanhamento (D+7 e D+30).
- Guia rápido de 1 página e guia completo do Cockpit (como o do CPCV, `docs/manual-cpcv-ia.html`; na fonte da marca).
- Lista de verificação da sessão de arranque, imprimível.
- Resposta-padrão de suporte e um endereço (por exemplo `suporte@acelabs.pt`, a confirmar).
- Texto de saída: como descarregar os dados e quando são apagados (depende do RGPD).

### Regras
- Números e promessas só como "até" e estimativa; sem preços nos materiais públicos; sem afirmações sobre RGPD enquanto não
  houver resposta.
- O piloto usa exatamente este processo, e o que correr mal entra nesta lista antes do 2.º cliente.

## 3. Ordem sugerida
1. **Fase 1** (a base): migração com os campos e a auditoria, função `admin` para o projeto partilhado, Painel e página da
   Empresa com utilizadores, e registo de ações. É o que permite criar o cliente piloto sem scripts.
2. **Fase 2**: lista de arranque no Dashboard, modelo de importação, página Ajuda, e os emails e guias.
3. **Fase 3**: o gestor convida a sua equipa dentro da app (com os papéis), alertas por email.

## 4. Decisões para vocês
1. Administração **só em localhost** (recomendado) ou também publicada com login forte?
2. O gestor do cliente convida a equipa ele próprio já na primeira versão (obriga a fechar os papéis), ou nós convidamos todos?
3. Estados de uma empresa: piloto, ativa, suspensa, terminada. Faltam alguns?
4. Contacto de suporte e prazo de resposta que prometemos ao cliente.
5. Quem acompanha cada cliente (uma pessoa responsável por empresa, ou os dois)?
