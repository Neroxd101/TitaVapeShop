-- Dynamic inventory categories. Existing category values remain unchanged.
CREATE TABLE IF NOT EXISTS public.inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(20) NOT NULL,
    slug VARCHAR(20) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT inventory_categories_name_not_blank CHECK (length(btrim(name)) BETWEEN 1 AND 20)
);

INSERT INTO public.inventory_categories (name, slug)
VALUES ('Hardware', 'hardware'), ('Juices', 'juices')
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_category_check;

CREATE OR REPLACE FUNCTION public.categories_get_all()
RETURNS TABLE (name VARCHAR(20), slug VARCHAR(20))
LANGUAGE SQL SECURITY DEFINER SET search_path = public
AS $$
    SELECT c.name, c.slug
    FROM public.inventory_categories c
    WHERE c.is_active
    ORDER BY c.name;
$$;

DROP FUNCTION IF EXISTS public.category_create(VARCHAR);
CREATE OR REPLACE FUNCTION public.category_create(p_name VARCHAR(20), p_user_email VARCHAR(255) DEFAULT NULL)
RETURNS TABLE (name VARCHAR(20), slug VARCHAR(20))
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    clean_name VARCHAR(20) := BTRIM(p_name);
    v_slug VARCHAR(20) := LOWER(REGEXP_REPLACE(clean_name, '[^a-zA-Z0-9]+', '-', 'g'));
BEGIN
    IF clean_name IS NULL OR length(clean_name) NOT BETWEEN 1 AND 20 OR v_slug = '' THEN
        RAISE EXCEPTION 'Category must be 1–20 characters';
    END IF;
    INSERT INTO public.inventory_categories (name, slug)
    VALUES (clean_name, v_slug)
    ON CONFLICT ON CONSTRAINT inventory_categories_slug_key
    DO UPDATE SET is_active = TRUE;
    PERFORM public.transactions_log('category_add', p_user_email, NULL, 'category',
        jsonb_build_object('category_name', clean_name, 'category_slug', v_slug));
    RETURN QUERY SELECT c.name, c.slug FROM public.inventory_categories c WHERE c.slug = v_slug;
END;
$$;

DROP FUNCTION IF EXISTS public.category_delete(VARCHAR);
CREATE OR REPLACE FUNCTION public.category_delete(p_slug VARCHAR(20), p_user_email VARCHAR(255) DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    deleted_name VARCHAR(20);
BEGIN
    IF EXISTS (SELECT 1 FROM public.inventory i WHERE LOWER(i.category) = LOWER(BTRIM(p_slug))) THEN
        RAISE EXCEPTION 'Category cannot be deleted while products use it';
    END IF;
    SELECT c.name INTO deleted_name
    FROM public.inventory_categories c
    WHERE c.slug = LOWER(BTRIM(p_slug));
    DELETE FROM public.inventory_categories c WHERE c.slug = LOWER(BTRIM(p_slug));
    PERFORM public.transactions_log('category_delete', p_user_email, NULL, 'category',
        jsonb_build_object('category_name', deleted_name, 'category_slug', LOWER(BTRIM(p_slug))));
END;
$$;

REVOKE ALL ON FUNCTION public.categories_get_all() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.categories_get_all() TO service_role;
REVOKE ALL ON FUNCTION public.category_create(VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.category_create(VARCHAR, VARCHAR) TO service_role;
REVOKE ALL ON FUNCTION public.category_delete(VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.category_delete(VARCHAR, VARCHAR) TO service_role;
