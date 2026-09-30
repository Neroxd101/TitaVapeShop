-- Isolated fixtures: rollback-only, no business records are touched.
DO $$
DECLARE
    product UUID := gen_random_uuid();
    sale_a UUID := gen_random_uuid();
    sale_b UUID := gen_random_uuid();
    result JSONB;
BEGIN
    INSERT INTO analytics_overflow_test.inventory (id, category, name, quantity, cost_price, sale_price)
    VALUES (product, 'Overflow test', 'Overflow product', 10, 60000000, 1);
    INSERT INTO analytics_overflow_test.transactions (action_type, entity_type, entity_id, sale_total, sale_items, created_at)
    VALUES
      ('sale_complete', 'sale', sale_a, 1, jsonb_build_array(jsonb_build_object('id', product, 'name', 'Overflow product', 'qty', 1, 'price', 1, 'cost_price', 60000000)), '2030-01-01'),
      ('sale_complete', 'sale', sale_b, 1, jsonb_build_array(jsonb_build_object('id', product, 'name', 'Overflow product', 'qty', 1, 'price', 1, 'cost_price', 60000000)), '2030-01-02');
    ASSERT analytics_overflow_test.analytics_total_profit() = -119999998, 'negative profit beyond numeric(10,2)';
    result := analytics_overflow_test.analytics_modal_total_profit();
    ASSERT (result->>'total')::NUMERIC = -119999998, 'negative modal profit';
    ASSERT (result->'rows'->0->>'profit')::NUMERIC = -119999998, 'negative product breakdown';
    ASSERT analytics_overflow_test.analytics_total_profit('2030-01-02', '2030-01-02') = -59999999, 'date filter preserved';
    ASSERT analytics_overflow_test.analytics_total_profit('2040-01-01', '2040-01-01') = 0, 'empty total is zero';

    -- Voids outside a selected range must still exclude the original sale.
    INSERT INTO analytics_overflow_test.transactions (action_type, entity_type, entity_id, created_at)
    VALUES ('sale_void', 'sale', sale_a, '2031-01-01');
    ASSERT analytics_overflow_test.analytics_total_profit('2030-01-01', '2030-01-02') = -59999999, 'void filtering preserved';

    -- Profit and gross totals can exceed the limit even with valid individual prices.
    TRUNCATE analytics_overflow_test.transactions;
    INSERT INTO analytics_overflow_test.transactions (action_type, entity_type, entity_id, sale_total, sale_items, created_at)
    VALUES
      ('sale_complete', 'sale', sale_a, 60000000, jsonb_build_array(jsonb_build_object('id', product, 'name', 'Overflow product', 'qty', 1, 'price', 60000000, 'cost_price', 0)), '2030-01-01'),
      ('sale_complete', 'sale', sale_b, 60000000, jsonb_build_array(jsonb_build_object('id', product, 'name', 'Overflow product', 'qty', 1, 'price', 60000000, 'cost_price', 0)), '2030-01-01');
    ASSERT analytics_overflow_test.analytics_total_profit() = 120000000, 'positive profit beyond limit';
    ASSERT analytics_overflow_test.analytics_gross_sales() = 120000000, 'gross total beyond limit';
    ASSERT (analytics_overflow_test.analytics_modal_gross_sales()->>'total')::NUMERIC = 120000000, 'gross modal beyond limit';
    ASSERT (analytics_overflow_test.analytics_modal_total_profit()->>'total')::NUMERIC = 120000000, 'positive modal profit';
    ASSERT (analytics_overflow_test.analytics_sales_trend()->0->>'profit')::NUMERIC = 120000000, 'daily profit beyond limit';
    ASSERT (analytics_overflow_test.analytics_category_stats()->'Overflow test'->>'revenue')::NUMERIC = 120000000, 'category revenue';
    ASSERT (analytics_overflow_test.analytics_top_products()->0->>'revenue')::NUMERIC = 120000000, 'product revenue';

    -- Historical JSON amounts also must not overflow narrow casts.
    UPDATE analytics_overflow_test.transactions SET sale_items = jsonb_build_array(jsonb_build_object(
        'id', product, 'name', 'Overflow product', 'qty', 1, 'price', 100000001.115, 'cost_price', 0));
    ASSERT analytics_overflow_test.analytics_total_profit() = 200000002.24, 'large line amounts retain cent rounding';
    ASSERT (analytics_overflow_test.analytics_modal_total_profit()->>'total')::NUMERIC = 200000002.24, 'modal large line amounts';
    ASSERT (analytics_overflow_test.analytics_sales_trend()->0->>'profit')::NUMERIC = 200000002.24, 'trend large line amounts';
    ASSERT (analytics_overflow_test.analytics_category_stats()->'Overflow test'->>'revenue')::NUMERIC = 200000002.24, 'category large line amounts';
    ASSERT (analytics_overflow_test.analytics_top_products()->0->>'revenue')::NUMERIC = 200000002.24, 'product large line amounts';

    -- Missing cost snapshots still use inventory cost; explicit zero stays zero.
    TRUNCATE analytics_overflow_test.transactions;
    INSERT INTO analytics_overflow_test.transactions (action_type, entity_type, entity_id, sale_total, sale_items)
    VALUES ('sale_complete', 'sale', sale_a, 1, jsonb_build_array(jsonb_build_object('id', product, 'qty', 2, 'price', 1)));
    ASSERT analytics_overflow_test.analytics_total_profit() = -119999998, 'inventory cost fallback preserved';
    ASSERT NOT has_function_privilege('anon', 'analytics_overflow_test.analytics_total_profit(timestamptz,timestamptz)', 'EXECUTE'), 'RPC remains backend-only';
END;
$$;
SELECT 'analytics overflow regressions passed' AS result;
