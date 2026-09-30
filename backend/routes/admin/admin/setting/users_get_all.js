const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../../../database/supabase');
const { isAuthenticated, hasRole } = require('../../../../middleware/authMiddleware');

/**
 * GET /api/user/profile/info
 * Get current user profile information (or target user if admin)
 */
router.get('/api/user/profile/info', isAuthenticated, hasRole(['admin']), async (req, res) => {
  try {
    const userId = req.user?.id;
    const targetUserId = req.query.user_id; // Admin can specify target user
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    let user;

    if (targetUserId) {
      // Fetch specific user by ID via RPC
      const { data: userData, error: rpcError } = await supabaseAdmin.rpc('users_get_all', {
        p_user_id: targetUserId
      });

      if (rpcError || !userData || userData.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      user = userData[0];
    } else {
      // Get current user info via RPC
      const { data: userData, error: rpcError } = await supabaseAdmin.rpc('users_get_all', {
        p_user_id: userId
      });

      if (rpcError || !userData || userData.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      user = userData[0];
    }

    // Return user info (without password)
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        last_login: user.last_login,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/users/list
 * Get list of all users (admin only)
 */
router.get('/api/users/list', isAuthenticated, hasRole(['admin']), async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }
    
    // Call RPC function to get all users
    const { data: users, error } = await supabaseAdmin.rpc('users_get_all');

    if (error) {
      console.error('RPC error fetching users:', error);
      return res.status(400).json({ success: false, error: error.message });
    }
    
    res.json({
      success: true,
      users: users || []
    });
  } catch (error) {
    console.error('Get users list error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', details: error.message });
  }
});

module.exports = router;
