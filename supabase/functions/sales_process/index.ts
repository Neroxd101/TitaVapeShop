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

        const { items } = await req.json();

        if (!items || !Array.isArray(items) || items.length === 0) {
            return new Response(
                JSON.stringify({ success: false, error: "Invalid cart items" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const results = [];
        const errors = [];

        for (const item of items) {
            try {
                const { data: currentItem, error: fetchError } = await supabase
                    .from("inventory")
                    .select("quantity, name")
                    .eq("id", item.id)
                    .single();

                if (fetchError || !currentItem) {
                    throw new Error(`Item ${item.name || item.id} not found: ${fetchError?.message || ''}`);
                }

                if (currentItem.quantity < item.qty) {
                    throw new Error(`Insufficient stock for ${currentItem.name}. Available: ${currentItem.quantity}, Requested: ${item.qty}`);
                }

                const newQuantity = currentItem.quantity - item.qty;
                const { error: updateError } = await supabase
                    .from("inventory")
                    .update({ quantity: newQuantity })
                    .eq("id", item.id);

                if (updateError) {
                    throw new Error(`Failed to update stock for ${currentItem.name}: ${updateError.message}`);
                }

                results.push({
                    id: item.id,
                    name: currentItem.name,
                    deducted: item.qty,
                    remaining: newQuantity
                });

            } catch (err) {
                console.error(`Error processing item ${item.id}:`, err);
                errors.push({
                    id: item.id,
                    name: item.name || "Unknown",
                    error: err.message
                });
            }
        }

        if (errors.length > 0) {
            return new Response(
                JSON.stringify({
                    success: false,
                    message: "Some items failed to process",
                    errors,
                    processed: results
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, processed: results }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Sales error:", error);
        return new Response(
            JSON.stringify({ success: false, error: "Internal server error", details: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
