-- Public catalog category list, limited to display names and slugs.
CREATE OR REPLACE FUNCTION public.catalog_categories()
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

REVOKE ALL ON FUNCTION public.catalog_categories() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_categories() TO anon, service_role;
