import { useState, useEffect, Dispatch, SetStateAction, FormEvent } from 'react';
import { Invoice, Customer, Product, CustomerDiscountRule, Purchase, Supplier, SupplierPayment, BusinessProfile } from '../types';
import { Calendar, Download, Tag, Award, Plus, Trash2, TrendingUp, DollarSign, Receipt, Percent, FileText, CheckCircle, HelpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ReportsTabProps {
  invoices: Invoice[];
  customers: Customer[];
  products: Product[];
  purchases: Purchase[];
  suppliers: Supplier[];
  supplierPayments: SupplierPayment[];
  businessProfile: BusinessProfile;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function ReportsTab({ invoices, customers, products, purchases, suppliers, supplierPayments, businessProfile, showToast }: ReportsTabProps) {
  const [subTab, setSubTab] = useState<'analytics' | 'discounts' | 'purchases'>('analytics');

  // Date filters
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to start of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [purchaseFilterSupplier, setPurchaseFilterSupplier] = useState('All');

  // Discount rules state
  const [discountRules, setDiscountRules] = useState<CustomerDiscountRule[]>([]);

  // Load discount rules from localStorage on mount
  useEffect(() => {
    const savedRules = localStorage.getItem('customer_discount_rules');
    if (savedRules) {
      setDiscountRules(JSON.parse(savedRules));
    } else {
      // Seed some demo rules if desired
      const defaultRules: CustomerDiscountRule[] = [
        {
          id: 'rule-demo-1',
          customerId: customers[0]?.id || 'cust-1',
          customerName: customers[0]?.name || 'Acme Enterprises',
          type: 'Flat',
          value: '',
          label: 'All Brands & Products',
          discountPercent: 10
        }
      ];
      setDiscountRules(defaultRules);
      localStorage.setItem('customer_discount_rules', JSON.stringify(defaultRules));
    }
  }, [customers]);

  // Save rules
  const saveRules = (newRules: CustomerDiscountRule[]) => {
    setDiscountRules(newRules);
    localStorage.setItem('customer_discount_rules', JSON.stringify(newRules));
  };

  // Rule creation state
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false);
  const [ruleCustomerId, setRuleCustomerId] = useState('');
  const [ruleType, setRuleType] = useState<'Flat' | 'Brand' | 'SKU'>('Flat');
  const [ruleBrand, setRuleBrand] = useState('');
  const [ruleProductId, setRuleProductId] = useState('');
  const [rulePercent, setRulePercent] = useState<number | ''>('');

  // Extract unique brands for brand rules
  const uniqueBrands = Array.from(new Set(products.map(p => p.brand).filter(Boolean)));

  // Filter invoices by date range
  const filteredInvoices = invoices.filter(inv => {
    return inv.date >= startDate && inv.date <= endDate;
  });

  // Calculate summaries for the selected range
  const summary = filteredInvoices.reduce((acc, inv) => {
    acc.sales += inv.totalAmount;
    acc.tax += inv.taxAmount;
    acc.discounts += inv.discountAmount;
    
    // Also include per-item discounts if saved
    inv.items.forEach(itm => {
      acc.discounts += (itm.discountAmount || 0);
    });

    return acc;
  }, { sales: 0, tax: 0, discounts: 0 });

  const filteredPurchases = purchases.filter(purchase => {
    const matchesDate = purchase.date >= startDate && purchase.date <= endDate;
    const matchesSupplier = purchaseFilterSupplier === 'All' || purchase.supplierId === purchaseFilterSupplier;
    return matchesDate && matchesSupplier;
  });

  const purchaseSummary = filteredPurchases.reduce((acc, purchase) => {
    acc.purchaseAmount += purchase.grandTotal;
    acc.tax += purchase.taxAmount;
    acc.discount += purchase.discountAmount;
    return acc;
  }, { purchaseAmount: 0, tax: 0, discount: 0 });

  const handleExportPurchaseExcel = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      showToast("SheetJS library is not yet loaded.", "error");
      return;
    }

    try {
      const rows = filteredPurchases.map((purchase, idx) => ({
        'S.No': idx + 1,
        'Purchase No': purchase.purchaseNumber,
        'Date': purchase.date,
        'Supplier': purchase.supplierName,
        'Supplier GSTIN': purchase.supplierGstin,
        'Subtotal': purchase.subtotal,
        'Discount': purchase.discountAmount,
        'Tax': purchase.taxAmount,
        'Grand Total': purchase.grandTotal,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const maxLens = Object.keys(rows[0] || {}).map(key => ({ wch: key.length + 4 }));
      worksheet['!cols'] = maxLens;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Report');
      XLSX.writeFile(workbook, `Purchase_Report_${startDate}_to_${endDate}.xlsx`);
      showToast(`Exported ${filteredPurchases.length} purchase records successfully!`, 'success');
    } catch (err: any) {
      showToast("Purchase export failed: " + err.message, "error");
    }
  };

  // Handle Export to Excel
  const handleExportExcel = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      showToast("SheetJS library is not yet loaded.", "error");
      return;
    }

    try {
      const excelRows = filteredInvoices.map((inv, idx) => ({
        "S.No": idx + 1,
        "Invoice Number": inv.invoiceNumber,
        "Invoice Date": inv.date,
        "Customer Name": inv.customerName,
        "Customer Mobile": inv.customerMobile,
        "Customer GSTIN": inv.customerGstin,
        "Billing State": inv.customerState,
        "Gross Subtotal (₹)": inv.subtotal,
        "Discount Amount (₹)": inv.discountAmount,
        "Tax Amount (₹)": inv.taxAmount,
        "IGST Collected (₹)": inv.igstAmount,
        "CGST Collected (₹)": inv.cgstAmount,
        "SGST Collected (₹)": inv.sgstAmount,
        "Total Receivables (₹)": inv.totalAmount,
        "Bill Status": inv.status
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      
      // Auto-fit columns
      const maxLens = Object.keys(excelRows[0] || {}).map(key => ({ wch: key.length + 4 }));
      worksheet['!cols'] = maxLens;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Financial Reports");
      
      XLSX.writeFile(workbook, `SONALI_ERP_Report_${startDate}_to_${endDate}.xlsx`);
      showToast(`Exported ${filteredInvoices.length} transactions successfully!`, 'success');
    } catch (err: any) {
      showToast("Export failed: " + err.message, "error");
    }
  };

  // Add rule submit handler
  const handleAddRule = (e: FormEvent) => {
    e.preventDefault();

    if (!ruleCustomerId) {
      showToast("Please choose a billing customer", "error");
      return;
    }

    const selectedCustObj = customers.find(c => c.id === ruleCustomerId);
    if (!selectedCustObj) return;

    if (rulePercent === '' || rulePercent < 0 || rulePercent > 100) {
      showToast("Please input a discount between 0% and 100%", "error");
      return;
    }

    let val = '';
    let lbl = 'All Brands & Products';

    if (ruleType === 'Brand') {
      if (!ruleBrand) {
        showToast("Please write or select a Brand", "error");
        return;
      }
      val = ruleBrand;
      lbl = `Brand: ${ruleBrand}`;
    } else if (ruleType === 'SKU') {
      if (!ruleProductId) {
        showToast("Please pick a target Product", "error");
        return;
      }
      const pObj = products.find(p => p.id === ruleProductId);
      val = ruleProductId;
      lbl = pObj ? `Product: ${pObj.name}` : `Product SKU (${ruleProductId})`;
    }

    // Check if duplicate rule
    const isDuplicate = discountRules.some(r => 
      r.customerId === ruleCustomerId && 
      r.type === ruleType && 
      r.value.toLowerCase().trim() === val.toLowerCase().trim()
    );

    if (isDuplicate) {
      showToast("A matching rule exists for this customer. Remove existing rule first.", "error");
      return;
    }

    const newRule: CustomerDiscountRule = {
      id: `rule-${Date.now()}`,
      customerId: ruleCustomerId,
      customerName: selectedCustObj.name,
      type: ruleType,
      value: val,
      label: lbl,
      discountPercent: Number(rulePercent)
    };

    saveRules([newRule, ...discountRules]);
    showToast(`Rule added for customer '${selectedCustObj.name}' (${rulePercent}%)`, 'success');
    
    // reset Form
    setRuleCustomerId('');
    setRuleType('Flat');
    setRuleBrand('');
    setRuleProductId('');
    setRulePercent('');
    setIsNewRuleOpen(false);
  };

  const handleDeleteRule = (id: string, name: string) => {
    saveRules(discountRules.filter(r => r.id !== id));
    showToast(`Deleted discount rule for ${name}`, "info");
  };

  return (
    <div className="space-y-4">
      {/* Tab Header Controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center border-b border-slate-200 dark:border-slate-800 pb-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Reports & Business Memory
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Query financial records, export transactions, and customize sticky client discounts.
          </p>
        </div>

        {/* Sub tabs switches */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950/80 rounded-lg border border-slate-200 dark:border-slate-800/80 font-sans">
          <button
            onClick={() => setSubTab('analytics')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              subTab === 'analytics'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Financial Analytics
          </button>
          <button
            onClick={() => setSubTab('purchases')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              subTab === 'purchases'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Purchase Report
          </button>
          <button
            onClick={() => setSubTab('discounts')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
              subTab === 'discounts'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-slate-100 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Sticky Customer Discounts
          </button>
        </div>
      </div>

      {subTab === 'analytics' ? (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Query Filter Area */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-end justify-between gap-3 shadow-xs font-sans">
            <div className="grid grid-cols-2 gap-3 w-full md:max-w-md">
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-1.5">
                  Start Date Limit:
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-1.5">
                  End Date Limit:
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleExportExcel}
              disabled={filteredInvoices.length === 0}
              className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer ${
                filteredInvoices.length === 0
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Export Selected Range to Excel
            </button>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3.5 flex items-center justify-between shadow-xs">
              <div className="text-left">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Calculated Gross Sales
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  ₹{summary.sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                <span className="text-[10px] text-emerald-500 font-semibold block mt-1">
                  Includes taxes, minus discounts
                </span>
              </div>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3.5 flex items-center justify-between shadow-xs">
              <div className="text-left">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Total Tax Collected
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  ₹{summary.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                <span className="text-[10px] text-blue-500 font-semibold block mt-1">
                  Sum of CGST, SGST, & IGST
                </span>
              </div>
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg">
                <Receipt className="w-4.5 h-4.5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3.5 flex items-center justify-between shadow-xs">
              <div className="text-left">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Total Discounts Offered
                </span>
                <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                  ₹{summary.discounts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                <span className="text-[10px] text-rose-400 font-semibold block mt-1">
                  Sum of product level discounts
                </span>
              </div>
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg">
                <Percent className="w-4.5 h-4.5" />
              </div>
            </div>
          </div>

          {/* Transactions list layout */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-955/55 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-50 uppercase tracking-wider">
                Transaction Rows Inside Date Domain ({filteredInvoices.length})
              </h3>
            </div>

            {filteredInvoices.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400">No Sales In Range</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-1 max-w-xs mx-auto">
                  Adjust standard date boundaries on filters to search historic bills.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-955/20 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="px-4 py-2">No / Date</th>
                      <th className="px-4 py-2">Customer Profile</th>
                      <th className="px-4 py-2 text-right">Subtotal</th>
                      <th className="px-4 py-2 text-right text-rose-500">Discount</th>
                      <th className="px-4 py-2 text-right text-blue-500">Tax Collected</th>
                      <th className="px-4 py-2 text-right font-black text-slate-800 dark:text-slate-200">Total Net</th>
                      <th className="px-4 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {filteredInvoices.map(inv => {
                      // Sum of item discount for display:
                      let itemDiscs = 0;
                      inv.items.forEach(itm => {
                        itemDiscs += (itm.discountAmount || 0);
                      });
                      const totalDiscVal = inv.discountAmount + itemDiscs;

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-955/10 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="font-bold text-slate-900 dark:text-slate-50 font-mono text-[11px]">{inv.invoiceNumber}</div>
                            <div className="text-[10px] text-slate-400">{inv.date}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{inv.customerName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">GST: {inv.customerGstin || "N/A"}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">
                            ₹{inv.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-rose-600 dark:text-rose-400">
                            -₹{totalDiscVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-blue-600 dark:text-blue-400">
                            ₹{inv.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-black text-slate-850 dark:text-slate-100">
                            ₹{inv.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase rounded ${
                              inv.status === 'Paid'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-955/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30'
                                : 'bg-slate-50 text-slate-600 dark:bg-slate-955/20 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : subTab === 'purchases' ? (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-end justify-between gap-3 shadow-xs font-sans">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full md:max-w-2xl">
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-1.5">
                  Start Date Limit:
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-1.5">
                  End Date Limit:
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
                    <Calendar className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-1.5">
                  Supplier Filter:
                </label>
                <select
                  value={purchaseFilterSupplier}
                  onChange={(e) => setPurchaseFilterSupplier(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-md text-xs dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="All">All Suppliers</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleExportPurchaseExcel}
              disabled={filteredPurchases.length === 0}
              className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer ${
                filteredPurchases.length === 0
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Export Purchase Report
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3.5 flex items-center justify-between shadow-xs">
              <div className="text-left">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Purchase Value
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  ₹{purchaseSummary.purchaseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                <span className="text-[10px] text-amber-500 font-semibold block mt-1">
                  Total landed value in range
                </span>
              </div>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-lg">
                <Receipt className="w-4.5 h-4.5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3.5 flex items-center justify-between shadow-xs">
              <div className="text-left">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Purchase Tax
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  ₹{purchaseSummary.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                <span className="text-[10px] text-blue-500 font-semibold block mt-1">
                  Collected GST on purchases
                </span>
              </div>
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-lg">
                <TrendingUp className="w-4.5 h-4.5" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3.5 flex items-center justify-between shadow-xs">
              <div className="text-left">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Purchase Discount
                </span>
                <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                  ₹{purchaseSummary.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                <span className="text-[10px] text-rose-400 font-semibold block mt-1">
                  Supplier and line discounts
                </span>
              </div>
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg">
                <Percent className="w-4.5 h-4.5" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-955/55 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-50 uppercase tracking-wider">
                Purchase Transactions ({filteredPurchases.length})
              </h3>
            </div>

            {filteredPurchases.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400">No Purchase Records In Range</h4>
                <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-1 max-w-xs mx-auto">
                  Adjust the filters above to view purchase activity.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-955/20 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="px-4 py-2">Purchase No / Date</th>
                      <th className="px-4 py-2">Supplier</th>
                      <th className="px-4 py-2 text-right">Subtotal</th>
                      <th className="px-4 py-2 text-right text-rose-500">Discount</th>
                      <th className="px-4 py-2 text-right text-blue-500">Tax</th>
                      <th className="px-4 py-2 text-right font-black text-slate-800 dark:text-slate-200">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {filteredPurchases.map((purchase) => (
                      <tr key={purchase.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-955/10 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-bold text-slate-900 dark:text-slate-50 font-mono text-[11px]">{purchase.purchaseNumber}</div>
                          <div className="text-[10px] text-slate-400">{purchase.date}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{purchase.supplierName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">GST: {purchase.supplierGstin || 'N/A'}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono">
                          ₹{purchase.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-rose-600 dark:text-rose-400">
                          -₹{purchase.discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-blue-600 dark:text-blue-400">
                          ₹{purchase.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-black text-slate-850 dark:text-slate-100">
                          ₹{purchase.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Header row in Sticky Customer Discounts sub-tab */}
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-xs font-sans">
            <div className="text-left">
              <h3 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                Active Client Sticky Rules
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-550 mt-0.5">
                Automatically append customized percentage discounts for clients whenever you specify their profile during billing.
              </p>
            </div>

            <button
              onClick={() => setIsNewRuleOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Configure Sticky Rule
            </button>
          </div>

          {/* Rules list */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
            {discountRules.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Tag className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 font-sans">No Sticky Rules Defined</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-550 mt-1 max-w-sm mx-auto font-sans">
                  Configure special target contracts per-client or per-brand easily by selecting 'Configure Sticky Rule'.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-955/55 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="px-4 py-2">Customer Profile</th>
                      <th className="px-4 py-2">Target Scope</th>
                      <th className="px-4 py-2">Rule Value / ID</th>
                      <th className="px-4 py-2 text-right">Discount Percentage</th>
                      <th className="px-4 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {discountRules.map(rule => (
                      <tr key={rule.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-955/10 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                          {rule.customerName}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            rule.type === 'Flat'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-955/35 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30'
                              : rule.type === 'Brand'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-955/35 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-955/35 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                          }`}>
                            {rule.type} Limit
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-350">
                          {rule.label || "Flat Account Level"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-black text-slate-900 dark:text-slate-100">
                          {rule.discountPercent}% OFF
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => handleDeleteRule(rule.id, rule.customerName)}
                            className="p-1 rounded bg-slate-50 dark:bg-slate-850 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-205 dark:border-slate-800 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add Rule Modal */}
          <AnimatePresence>
            {isNewRuleOpen && (
              <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-lg space-y-4 text-left"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-black text-slate-900 dark:text-slate-50 uppercase tracking-widest">
                      Configure Sticky Rule
                    </h3>
                    <button
                      onClick={() => setIsNewRuleOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleAddRule} className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Select Target Client *
                      </label>
                      <select
                        required
                        value={ruleCustomerId}
                        onChange={(e) => setRuleCustomerId(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-xs dark:text-slate-105 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-- PICK A CUSTOMER --</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Sticky Rule Scope *
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Flat', 'Brand', 'SKU'] as const).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setRuleType(t)}
                            className={`py-1 rounded-lg text-xs font-bold border cursor-pointer uppercase tracking-wider text-center ${
                              ruleType === t
                                ? 'bg-blue-50 dark:bg-blue-955/40 text-blue-700 dark:text-slate-100 border-blue-400'
                                : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {ruleType === 'Brand' && (
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          Type Brand Name *
                        </label>
                        <select
                          required
                          value={ruleBrand}
                          onChange={(e) => setRuleBrand(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-xs dark:text-slate-105 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">-- SELECT BRAND --</option>
                          {uniqueBrands.map(b => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {ruleType === 'SKU' && (
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          Select Product SKU *
                        </label>
                        <select
                          required
                          value={ruleProductId}
                          onChange={(e) => setRuleProductId(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-xs dark:text-slate-105 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        >
                          <option value="">-- PICK PHYSICAL PRODUCT SKU --</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} [{p.brand || "Generic"}]
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Assigned Discount Percent *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          required
                          min={0}
                          max={100}
                          value={rulePercent}
                          onChange={(e) => setRulePercent(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="E.g., 10"
                          className="w-full pl-3 pr-8 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                        />
                        <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 font-bold text-xs pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsNewRuleOpen(false)}
                        className="flex-1 py-1.5 border border-slate-200 dark:border-slate-750 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-705 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Save Contract Rule
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
