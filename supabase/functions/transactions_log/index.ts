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
            entity_type,
            details,
            sale_total,
            sale_items,
            customer_name,
            customer_email
        } = body;

        if (!action_type) {
            return new Response(
                JSON.stringify({ success: false, error: "action_type is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const { data, error } = await supabase
            .from("transactions")
            .insert({
                action_type,
                user_email,
                entity_id,
                entity_type,
                details,
                sale_total,
                sale_items,
                customer_name,
                customer_email
            })
            .select()
            .single();

        if (error) {
            return new Response(
                JSON.stringify({ success: false, error: error.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, transaction: data }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ success: false, error: "Internal server error", details: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
