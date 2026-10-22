-- ========================================================
-- EDUCHAT: PURGAÇÃO DEFINITIVA DE DOSSIÊS VAZADOS EM CANAIS DE EQUIPE
-- ========================================================
-- Remove quaisquer mensagens de dossiê acidentalmente inseridas
-- em canais públicos de equipe (ex: c-geral, c-comercial, etc.),
-- garantindo que dados confidenciais fiquem restritos ao solicitante.

DELETE FROM public.messages 
WHERE (
    chat_id LIKE 'c-%' 
    OR chat_id IN ('c-geral', 'c-comercial', 'c-tutoria', 'c-secretaria', 'c-marketing', 'c-pedagogico', 'c-expansao', 'c-diretoria')
    OR (channel_id IS NOT NULL AND channel_id LIKE 'c-%')
)
AND (
    text LIKE '%DOSSIÊ EXECUTIVO%' 
    OR text LIKE '%<!-- DOSSIER_RECORD:%'
);
