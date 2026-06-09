-- Migration to add PAN to company_settings and Freight Charges to invoices

-- Add PAN to company_settings
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS pan text;

-- Add Freight Charges and Freight GST to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS freight_charges numeric(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS freight_gst numeric(12,2) DEFAULT 0;

-- Also update existing records if they have pan in data jsonb
UPDATE company_settings SET pan = data->>'pan' WHERE pan IS NULL AND data ? 'pan';
UPDATE invoices SET freight_charges = (data->>'freightCharges')::numeric WHERE freight_charges = 0 AND data ? 'freightCharges';
UPDATE invoices SET freight_gst = (data->>'freightGst')::numeric WHERE freight_gst = 0 AND data ? 'freightGst';
