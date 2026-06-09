export type Money = number;

export interface Customer {
  id: string;
  userId: string;
  name: string;
  mobile: string;
  email: string;
  gstin: string;
  pan: string;
  aadhar: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  routeId?: string;
  openingBalance: number;
  openingBalanceType: 'They owe us' | 'We owe them';
  balance: number;
  createdAt: string;
}

export interface Supplier {
  id: string;
  userId: string;
  name: string;
  contactPerson: string;
  mobile: string;
  email: string;
  gstin: string;
  pan: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  paymentTerms: string;
  openingBalance: number;
  balanceType: 'We owe them' | 'They owe us';
  createdAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  isActive: boolean;
  userId: string;
  createdAt: string;
}

export interface Route {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  userId: string;
  createdAt: string;
}

export interface Product {
  id: string;
  userId: string;
  sku: string;
  name: string;
  partNo: string;
  brandId?: string;
  brand?: string;
  categoryId?: string;
  category?: string;
  hsnCode: string;
  unit: string;
  purchasePrice: number;
  rate: number; // Selling price
  mrp: number;
  gstRate: number;
  stock: number;
  reorderLevel: number;
  isNetRateProduct: boolean;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  productName: string;
  partNo: string;
  hsnCode: string;
  qty: number;
  mrpPerUnit: number;
  effectivePrice: number; // Rate after discount
  discountPercent: number;
  discountAmount: number; // Disc (Rs.)
  isNetRate: boolean;
  gstRate: number;
  basicRatePerUnit: number; // Rate before GST
  basicAmount: number; // Taxable Amt
  gstAmount: number; // GST Tax
  lineTotal: number; // Amount
  createdAt: string;
}

export interface CreditNoteItem {
  id: string;
  creditNoteId: string;
  productId: string;
  productName: string;
  partNo: string;
  hsnCode: string;
  qty: number;
  mrpPerUnit: number;
  effectivePrice: number;
  discountPercent: number;
  discountAmount: number;
  gstRate: number;
  basicAmount: number;
  gstAmount: number;
  lineTotal: number;
}

export interface Address {
  address: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
}

export interface Invoice {
  id: string;
  userId: string;
  invoiceNumber: string;
  
  // E-invoice fields
  irnNo?: string;
  ackNo?: string;
  ackDate?: string;
  
  customerId: string;
  customerName: string;
  customerGstin: string;
  customerPan: string;
  customerAadhar?: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerStateCode: string;
  
  deliveryAddress: Address;
  
  date: string;
  dueDate: string;
  orderNo?: string;
  remark?: string;
  
  subtotalMrp: number; // Total MRP
  totalDiscountAmount: number; // Total Discount
  subtotalBasic: number; // Taxable Amount
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  freightCharges: number;
  freightGst: number;
  roundOff: number;
  grandTotal: number; // Bill Total
  
  isInterstate: boolean;
  status: 'Draft' | 'Active' | 'Paid' | 'Cancelled';
  items: InvoiceItem[];
  createdAt: string;
}

export interface CreditNote {
  id: string;
  userId: string;
  creditNoteNumber: string;
  originalInvoiceId: string;
  originalInvoiceNumber?: string;
  customerId: string;
  customerName: string;
  customerGstin: string;
  customerPhone?: string;
  customerAddress?: string;
  date: string;
  reason: string;
  items: CreditNoteItem[];
  subtotalBasic: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  roundOff: number;
  totalAmount: number;
  status: 'Pending' | 'Applied';
  createdAt: string;
}

export interface CompanySettings {
  id: string;
  user_id: string;
  company_name: string;
  gstin: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
  state: string;
  state_code: string;
  logo_url: string;
  pan: string;
  
  // Bank Details
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  branch: string;
  
  invoice_prefix: string;
  invoice_sequence: number;
  financial_year: string;
  created_at: string;
}

export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  mode: string;
  date: string;
  type: 'CASH' | 'UPI';
}

export interface PricingRule {
  id: string;
  customerId: string;
  type: 'BRAND_DISCOUNT' | 'PRODUCT_DISCOUNT' | 'PRODUCT_NET_RATE';
  target: string;
  value: number;
}

export interface ReportFilters {
  from?: string;
  to?: string;
  customerId?: string;
  productId?: string;
}
