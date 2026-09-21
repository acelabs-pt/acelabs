-- =============================================================
-- CPCV com IA - Fase 5 (cópia automática no Google Drive)
-- Migração aditiva sobre o schema já em produção.
-- =============================================================

-- Guarda o link da pasta no Drive onde o PDF/Word ficam também guardados, criada
-- automaticamente quando a gestora aprova e gera o CPCV. Ver lib/google-drive.ts.
alter table cpcv_processos add column if not exists drive_folder_url text;
