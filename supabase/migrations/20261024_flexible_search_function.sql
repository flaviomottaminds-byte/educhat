-- ========================================================
-- EDUCHAT / EDUCONTROL: BUSCA FLEXÍVEL DE ALUNOS (UNACCENT + ILIKE + TRIGRAM)
-- Permite localizar alunos por:
-- 1. Nome parcial ou nomes do meio (ex: "Célia Florentina Amaral" acha "Regina Célia Florentina Amaral")
-- 2. Insensibilidade a acentos (unaccent) e maiúsculas/minúsculas (ILIKE)
-- 3. CPF (com ou sem pontuação)
-- 4. Similaridade Trigram (pg_trgm) para erros de digitação leves
-- ========================================================

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.buscar_alunos_flexivel(termo TEXT)
RETURNS SETOF public.alunos
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    clean_term TEXT;
    words TEXT[];
BEGIN
    clean_term := trim(termo);
    IF clean_term IS NULL OR clean_term = '' THEN
        RETURN;
    END IF;

    -- A. Busca por CPF ou dígitos numéricos (>= 5 dígitos)
    IF regexp_replace(clean_term, '\D', '', 'g') ~ '^\d{5,}$' THEN
        RETURN QUERY
        SELECT * FROM public.alunos
        WHERE regexp_replace(cpf, '\D', '', 'g') LIKE '%' || regexp_replace(clean_term, '\D', '', 'g') || '%'
        LIMIT 5;
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;

    -- B. Correspondência de frase contínua com unaccent + ILIKE
    RETURN QUERY
    SELECT * FROM public.alunos
    WHERE unaccent(nome_completo) ILIKE unaccent('%' || clean_term || '%')
       OR email ILIKE '%' || clean_term || '%'
    LIMIT 5;
    IF FOUND THEN
        RETURN;
    END IF;

    -- C. Busca por tokens/palavras individuais:
    -- Retorna alunos cujo nome contenha TODAS as palavras principais fornecidas (em qualquer ordem)
    words := string_to_array(unaccent(clean_term), ' ');
    RETURN QUERY
    SELECT a.* FROM public.alunos a
    WHERE (
        SELECT bool_and(unaccent(a.nome_completo) ILIKE '%' || token || '%')
        FROM unnest(words) AS token
        WHERE length(token) >= 2 AND lower(token) NOT IN ('de', 'da', 'do', 'dos', 'das', 'e')
    )
    LIMIT 5;
    IF FOUND THEN
        RETURN;
    END IF;

    -- D. Trigram similarity / Fuzzy Matching (para pequenos desvios ortográficos)
    RETURN QUERY
    SELECT * FROM public.alunos
    WHERE similarity(unaccent(nome_completo), unaccent(clean_term)) > 0.25
    ORDER BY similarity(unaccent(nome_completo), unaccent(clean_term)) DESC
    LIMIT 5;
END;
$$;
