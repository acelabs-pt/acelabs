-- Marca "sem interesse" nos imóveis do comprador (data em que o comprador disse que não tem interesse).
alter table comprador_imoveis add column if not exists sem_interesse_em date;
