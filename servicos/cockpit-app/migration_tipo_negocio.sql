-- Tipo de negócio (Habitação ou Comercial) nos compradores e proprietários.
alter table compradores add column if not exists tipo_negocio text;
alter table proprietarios add column if not exists tipo_negocio text;
