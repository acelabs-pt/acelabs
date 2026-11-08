-- Valor do cheque bancário nos documentos do comprador para a escritura.
alter table comprador_documentos add column if not exists valor numeric(12,2);
