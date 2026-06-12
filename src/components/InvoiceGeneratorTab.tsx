import { useState, useEffect, Dispatch, SetStateAction, FormEvent } from 'react';
import { Customer, Product, Invoice, InvoiceItem, BusinessProfile, CustomerDiscountRule, CustomerDiscount, CustomerNetRate, CustomerCategoryDiscount } from '../types';
import { Plus, Trash, UserPlus, FileText, Calendar, Percent, IndianRupee, AlertTriangle, Check, ChevronDown, Sparkles } from 'lucide-react';
import { INDIAN_STATES } from './CustomersTab';
import supabase from '../supabase';
import pricingService from '../services/pricingService';

const fixedPriceToastMessage = (fixedPrice: number) => `Fixed MRP applied: ₹${fixedPrice.toFixed(2)} (No discount)`;

const calculateLineDiscountMetrics = (item: Partial<InvoiceItem>, product?: Product) => {
  // MRP is GST-inclusive.
  // Rate (Ex GST) = MRP ÷ (1 + GST%/100)
  // Disc(Rs.) = Rate × Disc% / 100 × Qty
  // Taxable Amt = (Rate × Qty) - Disc(Rs.)
  // GST TAX = Taxable Amt × GST% / 100
  // AMOUNT = Taxable Amt + GST TAX
  const quantity = Number(item.quantity) || 0;
  const gstRate = Number(item.gstRate ?? product?.gstRate ?? 0) || 0;
  const discountPercent = Number(item.discountPercent) || 0;

  const fixedPrice = Number(item.netPriceApplied || 0);
  const mrp = fixedPrice > 0
    ? fixedPrice
    : Number(product?.sellingPrice ?? (item as any).mrp ?? item.sellingPrice ?? 0) || 0;

  const rate = gstRate > 0 ? mrp / (1 + gstRate / 100) : mrp;
  const discountAmount = fixedPrice > 0 ? 0 : rate * (discountPercent / 100) * quantity;
  const taxableAmount = Math.max(0, rate * quantity - discountAmount);
  const gstTax = taxableAmount * (gstRate / 100);
  const amount = taxableAmount + gstTax;

  return {
    mrp,
    rate,
    quantity,
    discountPercent,
    discountAmount,
    taxableAmount,
    gstTax,
    amount,
  };
};

const calculateDiscountSummary = (items: Partial<InvoiceItem>[]) => {
  return items.reduce((summary, item) => {
    if (!item.productId) return summary;

    const metrics = calculateLineDiscountMetrics(item);
    summary.totalDiscountAmount += Number((metrics.discountAmount || 0).toFixed(2));
    summary.totalBill += Number((metrics.amount || 0).toFixed(2));

    return summary;
  }, { totalDiscountAmount: 0, totalBill: 0 });
};

interface InvoiceGeneratorTabProps {
  customers: Customer[];
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  invoices: Invoice[];
  setInvoices: Dispatch<SetStateAction<Invoice[]>>;
  businessProfile: BusinessProfile;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  setActiveTab: (tab: string) => void;
  invoiceToEdit?: Invoice | null;
  setInvoiceToEdit?: (invoice: Invoice | null) => void;
}

export function InvoiceGeneratorTab({
  customers,
  setCustomers,
  products,
  setProducts,
  invoices,
  setInvoices,
  businessProfile,
  showToast,
  setActiveTab,
  invoiceToEdit = null,
  setInvoiceToEdit
}: InvoiceGeneratorTabProps) {
  
  // 1. Auto Generate Invoice Number
  const generateNextInvoiceNumber = () => {
    if (invoices.length === 0) {
      return "INV/2025-26/0001";
    }
    // Sort invoices to find the highest number in INV/2025-26/XXXX format
    const formatRegex = /^INV\/(\d{4}-\d{2})\/(\d+)$/;
    let maxNumber = 0;
    let currentFY = "2025-26";

    // Detect FY based on current date
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth(); // 0-indexed, 3 is April
    const fyStart = curMonth >= 3 ? curYear : curYear - 1;
    currentFY = `${fyStart}-${(fyStart + 1).toString().slice(-2)}`;

    invoices.forEach(inv => {
      const match = inv.invoiceNumber.match(formatRegex);
      if (match) {
        const fy = match[1];
        const num = parseInt(match[2], 10);
        if (fy === currentFY && num > maxNumber) {
          maxNumber = num;
        }
      }
    });

    const nextNum = maxNumber + 1;
    return `INV/${currentFY}/${nextNum.toString().padStart(4, '0')}`;
  };

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [vehicleNo, setVehicleNo] = useState('');
  const [customerDiscounts, setCustomerDiscounts] = useState<CustomerDiscount[]>([]);
  const [customerNetRates, setCustomerNetRates] = useState<CustomerNetRate[]>([]);
  const [customerCategoryDiscounts, setCustomerCategoryDiscounts] = useState<CustomerCategoryDiscount[]>([]);
  const [legacyDiscountRules, setLegacyDiscountRules] = useState<CustomerDiscountRule[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  useEffect(() => {
    try {
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      const savedRules = storage ? storage.getItem('customer_discount_rules') : null;
      if (savedRules) {
        setLegacyDiscountRules(JSON.parse(savedRules));
      }
    } catch (err) {
      console.error('Failed to load customer discount rules', err);
    }
  }, []);

  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerDiscounts([]);
      setCustomerNetRates([]);
      setCustomerCategoryDiscounts([]);
      return;
    }

    (async () => {
      try {
        const [discounts, netRates, categoryDiscounts] = await Promise.all([
          pricingService.fetchCustomerDiscounts(selectedCustomerId),
          pricingService.fetchCustomerNetRates(selectedCustomerId),
          pricingService.fetchCustomerCategoryDiscounts(selectedCustomerId)
        ]);
        setCustomerDiscounts(discounts);
        setCustomerNetRates(netRates);
        setCustomerCategoryDiscounts(categoryDiscounts);
      } catch (err) {
        console.error('Failed to load customer pricing rules', err);
        setCustomerDiscounts([]);
        setCustomerNetRates([]);
        setCustomerCategoryDiscounts([]);
      }
    })();
  }, [selectedCustomerId]);

  useEffect(() => {
    if (products.length > 0) return;

    try {
      const storage = typeof window !== 'undefined' ? window.localStorage : null;
      const savedProducts = storage ? storage.getItem('invoice_products') : null;
      if (!savedProducts) return;

      const parsedProducts = JSON.parse(savedProducts);
      if (Array.isArray(parsedProducts) && parsedProducts.length > 0) {
        setProducts(parsedProducts);
      }
    } catch (err) {
      console.error('Failed to load products for invoice builder', err);
    }
  }, [products.length, setProducts]);

  const getCustomerNetPrice = (customerId: string | undefined, productId: string) => {
    if (!customerId) return null;
    const rule = customerNetRates.find(r => r.productId === productId);
    return rule ? rule.netRate : null;
  };

  const getStickyDiscount = (prod: Product, targetCustomerId?: string): number => {
    if (prod.isNetProduct) return 0;
    const custId = targetCustomerId || selectedCustomerId;
    if (!custId) return 0;

    const fixedPrice = getCustomerNetPrice(custId, prod.id);
    if (fixedPrice !== null) return 0;

    if (customerDiscounts.length > 0) {
      const prodRule = customerDiscounts.find(d => d.type === 'PRODUCT' && d.target === prod.id);
      if (prodRule) return prodRule.discountPercent;

      if (prod.brand) {
        const brandRule = customerDiscounts.find(d => d.type === 'BRAND' && d.target.toLowerCase().trim() === prod.brand.toLowerCase().trim());
        if (brandRule) return brandRule.discountPercent;
      }
    }

    if (customerCategoryDiscounts.length > 0 && prod.category) {
      const catRule = customerCategoryDiscounts.find(d => d.category.toLowerCase().trim() === prod.category.toLowerCase().trim());
      if (catRule) return catRule.discountPercent;
    }

    if (legacyDiscountRules?.length) {
      // ... same legacy logic
      try {
        const rules = legacyDiscountRules;
        const custRules = rules.filter(r => r.customerId === custId);
        if (custRules.length === 0) return 0;

        const skuRule = custRules.find(r => r.type === 'SKU' && r.value === prod.id);
        if (skuRule) return skuRule.discountPercent;

        if (prod.brand) {
          const brandRule = custRules.find(r => r.type === 'Brand' && r.value.toLowerCase().trim() === prod.brand.toLowerCase().trim());
          if (brandRule) return brandRule.discountPercent;
        }

        const flatRule = custRules.find(r => r.type === 'Flat');
        if (flatRule) return flatRule.discountPercent;
      } catch (e) {
        console.error(e);
      }
    }

    return 0;
  };

  const applyCustomerPricing = (item: InvoiceItem, product: Product | undefined, customerId: string | undefined) => {
    const fixedPrice = product ? getCustomerNetPrice(customerId, product.id) : null;
    const effectiveMrp = fixedPrice ?? product?.sellingPrice ?? item.sellingPrice ?? 0;
    const quantity = item.quantity || 1;
    const gstRate = Number(item.gstRate ?? product?.gstRate ?? 0) || 0;
    const isNetPriceApplied = fixedPrice !== null;
    
    // Auto-apply sticky discount if item.discountPercent is 0 or undefined
    let lineDiscountPercent = isNetPriceApplied ? 0 : (item.discountPercent || 0);
    if (!isNetPriceApplied && lineDiscountPercent === 0 && product) {
      lineDiscountPercent = getStickyDiscount(product, customerId);
    }

    const rate = gstRate > 0 ? effectiveMrp / (1 + gstRate / 100) : effectiveMrp;
    const subtotal = rate * quantity;
    const discountAmount = lineDiscountPercent > 0 ? rate * (lineDiscountPercent / 100) * quantity : 0;
    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const taxAmount = taxableAmount * (gstRate / 100);
    const totalAmount = taxableAmount + taxAmount;

    return {
      sellingPrice: effectiveMrp,
      discountPercent: lineDiscountPercent,
      discountAmount,
      netPriceApplied: isNetPriceApplied ? effectiveMrp : undefined,
      subtotal,
      taxAmount,
      totalAmount,
    };
  };

  useEffect(() => {
    setItems(prev => prev.map(item => {
      if (!item.productId) return item;
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return item;

      return {
        ...item,
        ...applyCustomerPricing(item, prod, selectedCustomerId),
      };
    }));
  }, [selectedCustomerId, products, customerDiscounts, customerNetRates, customerCategoryDiscounts]);

  // 4. Update row values on product selection or custom inputs
  const handleItemProductSelect = (index: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    setProductSearches(prev => ({ ...prev, [items[index]?.id || `item-${index}`]: prod.name }));
    setActiveDropdownIndex(null);

    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;

      const quantity = item.quantity || 1;
      const finalQty = quantity;

      const stickyPercent = getStickyDiscount(prod);
      if (stickyPercent > 0) {
        showToast(`Auto discount ${stickyPercent}% applied (Brand/Product discount)`, "success");
      }

      const pricing = applyCustomerPricing({
        ...item,
        productId,
        productName: prod.name,
        partNumber: prod.partNumber,
        hsnCode: prod.hsnCode,
        sellingPrice: prod.sellingPrice,
        gstRate: prod.gstRate,
        quantity: finalQty || 1,
        subtotal: 0,
        taxAmount: 0,
        totalAmount: 0,
      }, prod, selectedCustomerId);

      if (pricing.netPriceApplied && !item.netPriceApplied) {
        showToast(fixedPriceToastMessage(pricing.netPriceApplied), 'success');
      }

      return {
        ...item,
        productId,
        productName: prod.name,
        partNumber: prod.partNumber,
        hsnCode: prod.hsnCode,
        sellingPrice: pricing.sellingPrice,
        gstRate: prod.gstRate,
        quantity: finalQty || 1,
        discountPercent: pricing.discountPercent,
        discountAmount: pricing.discountAmount,
        netPriceApplied: pricing.netPriceApplied,
        subtotal: pricing.subtotal,
        taxAmount: pricing.taxAmount,
        totalAmount: pricing.totalAmount
      };
    }));
  };

  const handleQtyChange = (itemId: string, qty: number) => {
    setItems(prev => prev.map((item) => {
      if (item.id !== itemId) return item;

      const prod = products.find(p => p.id === item.productId);
      const finalQty = Math.max(0, qty);

      const pricing = applyCustomerPricing({
        ...item,
        quantity: finalQty,
      }, prod, selectedCustomerId);

      if (pricing.netPriceApplied && !item.netPriceApplied) {
        showToast(fixedPriceToastMessage(pricing.netPriceApplied), 'success');
      }

      return {
        ...item,
        quantity: finalQty,
        sellingPrice: pricing.sellingPrice,
        discountPercent: pricing.discountPercent,
        discountAmount: pricing.discountAmount,
        subtotal: pricing.subtotal,
        taxAmount: pricing.taxAmount,
        totalAmount: pricing.totalAmount,
        netPriceApplied: pricing.netPriceApplied,
      };
    }));
  };

  const handlePriceChange = (index: number, price: number) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;

      const prod = products.find(p => p.id === item.productId);
      const qty = item.quantity || 1;
      const fixedPrice = prod ? getCustomerNetPrice(selectedCustomerId, prod.id) : null;
      const effectiveMrp = fixedPrice !== null ? fixedPrice : price;
      const gst = item.gstRate || 0;
      const rate = gst > 0 ? effectiveMrp / (1 + gst / 100) : effectiveMrp;
      const subtotal = rate * qty;
      const discPercent = fixedPrice !== null ? 0 : (item.discountPercent || 0);
      const discountAmount = discPercent > 0 ? rate * (discPercent / 100) * qty : 0;
      const taxableAmount = Math.max(0, subtotal - discountAmount);
      const taxAmount = taxableAmount * (gst / 100);
      const totalAmount = taxableAmount + taxAmount;

      return {
        ...item,
        sellingPrice: effectiveMrp,
        discountPercent: discPercent,
        discountAmount,
        subtotal,
        taxAmount,
        totalAmount,
        netPriceApplied: fixedPrice !== null ? effectiveMrp : undefined,
      };
    }));
  };

  const handleItemDiscountPercentChange = (index: number, discPercent: number) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;

      const prod = products.find(p => p.id === item.productId);
      const fixedPrice = prod ? getCustomerNetPrice(selectedCustomerId, prod.id) : null;
      const isNet = prod && (prod.isNetProduct || fixedPrice !== null);
      const appliedDisc = isNet ? 0 : discPercent;

      if (isNet && discPercent > 0) {
        showToast(`Discount not allowed: '${prod?.name || 'Product'}' is protected from discounts by fixed net pricing.`, "error");
      }

      const effectiveMrp = item.sellingPrice || 0;
      const qty = item.quantity || 1;
      const gst = item.gstRate || 0;
      const rate = gst > 0 ? effectiveMrp / (1 + gst / 100) : effectiveMrp;
      const subtotal = rate * qty;
      const discountAmount = appliedDisc > 0 ? rate * (appliedDisc / 100) * qty : 0;
      const taxableAmount = Math.max(0, subtotal - discountAmount);
      const taxAmount = taxableAmount * (gst / 100);
      const totalAmount = taxableAmount + taxAmount;

      return {
        ...item,
        discountPercent: appliedDisc,
        discountAmount,
        subtotal,
        taxAmount,
        totalAmount,
        netPriceApplied: fixedPrice !== null ? item.sellingPrice : undefined,
      };
    }));
  };

  const handleGstRateChange = (index: number, rate: number) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;

      const effectiveMrp = item.sellingPrice || 0;
      const qty = item.quantity || 1;
      const rateExGst = rate > 0 ? effectiveMrp / (1 + rate / 100) : effectiveMrp;
      const subtotal = rateExGst * qty;
      const discountAmount = (item.discountPercent || 0) > 0 ? rateExGst * ((item.discountPercent || 0) / 100) * qty : 0;
      const taxableAmount = Math.max(0, subtotal - discountAmount);
      const taxAmount = taxableAmount * (rate / 100);
      const totalAmount = taxableAmount + taxAmount;

      return {
        ...item,
        gstRate: rate,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount
      };
    }));
  };

  // 5. Calculations on total
  const calculateInvoiceTotals = () => {
    // Compute per-line metrics and aggregate
    let totalLineBase = 0;
    let itemDiscountsSum = 0;
    let taxableBaseAfterLineDiscount = 0;

    let calculatedCgst = 0;
    let calculatedSgst = 0;
    let calculatedIgst = 0;
    let finalTaxSum = 0;

    items.forEach(item => {
      if (!item.productId) return;
      const prod = products.find(p => p.id === item.productId);
      const metrics = calculateLineDiscountMetrics(item, prod);

      totalLineBase += (metrics.rate || 0) * (metrics.quantity || 0);
      itemDiscountsSum += (metrics.discountAmount || 0);
      taxableBaseAfterLineDiscount += (metrics.taxableAmount || 0);
      finalTaxSum += (metrics.gstTax || 0);

      if (isSameState) {
        calculatedCgst += (metrics.gstTax || 0) / 2;
        calculatedSgst += (metrics.gstTax || 0) / 2;
      } else {
        calculatedIgst += (metrics.gstTax || 0);
      }
    });

    const invoiceLevelDiscountAmt = taxableBaseAfterLineDiscount * (discountPercent / 100);
    const totalDiscountAmount = itemDiscountsSum + invoiceLevelDiscountAmt;

    const taxableAfterInvoiceDiscount = Math.max(0, taxableBaseAfterLineDiscount - invoiceLevelDiscountAmt);
    const roundTaxRatio = taxableAfterInvoiceDiscount > 0 ? taxableAfterInvoiceDiscount / Math.max(1, taxableBaseAfterLineDiscount) : 0;

    const finalTaxAfterInvoiceDiscount = finalTaxSum * roundTaxRatio;
    let cgstAfter = 0, sgstAfter = 0, igstAfter = 0;
    if (isSameState) {
      cgstAfter = finalTaxAfterInvoiceDiscount / 2;
      sgstAfter = finalTaxAfterInvoiceDiscount / 2;
    } else {
      igstAfter = finalTaxAfterInvoiceDiscount;
    }

    const totalBill = taxableAfterInvoiceDiscount + finalTaxAfterInvoiceDiscount;

    return {
      subtotal: totalLineBase,
      discountAmount: totalDiscountAmount,
      taxAmount: finalTaxAfterInvoiceDiscount,
      cgstAmount: cgstAfter,
      sgstAmount: sgstAfter,
      igstAmount: igstAfter,
      totalAmount: totalBill
    };
  };

  const totals = calculateInvoiceTotals();
  const discountSummary = calculateDiscountSummary(items);

  // 6. Submit and Save Invoice (Supports Create or Edit)
  const handleSaveInvoice = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      showToast("Please select a billing customer to proceed", "error");
      return;
    }

    // Validate items
    const validItems = items.filter(item => item.productId && (item.quantity || 0) > 0);
    if (validItems.length === 0) {
      showToast("Invoice must contain at least 1 product with quantity > 0", "error");
      return;
    }

    // First, map the old quantities if we are in Edit Mode
    const oldQuantitiesMap: { [productId: string]: number } = {};
    if (invoiceToEdit) {
      invoiceToEdit.items.forEach(item => {
        oldQuantitiesMap[item.productId] = (oldQuantitiesMap[item.productId] || 0) + item.quantity;
      });
    }

    // Adjust/Deduct stock of items in database
    // "FIRST: Restore old stock for all old products (add back the old quantities)"
    // "THEN: Apply new stock deduction for updated quantities"
    setProducts(prevProducts => prevProducts.map(p => {
      const oldQty = oldQuantitiesMap[p.id] || 0;
      const invoiceItem = validItems.find(vi => vi.productId === p.id);
      const newQty = invoiceItem ? (invoiceItem.quantity || 0) : 0;
      if (oldQty > 0 || newQty > 0) {
        return {
          ...p,
          currentStock: Math.max(0, p.currentStock + oldQty - newQty)
        };
      }
      return p;
    }));

    let nextInvoices: Invoice[] = invoices;

    if (invoiceToEdit) {
      // Update existing invoice (preserve same ID and invoiceNumber)
      const updatedInvoice: Invoice = {
        ...invoiceToEdit,
        invoiceNumber,
        date: invoiceDate,
        customerId: selectedCustomerId,
        customerName: activeCustomer!.name,
        customerMobile: activeCustomer!.mobile,
        customerGstin: activeCustomer!.gstin,
        customerAddress: activeCustomer!.address,
        customerState: activeCustomer!.state,
        vehicleNo: vehicleNo.trim().toUpperCase(),
        items: validItems.map((vi, index) => ({
          id: vi.id && vi.id.startsWith('item-final-') ? vi.id : `item-final-${index}-${Date.now()}`,
          productId: vi.productId!,
          productName: vi.productName!,
          partNumber: vi.partNumber!,
          hsnCode: vi.hsnCode!,
          sellingPrice: vi.sellingPrice!,
          gstRate: vi.gstRate!,
          quantity: vi.quantity!,
          discountPercent: vi.discountPercent || 0,
          discountAmount: vi.discountAmount || 0,
          netPriceApplied: vi.netPriceApplied,
          subtotal: vi.subtotal!,
          taxAmount: vi.taxAmount!,
          totalAmount: vi.totalAmount!
        })),
        discountPercent,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        totalAmount: totals.totalAmount,
        isSameState,
        status: invoiceToEdit.status || 'Paid'
      };

      nextInvoices = invoices.map(inv => inv.id === invoiceToEdit.id ? updatedInvoice : inv);
      setInvoices(nextInvoices);
      showToast("Invoice updated successfully", "success");

      if (setInvoiceToEdit) {
        setInvoiceToEdit(null);
      }

      try {
        await supabase.saveInvoice(updatedInvoice);
      } catch (err) {
        console.error('Failed to persist invoice to Supabase', err);
        showToast('Invoice saved locally, but Supabase persist failed.', 'error');
      }
    } else {
      // Create Invoice structure
      const nextInvoice: Invoice = {
        id: `inv-new-${Date.now()}`,
        invoiceNumber,
        date: invoiceDate,
        customerId: selectedCustomerId,
        customerName: activeCustomer!.name,
        customerEmail: '',
        customerMobile: activeCustomer!.mobile,
        customerGstin: activeCustomer!.gstin,
        customerAddress: activeCustomer!.address,
        customerState: activeCustomer!.state,
        vehicleNo: vehicleNo.trim().toUpperCase(),
        items: validItems.map((vi, index) => ({
          id: `item-final-${index}-${Date.now()}`,
          productId: vi.productId!,
          productName: vi.productName!,
          partNumber: vi.partNumber!,
          hsnCode: vi.hsnCode!,
          sellingPrice: vi.sellingPrice!,
          gstRate: vi.gstRate!,
          quantity: vi.quantity!,
          discountPercent: vi.discountPercent || 0,
          discountAmount: vi.discountAmount || 0,
          netPriceApplied: vi.netPriceApplied,
          subtotal: vi.subtotal!,
          taxAmount: vi.taxAmount!,
          totalAmount: vi.totalAmount!
        })),
        discountPercent,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        totalAmount: totals.totalAmount,
        isSameState,
        status: 'Paid'
      };

      nextInvoices = [nextInvoice, ...invoices];
      setInvoices(nextInvoices);
      showToast(`Invoice ${invoiceNumber} generated & saved successfully!`, "success");

      try {
        await supabase.saveInvoice(nextInvoice);
      } catch (err) {
        console.error('Failed to persist invoice to Supabase', err);
        showToast('Invoice saved locally, but Supabase persist failed.', 'error');
      }
    }

    // Clear Form & Redirect to Invoice list
    setItems([{ id: 'item-init-1', productId: '', productName: '', partNumber: '', hsnCode: '', sellingPrice: 0, gstRate: 18, quantity: 0, discountPercent: 0, discountAmount: 0, subtotal: 0, taxAmount: 0, totalAmount: 0 }]);
    setSelectedCustomerId('');
    setSearchCustomerQuery('');
    setDiscountPercent(0);
    setVehicleNo('');
    setActiveTab('Invoices');
  };

  // Quick CRM handling
  const handleQuickAddCustomerSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!qcName.trim()) {
      showToast("Name is required", "error");
      return;
    }

    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: qcName.trim(),
      mobile: qcMobile.trim(),
      gstin: qcGstin.trim().toUpperCase(),
      address: qcAddress.trim(),
      state: qcState,
      root: qcRoot.trim() || undefined
    };

    setCustomers(prev => [newCust, ...prev]);
    setSelectedCustomerId(newCust.id);
    setSearchCustomerQuery(newCust.name);
    setIsQuickCustModalOpen(false);
    showToast(`Customer '${qcName}' created & auto-selected!`, "success");

    // Reset Form
    setQcName('');
    setQcMobile('');
    setQcGstin('');
    setQcRoot('');
    setQcAddress('');
    setQcState('West Bengal');
  };

  // Filtering customers list by name/mobile for dropdown search
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchCustomerQuery.toLowerCase()) ||
    c.mobile.includes(searchCustomerQuery)
  );

  return (
    <div className="space-y-6">
      {/* Tab Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Professional GST Invoice Builder
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Draft tax compliance invoices with smart totals, State tax routing, and auto rounding.
        </p>
      </div>

      <form onSubmit={handleSaveInvoice} className="space-y-6">
        
        {/* SECTION 1: Meta Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Invoice Number */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest block">
              Billing Ledger
            </span>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="w-full">
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Invoice ID
                </label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV/2025-26/0001"
                  className="w-full bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-100 font-mono font-bold text-sm"
                />
              </div>
            </div>
          </div>

          {/* Date Picker */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest block">
              Issue period
            </span>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="w-full">
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Invoice Date
                </label>
                <input
                  type="date"
                  required
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-100 font-semibold text-sm cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Vehicle Number Input */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 space-y-2">
            <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest block">
              Transport
            </span>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="w-full">
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Vehicle Number / Gari No
                </label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="e.g. WB-02-AD-1234"
                  className="w-full bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-100 font-bold text-sm uppercase font-mono placeholder:lowercase"
                />
              </div>
            </div>
          </div>

          {/* Business State info */}
          <div className="bg-indigo-50/50 dark:bg-indigo-950/25 border border-indigo-100/60 dark:border-indigo-900/40 rounded-2xl p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest block">
                Billing Outpost Source
              </span>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[130px]" title={businessProfile.name}>
                {businessProfile.name}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                State: <strong className="text-indigo-600 dark:text-indigo-400">{businessProfile.state}</strong>
              </div>
            </div>
            <span className="text-2xl shrink-0">{businessProfile.logo || "⚡"}</span>
          </div>

        </div>

        {/* SECTION 2: Customer CRM Picker */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Customer Details
            </h3>
            
            <button
              type="button"
              onClick={() => setIsQuickCustModalOpen(true)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 flex items-center gap-1 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Quick Add Client
            </button>
          </div>

          <div className="relative">
            {/* Display Input or Selection */}
            {selectedCustomerId ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-slate-50 text-sm">
                    {activeCustomer?.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1 leading-relaxed">
                    <span>Mobile: <strong>{activeCustomer?.mobile || 'N/A'}</strong></span>
                    <span>GSTIN: <strong className="font-mono text-xs">{activeCustomer?.gstin || 'Unregistered'}</strong></span>
                    <span>State: <strong className="text-indigo-600 dark:text-indigo-400">{activeCustomer?.state}</strong></span>
                  </div>
                  {activeCustomer?.address && (
                    <div className="text-xs text-slate-450 dark:text-slate-500 leading-relaxed max-w-2xl mt-1.5">
                      Address: {activeCustomer?.address}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId('');
                      setSearchCustomerQuery('');
                    }}
                    className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Change Customer
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Search Text field autocomplete */}
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Search client by typing name, contact number, or GST credentials..."
                    value={searchCustomerQuery}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    onChange={(e) => {
                      setSearchCustomerQuery(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-2xl text-sm dark:text-slate-100"
                  />
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
                </div>

                {isCustomerDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 max-h-56 overflow-y-auto rounded-2xl shadow-xl z-20 divide-y divide-slate-50 dark:divide-slate-850">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No clients match.{" "}
                        <button
                          type="button"
                          onClick={() => setIsQuickCustModalOpen(true)}
                          className="text-indigo-600 font-bold hover:underline"
                        >
                          Create customer '{searchCustomerQuery}' now.
                        </button>
                      </div>
                    ) : (
                      filteredCustomers.map(cust => (
                        <div
                          key={cust.id}
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setSearchCustomerQuery(cust.name);
                            setIsCustomerDropdownOpen(false);
                          }}
                          className="p-3 hover:bg-slate-50 dark:hover:bg-slate-950 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{cust.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Mobile: {cust.mobile || 'None'} | GSTIN: {cust.gstin || 'URD'}</div>
                          </div>
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 font-semibold">{cust.state}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: Line Items Grid */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs overflow-x-auto">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Invoice Ledger Line Items
            </h3>
            <span className="text-[11px] font-semibold text-slate-400">
              Tax Context: {isSameState ? <span className="text-emerald-500 font-bold">Intrastate (CGST 50% + SGST 50%)</span> : <span className="text-violet-500 font-bold">Interstate (IGST 100%)</span>}
            </span>
          </div>

          <table className="w-full text-left min-w-[1100px]">
            <thead>
              <tr className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                <th className="py-2.5 w-10">Sr No</th>
                <th className="py-2.5 px-2 w-28">Part No</th>
                <th className="py-2.5 w-1/3">Description</th>
                <th className="py-2.5 px-2 w-24">HSN No</th>
                <th className="py-2.5 px-2 w-28">MRP</th>
                <th className="py-2.5 px-2 w-28">Rate</th>
                <th className="py-2.5 px-2 w-16">Qty</th>
                <th className="py-2.5 px-2 w-20">Disc%</th>
                <th className="py-2.5 px-2 w-28">Disc (Rs.)</th>
                <th className="py-2.5 px-2 w-32">Taxable Amt</th>
                <th className="py-2.5 px-2 w-20">GST%</th>
                <th className="py-2.5 px-2 w-28">GST TAX</th>
                <th className="py-2.5 px-2 text-right">AMOUNT</th>
                <th className="py-2.5 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
              {items.map((item, index) => {
                const productSpec = products.find(p => p.id === item.productId);
                const lineMetrics = calculateLineDiscountMetrics(item, productSpec);

                return (
                  <tr key={item.id} className="align-middle">
                    <td className="py-3 px-2 text-xs text-slate-600">{index + 1}</td>

                    {/* Part No */}
                    <td className="py-3 px-2 text-xs font-mono text-slate-600">{productSpec?.partNumber || item.partNumber || '-'}</td>

                    {/* Description */}
                    <td className="py-3 pr-2 relative text-sm">
                      <div className="relative">
                        <input
                          type="text"
                          value={productSearches[item.id] ?? item.productName ?? ''}
                          onChange={(e) => handleProductSearchInput(item.id, index, e.target.value)}
                          onFocus={() => setActiveDropdownIndex(index)}
                          placeholder="Search product name, part no or brand..."
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {activeDropdownIndex === index && (
                          <div className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
                            {getProductSearchOptions(productSearches[item.id] ?? item.productName ?? '').map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => handleItemProductSelect(index, product.id)}
                                className="w-full text-left px-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-950"
                              >
                                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{product.name}</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {product.partNumber || 'No part no'} • ₹{product.sellingPrice.toFixed(2)} • GST {product.gstRate}%
                                </div>
                              </button>
                            ))}
                            {getProductSearchOptions(productSearches[item.id] ?? item.productName ?? '').length === 0 && (
                              <div className="px-3 py-3 text-xs text-slate-500">No matching products found.</div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                        {productSpec ? `${productSpec.partNumber || 'N/A'} • ₹${productSpec.sellingPrice.toFixed(2)} • GST ${productSpec.gstRate}%` : 'Select a product to populate item details.'}
                      </div>
                    </td>

                    {/* HSN */}
                    <td className="py-3 px-2 text-xs font-mono text-slate-500">{item.hsnCode || productSpec?.hsnCode || '-'}</td>

                    {/* MRP */}
                    <td className="py-3 px-2 text-right font-mono text-xs">₹{lineMetrics.mrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>

                    {/* Rate (editable) */}
                    <td className="py-3 px-2">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₹</span>
                        <input
                          type="number"
                          required
                          min={0}
                          value={item.sellingPrice || 0}
                          onChange={(e) => handlePriceChange(index, Number(e.target.value))}
                          className="w-full pl-6 pr-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-200"
                        />
                      </div>
                    </td>

                    {/* Qty */}
                    <td className="py-3 px-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={item.quantity || ''}
                        onChange={(e) => handleQtyChange(item.id, Number(e.target.value))}
                        style={{
                          width: '70px',
                          padding: '6px',
                          textAlign: 'center',
                          border: '1px solid #d1d5db',
                          borderRadius: '8px',
                          appearance: 'textfield',
                          MozAppearance: 'textfield',
                          WebkitAppearance: 'none'
                        }}
                        className="focus:outline-none"
                      />
                    </td>

                    {/* Disc% */}
                    <td className="py-3 px-2 text-center">
                      <input
                        type="number"
                        required
                        min={0}
                        max={100}
                        value={item.discountPercent || 0}
                        onChange={(e) => handleItemDiscountPercentChange(index, Number(e.target.value))}
                        className="w-full pl-2 pr-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-100"
                      />
                    </td>

                    {/* Disc(Rs.) */}
                    <td className="py-3 px-2 text-right font-mono text-xs">₹{(lineMetrics.discountAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>

                    {/* Taxable Amt */}
                    <td className="py-3 px-2 text-right font-mono text-xs">₹{(lineMetrics.taxableAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>

                    {/* GST% */}
                    <td className="py-3 px-2 text-center text-xs">{item.gstRate || productSpec?.gstRate || 0}%</td>

                    {/* GST TAX */}
                    <td className="py-3 px-2 text-right font-mono text-xs">₹{(lineMetrics.gstTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>

                    {/* AMOUNT */}
                    <td className="py-3 px-2 text-right font-semibold font-mono text-xs">₹{(lineMetrics.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>

                    {/* Delete action */}
                    <td className="py-3 pl-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeItemRow(index)}
                        className="p-1 px-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-50 dark:hover:bg-slate-950 transition-colors cursor-pointer"
                        title="Delete Item Row"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 justify-end">
            <div className="rounded-2xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/70 dark:bg-rose-950/20 px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Total Discount</div>
                <div className="text-xs text-slate-500 dark:text-slate-300">Sum of item discount amounts across all line items</div>
              </div>
              <div className="font-mono text-lg font-bold text-rose-700 dark:text-rose-300">
                ₹{discountSummary.totalDiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-emerald-950/20 px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Total Bill</div>
                <div className="text-xs text-slate-500 dark:text-slate-300">Sum of discounted line totals including GST</div>
              </div>
              <div className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-300">
                ₹{discountSummary.totalBill.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={addItemRow}
            className="mt-4 px-4 py-2 border border-dashed border-slate-250 dark:border-slate-750 hover:bg-slate-50 dark:hover:bg-slate-950 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Append Line Item
          </button>
        </div>

        {/* SECTION 4: Summary calculations / Total Invoice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          
          {/* Discount input box / Terms */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Financing Variables
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Discount on Whole Invoice (%)
              </label>
              <div className="relative max-w-xs">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Percent className="w-4 h-4" />
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-100"
                  placeholder="E.g., 5"
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 text-[11px] text-slate-500 dark:text-slate-400">
              Invoice totals and line amounts update automatically as quantities change.
            </div>
          </div>

          {/* Ledger Calculation totals */}
          <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
              Financial Summary Ledger
            </h3>

            <div className="space-y-2.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Total Items Subtotal (Excl. Tax)</span>
                <span className="font-mono text-slate-200">₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              {discountPercent > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Invoice Trade Discount Applied ({discountPercent}%)</span>
                  <span className="font-mono">- ₹{totals.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              <div className="border-t border-slate-800/80 my-2 pt-2" />

              {isSameState ? (
                <>
                  <div className="flex justify-between">
                    <span>Central GST (CGST)</span>
                    <span className="font-mono text-slate-350">₹{totals.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>State GST (SGST)</span>
                    <span className="font-mono text-slate-350">₹{totals.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between font-medium">
                  <span>Integrated GST (IGST)</span>
                  <span className="font-mono text-slate-350">₹{totals.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}

              <div className="flex justify-between font-medium">
                <span>Total Calculated Tax Amount</span>
                <span className="font-mono text-slate-300">₹{totals.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="border-t border-slate-800 my-2.5 pt-3" />

              <div className="flex justify-between items-center text-white">
                <span className="font-semibold text-sm">Invoice Net Amount Due (Rounded)</span>
                <span className="text-xl font-extrabold font-mono text-indigo-400">
                  ₹{Math.round(totals.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="submit"
                id="save-invoice-btn"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/10 cursor-pointer text-center"
              >
                Register & Lock-In Invoice
              </button>
            </div>
          </div>

        </div>

      </form>

      {/* Quick Add Customer Modal */}
      {isQuickCustModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
              Quick Add Customer Entry
            </h3>
            
            <form onSubmit={handleQuickAddCustomerSubmit} className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={qcName}
                  onChange={(e) => setQcName(e.target.value)}
                  placeholder="Acma Solutions"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Mobile
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={qcMobile}
                    onChange={(e) => setQcMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs dark:text-slate-100 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={qcGstin}
                    onChange={(e) => setQcGstin(e.target.value)}
                    placeholder="15-char ID"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Billing State *
                </label>
                <select
                  value={qcState}
                  onChange={(e) => setQcState(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-805 rounded-xl text-xs dark:text-slate-100"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Root / Branch Name
                </label>
                <input
                  type="text"
                  value={qcRoot}
                  onChange={(e) => setQcRoot(e.target.value)}
                  placeholder="Kolkata Branch"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Billing Address
                </label>
                <textarea
                  value={qcAddress}
                  onChange={(e) => setQcAddress(e.target.value)}
                  rows={2}
                  placeholder="Complete office street details..."
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl text-xs dark:text-slate-100"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickCustModalOpen(false)}
                  className="flex-1 py-2 text-xs border border-slate-250 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-1 px-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
                >
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
