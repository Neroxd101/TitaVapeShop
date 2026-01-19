# Inventory API Routes Reference

Quick reference guide for all inventory API routes.

## 📋 Routes Overview

| Action | Method | Route | HTML Location | Backend Handler |
|--------|--------|-------|---------------|-----------------|
| **Load Inventory** | GET | `/inventory/load-items` | `inventory.html` (line 58) | `config/routes/inventory.js` (line 12) |
| **Create Item** | POST | `/inventory/create-item` | `inventory-add-edit-modal.html` (line 13) | `config/routes/inventory.js` (line 43) |
| **Update Item** | PUT | `/inventory/update-item` | `inventory-add-edit-modal.html` (line 13) | `config/routes/inventory.js` (line 82) |
| **Delete Item** | DELETE | `/inventory/delete-item/:id` | `inventory-delete-modal.html` (line 16) | `config/routes/inventory.js` (line 115) |

---

## 🔍 Detailed Routes

### 1. GET /inventory/load-items - Load All Items
- **HTML**: `inventory.html` → Grid loads items on page load
- **JavaScript**: `javascript/api.js` → `loadInventory()`
- **Backend**: `config/routes/inventory.js` → `router.get('/load-items')`
- **Purpose**: Fetch all inventory items from database

### 2. POST /inventory/create-item - Create New Item
- **HTML**: `inventory-add-edit-modal.html` → Form with `action="/inventory/create-item" method="POST"`
- **JavaScript**: `javascript/api.js` → `saveItem()` (when `editingItemId` is null)
- **Backend**: `config/routes/inventory.js` → `router.post('/create-item')`
- **Purpose**: Create a new inventory item

### 3. PUT /inventory/update-item - Update Existing Item
- **HTML**: `inventory-add-edit-modal.html` → Form with `action="/inventory/update-item" method="PUT"`
- **JavaScript**: `javascript/api.js` → `saveItem()` (when `editingItemId` exists)
- **Backend**: `config/routes/inventory.js` → `router.put('/update-item')`
- **Purpose**: Update an existing inventory item

### 4. DELETE /inventory/delete-item/:id - Delete Item
- **HTML**: `inventory-delete-modal.html` → Button with `data-api-route="/inventory/delete-item"`
- **JavaScript**: `javascript/api.js` → `confirmDelete()`
- **Backend**: `config/routes/inventory.js` → `router.delete('/delete-item/:id')`
- **Purpose**: Delete an inventory item by ID

---

## 🗂️ File Structure

```
public/inventory/
├── inventory.html                    # Main page (GET route)
├── inventory-add-edit-modal.html     # Create/Update form (POST/PUT routes)
├── inventory-delete-modal.html       # Delete confirmation (DELETE route)
└── javascript/
    └── api.js                        # All API calls

config/routes/
└── inventory.js                      # All backend route handlers
```

---

## 💡 Quick Tips

- **Find a route in HTML?** → Check this file to see which backend handler processes it
- **Modifying a route?** → Update both HTML `action` attribute AND backend route
- **Adding a new route?** → Add entry here, update HTML, and create backend handler
