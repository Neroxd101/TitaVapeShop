-- Inventory category deletion is exposed through its own admin-only RPC.
DROP FUNCTION IF EXISTS public.category_delete(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS public.category_delete(VARCHAR);

CREATE OR REPLACE FUNCTION public.inventory_category_delete(
    p_slug VARCHAR(20),
    p_user_email VARCHAR(255) DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_name VARCHAR(20);
    clean_slug VARCHAR(20) := LOWER(BTRIM(p_slug));
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.inventory AS item
        WHERE LOWER(item.category) = clean_slug
    ) THEN
        RAISE EXCEPTION 'Category cannot be deleted while products use it';
    END IF;

    SELECT category.name INTO deleted_name
    FROM public.inventory_categories AS category
    WHERE category.slug = clean_slug;

    DELETE FROM public.inventory_categories AS category
    WHERE category.slug = clean_slug;

    PERFORM public.transactions_log(
        'category_delete',
        p_user_email,
        NULL,
        'category',
        jsonb_build_object('category_name', deleted_name, 'category_slug', clean_slug)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.inventory_category_delete(VARCHAR, VARCHAR)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_category_delete(VARCHAR, VARCHAR)
TO service_role;
