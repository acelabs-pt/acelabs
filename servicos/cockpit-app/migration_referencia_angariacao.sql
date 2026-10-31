-- ID do imóvel na angariação (o título passa a ser tipologia, concelho e freguesia).
alter table angariacoes add column if not exists referencia text;
