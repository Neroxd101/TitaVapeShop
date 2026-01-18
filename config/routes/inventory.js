const express = require('express');
const path = require('path');
const router = express.Router();
const supabase = require('../database/supabase');

// GET /inventory - Serve inventory page
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/inventory.html'));
});

// GET /inventory/api - Get all inventory items
router.get('/api', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    const { data, error } = await supabase.functions.invoke('inventory', {
      body: { 
        action: 'list',
        category: req.query.category,
        search: req.query.search,
      },
    });

    if (error) {
      console.error('Supabase function error:', error);
      // Check if the data contains the actual response
      if (data && typeof data === 'object') {
        return res.status(400).json(data);
      }
      return res.status(400).json({ success: false, error: error.message || 'Failed to fetch inventory' });
    }

    res.json(data);
  } catch (error) {
    console.error('Inventory fetch error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /inventory/api - Create new item
router.post('/api', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    console.log('Creating item with data:', JSON.stringify(req.body, null, 2));

    const { data, error } = await supabase.functions.invoke('inventory', {
      body: { 
        action: 'create',
        ...req.body,
      },
    });

    console.log('Edge function response:', { data, error });

    if (error) {
      console.error('Supabase function error:', error);
      // The Edge Function may have returned error details in data
      if (data && data.error) {
        return res.status(400).json({ success: false, error: data.error });
      }
      return res.status(400).json({ success: false, error: error.message || 'Failed to create item' });
    }

    // Check if data indicates failure
    if (data && data.success === false) {
      return res.status(400).json(data);
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Inventory create error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// PUT /inventory/api - Update item
router.put('/api', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    const { data, error } = await supabase.functions.invoke('inventory', {
      body: { 
        action: 'update',
        ...req.body,
      },
    });

    if (error) {
      console.error('Supabase function error:', error);
      if (data && data.error) {
        return res.status(400).json({ success: false, error: data.error });
      }
      return res.status(400).json({ success: false, error: error.message || 'Failed to update item' });
    }

    if (data && data.success === false) {
      return res.status(400).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Inventory update error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

// DELETE /inventory/api/:id - Delete item
router.delete('/api/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ success: false, error: 'Database not configured' });
    }

    const { data, error } = await supabase.functions.invoke('inventory', {
      body: { 
        action: 'delete',
        id: req.params.id,
      },
    });

    if (error) {
      console.error('Supabase function error:', error);
      if (data && data.error) {
        return res.status(400).json({ success: false, error: data.error });
      }
      return res.status(400).json({ success: false, error: error.message || 'Failed to delete item' });
    }

    if (data && data.success === false) {
      return res.status(400).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error('Inventory delete error:', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

module.exports = router;
