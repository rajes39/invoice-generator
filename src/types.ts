export interface Customer {
  id: string;
  name: string;
  mobile: string;
  gstin: string;
  address: string;
  state: string;
  aadhar?: string;
  pan?: string;
  root?: string;
}

export interface Product {
  id: string;
  name: string;
  partNumber: string;
  brand: string;
  category?: string;
  hsnCode: string;
  sellingPrice: number;
  gstRate: number; // 5, 12, 18, 28
  currentStock: number;
  isNetProduct?: boolean; // Net Product (No discount allowed)
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
  customerGstin: string;
  customerAddress: string;
  customerState: string;
  items: InvoiceItem[];
  discountPercent: number; // discount on whole invoice subtotal/total
  subtotal: number; // sum of item subtotals
  discountAmount: number;
  taxAmount: number; // total tax (CGST+SGST or IGST)
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number; // subtotal - discountAmount + taxAmount
  isSameState: boolean; // Same as business state (West Bengal)
  status: 'Paid' | 'Draft' | 'Sent';
  vehicleNo?: string;
}

export interface BusinessProfile {
  name: string;
  gstin: string;
  address: string;
  phone: string;
  email: string;
  state: string; // Defaults to "West Bengal"
  logo: string; // Emoji or visual icon representation
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

