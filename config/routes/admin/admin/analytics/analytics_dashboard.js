/**
 * ============================================
 * ANALYTICS: Dashboard Route (Combined)
 * ============================================
 * 
 * GET /api/analytics/dashboard
 * Gets all analytics data by calling separate RPC functions and combining results
 * This endpoint combines all individual metrics into one response
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

router.get('/api/analytics/dashboard', isAuthenticated, hasRole(['admin']), async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ success: false, error: 'Database not configured' });
        }

        // Build RPC parameters from query string
        const rpcParams = {
            p_start_date: req.query.start_date || null,
            p_end_date: req.query.end_date || null
        };

        // ========================================
        // STEP 1: Call all separate RPC functions in parallel
        // ========================================
        const [
            totalRevenueResult,
            totalOrdersResult,
            itemsSoldResult,
            avgBasketResult,
            revenueTrendResult,
            topProductsResult,
            categoryStatsResult
        ] = await Promise.all([
            supabase.rpc('analytics_total_profit', rpcParams).then(res => {
                if (res.error && res.error.message && res.error.message.includes('analytics_total_profit')) {
                    return supabase.rpc('analytics_total_revenue', rpcParams);
                }
                return res;
            }),
            supabase.rpc('analytics_total_orders', rpcParams).then(res => {
                if (res.error && res.error.message && res.error.message.includes('analytics_total_orders')) {
                    return supabase.rpc('analytics_total_sales', rpcParams);
                }
                return res;
            }),
            supabase.rpc('analytics_items_sold', rpcParams),
            supabase.rpc('analytics_gross_sales', rpcParams).then(res => {
                if (res.error && res.error.message && res.error.message.includes('analytics_gross_sales')) {
                    return supabase.rpc('analytics_avg_basket', rpcParams);
                }
                return res;
            }),
            supabase.rpc('analytics_revenue_trend', rpcParams),
            supabase.rpc('analytics_top_products', rpcParams),
            supabase.rpc('analytics_category_stats', rpcParams)
        ]);

        // ========================================
        // STEP 2: Check for errors in any of the RPC calls
        // ========================================
        const rpcResults = [
            { name: 'analytics_total_profit', result: totalRevenueResult },
            { name: 'analytics_total_orders', result: totalOrdersResult },
            { name: 'analytics_items_sold', result: itemsSoldResult },
            { name: 'analytics_gross_sales', result: avgBasketResult },
            { name: 'analytics_revenue_trend', result: revenueTrendResult },
            { name: 'analytics_top_products', result: topProductsResult },
            { name: 'analytics_category_stats', result: categoryStatsResult }
        ];

        const failedRPCs = rpcResults.filter(rpc => rpc.result.error);
        
        if (failedRPCs.length > 0) {
            console.error('Analytics RPC Errors:');
            failedRPCs.forEach(rpc => {
                console.error(`  - ${rpc.name}:`, rpc.result.error);
            });
            
            const errorMessages = failedRPCs.map(rpc => 
                `${rpc.name}: ${rpc.result.error.message || rpc.result.error}`
            ).join('; ');
            
            return res.status(400).json({
                success: false,
                error: 'Failed to fetch analytics data',
                details: errorMessages,
                message: `The following RPC functions failed: ${failedRPCs.map(rpc => rpc.name).join(', ')}. Please ensure all migration files have been run in Supabase.`
            });
        }

        // ========================================
        // STEP 3: Extract data from each result
        // ========================================
        const totalRevenue = totalRevenueResult.data ?? 0;
        const ordersCount = totalOrdersResult.data ?? 0;
        const itemsSold = itemsSoldResult.data ?? 0;
        const grossSales = avgBasketResult.data ?? 0;
        const dailyRevenue = revenueTrendResult.data ?? [];
        const topProducts = topProductsResult.data ?? [];
        const categoryStats = categoryStatsResult.data ?? {};

        // ========================================
        // STEP 4: Build response in the format frontend expects
        // ========================================
        const response = {
            success: true,
            report: {
                totalRevenue: totalRevenue,
                totalProfit: totalRevenue,
                totalOrders: ordersCount,
                ordersCount: ordersCount,
                salesCount: ordersCount,
                itemsSold: itemsSold,
                grossSales: grossSales,
                averageSale: grossSales,
                dailyRevenue: dailyRevenue,
                topProducts: topProducts,
                categoryStats: categoryStats,
                rawSales: []
            }
        };

        // ========================================
        // STEP 5: Send combined response
        // ========================================
        res.json(response);

    } catch (error) {
        console.error('Error in analytics dashboard API:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

module.exports = router;
