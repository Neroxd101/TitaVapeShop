-- =============================================
-- Inventory Delete Item Function
-- Deletes an inventory item via RPC
-- =============================================

CREATE OR REPLACE FUNCTION public.inventory_delete_item(
    p_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Validate required fields
    IF p_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Item ID is required'
        );
    END IF;

    -- Delete the inventory item
    DELETE FROM inventory
    WHERE inventory.id = p_id;

    -- Get the number of rows deleted
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- Check if item was found and deleted
    IF deleted_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Item not found'
        );
    END IF;

    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Item deleted'
    );
END;
$$;

-- Only the trusted backend service-role client may delete inventory items.
REVOKE ALL ON FUNCTION public.inventory_delete_item(UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.inventory_delete_item(UUID)
TO service_role;
