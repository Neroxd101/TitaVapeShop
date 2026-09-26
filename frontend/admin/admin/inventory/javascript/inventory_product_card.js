// Build the inventory product cards displayed in the grid.
const InventoryProductCardRenderer = {
    getCategoryBadge(category) {
        const label = String(category || 'General').trim() || 'General';
        const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'general';
        if (key === 'hardware' || key === 'juices') return { className: key, style: '' };

        let hash = 0;
        for (let index = 0; index < label.length; index += 1) {
            hash = ((hash << 5) - hash) + label.charCodeAt(index);
            hash |= 0;
        }
        return {
            className: 'category-generated',
            style: ` style="--category-hue: ${Math.abs(hash) % 360}"`
        };
    },

    create(item) {
        const isLowStock = item.quantity <= 5;
        const stockLabel = Number(item.quantity) === 0 ? '(No Stock)' : (isLowStock ? '(Low)' : '');
        const category = String(item.category || 'General').trim() || 'General';
        const categoryBadge = this.getCategoryBadge(category);
        const images = InventoryImage.parseImages(item);
        const nonQrImages = images.filter(url => url && url !== item.qr_image_url);
        const firstImage = nonQrImages.length > 0 ? nonQrImages[0] : (images.length > 0 ? images[0] : null);
        const imagesHtml = firstImage
            ? (() => {
                const fallbacks = InventoryImage.getFallbackUrls(firstImage, 800);
                return `<div class="card-images single"><img src="${fallbacks[0]}" alt="${item.name}" loading="lazy" data-original-url="${firstImage}" data-fallback-size="800" data-tried-index="0"></div>`;
            })()
            : `<div class="card-images"><div class="card-images-placeholder"><svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div></div>`;

        return `
      <div class="inventory-card" data-id="${item.id}">
        ${imagesHtml}
        <div class="card-header"><span class="card-category ${categoryBadge.className}"${categoryBadge.style}>${category}</span></div>
        <h3 class="card-name">${item.name}</h3>
        <div class="card-details">
          <div class="detail-item"><span class="detail-label">Quantity</span><span class="detail-value ${isLowStock ? 'low-stock' : ''}">${item.quantity} ${stockLabel}</span></div>
          <div class="detail-item"><span class="detail-label">Sale Price</span><span class="detail-value price">${InventoryUtils.formatCurrency(item.sale_price)}</span></div>
        </div>
        <div class="card-actions">
           <button class="btn-card btn-edit" data-action="edit">Edit</button>
           <button class="btn-card btn-delete" data-action="delete">Delete</button>
        </div>
      </div>`;
    }
};

window.InventoryProductCardRenderer = InventoryProductCardRenderer;
