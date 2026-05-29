import { Customer, Product, Invoice, BusinessProfile } from './types';

export const INITIAL_BUSINESS_PROFILE: BusinessProfile = {
  name: "Superior Tech Distribution Ltd",
  gstin: "19AAACS2312M1Z5", // West Bengal state code is 19
  address: "Block EP & GP, Sector V, Salt Lake City, Kolkata",
  phone: "+91 98765 43210",
  email: "billing@superiortech.in",
  state: "West Bengal",
  logo: "⚡",
};

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: "cust-1",
    name: "Aman Logistics & Solutions",
    mobile: "9123456780",
    gstin: "19AHDCS8421A1Z9",
    address: "24 Park Street, Near Metro Station, Kolkata",
    state: "West Bengal",
    root: "Kolkata Branch",
  },
  {
    id: "cust-2",
    name: "Vertex Tech Hub Pvt Ltd",
    mobile: "8877665544",
    gstin: "27AAACV9876R1Z4", // Maharashtra state code is 27
    address: "102, Bandra Kurla Complex, Bandra East, Mumbai",
    state: "Maharashtra",
    root: "Mumbai Hub",
  },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    name: "Logitech MX Master 3S Wireless Mouse",
    partNumber: "MX-910-006557",
    brand: "Logitech",
    hsnCode: "84716060",
    sellingPrice: 8999,
    gstRate: 18,
    currentStock: 15,
  },
  {
    id: "prod-2",
    name: "Dell UltraSharp 27\" 4K Monitor",
    partNumber: "DELL-U2723QE",
    brand: "Dell",
    hsnCode: "85285200",
    sellingPrice: 48500,
    gstRate: 18,
    currentStock: 3, // Low stock indicator! (<5)
  },
  {
    id: "prod-3",
    name: "Apple MacBook Pro 14\" M3 Max",
    partNumber: "APL-MRX43HN/A",
    brand: "Apple",
    hsnCode: "84713010",
    sellingPrice: 249900,
    gstRate: 18,
    currentStock: 12,
  },
  {
    id: "prod-4",
    name: "SanDisk Extreme Pro 1TB Portable SSD",
    partNumber: "SD-SDSSDE81-1T00",
    brand: "SanDisk",
    hsnCode: "84717020",
    sellingPrice: 11200,
    gstRate: 18,
    currentStock: 2, // Low stock indicator! (<5)
  },
  {
    id: "prod-5",
    name: "Keychron Q1 Pro Mechanical Keyboard",
    partNumber: "KC-Q1P-M1",
    brand: "Keychron",
    hsnCode: "84716020",
    sellingPrice: 15500,
    gstRate: 18,
    currentStock: 8,
  },
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: "inv-1",
    invoiceNumber: "INV/2025-26/0001",
    date: "2026-05-10",
    customerId: "cust-1",
    customerName: "Aman Logistics & Solutions",
    customerMobile: "9123456780",
    customerGstin: "19AHDCS8421A1Z9",
    customerAddress: "24 Park Street, Near Metro Station, Kolkata",
    customerState: "West Bengal",
    items: [
      {
        id: "item-1",
        productId: "prod-1",
        productName: "Logitech MX Master 3S Wireless Mouse",
        partNumber: "MX-910-006557",
        hsnCode: "84716060",
        sellingPrice: 8999,
        gstRate: 18,
        quantity: 2,
        subtotal: 17998,
        taxAmount: 3239.64,
        totalAmount: 21237.64,
      },
      {
        id: "item-2",
        productId: "prod-5",
        productName: "Keychron Q1 Pro Mechanical Keyboard",
        partNumber: "KC-Q1P-M1",
        hsnCode: "84716020",
        sellingPrice: 15500,
        gstRate: 18,
        quantity: 1,
        subtotal: 15500,
        taxAmount: 2790,
        totalAmount: 18290,
      }
    ],
    discountPercent: 5, // 5% Discount
    subtotal: 33498,
    discountAmount: 1674.9, // 5% of 33498
    taxAmount: 6029.64,
    cgstAmount: 3014.82, // Same state (West Bengal) -> CGST 9% + SGST 9% (divided)
    sgstAmount: 3014.82,
    igstAmount: 0,
    totalAmount: 37852.74, // 33498 - 1674.9 + 6029.64
    isSameState: true,
    status: 'Paid',
  },
  {
    id: "inv-2",
    invoiceNumber: "INV/2025-26/0002",
    date: "2026-05-22",
    customerId: "cust-2",
    customerName: "Vertex Tech Hub Pvt Ltd",
    customerMobile: "8877665544",
    customerGstin: "27AAACV9876R1Z4",
    customerAddress: "102, Bandra Kurla Complex, Bandra East, Mumbai",
    customerState: "Maharashtra",
    items: [
      {
        id: "item-3",
        productId: "prod-2",
        productName: "Dell UltraSharp 27\" 4K Monitor",
        partNumber: "DELL-U2723QE",
        hsnCode: "85285200",
        sellingPrice: 48500,
        gstRate: 18,
        quantity: 1,
        subtotal: 48500,
        taxAmount: 8730,
        totalAmount: 57230,
      }
    ],
    discountPercent: 0,
    subtotal: 48500,
    discountAmount: 0,
    taxAmount: 8730,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 8730, // Different state -> IGST 18%
    totalAmount: 57230,
    isSameState: false,
    status: 'Paid',
  }
];
