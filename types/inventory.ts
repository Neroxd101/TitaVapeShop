export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  sale_price: number;
  costing: number;
  category?: string;
  image_urls?: string[];
  qr_code_url?: string;
  date_added?: string;
  last_update?: string;
}

export interface InventoryFormData {
  name: string;
  description?: string;
  quantity: number;
  sale_price: number;
  costing: number;
  category?: string;
  image_urls?: string[];
}
