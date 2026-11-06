# Ace Labs Torre

Painel de gestão interno dos sócios (Pedro e Miguel): contas, movimentos, débitos diretos, quem pagou o quê e quanto a
empresa deve a cada sócio. **Publicado** (Vercel). Entra-se a escolher o nome (Pedro ou Miguel) e com um **PIN de 6
algarismos** (decisão do Pedro, 2026-11-06; sem 2FA). Abre no telemóvel.

## Entrar com PIN

- O ecrã de entrar mostra os nomes dos sócios ativos (função `socios_para_entrar`, sem emails) e lembra quem entrou da
  última vez nesse aparelho.
- O PIN não é a password do Supabase: a password é derivada do PIN com `TORRE_PIN_SEGREDO`, um segredo que só o servidor
  tem (`lib/pin.ts`). Quem tentar PINs diretamente no Supabase não consegue nada. Na Torre, 10 PINs errados em 30 minutos
  bloqueiam esse sócio durante 30 minutos (tabela `pin_falhas`, contada na base de dados).
- Qualquer PIN de 6 algarismos serve, incluindo os fáceis (decisão do Pedro, 2026-11-06). Mudar: "Mudar PIN", no menu.
- **PIN temporário:** `npm run socio -- email Nome --pin=123456` cria a conta (ou repõe o PIN) com um PIN combinado, que pode ser
  fácil porque é temporário. Na primeira entrada a Torre só mostra "Escolhe o PIN que quiseres": até o sócio o escolher não abre
  nenhuma página, ação ou ficheiro (`exigirSocio` volta ao início). Sem o `--pin`, sai um PIN
  aleatório.
- **Esqueci-me do PIN** (`/redefinir`, a partir do ecrã de entrar): escolhe-se o nome, o Supabase envia um código de 6
  algarismos para o email do sócio (vale 15 minutos), e com o código escreve-se o PIN novo e entra-se. Os códigos errados
  contam para o mesmo bloqueio. O email sai pelo Resend (SMTP do Supabase da Torre: `smtp.resend.com`, remetente
  `torre@acelabs.pt`, com a chave do Resend que o Cockpit já usa) e o texto em português está no modelo "Reset password"
  do Supabase. Sem o SMTP próprio, o Supabase grátis só envia para membros da equipa do projeto.
- **`TORRE_PIN_SEGREDO` tem de ser o mesmo no `.env.local` e na Vercel.** Se mudar, todos os PINs deixam de servir e é
  preciso voltar a dar PINs com `npm run socio`.

Feitas e publicadas (2026-11-06): fase 1, fase 2 (faturas) e fase 3 (tesouraria,
clientes e fornecedores, contratos, IVA por trimestre). Seguem-se: 4) painéis do Cockpit e do CPCV (só leitura, pela função
`admin` com uma chave própria da Torre); 5) faturas apanhadas do email, avisos por email e ligação automática ao banco.

## Melhorias de 2026-11-06 (tarde)

- **Extratos em Excel:** `.xlsx`, `.xls` (também o "xls" que alguns bancos exportam e que é uma tabela HTML) e `.ods`, além do
  CSV (`lib/folha.ts`, SheetJS 0.20.3 da CDN oficial). As datas do Excel leem-se pelo número de série, nunca pelo texto
  formatado (que pode sair à americana); o texto dos "xls" em HTML fica tal e qual e é lido pelas regras portuguesas.
- **Débitos diretos com o estado do ciclo:** cada débito diz se já saiu ("Saiu a dd/mm, valor"), se não apareceu (só passados
  7 dias da data), a próxima data e se o valor foi diferente do previsto. Indicadores: por mês, por ano, já saiu este mês e em
  falta (`lib/debitos.ts`, os mesmos limites dos avisos do Início).
- **Sócios:** "Registar devolução" em cada sócio com dívida, já com o valor em dívida e a conta da empresa.
- **Exportar movimentos** em CSV para o Excel, com os mesmos filtros e pesquisa do ecrã (`lib/filtros.ts`, partilhado).

## Tesouraria, clientes e contratos (fase 3)

- **Tesouraria** (`/tesouraria`, 30, 60 ou 90 dias): parte do caixa de hoje (contas da empresa) e soma, por ordem de data,
  os débitos diretos da conta da empresa, as mensalidades e arranques dos contratos ativos, as faturas emitidas por receber e
  as recebidas por pagar (sem vencimento assume 30 dias depois da data; as vencidas contam já hoje; as de fornecedores com
  débito direto não contam duas vezes). Mostra o caixa em cada dia (gráfico em degraus), o ponto mais baixo, a lista do que vai
  acontecer com o saldo a seguir a cada coisa, e a **autonomia** (meses que o caixa dura: caixa a dividir pela saída mensal
  média dos últimos 3 meses, ou pelos débitos fixos se for maior, menos a mensalidade que entra). É uma estimativa: não
  conta o que ainda não se conhece.
- **Avisos no Início:** "o caixa pode ficar negativo a dd/mm" (previsão a 60 dias) e faturas emitidas por receber em atraso,
  que passam à frente de tudo no próximo passo. O cartão da caixa mostra a autonomia e leva à tesouraria.
- **Clientes e fornecedores** (`/contactos`): para cada um, dinheiro recebido ou pago (este ano e no total), faturas em aberto
  (sem movimento no banco), última atividade e contratos. A ficha (`/contactos/<id>`) tem contratos (criar, editar, apagar),
  faturas, movimentos e os dados.
- **Contratos:** produto, estado (proposta, ativo, pausado, terminado), arranque (uma vez, na data de início), mensalidade
  (todos os meses, no dia pedido, até ao fim) e notas. A mensalidade dos ativos é o **MRR**, que aparece no Início e nas listas.
  Uma proposta não conta. Não é a fatura: essa vem do software certificado.
- **IVA por trimestre** nos Resultados: cobrado nas faturas emitidas e pago nas recebidas, só das faturas ligadas a um
  movimento do banco. Estimativa; a declaração é com o contabilista.
- **Instalar no telemóvel:** manifesto e ícones em `public/icones/` (gerados uma vez; o gerador de imagens do Next falha no
  Windows). iPhone: Partilhar, "Adicionar ao ecrã principal". Abre sem a barra do browser.

O aspeto segue o do Cockpit (`servicos/cockpit-app`): quadros azuis nos indicadores, seletores segmentados.

## Como se usa (desenho da experiência)

- **Menu lateral sempre** (decisão do Pedro, 2026-11-06): com secções (Dia a dia, Dinheiro, Gestão), números nas faturas
  por rever e nos movimentos por classificar. A partir de 1024 px abre com os nomes; entre 640 e 1023 px mostra só os
  ícones; o botão "Encolher menu" muda e a escolha fica lembrada neste aparelho. No telemóvel o menu abre de lado (botão
  no canto de cima, à esquerda); o "+" em baixo dá as três ações rápidas (fotografar fatura, lançar despesa, importar extrato).
- **Início:** diz o que fazer a seguir ("1 fatura por rever, Rever agora"). Por ordem: faturas lidas por rever, movimentos
  por classificar, despesas sem fatura. Enquanto a Torre está por montar mostra os **primeiros passos** (contas, extrato,
  faturas, débitos) e desaparecem sozinhos quando estiverem feitos.
- **Largar faturas em qualquer ecrã:** arrastar PDFs ou fotografias para a janela abre a caixa de faturas e lê-as (na ficha
  de um movimento, liga-as a esse movimento). Não vale na importação de extratos (aí o ficheiro é um CSV).
- **Movimentos:** separadores Todos / Por classificar / Sem fatura (com números), pesquisa por texto ou valor, filtros
  escondidos até serem precisos, agrupado por mês e "mostrar mais". A **categoria muda-se na própria linha**; depois
  aparece "Aplicar sempre a ...", que cria a regra e classifica os outros movimentos parecidos.
- **Avisos curtos** no canto (guardado, classificado...) em vez de mensagens coladas à página; os erros ficam junto ao botão.
- **Definições** por secções, com o seu menu lateral: Contas, Regras, Categorias, Fornecedores e clientes (lista; a página completa é Clientes e fornecedores), A minha conta
  (sócios, PIN, cópia de segurança). O endereço guarda a secção (`/definicoes?s=regras`).
- **Pesquisa e ações (Ctrl K, Cmd K ou "/")** em qualquer ecrã.

## Faturas (fase 2)

- **Caixa de entrada:** larga-se PDFs ou fotografias (várias de uma vez; no telemóvel, "Fotografar"). Cada uma passa por:
  1. **código QR da AT**, lido no browser (pdf.js + jsQR): NIF, número, data, base, IVA e total exatos, como foram
     comunicados às Finanças. Todas as faturas portuguesas de software certificado o têm desde 2022;
  2. **IA** (Claude, `lib/ia-fatura.ts`, saída estruturada): nome do fornecedor, descrição, categoria, vencimento, e as
     faturas estrangeiras (Vercel, Anthropic...) que não têm QR. O QR ganha sempre à IA. O que a IA não lê com certeza vai
     para "dúvidas" em vez de ser adivinhado.
  3. fornecedor (pelo NIF ou pelo nome), categoria (a última usada com esse fornecedor) e **ligação ao movimento do banco**
     (valor, nome na descrição, datas perto). Só liga sozinha quando é inequívoco; senão sugere.
- **Revisão:** documento ao lado, cada campo com a origem à vista (QR da AT, IA, histórico). "Confirmar e seguir" cria o
  fornecedor se for novo, passa categoria e fornecedor ao movimento e abre a próxima por rever.
- **Movimentos:** etiqueta e filtro "Sem fatura"; no detalhe, a fatura ligada ou uma caixa para a juntar ali.
- **Pacote do contabilista:** ZIP do mês com as faturas (nomes arrumados), `faturas.csv`, `movimentos.csv` (abrem no Excel)
  e um LEIA-ME com as despesas ainda sem fatura.
- Ficheiros no armazenamento privado `faturas` do Supabase, só para sócios, servidos pela Torre (`/faturas/<id>/ficheiro`).
  O mesmo ficheiro duas vezes, ou o mesmo número do mesmo fornecedor, não duplica.
- Precisa de `ANTHROPIC_API_KEY` (no `.env.local`; na Vercel quando se publicar, como variável sensível). Sem chave, o QR
  continua a funcionar e o resto preenche-se à mão.

## Também (fase 2)

- **Pesquisa rápida** (Ctrl K, Cmd K ou "/"): qualquer fatura, fornecedor, débito, conta ou movimento (por texto ou valor),
  e as ações mais comuns.
- **Resultados:** proveitos e custos por grupo, mês a mês (12 meses ou por ano). Com fatura conta o valor sem IVA; o IVA
  fica numa estimativa à parte.
- **Pré-preenchimento:** no lançamento à mão, o fornecedor traz a categoria da última vez e o débito direto traz fornecedor,
  categoria, conta e valor; a conta começa na última usada.

## O que tem (fase 1)

- **Início:** caixa da empresa, resultado do mês e do ano, débitos por mês, saldos por conta, quanto a empresa deve a cada
  sócio, de onde saiu o dinheiro este mês, próximos débitos (30 dias) e avisos (por classificar, débito com valor diferente
  do previsto, pagamento previsto que não aparece no extrato).
- **Movimentos:** lista com filtros, lançamento à mão, edição, e "aplicar sempre" (cria uma regra e classifica já os outros).
- **Importar extrato:** CSV de qualquer banco (deteta separador, cabeçalho no meio do ficheiro, débito/crédito ou coluna
  única, ficheiros em Windows-1252). Guarda as colunas por conta. Voltar a importar o mesmo extrato não duplica nada.
  Nas contas dos sócios começa sem nada escolhido: escolhe-se só o que é da Ace Labs.
- **Débitos diretos:** de que conta sai cada um, valor, próxima cobrança, total por mês e por ano. Sugere débitos a partir
  de pagamentos que se repetem nos extratos.
- **Sócios:** despesas adiantadas (a conjunta divide em partes iguais), suprimentos, reembolsos e capital.
- **Registo:** quem fez o quê (gatilho na base de dados, não se pode falsificar a partir da app).
- **Definições:** contas, regras, categorias, fornecedores e clientes, mudar PIN, cópia de segurança.

Contas: **empresa** (o dinheiro é da Ace Labs), **conjunta** (dos dois sócios), **pessoal** e **cartão** (com titular = dinheiro
de um sócio; sem titular = cartão da empresa). Despesas pagas com dinheiro dos sócios ficam "a devolver" por omissão.
Categorias "internas" (transferências, capital, suprimentos, reembolsos, entrega de IVA) não entram no resultado.

A Torre não emite faturas (isso exige software certificado pela AT) e não substitui a contabilidade oficial.

## Montar do zero

1. Projeto Supabase próprio, região UE, nome `acelabs-torre`. Em Authentication: desligar "Allow new users to sign up";
   password mínima de 12 caracteres.
2. `.env.local` nesta pasta (nunca no git):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
   SUPABASE_SERVICE_ROLE_KEY=<service_role>     # só neste computador, para os scripts e testes
   TORRE_DB_URL=<Connect > Session pooler>      # para npm run schema
   TORRE_PIN_SEGREDO=<48 bytes aleatórios>      # igual ao da Vercel (ver "Entrar com PIN")
   ANTHROPIC_API_KEY=<chave>                    # leitura de faturas
   ```
3. `npm install`, `npm run schema` (cria tabelas, regras de acesso e categorias; pode repetir-se).
4. `npm run socio -- pedro@acelabs.pt Pedro` e `npm run socio -- miguel@acelabs.pt Miguel`. O PIN temporário fica em
   `.env.senhas-temporarias` nesta pasta (fora do git, não aparece no ecrã). Cada um entra com ele e muda-o em
   "Mudar PIN". Depois apaga-se o ficheiro. Repetir o comando dá um PIN novo (serve para quem se esqueceu).
5. `npm run dev` (porta 3003). O `predev`/`prebuild` copia o worker do pdf.js para `public/` (o build não o consegue
   empacotar; fica fora do git).

Em uso: projeto `acelabs-torre` (`umsfewmuqqdfgffgksbg`) na organização grátis `acelabs-gratis` do Supabase, endereço
`https://acelabs-torre.vercel.app`.

## Plano grátis do Supabase

- **Pausa ao fim de 7 dias sem uso:** a Vercel chama `/api/manter` todos os dias às 7h (UTC), com `CRON_SECRET`
  (`vercel.json`). O pedido toca na base de dados sem ler nada.
- **Sem cópias automáticas:** em Definições, "Descarregar cópia de tudo" (JSON com todas as tabelas), pelo menos uma vez
  por semana. No computador: `npm run copia` grava em `business-center/torre-copias/` (fora do git).

## Publicar

Vercel, equipa `acelabs1`, projeto `torre`, por CLI (`vercel deploy --prod` nesta pasta), como o Cockpit. Na Vercel só vão
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (tipo "config", são públicas por desenho), e como sensíveis
`CRON_SECRET`, `TORRE_PIN_SEGREDO` e `ANTHROPIC_API_KEY`.
**A service_role nunca vai para a Vercel**: a app só usa a sessão de quem entrou, e é a base de dados que decide o acesso.
Depois de publicar, confirmar o login e um ecrã em `https://acelabs-torre.vercel.app`.

## Segurança

- Regras de acesso (RLS) em todas as tabelas: só sócios ativos com sessão iniciada. A chave anon não lê nada. Desativar um
  sócio (`ativo = false`) corta o acesso logo, mesmo com a sessão aberta.
- PIN de 6 algarismos com segredo do servidor e bloqueio na base de dados (ver "Entrar com PIN"). Registo público
  desligado no Supabase: só entra quem for criado com `npm run socio`.
- O middleware e cada página/ação voltam a confirmar (sessão, sócio) para mostrar o ecrã certo.
- Cabeçalhos: CSP só `'self'`, sem iframes, `noindex`, HSTS, sem cache. `Referrer-Policy: same-origin` e não
  `no-referrer`: com `no-referrer` o browser manda `Origin: null` nos POST e as ações do servidor do Next deixam de funcionar
  (ninguém consegue entrar).
- O repositório é público: aqui só há código. Nada de extratos, valores ou chaves em testes ou exemplos.

## Testes

`npm run testar`:
1. **Unidade** (sem rede): valores em vários formatos, extratos de bancos diferentes, duplicados, regras, próxima cobrança,
   saldos dos sócios, resultado, origem do dinheiro, pagamentos repetidos e avisos, com números conhecidos.
2. **Integração** (com `TORRE_TESTES_PERMITIDOS=1` no `.env.local`): sem sessão e conta que não é sócia não leem nem
   escrevem; sócio sim; sócio desativado perde o acesso logo; importar duas vezes não duplica; o registo guarda quem fez;
   regras da base de dados. Cria contas e dados de teste próprios e apaga-os no fim.
