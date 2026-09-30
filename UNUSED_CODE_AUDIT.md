# Unused code audit — 2026-09-30

## Scope and result

Reviewed frontend HTML, JavaScript and CSS; backend modules and route imports; both server entry points; package dependencies; and 69 SQL source files. Generated dependencies, binary images and Git internals were excluded from the source review. Test utilities remain separate executable entry points.

Confirmed unused application code was removed. The remaining SQL findings have no repository callers; external consumers cannot be established from repository searches or API metadata. No live database changes were made.

## Removed

- The catalog order-success modal HTML and JavaScript, its container/script/initialization, and its dedicated CSS in three stylesheets. Checkout already redirects to order status; no application code opened this modal.
- Unused methods: CatalogCart.getImageUrl, CatalogCard.formatVariations, CustomerAuth.handleLogout and TransactionsLog.logInventoryDelete. CustomerLogin handles actual logout; inventory deletion logs through the database RPC.
- Ten unused local bindings across order status, settings, inventory image editing, POS and catalog cart rendering. Calls with side effects, including showOTPModal, were retained.
- Ignored excludeUserId arguments in customer email/phone validation, plus an unused event callback argument. Authenticated customer exclusion continues to be derived by the backend from the session.
- The unused googleapis dependency. OAuth and Drive integration use fetch. npm updated both manifests offline and removed 53 unnecessary package entries from the lockfile.

## SQL functions without application callers

| Function | Evidence | Source |
| --- | --- | --- |
| dashboard_recent_activity() | Dashboard now calls transactions_get_all. | [supabase/migrations/admin/admin/dashboard/dashboard_recent_activity.sql](/C:/Users/Administrator/Documents/titas/supabase/migrations/admin/admin/dashboard/dashboard_recent_activity.sql) |
| catalog_categories() | Catalog category route calls inventory_category_get. | [supabase/migrations/catalog/catalog_categories.sql](/C:/Users/Administrator/Documents/titas/supabase/migrations/catalog/catalog_categories.sql) |

Read-only live Supabase API metadata confirms that both functions are still deployed. They were retained because metadata and source searches cannot establish consumers outside this repository or all database-side dependencies. Removing migration files would also leave deployed functions in place. update_orders_updated_at is used by a trigger and was retained.

## CSS verification and cleanup

Verified the following selector families against frontend/backend templates, cross-file globals, generated HTML and dynamic class assignments. Removed 465 selector entries and 367 rules/empty conditional blocks from 30 stylesheets. Kept used members of grouped selectors. Removed the empty footer stylesheet and its nine imports. All 42 rendered style snapshots (14 pages at 1440, 1024 and 390 pixel widths) matched the pre-cleanup baseline.

| File | Removed positive selector families |
| --- | --- | --- |
| [frontend/admin/admin/activity-log/activity-log.css](/C:/Users/Administrator/Documents/titas/frontend/admin/admin/activity-log/activity-log.css) | `.main-header`, `.user-icon` |
| [frontend/admin/admin/analytics/analytics-structure.css](/C:/Users/Administrator/Documents/titas/frontend/admin/admin/analytics/analytics-structure.css) | `.stats-card`, `.stats-card-icon`, `.stats-value`, `.stats-label` |
| [frontend/admin/admin/dashboard/dashboard.css](/C:/Users/Administrator/Documents/titas/frontend/admin/admin/dashboard/dashboard.css) | `.metric-card-hero`, `.metric-card-alert`, `.has-urgent-stock`, `.pill-green`, `.pill-amber`, `.pill-red`, `.op-tag`, `.tag-order`, `.critical` |
| [frontend/admin/admin/inventory/inventory-structure.css](/C:/Users/Administrator/Documents/titas/frontend/admin/admin/inventory/inventory-structure.css) | `.inventory-category-stock`, `.variation-remove`, `.variation-help`, `.is-delete-confirming`, `.is-locked`, `.variation-display`, `.image-hint`, `.view-thumbnail-placeholder` |
| [frontend/admin/admin/pos/pos-structure.css](/C:/Users/Administrator/Documents/titas/frontend/admin/admin/pos/pos-structure.css) | `.main-header` |
| [frontend/catalog/catalog-checkout-styles.css](/C:/Users/Administrator/Documents/titas/frontend/catalog/catalog-checkout-styles.css) | `.form-hint` |
| [frontend/catalog/css/catalog-product-modal.css](/C:/Users/Administrator/Documents/titas/frontend/catalog/css/catalog-product-modal.css) | `.modal-variation-hint` |
| [frontend/catalog/css/catalog-responsive.css](/C:/Users/Administrator/Documents/titas/frontend/catalog/css/catalog-responsive.css) | `.category-filters` |
| [frontend/css/components/action-cards.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/action-cards.css) | `.actions-grid`, `.action-icon` |
| [frontend/css/components/animations.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/animations.css) | `.animate-slide-in`, `.animate-fade-up`, `.animate-fade-in`, `.animate-slide-down`, `.animate-scale-in`, `.animate-fade-in-row` |
| [frontend/css/components/buttons.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/buttons.css) | `.translucent` |
| [frontend/css/components/cards.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/cards.css) | `.card-dates`, `.date-item`, `.date-value` |
| [frontend/css/components/detail-view.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/detail-view.css) | `.view-dates`, `.view-date`, `.date-value` |
| [frontend/css/components/filter-tabs.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/filter-tabs.css) | `.filter-tabs-row`, `.filter-tabs-actions-single` |
| [frontend/css/components/filters.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/filters.css) | `.filters-card`, `.date-filter-group`, `.date-select` |
| `frontend/css/components/footer.css` (removed) | `.footer-text` |
| [frontend/css/components/forms.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/forms.css) | `.has-icon` |
| [frontend/css/components/history-table.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/history-table.css) | `.history-badge`, `.history-title-wrap`, `.history-modal-title`, `.history-product-divider`, `.history-stat-icon`, `.history-stats-container` |
| [frontend/css/components/image-carousel.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/image-carousel.css) | `.card-images-track`, `.card-images-nav`, `.card-images-dot`, `.card-images-arrow`, `.card-images-count` |
| [frontend/css/components/image-upload.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/image-upload.css) | `.images-grid`, `.image-upload-bar`, `.btn-upload`, `.image-hint`, `.image-uploading` |
| [frontend/css/components/main-layout.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/main-layout.css) | `.main-header`, `.menu-toggle`, `.current-date` |
| [frontend/css/components/modal-layouts.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/modal-layouts.css) | `.view-dates`, `.view-date`, `.date-value` |
| [frontend/css/components/modal.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/modal.css) | `.modal-xl` |
| [frontend/css/components/qr-preview.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/qr-preview.css) | `.card-qr`, `.qr-preview-wrapper`, `.qr-info`, `.qr-code-text`, `.view-qr`, `.no-qr` |
| [frontend/css/components/stat-cards.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/stat-cards.css) | `.stats-card`, `.stats-card-icon`, `.stats-card-info`, `.stats-label`, `.stats-value` |
| [frontend/css/components/status-indicators.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/status-indicators.css) | `.status-container`, `.online` |
| [frontend/css/components/utilities.css](/C:/Users/Administrator/Documents/titas/frontend/css/components/utilities.css) | `.amount-negative`, `.date-filter-group`, `.date-select` |
| [frontend/customer/customer-auth.css](/C:/Users/Administrator/Documents/titas/frontend/customer/customer-auth.css) | `#customerPrivacyView`, `.privacy-active`, `.privacy-header`, `.privacy-content`, `.profile-form-grid`, `.profile-full-col`, `.profile-actions`, `#customerProfileSubmitBtn` |
| [frontend/navigation/navigation.css](/C:/Users/Administrator/Documents/titas/frontend/navigation/navigation.css) | `#sidebar-container`, `.nav-user-item`, `.nav-logout-item` |
| [frontend/order-status/order-status.css](/C:/Users/Administrator/Documents/titas/frontend/order-status/order-status.css) | `.delivery-card` |

The remaining .has-icon occurrences are inside active :not(.has-icon) guards in forms.css. These rules match inputs without the class; they are used rules and were retained. No other selector candidates from the original list remain.

## Repaired defects

- Inventory stylesheet: restored the product-view media block and complete height/max-height declarations from Git history before commit 874e469. Moved the inserted Add/Edit styles outside that media block, preserved later form changes, and repaired a malformed comment. Desktop/tablet product views render with images left and details right.
- Shared modal stylesheet: removed the unmatched closing brace that could interrupt later responsive rules.
- Checkout failures: removed a stale stock-error branch referencing an undefined response variable. The backend returns errors through CustomerCreateOrder; checkout now displays that error, retains the cart, and re-enables retry. Three new tests cover failure, expired authentication and successful redirect.

## Verification

- All 24 JavaScript regression tests passed: 21 existing order/payment/refund/activity tests and three new checkout tests.
- All 195 production JavaScript files parsed successfully.
- All 80 backend JavaScript modules are reachable from main.js or netlify/functions/app.js through CommonJS imports.
- 410 local script/link/CSS-import/HTML-fetch references resolved; no missing assets were found.
- All 10 remaining direct npm dependencies have application import references.
- All 65 remaining CSS files passed comment/string and brace/parenthesis/bracket checks.
- git diff --check passed.

Inline HTML event handlers and cross-file globals were included in reference checks. Catalog product-image handlers, shared inventory helpers, receiver-consumed callbacks, Express positional parameters and the analytics success destructuring (used to omit response metadata) were retained.

Browser smoke checks passed for 14 pages at three viewport sizes, with zero JavaScript/console errors or missing local assets. The catalog product modal and inventory product-view modal were opened. API responses use local fixtures; external chart, QR and scanner libraries are stubbed. A separate browser interaction verified the solid refund button, confirmation, settled notice, removed refund action, and cleared fixture balance. Vendor rendering, OAuth, email delivery and real checkout/payment operations were not exercised.

Read-only live Supabase metadata verification passed: all 67 backend RPC names exist, and all 52 statically available parameter sets match the API definitions. This checks deployment contracts, not stored function bodies or transactional behavior. Inventory-deletion and analytics rollback regression queries generate successfully but were not executed: no PostgreSQL administrator connection is configured.

Reusable checks: node tests/verify-source.js, node --test tests/*.test.js, and node tests/verify-ui.js with the fixture server running. Browser artifacts are written to the system temporary directory. Static and fixture verification cannot prove every possible production path or external RPC consumer is covered.
