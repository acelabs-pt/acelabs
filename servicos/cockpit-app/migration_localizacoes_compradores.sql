-- Compradores com várias zonas de procura (distritos, concelhos e freguesias).
-- Correr no SQL Editor do Supabase de cada instalação, uma vez, ANTES de usar a app nova.
-- Formato de cada zona: {"distrito": "Braga", "concelho": "Guimarães", "freguesia": "Creixomil"}
-- Sem "freguesia" = concelho inteiro; só "distrito" = distrito inteiro.
-- As colunas antigas (distrito, concelho, freguesia) ficam na tabela, sem uso, para não perder dados.

alter table compradores add column if not exists localizacoes jsonb not null default '[]'::jsonb;

-- Copia a zona única que já existia para a lista nova (só onde ainda está vazia)
update compradores
set localizacoes = jsonb_build_array(
  jsonb_strip_nulls(jsonb_build_object('distrito', distrito, 'concelho', concelho, 'freguesia', freguesia))
)
where distrito is not null and localizacoes = '[]'::jsonb;
