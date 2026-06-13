ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode_no TEXT;
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode_no);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
