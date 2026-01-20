const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Use Service Role Key for backend operations to bypass RLS if needed
// and ensure we can update inventory
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const { isAuthenticated } = require('../../middleware/authMiddleware');

// Protect all sales API routes
router.use(isAuthenticated);

// Handle sale checkout: deduct inventory
router.post('/api/sales/checkout', async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Invalid cart items' });
        }

        // Process items sequentially to avoid race conditions 
        // real-world would use a DB transaction or RPC
        const results = [];
        const errors = [];

        for (const item of items) {
            try {
                // 1. Get current stock
                const { data: currentItem, error: fetchError } = await supabase
                    .from('inventory')
                    .select('quantity, name')
                    .eq('id', item.id)
                    .single();

                if (fetchError) {
                    throw new Error(`Failed to fetch item ${item.name}: ${fetchError.message}`);
                }

                if (!currentItem) {
                    throw new Error(`Item ${item.name} not found`);
                }

                // 2. Check stock
                if (currentItem.quantity < item.qty) {
                    throw new Error(`Insufficient stock for ${item.name}. Available: ${currentItem.quantity}, Requested: ${item.qty}`);
                }

                // 3. Update stock
                const newQuantity = currentItem.quantity - item.qty;
                const { error: updateError } = await supabase
                    .from('inventory')
                    .update({ quantity: newQuantity })
                    .eq('id', item.id);

                if (updateError) {
                    throw new Error(`Failed to update stock for ${item.name}: ${updateError.message}`);
                }

                results.push({
                    id: item.id,
                    name: item.name,
                    deducted: item.qty,
                    remaining: newQuantity
                });

            } catch (err) {
                console.error(`Error processing item ${item.id}:`, err);
                errors.push({
                    id: item.id,
                    name: item.name,
                    error: err.message
                });
            }
        }

        if (errors.length > 0) {
            // If there were errors, return 400 or 207 (Multi-Status)
            // For simplicity, we return 400 if ANY item failed, though some might have succeeded (partial failure)
            // In a real app we'd roll back
            return res.status(400).json({
                success: false,
                message: 'Some items failed to process',
                errors,
                processed: results
            });
        }

        res.json({ success: true, processed: results });

    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
