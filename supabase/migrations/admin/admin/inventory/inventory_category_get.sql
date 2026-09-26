-- Return active inventory categories through the inventory-specific RPC.
DROP FUNCTION IF EXISTS public.categories_get_all();

CREATE OR REPLACE FUNCTION public.inventory_category_get()
RETURNS TABLE (
    name VARCHAR(20),
    slug VARCHAR(20)
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT category.name, category.slug
    FROM public.inventory_categories AS category
    WHERE category.is_active
    ORDER BY category.name;
$$;

REVOKE ALL ON FUNCTION public.inventory_category_get() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_category_get() TO service_role;
