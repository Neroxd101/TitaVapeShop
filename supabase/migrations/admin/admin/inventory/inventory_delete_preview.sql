-- inventory_delete_preview RPC.
CREATE OR REPLACE FUNCTION public.inventory_delete_preview(p_id UUID)
RETURNS JSONB LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    WITH affected AS (
        SELECT o.* FROM public.orders o
        WHERE o.status IN ('pending', 'confirmed')
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(o.items) i
              WHERE i->>'id' = p_id::TEXT AND i->>'unavailable' IS DISTINCT FROM 'true')
    )
    SELECT jsonb_build_object(
        'success', EXISTS (SELECT 1 FROM public.inventory WHERE id = p_id),
        'affected_orders', COUNT(*),
        'cancelled_orders', COUNT(*) FILTER (WHERE NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(affected.items) i
            WHERE i->>'id' IS DISTINCT FROM p_id::TEXT
              AND i->>'unavailable' IS DISTINCT FROM 'true'
        )),
        'payment_review_orders', COUNT(*) FILTER (WHERE payment_status IN ('paid', 'pending_verification'))
    ) FROM affected;
$$;

REVOKE ALL ON FUNCTION public.inventory_delete_preview(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_delete_preview(UUID) TO service_role;
