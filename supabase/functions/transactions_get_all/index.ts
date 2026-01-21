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
        const {
            action_type,
            user_email,
            entity_id,
            limit = 50,
            offset = 0,
            start_date,
            end_date
        } = body;

        let query = supabase
            .from("transactions")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false });

        if (action_type) query = query.eq("action_type", action_type);
        if (user_email) query = query.eq("user_email", user_email);
        if (entity_id) query = query.eq("entity_id", entity_id);
        if (start_date) query = query.gte("created_at", start_date);
        if (end_date) query = query.lte("created_at", end_date);

        query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        const { data, error, count } = await query;

        if (error) {
            return new Response(
                JSON.stringify({ success: false, error: error.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                transactions: data,
                total: count,
                limit: parseInt(limit),
                offset: parseInt(offset)
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
