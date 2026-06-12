export interface InvoiceRow {
  id: string;
  partNo: string;
  description: string;
  hsn: string;
  oQty: number;
  sQty?: number;
  mrp: number;
  disc: number;
  gst: number;
  customRate?: number | null;
  isNetRateProduct?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  gstin: string;
  address: string;
  pincode: string;
  city?: string;
  state: string;
  stateCode?: string;
  routeId?: string;
  aadhar?: string;
  pan?: string;
  root?: string;
  openingBalanceAmount?: number;
  openingBalanceType?: 'They owe us' | 'We owe them';
  balanceType?: 'receivable' | 'payable';
  openingBalanceDate?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  barcode?: string;
  brand: string;
  category: string;
  hsnCode: string;
  mrp: number;
  gstRate: number;
  unit: string;
  stock: number;
  reorderLevel?: number;
}

export interface PricingRule {
  id: string;
  customerId: string;
  type: 'BRAND_DISCOUNT' | 'PRODUCT_DISCOUNT' | 'PRODUCT_NET_RATE' | 'CATEGORY_DISCOUNT';
  target: string; // Brand Name or Product ID or Category Name
  value: number; // Discount % or Net Rate Amount
}

export interface InvoiceItem {
  id: string;
  productId: string;
  productName: string;
  partNumber: string;
  hsnCode: string;
  sellingPrice: number;
  gstRate: number;
  quantity: number;
  discountPercent?: number; // per product discount %
  discountAmount?: number;   // row discount amt
  netPriceApplied?: number;  // customer-specific fixed selling price override
  subtotal: number; // rate * qty
  taxAmount: number; // subtotal * (gstRate/100)
  totalAmount: number; // subtotal + taxAmount
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerEmail: string;
  customerGstin: string;
  customerPan?: string;
  customerAadhar?: string;
  customerAddress: string;
  deliveryAddress?: string;
  customerState: string;
  items: InvoiceItem[];
  discountPercent: number; // discount on whole invoice subtotal/total
  subtotal: number; // sum of item subtotals (MRP × Qty)
  discountAmount: number; // total discount amount (MRP - Rate) × Qty plus any invoice-level discount
  taxAmount: number; // total tax (CGST+SGST or IGST)
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number; // taxable subtotal + tax amount
  isSameState: boolean; // Same as business state (West Bengal)
  status: 'Paid' | 'Draft' | 'Sent';
  vehicleNo?: string;
  irnNo?: string;
  ackNo?: string;
  ackDate?: string;
  orderNo?: string;
  remark?: string;
}

export interface BusinessProfile {
  name: string;
  gstin: string;
  address: string;
  phone: string;
  email: string;
  state: string; // Defaults to "West Bengal"
  logo: string; // Emoji or visual icon representation
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  terms: string[];
}

export interface CustomerDiscount {
  id: string;
  customerId: string;
  type: 'BRAND' | 'PRODUCT';
  target: string; // Brand name or Product ID
  discountPercent: number;
}

export interface CustomerNetRate {
  id: string;
  customerId: string;
  productId: string;
  netRate: number;
  productName?: string;
}

export interface CustomerCategoryDiscount {
  id: string;
  customerId: string;
  category: string;
  discountPercent: number;
}

export interface CustomerDiscountRule {
  id: string;
  customerId: string;
  customerName: string;
  type: 'Flat' | 'Brand' | 'SKU';
  value: string; // Brand Name or Product ID or blank for Flat
  label?: string; // Brand Name or Product Name
  discountPercent: number;
}

export interface CreditNoteItem {
  id: string;
  productId: string;
  productName: string;
  partNumber: string;
  hsnCode: string;
  sellingPrice: number;
  gstRate: number;
  quantity: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerMobile: string;
  customerGstin: string;
  customerAddress: string;
  customerState: string;
  date: string;
  items: CreditNoteItem[];
  subtotal: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
  isSameState: boolean;
}

export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  mode: string;
  date: string;
  type: 'CASH' | 'UPI';
}

export interface Supplier {
  id: string;
  name: string;
  mobile: string;
  gstin: string;
  address: string;
  state: string;
  openingBalanceAmount?: number;
  openingBalanceType?: 'We owe them' | 'They owe us';
  openingBalanceDate?: string;
}

export interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  partNumber: string;
  brand: string;
  hsnCode: string;
  quantity: number;
  purchasePrice: number;
  rowDiscountPercent: number;
  gstRate: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  date: string;
  supplierId: string;
  supplierName: string;
  supplierMobile: string;
  supplierGstin: string;
  supplierState: string;
  items: PurchaseItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  grandTotal: number;
  isSameState: boolean;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  mode: string;
  date: string;
}

