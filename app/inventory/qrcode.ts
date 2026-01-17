import QRCode from 'qrcode';
import sharp from 'sharp';

// Helper function to sanitize item name for use in file paths
function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Escape item name for SVG
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface GenerateQRCodeOptions {
  data: string;
  itemName: string;
  qrCodeSize?: number;
  margin?: number;
  textHeight?: number;
  fontSize?: number;
}

/**
 * Generates a QR code image with the item name below it
 * @param options - Configuration options for QR code generation
 * @returns Buffer containing the PNG image
 */
export async function generateQRCodeWithText(options: GenerateQRCodeOptions): Promise<Buffer> {
  const {
    data,
    itemName,
    qrCodeSize = 300,
    margin = 1,
    textHeight = 25,
    fontSize = 13,
  } = options;

  // Generate QR code buffer
  const qrCodeBuffer = await QRCode.toBuffer(data, {
    errorCorrectionLevel: 'M',
    type: 'png',
    width: qrCodeSize,
    margin,
  });

  // Calculate dimensions
  const padding = 0;
  const totalWidth = qrCodeSize;
  const totalHeight = qrCodeSize + textHeight;

  // Escape item name for SVG
  const escapedItemName = escapeXml(itemName);
  const textY = qrCodeSize + 12;

  // Convert QR code to base64 data URL
  const qrCodeBase64 = qrCodeBuffer.toString('base64');

  // Create SVG with QR code and text
  const svgWithText = `
    <svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <rect width="${totalWidth}" height="${totalHeight}" fill="white"/>
      <image 
        x="0" 
        y="0" 
        width="${qrCodeSize}" 
        height="${qrCodeSize}" 
        href="data:image/png;base64,${qrCodeBase64}"
      />
      <text 
        x="${totalWidth / 2}" 
        y="${textY}" 
        font-family="Arial, sans-serif" 
        font-size="${fontSize}" 
        font-weight="bold" 
        fill="#000000" 
        text-anchor="middle"
        dominant-baseline="middle"
      >${escapedItemName}</text>
    </svg>
  `;

  // Convert SVG to PNG
  const finalBuffer = await sharp(Buffer.from(svgWithText))
    .png()
    .toBuffer();

  return finalBuffer;
}

/**
 * Sanitizes item name for use in file paths
 */
export function sanitizeItemNameForPath(name: string): string {
  return sanitizeFileName(name);
}
