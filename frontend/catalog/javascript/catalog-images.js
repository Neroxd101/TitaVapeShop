// Shared image parsing and URL fallbacks for catalog cards and the product modal.
window.CatalogImages = (() => {
    function parseImages(product) {
        if (!product.images) {
            return [];
        }

        try {
            let parsed;
            if (typeof product.images === 'string') {
                if (product.images.trim().startsWith('[') || product.images.trim().startsWith('{')) {
                    parsed = JSON.parse(product.images);
                } else {
                    parsed = [product.images];
                }
            } else {
                parsed = product.images;
            }
            
            const imageArray = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
            const validImages = imageArray.filter(img => img && typeof img === 'string' && img.trim() !== '');
            const nonQrImages = validImages.filter(url => url && url !== product.qr_image_url);
            
            return nonQrImages.length > 0 ? nonQrImages : validImages;
        } catch (e) {
            console.error('Error parsing images for product:', product.id, product.name);
            return [];
        }
    }

    function getGoogleDriveFileId(url) {
        if (!url) return null;

        const patterns = [
            /[?&]id=([a-zA-Z0-9_-]+)/,
            /\/d\/([a-zA-Z0-9_-]+)/,
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }

        return null;
    }

    function getFallbackUrls(url, size = 800) {
        if (!url || typeof url !== 'string') return ['/img/placeholder-product.png'];
        
        const fileId = getGoogleDriveFileId(url);
        if (!fileId) {
            // Not a Google Drive URL, return as-is
            return [url];
        }

        return [
            `/api/catalog/image/${fileId}`,
            `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`,
            url
        ];
    }

    return { parseImages, getGoogleDriveFileId, getFallbackUrls };
})();
