-- Imóveis do comprador ligados a uma angariação, com observações da visita.
-- Correr no SQL Editor do Supabase de cada instalação, uma vez, ANTES de usar a app nova.
alter table comprador_imoveis add column if not exists angariacao_id uuid references angariacoes(id) on delete set null;
alter table comprador_imoveis add column if not exists visita_obs text;
create index if not exists comprador_imoveis_angariacao on comprador_imoveis (angariacao_id);
