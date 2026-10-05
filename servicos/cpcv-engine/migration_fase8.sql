-- =============================================================
-- CPCV com IA - Fase 8 (tipos de documento dinamicos por pessoa)
-- Migracao aditiva sobre o schema ja em producao.
-- =============================================================

-- cpcv_ficheiros.tipo tinha uma check constraint fixa ('cc_vendedor','cc_comprador',
-- 'caderneta_predial','certificado_energetico','outro') de quando so havia um documento
-- por tipo. Desde a reorganizacao de /cpcv/novo em varios documentos por imovel e varios
-- documentos por pessoa (identificacao_vendedor, identificacao_vendedor_2, etc. - sufixo
-- dinamico por pessoa e por ficheiro), passou a haver valores fora dessa lista fixa, o que
-- fazia o upload falhar com "violates check constraint cpcv_ficheiros_tipo_check" (sem erro
-- visivel na UI - o insert em cpcv_ficheiros nao verificava o erro). Mesma convencao ja usada
-- para outras colunas livres do schema (documento_tipo, estado_civil): sem constraint fixa.
alter table cpcv_ficheiros drop constraint if exists cpcv_ficheiros_tipo_check;
