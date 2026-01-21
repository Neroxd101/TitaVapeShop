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

        let query = supabase.from("transactions").select("action_type, sale_total, created_at");

        if (start_date) query = query.gte("created_at", start_date);
        if (end_date) query = query.lte("created_at", end_date);

        const { data, error } = await query;

        if (error) {
            return new Response(
                JSON.stringify({ success: false, error: error.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const stats = {
            total_transactions: data.length,
            inventory_adds: data.filter((t: any) => t.action_type === "inventory_add").length,
            inventory_edits: data.filter((t: any) => t.action_type === "inventory_edit").length,
            inventory_deletes: data.filter((t: any) => t.action_type === "inventory_delete").length,
            sales_completed: data.filter((t: any) => t.action_type === "sale_complete").length,
            sales_voided: data.filter((t: any) => t.action_type === "sale_void").length,
            total_sales_amount: data
                .filter((t: any) => t.action_type === "sale_complete" && t.sale_total)
                .reduce((sum: number, t: any) => sum + parseFloat(t.sale_total), 0)
        };

        return new Response(
            JSON.stringify({ success: true, stats }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ success: false, error: "Internal server error", details: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
