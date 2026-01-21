import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const body = await req.json().catch(() => ({}));
        const { start_date, end_date } = body;

        let query = supabase
            .from("transactions")
            .select("sale_total, sale_items, customer_name, customer_email, created_at")
            .eq("action_type", "sale_complete")
            .order("created_at", { ascending: false });

        if (start_date) query = query.gte("created_at", start_date);
        if (end_date) query = query.lte("created_at", end_date);

        const { data, error } = await query;

        if (error) {
            return new Response(
                JSON.stringify({ success: false, error: error.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const total_sales = data.reduce((sum: number, sale: any) => sum + parseFloat(sale.sale_total || 0), 0);
        const total_transactions = data.length;

        const itemCounts: Record<string, any> = {};
        data.forEach((sale: any) => {
            if (sale.sale_items && Array.isArray(sale.sale_items)) {
                sale.sale_items.forEach((item: any) => {
                    if (!itemCounts[item.name]) {
                        itemCounts[item.name] = { name: item.name, quantity: 0, revenue: 0 };
                    }
                    itemCounts[item.name].quantity += item.qty;
                    itemCounts[item.name].revenue += item.qty * item.price;
                });
            }
        });

        const top_items = Object.values(itemCounts)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

        return new Response(
            JSON.stringify({
                success: true,
                report: {
                    total_sales,
                    total_transactions,
                    average_sale: total_transactions > 0 ? total_sales / total_transactions : 0,
                    top_items,
                    sales: data
                }
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ success: false, error: "Internal server error", details: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
