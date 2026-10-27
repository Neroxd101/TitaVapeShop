-- Existing names remain unchanged until the customer supplies their name parts.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name_parts JSONB;

CREATE OR REPLACE FUNCTION public.customer_normalize_name_parts(p_parts JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
    result JSONB := '{}'::JSONB;
    part TEXT;
    value TEXT;
BEGIN
    IF jsonb_typeof(p_parts) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'Please provide your last name and first name';
    END IF;
    FOREACH part IN ARRAY ARRAY['last_name', 'first_name', 'middle_name', 'suffix'] LOOP
        IF p_parts ? part AND jsonb_typeof(p_parts->part) <> 'string' THEN
            RAISE EXCEPTION 'Name fields must be text';
        END IF;
        value := BTRIM(COALESCE(p_parts->>part, ''));
        IF LENGTH(value) > (CASE WHEN part = 'suffix' THEN 20 ELSE 100 END) THEN
            RAISE EXCEPTION 'Name field is too long';
        END IF;
        IF part IN ('last_name', 'first_name') AND value = '' THEN
            RAISE EXCEPTION 'Please enter your last name and first name';
        END IF;
        result := result || jsonb_build_object(part, value);
    END LOOP;
    IF LENGTH((result->>'last_name') || ', ' || CONCAT_WS(' ',
        NULLIF(result->>'first_name', ''), NULLIF(result->>'middle_name', ''), NULLIF(result->>'suffix', ''))) > 255 THEN
        RAISE EXCEPTION 'Your full name must not exceed 255 characters';
    END IF;
    RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_format_name(p_parts JSONB)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
    SELECT (p_parts->>'last_name') || ', ' || CONCAT_WS(' ',
        NULLIF(p_parts->>'first_name', ''), NULLIF(p_parts->>'middle_name', ''), NULLIF(p_parts->>'suffix', ''));
$$;
REVOKE ALL ON FUNCTION public.customer_normalize_name_parts(JSONB), public.customer_format_name(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_normalize_name_parts(JSONB), public.customer_format_name(JSONB) TO service_role;
