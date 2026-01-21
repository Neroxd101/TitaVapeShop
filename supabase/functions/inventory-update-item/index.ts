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
        const { id, category, name, description, quantity, cost_price, sale_price, qr_image_url, images } = body;

        if (!id) {
            return new Response(
                JSON.stringify({ success: false, error: "Item ID is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const updateData: Record<string, unknown> = {};
        if (category !== undefined) updateData.category = category;
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (quantity !== undefined) updateData.quantity = quantity;
        if (cost_price !== undefined) updateData.cost_price = cost_price;
        if (sale_price !== undefined) updateData.sale_price = sale_price;
        if (qr_image_url !== undefined) updateData.qr_image_url = qr_image_url;
        if (images !== undefined) updateData.images = images;

        const { data, error } = await supabase
            .from("inventory")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            return new Response(
                JSON.stringify({ success: false, error: error.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, data }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Inventory error:", error);
        return new Response(
            JSON.stringify({ success: false, error: "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
