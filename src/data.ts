import { Customer, Product, Invoice, BusinessProfile } from './types';

export const INITIAL_BUSINESS_PROFILE: BusinessProfile = {
  name: "",
  gstin: "",
  address: "",
  phone: "",
  email: "",
  state: "",
  logo: "📋",
  bankName: "ICICI BANK",
  accountNumber: "444305000091",
  ifscCode: "ICIC0004443",
  terms: [
    "GOODS ONCE SOLD CANNOT BE TAKEN BACK",
    "OUR RESPONSILIBITY CEASES WHEN GOODS LEAVE OUR PREMISES",
    "INTEREST @18% PA WILL BE CHARGED IF BILL NOT PAID WITHIN 7 DAYS",
    "ALL DISPUTES ARE SUBJECT TO MURSHIDABAD JURISDICTION ONLY",
    "ALL CHEQUES ARE SUBJECT TO REALIZATION.",
    "CHEQUE DISHONOURED CHARGES @ RS.500/- PER LEAF"
  ]
};

export const INITIAL_CUSTOMERS: Customer[] = [];

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_INVOICES: Invoice[] = [];
