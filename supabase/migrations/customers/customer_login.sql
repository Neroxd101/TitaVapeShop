-- =============================================
-- Customer Login RPC Function
-- Returns customer authentication row by email
-- Password verification is done in Express using bcrypt
-- =============================================

CREATE OR REPLACE FUNCTION customer_login(
    p_email TEXT
)
RETURNS TABLE (
    id UUID,
    email TEXT,
    password TEXT,
    full_name TEXT,
    contact_number VARCHAR(20),
    birthday DATE,
    is_verified BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.email,
        c.password,
        c.full_name,
        c.contact_number,
        c.birthday,
        c.is_verified,
        c.created_at
    FROM public.customers c
    WHERE LOWER(c.email) = LOWER(TRIM(p_email));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backward compatibility alias
CREATE OR REPLACE FUNCTION customer_get_by_email(
    p_email TEXT
)
RETURNS TABLE (
    id UUID,
    email TEXT,
    password TEXT,
    full_name TEXT,
    contact_number VARCHAR(20),
    birthday DATE,
    is_verified BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM customer_login(p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
