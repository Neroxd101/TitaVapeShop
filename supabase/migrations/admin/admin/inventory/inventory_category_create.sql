-- Inventory category creation is exposed through its own admin-only RPC.
DROP FUNCTION IF EXISTS public.category_create(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.category_create(VARCHAR);

CREATE OR REPLACE FUNCTION public.inventory_category_create(
    p_name VARCHAR(20),
    p_user_email VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (name VARCHAR(20), slug VARCHAR(20))
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    clean_name VARCHAR(20) := BTRIM(p_name);
    v_slug VARCHAR(20) := LOWER(REGEXP_REPLACE(clean_name, '[^a-zA-Z0-9]+', '-', 'g'));
BEGIN
    IF clean_name IS NULL OR length(clean_name) NOT BETWEEN 1 AND 20 OR v_slug = '' THEN
        RAISE EXCEPTION 'Category must be 1-20 characters';
    END IF;

    INSERT INTO public.inventory_categories (name, slug)
    VALUES (clean_name, v_slug)
    ON CONFLICT ON CONSTRAINT inventory_categories_slug_key
    DO UPDATE SET is_active = TRUE;

    PERFORM public.transactions_log(
        'category_add',
        p_user_email,
        NULL,
        'category',
        jsonb_build_object('category_name', clean_name, 'category_slug', v_slug)
    );

    RETURN QUERY
    SELECT category.name, category.slug
    FROM public.inventory_categories AS category
    WHERE category.slug = v_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_category_create(VARCHAR, VARCHAR)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_category_create(VARCHAR, VARCHAR)
TO service_role;
