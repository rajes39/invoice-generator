import { useState, useEffect, Dispatch, SetStateAction, FormEvent } from 'react';
import { Customer, Product, Invoice, InvoiceItem, BusinessProfile, CustomerDiscountRule } from '../types';
import { Plus, Trash, UserPlus, FileText, Calendar, Percent, IndianRupee, AlertTriangle, Check, ChevronDown, Sparkles } from 'lucide-react';
import { INDIAN_STATES } from './CustomersTab';

const getCustomerNetPrice = (customerId: string | undefined, productId: string) => {
  if (!customerId) return null;

  try {
    const stored = localStorage.getItem('customerNetPrices');
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    const customerPrices = parsed?.[customerId];
    if (!customerPrices || typeof customerPrices !== 'object') return null;

    const fixedPrice = Number(customerPrices[productId]);
    return Number.isFinite(fixedPrice) && fixedPrice > 0 ? fixedPrice : null;
  } catch (error) {
    console.error('Error reading customerNetPrices', error);
    return null;
  }
};

const applyCustomerPricing = (item: InvoiceItem, product: Product | undefined, customerId: string | undefined) => {
  const fixedPrice = product ? getCustomerNetPrice(customerId, product.id) : null;
  const appliedPrice = fixedPrice ?? product?.sellingPrice ?? item.sellingPrice ?? 0;
  const quantity = item.quantity || 1;
  const isNetPriceApplied = fixedPrice !== null;
  const lineDiscountPercent = isNetPriceApplied ? 0 : (item.discountPercent || 0);
  const subtotal = appliedPrice * quantity;
  const discountAmount = subtotal * (lineDiscountPercent / 100);
  const taxAmount = (subtotal - discountAmount) * ((item.gstRate || product?.gstRate || 18) / 100);
  const totalAmount = subtotal - discountAmount + taxAmount;

  return {
    sellingPrice: appliedPrice,
    discountPercent: lineDiscountPercent,
    discountAmount,
    netPriceApplied: isNetPriceApplied ? appliedPrice : undefined,
    subtotal,
    taxAmount,
    totalAmount,
  };
};

const fixedPriceToastMessage = (fixedPrice: number) => `Fixed MRP applied: ₹${fixedPrice.toFixed(2)} (No discount)`;

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
  
  // Customer selection
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [searchCustomerQuery, setSearchCustomerQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  // Quick Add Customer modal inside Invoice generator
  const [isQuickCustModalOpen, setIsQuickCustModalOpen] = useState(false);
  const [qcName, setQcName] = useState('');
  const [qcMobile, setQcMobile] = useState('');
  const [qcGstin, setQcGstin] = useState('');
  const [qcState, setQcState] = useState('West Bengal');
  const [qcRoot, setQcRoot] = useState('');
  const [qcAddress, setQcAddress] = useState('');

  // Invoice Items
  const [items, setItems] = useState<Partial<InvoiceItem>[]>([
    { id: 'item-init-1', productId: '', productName: '', partNumber: '', hsnCode: '', sellingPrice: 0, gstRate: 18, quantity: 1, discountPercent: 0, discountAmount: 0, subtotal: 0, taxAmount: 0, totalAmount: 0 }
  ]);
  const [productSearches, setProductSearches] = useState<{[key: string]: string}>({});
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);

  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Initialize Invoice Number on mount or invoices list change, only if NOT in edit mode
  useEffect(() => {
    if (!invoiceToEdit) {
      setInvoiceNumber(generateNextInvoiceNumber());
    }
  }, [invoices, invoiceToEdit]);

  // Prefill fields if in Edit Mode
  useEffect(() => {
    if (invoiceToEdit) {
      setInvoiceNumber(invoiceToEdit.invoiceNumber);
      setInvoiceDate(invoiceToEdit.date);
      setVehicleNo(invoiceToEdit.vehicleNo || '');
      setSelectedCustomerId(invoiceToEdit.customerId);
      setSearchCustomerQuery(invoiceToEdit.customerName);
      setDiscountPercent(invoiceToEdit.discountPercent || 0);

      const mappedItems = invoiceToEdit.items.map((item, idx) => ({
        id: item.id || `item-edit-${idx}-${Date.now()}-${Math.random()}`,
        productId: item.productId,
        productName: item.productName,
        partNumber: item.partNumber,
        hsnCode: item.hsnCode,
        sellingPrice: item.sellingPrice,
        gstRate: item.gstRate,
        quantity: item.quantity,
        discountPercent: item.discountPercent || 0,
        discountAmount: item.discountAmount || 0,
        subtotal: item.subtotal,
        taxAmount: item.taxAmount,
        totalAmount: item.totalAmount
      }));
      setItems(mappedItems);
    } else {
      // Clear/Reset to default state
      setInvoiceNumber(generateNextInvoiceNumber());
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setVehicleNo('');
      setSelectedCustomerId('');
      setSearchCustomerQuery('');
      setDiscountPercent(0);
      setItems([
        { id: 'item-init-1', productId: '', productName: '', partNumber: '', hsnCode: '', sellingPrice: 0, gstRate: 18, quantity: 1, discountPercent: 0, discountAmount: 0, subtotal: 0, taxAmount: 0, totalAmount: 0 }
      ]);
    }
  }, [invoiceToEdit]);

  useEffect(() => {
    if (invoiceToEdit) return;

    try {
      const pendingBarcodes = localStorage.getItem('invoice_scan_pending_items');
      if (!pendingBarcodes) return;

      const parsedScans = JSON.parse(pendingBarcodes);
      if (!Array.isArray(parsedScans) || parsedScans.length === 0) return;

      const mappedScans = parsedScans.map((scan: { productId: string; productName: string; partNumber: string; hsnCode: string; sellingPrice: number; gstRate: number; quantity: number; discountPercent?: number }, index: number) => {
        const sellingPrice = Number(scan.sellingPrice) || 0;
        const quantity = Number(scan.quantity) || 1;
        const discountPercent = Number(scan.discountPercent) || 0;
        const subtotal = sellingPrice * quantity;
        const discountAmount = subtotal * (discountPercent / 100);
        const taxAmount = (subtotal - discountAmount) * (Number(scan.gstRate) / 100);
        const totalAmount = subtotal - discountAmount + taxAmount;

        return {
          id: `barcode-import-${Date.now()}-${index}`,
          productId: scan.productId,
          productName: scan.productName,
          partNumber: scan.partNumber,
          hsnCode: scan.hsnCode,
          sellingPrice,
          gstRate: Number(scan.gstRate) || 18,
          quantity,
          discountPercent,
          discountAmount,
          subtotal,
          taxAmount,
          totalAmount,
        };
      });

      setItems([...mappedScans, {
        id: `item-init-${Date.now()}`,
        productId: '',
        productName: '',
        partNumber: '',
        hsnCode: '',
        sellingPrice: 0,
        gstRate: 18,
        quantity: 1,
        discountPercent: 0,
        discountAmount: 0,
        subtotal: 0,
        taxAmount: 0,
        totalAmount: 0,
      }]);

      localStorage.removeItem('invoice_scan_pending_items');
      showToast(`${mappedScans.length} scanned items loaded into the invoice builder`, 'success');
    } catch (err) {
      console.error('Failed to load barcode scans into invoice builder', err);
    }
  }, [invoiceToEdit, showToast]);

  // Selected customer object
  const activeCustomer = customers.find(c => c.id === selectedCustomerId);

  // Dynamic values based on business profiles and customer states
  const isSameState = activeCustomer ? activeCustomer.state.toLowerCase().trim() === businessProfile.state.toLowerCase().trim() : true;

  // 2. Add New blank Item row
  const addItemRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item-dyn-${Date.now()}`,
        productId: '',
        productName: '',
        partNumber: '',
        hsnCode: '',
        sellingPrice: 0,
        gstRate: 18,
        quantity: 1,
        subtotal: 0,
        taxAmount: 0,
        totalAmount: 0
      }
    ]);
  };

  // 3. Remove Item Row
  const removeItemRow = (index: number) => {
    if (items.length === 1) {
      showToast("An invoice must contain at least 1 item", "info");
      return;
    }
    setItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Helper to fetch custom discount percentage for a customer and product brand or SKU
  const getStickyDiscount = (prod: Product, targetCustomerId?: string): number => {
    if (prod.isNetProduct) return 0;
    const custId = targetCustomerId || selectedCustomerId;
    if (!custId) return 0;

    const fixedPrice = getCustomerNetPrice(custId, prod.id);
    if (fixedPrice !== null) return 0;

    // 1. Try new memory tables linked directly to Customer ID in localStorage
    try {
      const savedMemo = localStorage.getItem(`customer_discounts_${custId}`);
      if (savedMemo) {
        const data = JSON.parse(savedMemo);
        if (data) {
          // Check product-wise discount (Product name is linked via productId in our new setup)
          const prodRule = data.products?.find((p: any) => p.productId === prod.id);
          if (prodRule) {
            return prodRule.discountPercent;
          }
          // Check brand-wise discount
          if (prod.brand) {
            const brandRule = data.brands?.find((b: any) => b.brandName.toLowerCase().trim() === prod.brand.toLowerCase().trim());
            if (brandRule) {
              return brandRule.discountPercent;
            }
          }
        }
      }
    } catch (e) {
      console.error("Error reading new customer discounts memory:", e);
    }

    // 2. Legacy / Custom discount rules fallback
    try {
      const savedRulesStr = localStorage.getItem('customer_discount_rules');
      if (!savedRulesStr) return 0;
      const rules: CustomerDiscountRule[] = JSON.parse(savedRulesStr);
      
      // Look for custom rules for this customer
      const custRules = rules.filter(r => r.customerId === custId);
      if (custRules.length === 0) return 0;

      // 1st Priority: SKU specific rule
      const skuRule = custRules.find(r => r.type === 'SKU' && r.value === prod.id);
      if (skuRule) return skuRule.discountPercent;

      // 2nd Priority: Brand specific rule
      if (prod.brand) {
        const brandRule = custRules.find(r => r.type === 'Brand' && r.value.toLowerCase().trim() === prod.brand.toLowerCase().trim());
        if (brandRule) return brandRule.discountPercent;
      }

      // 3rd Priority: Flat customer discount rule
      const flatRule = custRules.find(r => r.type === 'Flat');
      if (flatRule) return flatRule.discountPercent;

    } catch (e) {
      console.error(e);
    }
    return 0;
  };

  // Trigger pricing recalculation when customer selection or product catalog changes
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
  }, [selectedCustomerId, products]);

  // 4. Update row values on product selection or custom inputs
  const handleItemProductSelect = (index: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const oldQty = invoiceToEdit
      ? (invoiceToEdit.items.find(it => it.productId === productId)?.quantity || 0)
      : 0;
    const currentAvailable = prod.currentStock + oldQty;

    if (currentAvailable === 0) {
      showToast(`Warning: '${prod.name}' is currently of Out of Stock in warehouse`, "error");
    }

    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;

      const quantity = item.quantity || 1;
      const finalQty = quantity > currentAvailable ? currentAvailable : quantity;

      if (quantity > currentAvailable) {
        showToast(`Capped quantity at ${currentAvailable} due to warehouse availability limit`, "info");
      }

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

  const handleQtyChange = (index: number, qty: number) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;

      const prod = products.find(p => p.id === item.productId);
      const oldQty = invoiceToEdit
        ? (invoiceToEdit.items.find(it => it.productId === item.productId)?.quantity || 0)
        : 0;
      const availableStock = prod ? (prod.currentStock + oldQty) : 99999;
      
      let finalQty = qty;
      if (qty > availableStock) {
        showToast(`Stock limit: Only ${availableStock} units available for this product`, "error");
        finalQty = availableStock;
      }

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
      const effectivePrice = fixedPrice !== null ? fixedPrice : price;
      const subtotal = effectivePrice * qty;
      const discPercent = fixedPrice !== null ? 0 : (item.discountPercent || 0);
      const discountAmount = subtotal * (discPercent / 100);
      const gst = item.gstRate || 0;
      const taxAmount = (subtotal - discountAmount) * (gst / 100);
      const totalAmount = subtotal - discountAmount + taxAmount;

      return {
        ...item,
        sellingPrice: effectivePrice,
        discountPercent: discPercent,
        discountAmount,
        subtotal,
        taxAmount,
        totalAmount,
        netPriceApplied: fixedPrice !== null ? effectivePrice : undefined,
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

      const price = item.sellingPrice || 0;
      const qty = item.quantity || 1;
      const subtotal = price * qty;
      const discountAmount = subtotal * (appliedDisc / 100);
      const gst = item.gstRate || 0;
      const taxAmount = (subtotal - discountAmount) * (gst / 100);
      const totalAmount = subtotal - discountAmount + taxAmount;

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

      const price = item.sellingPrice || 0;
      const qty = item.quantity || 1;
      const subtotal = price * qty;
      const discPercent = item.discountPercent || 0;
      const discountAmount = subtotal * (discPercent / 100);
      const taxAmount = (subtotal - discountAmount) * (rate / 100);
      const totalAmount = subtotal - discountAmount + taxAmount;

      return {
        ...item,
        gstRate: rate,
        taxAmount,
        totalAmount
      };
    }));
  };

  // 5. Calculations on total
  const calculateInvoiceTotals = () => {
    let rawSubtotal = 0;
    let itemDiscountsSum = 0;
    let nonNetRemainingBase = 0;

    items.forEach(item => {
      if (!item.productId) return;
      rawSubtotal += item.subtotal || 0;
      itemDiscountsSum += item.discountAmount || 0;

      const prod = products.find(p => p.id === item.productId);
      const fixedPrice = prod ? getCustomerNetPrice(selectedCustomerId, prod.id) : null;
      const isProtectedNetRow = Boolean(prod && (prod.isNetProduct || fixedPrice !== null || item.netPriceApplied));

      if (!isProtectedNetRow) {
        const rowSubtotal = item.subtotal || 0;
        const rowItemDiscount = item.discountAmount || 0;
        nonNetRemainingBase += (rowSubtotal - rowItemDiscount);
      }
    });

    const remainingBase = rawSubtotal - itemDiscountsSum;
    const mainInvoiceDiscountAmt = nonNetRemainingBase * (discountPercent / 100);
    const totalDiscountAmount = itemDiscountsSum + mainInvoiceDiscountAmt;

    let calculatedCgst = 0;
    let calculatedSgst = 0;
    let calculatedIgst = 0;
    let finalTaxSum = 0;

    items.forEach(item => {
      if (!item.productId) return;
      const rowSubtotal = item.subtotal || 0;
      const rowItemDiscount = item.discountAmount || 0;
      const baseAfterRowDiscount = rowSubtotal - rowItemDiscount;
      
      const prod = products.find(p => p.id === item.productId);
      const fixedPrice = prod ? getCustomerNetPrice(selectedCustomerId, prod.id) : null;
      const isNet = Boolean(prod && (prod.isNetProduct || fixedPrice !== null || item.netPriceApplied));

      const shareOfMainDiscount = (!isNet && nonNetRemainingBase > 0) ? (baseAfterRowDiscount / nonNetRemainingBase) * mainInvoiceDiscountAmt : 0;
      const finalRowGstBase = baseAfterRowDiscount - shareOfMainDiscount;
      
      const itemTaxVal = finalRowGstBase * ((item.gstRate || 18) / 100);

      finalTaxSum += itemTaxVal;

      if (isSameState) {
        calculatedCgst += itemTaxVal / 2;
        calculatedSgst += itemTaxVal / 2;
      } else {
        calculatedIgst += itemTaxVal;
      }
    });

    const totalBill = rawSubtotal - totalDiscountAmount + finalTaxSum;

    return {
      subtotal: rawSubtotal,
      discountAmount: totalDiscountAmount,
      taxAmount: finalTaxSum,
      cgstAmount: calculatedCgst,
      sgstAmount: calculatedSgst,
      igstAmount: calculatedIgst,
      totalAmount: totalBill
    };
  };

  const totals = calculateInvoiceTotals();

  // 6. Submit and Save Invoice (Supports Create or Edit)
  const handleSaveInvoice = (e: FormEvent) => {
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

    // Check stock for all items
    // First, map the old quantities if we are in Edit Mode
    const oldQuantitiesMap: { [productId: string]: number } = {};
    if (invoiceToEdit) {
      invoiceToEdit.items.forEach(item => {
        oldQuantitiesMap[item.productId] = (oldQuantitiesMap[item.productId] || 0) + item.quantity;
      });
    }

    let hasStockError = false;
    validItems.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return;
      const oldQty = oldQuantitiesMap[item.productId] || 0;
      const newQty = item.quantity || 0;
      const tempStock = prod.currentStock + oldQty - newQty;
      if (tempStock < 0) {
        showToast(`Stock limit: Only ${prod.currentStock + oldQty} units of '${prod.name}' can be billed. Needed: ${newQty}`, "error");
        hasStockError = true;
      }
    });

    if (hasStockError) return;

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

    if (invoiceToEdit) {
      // Update existing invoice (preserve same ID and invoiceNumber)
      const updatedInvoice: Invoice = {
        ...invoiceToEdit,
        invoiceNumber, // in case user is allowed to edit or it stays same
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

      setInvoices(prev => prev.map(inv => inv.id === invoiceToEdit.id ? updatedInvoice : inv));
      showToast("Invoice updated successfully", "success");
      
      // Reset edit state
      if (setInvoiceToEdit) {
        setInvoiceToEdit(null);
      }
    } else {
      // Create Invoice structure
      const nextInvoice: Invoice = {
        id: `inv-new-${Date.now()}`,
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

      setInvoices(prev => [nextInvoice, ...prev]);
      showToast(`Invoice ${invoiceNumber} generated & saved successfully!`, "success");
    }

    // Clear Form & Redirect to Invoice list
    setItems([{ id: 'item-init-1', productId: '', productName: '', partNumber: '', hsnCode: '', sellingPrice: 0, gstRate: 18, quantity: 1, discountPercent: 0, discountAmount: 0, subtotal: 0, taxAmount: 0, totalAmount: 0 }]);
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
          Draft tax compliance invoices with real-time stock validations, State tax routing, and auto rounding.
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

          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
                <th className="py-2.5 w-1/3">Product Info</th>
                <th className="py-2.5 px-2 w-24">HSN Code</th>
                <th className="py-2.5 px-2 w-24">Stock Avail</th>
                <th className="py-2.5 px-2 w-28">Rate (Ex. GST)</th>
                <th className="py-2.5 px-2 w-16">Qty</th>
                <th className="py-2.5 px-2 w-24">Discount %</th>
                <th className="py-2.5 px-2 w-24">GST% Rate</th>
                <th className="py-2.5 px-2 text-right">Row Net Amt</th>
                <th className="py-2.5 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-850">
              {items.map((item, index) => {
                const productSpec = products.find(p => p.id === item.productId);
                const maxVal = productSpec ? productSpec.currentStock : 9999;

                return (
                  <tr key={item.id} className="align-middle">
                    {/* Product Selector */}
                    <td className="py-3 pr-2 relative">
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="Search SKU title, SKU Part No or category..."
                          value={productSearches[item.id!] !== undefined ? productSearches[item.id!] : (productSpec ? `${productSpec.name} (${productSpec.partNumber})` : '')}
                          onFocus={() => {
                            setActiveDropdownIndex(index);
                            if (productSearches[item.id!] === undefined) {
                              setProductSearches(prev => ({ ...prev, [item.id!]: productSpec ? productSpec.name : '' }));
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value;
                            setProductSearches(prev => ({ ...prev, [item.id!]: val }));
                            setActiveDropdownIndex(index);
                          }}
                          onBlur={() => {
                            // Delay closure slightly so that onMouseDown clicks can register successfully first
                            setTimeout(() => {
                              setActiveDropdownIndex(null);
                            }, 250);
                          }}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-200"
                        />
                        {productSpec && (
                          <button
                            type="button"
                            onClick={() => {
                              // Reset option/selection
                              setItems(prev => prev.map((itemObj, itIdx) => itIdx === index ? { ...itemObj, productId: '', productName: '', partNumber: '', hsnCode: '', sellingPrice: 0, gstRate: 18, quantity: 1, discountPercent: 0, discountAmount: 0, subtotal: 0, taxAmount: 0, totalAmount: 0 } : itemObj));
                              setProductSearches(prev => ({ ...prev, [item.id!]: '' }));
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-black p-0.5 cursor-pointer"
                            title="Clear SKU item selection"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {activeDropdownIndex === index && (
                        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 max-h-56 overflow-y-auto rounded-xl shadow-lg z-30 divide-y divide-slate-50 dark:divide-slate-850">
                          {(() => {
                            const query = productSearches[item.id!] || '';
                            const lQuery = query.toLowerCase().trim();
                            const filtered = products.filter(p => {
                              if (!lQuery) return true;
                              return (
                                p.name?.toLowerCase().includes(lQuery) ||
                                p.partNumber?.toLowerCase().includes(lQuery) ||
                                p.brand?.toLowerCase().includes(lQuery) ||
                                p.category?.toLowerCase().includes(lQuery) ||
                                p.hsnCode?.toLowerCase().includes(lQuery)
                              );
                            }).slice(0, 10);

                            if (filtered.length === 0) {
                              return <div className="p-3 text-center text-xs text-slate-450">No catalog products match search query</div>;
                            }

                            return filtered.map(p => (
                              <div
                                key={p.id}
                                onMouseDown={() => {
                                  handleItemProductSelect(index, p.id);
                                  setProductSearches(prev => ({ ...prev, [item.id!]: `${p.name} (${p.partNumber})` }));
                                  setActiveDropdownIndex(null);
                                }}
                                className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-955 cursor-pointer text-left transition-colors"
                              >
                                <div className="text-xs font-bold text-slate-850 dark:text-slate-200 flex items-center justify-between">
                                  <span>{p.name}</span>
                                  {p.isNetProduct && (
                                    <span className="px-1 text-[8px] bg-amber-100 dark:bg-amber-955 text-amber-700 dark:text-amber-400 rounded border border-amber-200 dark:border-amber-900/30 font-extrabold tracking-wider">
                                      NET SKU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Part No: {p.partNumber} | HSN: {p.hsnCode || "N/A"} | Stock: {p.currentStock} Units | Price: ₹{p.sellingPrice}
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      )}
                    </td>

                    {/* HSN Code display */}
                    <td className="py-3 px-2">
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {item.hsnCode || "-"}
                      </span>
                    </td>

                    {/* Available Stock Display */}
                    <td className="py-3 px-2">
                      {productSpec ? (
                        <span className={`text-xs font-bold font-mono ${productSpec.currentStock <= 5 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {productSpec.currentStock} Units
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Custom Pricing */}
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

                    {/* Quantity Field */}
                    <td className="py-3 px-2">
                      <input
                        type="number"
                        required
                        min={1}
                        max={maxVal}
                        value={item.quantity || 1}
                        onChange={(e) => handleQtyChange(index, Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-200"
                      />
                    </td>

                    {/* Discount % Field */}
                    <td className="py-3 px-2">
                      <div className="relative">
                        <input
                          type="number"
                          required
                          min={0}
                          max={100}
                          value={item.discountPercent || 0}
                          onChange={(e) => handleItemDiscountPercentChange(index, Number(e.target.value))}
                          className="w-full pl-2 pr-5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-100"
                        />
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold">%</span>
                      </div>
                    </td>

                    {/* Custom GST Selection */}
                    <td className="py-3 px-2">
                      <select
                        value={item.gstRate || 18}
                        onChange={(e) => handleGstRateChange(index, Number(e.target.value))}
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-250"
                      >
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </td>

                    {/* Total Row net cost */}
                    <td className="py-3 px-2 text-right font-semibold font-mono text-xs dark:text-slate-100">
                      ₹{((item.totalAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

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

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-normal font-medium">
                Warehouse compliance check active. Saving this sheet guarantees automatic deductions on active inventory counts immediately. Negative stock builds are strictly locked out.
              </p>
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
