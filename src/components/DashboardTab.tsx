import { Invoice, Product, Customer, Purchase, Supplier } from '../types';
import { IndianRupee, Landmark, ShieldCheck, AlertTriangle, ArrowRight, PlusCircle, UserPlus, FileText, CheckCircle2, ShoppingCart, Building2, PackageCheck } from 'lucide-react';

interface DashboardTabProps {
  invoices: Invoice[];
  products: Product[];
  customers: Customer[];
  purchases: Purchase[];
  suppliers: Supplier[];
  setActiveTab: (tab: string) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  setSelectedInvoice?: (invoice: Invoice) => void; 
}

export function DashboardTab({
  invoices,
  products,
  customers,
  purchases,
  suppliers,
  setActiveTab,
  showToast,
  setSelectedInvoice
}: DashboardTabProps) {

  // Current system date extraction (metadata states May 2026)
  const currentSystemDate = new Date("2026-05-28T06:20:30Z");
  const currentYear = currentSystemDate.getFullYear();
  const currentMonthIdx = currentSystemDate.getMonth(); // 4 for May

  // 1. Total sales (current month - May 2026)
  const currentMonthInvoices = invoices.filter(inv => {
    const invDate = new Date(inv.date);
    return invDate.getFullYear() === currentYear && invDate.getMonth() === currentMonthIdx;
  });

  const totalSalesCurrentMonth = currentMonthInvoices.reduce((sum, inv) => sum + Math.round(inv.totalAmount), 0);

  // 2. Total Tax Collected (Across all invoices of current month)
  const totalTaxCurrentMonth = currentMonthInvoices.reduce((sum, inv) => sum + inv.taxAmount, 0);

  // 3. Low stock alerts (products with stock < 5)
  const lowStockProducts = products.filter(p => p.currentStock < 5);

  // 4. Purchase module metrics
  const currentMonthPurchases = purchases.filter(purchase => {
    const purchaseDate = new Date(purchase.date);
    return purchaseDate.getFullYear() === currentYear && purchaseDate.getMonth() === currentMonthIdx;
  });
  const totalPurchasesCurrentMonth = currentMonthPurchases.reduce((sum, purchase) => sum + Math.round(purchase.grandTotal), 0);
  const stockValue = products.reduce((sum, product) => sum + (product.currentStock * product.sellingPrice), 0);
  const recentPurchases = [...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  // 5. Recent invoices (last 5)
  const recentInvoices = invoices.slice(0, 5);

  return (
    <div className="space-y-4">
      
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Billing Overview
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Real-time fiscal reporting, active tax registers, and warehouse inventory statuses.
          </p>
        </div>
        
        <div className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-extrabold px-2.5 py-1 rounded-md border border-blue-200/50">
          Last Checkpoint: May 2026
        </div>
      </div>

      {/* Numerical Metrics Grid (Bento Box style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Metric 1: Monthly Sales Volume */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-1 text-left">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">
              Sales Volume (May 2026)
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-50 font-mono tracking-tight leading-none">
              ₹{totalSalesCurrentMonth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 pt-0.5">
              <CheckCircle2 className="w-3 h-3" />
              {currentMonthInvoices.length} Invoices Active
            </p>
          </div>
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
            <IndianRupee className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Collected GST Tax */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-1 text-left">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">
              Tax collected (May 2026)
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-50 font-mono tracking-tight leading-none">
              ₹{totalTaxCurrentMonth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-400 font-semibold pt-0.5">
              GST Tax Collected Summary
            </p>
          </div>
          <div className="p-2.5 bg-slate-100 dark:bg-slate-850 rounded-lg text-slate-500 dark:text-slate-400 shrink-0">
            <Landmark className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Safe/Alert Stock Warning */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-1 text-left">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">
              Low Stock Alerts
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-50 font-mono tracking-tight leading-none flex items-baseline gap-1.5">
              <span>{lowStockProducts.length}</span>
              <span className="text-[10px] text-slate-400 font-semibold">SKUs Left</span>
            </div>
            <p className={`text-[10px] font-bold ${lowStockProducts.length > 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'} pt-0.5`}>
              {lowStockProducts.length > 0 ? "Requires restock replenishment" : "All warehouse stock safe"}
            </p>
          </div>
          <div className={`p-2.5 rounded-lg shrink-0 ${lowStockProducts.length > 0 ? 'bg-rose-55/10 text-rose-500' : 'bg-emerald-55/10 text-emerald-550'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* Purchase & Inventory Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-1 text-left">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">
              Purchases (Current Month)
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-50 font-mono tracking-tight leading-none">
              ₹{totalPurchasesCurrentMonth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5 pt-0.5">
              <ShoppingCart className="w-3 h-3" />
              {currentMonthPurchases.length} Purchase Entries
            </p>
          </div>
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400 shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-1 text-left">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">
              Active Suppliers
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-50 font-mono tracking-tight leading-none">
              {suppliers.length}
            </div>
            <p className="text-[10px] text-slate-400 font-semibold pt-0.5">
              Supplier master entries
            </p>
          </div>
          <div className="p-2.5 bg-slate-100 dark:bg-slate-850 rounded-lg text-slate-500 dark:text-slate-400 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="space-y-1 text-left">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">
              Warehouse Stock Value
            </span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-50 font-mono tracking-tight leading-none">
              ₹{stockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 pt-0.5">
              <PackageCheck className="w-3 h-3" />
              Current inventory valuation
            </p>
          </div>
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg text-emerald-600 dark:text-emerald-400 shrink-0">
            <PackageCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Quick Access Buttons */}
      <div className="bg-[#3b82f6] dark:bg-blue-950/70 rounded-xl p-4 text-white grid grid-cols-1 sm:grid-cols-3 gap-3 items-center shadow-xs">
        <div className="space-y-0.5 text-left sm:col-span-1">
          <h3 className="text-sm font-black tracking-tight text-white leading-none">
            Quick Actions Setup
          </h3>
          <p className="text-blue-100 text-[10px]">
            Initiate standard transactions, add clients instantly.
          </p>
        </div>

        <div className="sm:col-span-2 flex flex-wrap gap-2 justify-end">
          <button
            onClick={() => setActiveTab('New Invoice')}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-blue-600 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            New Invoice Draft
          </button>

          <button
            onClick={() => setActiveTab('Customers')}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Register Customer
          </button>

          <button
            onClick={() => setActiveTab('Products')}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Catalog SKU Product
          </button>
        </div>
      </div>

      {/* Inventory Alerts & Recent invoices archive Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        
        {/* Recent Invoices list */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 lg:col-span-2 space-y-3 shadow-xs text-left">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-205 uppercase tracking-wider">
              Recent Transactions List
            </h3>
            <button
              onClick={() => setActiveTab('Invoices')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              Browse Archive
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left bg-slate-50 dark:bg-slate-850/50">
                  <th className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800">Receipt ID</th>
                  <th className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800">Client Receiver</th>
                  <th className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 font-mono">Date</th>
                  <th className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 text-right">Amnt Rounded</th>
                  <th className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {recentInvoices.map(inv => (
                  <tr key={inv.id} className="text-[11px] hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200 font-mono">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">
                      {inv.customerName}
                    </td>
                    <td className="px-3 py-2 text-slate-400 font-mono">
                      {inv.date}
                    </td>
                    <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100 font-mono text-right">
                      ₹{Math.round(inv.totalAmount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2 text-right pl-3">
                      <button
                        onClick={() => {
                          if (setSelectedInvoice) {
                            setSelectedInvoice(inv);
                            setActiveTab('Invoices');
                          }
                        }}
                        className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Watch Grid */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 space-y-3 shadow-xs text-left">
          <div className="pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-205 uppercase tracking-wider flex items-center gap-1.5">
              Refill Inventory Alerts
            </h3>
          </div>

          <div className="space-y-2">
            {lowStockProducts.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs font-semibold">
                🎉 No stock alerts! Warehouse full.
              </div>
            ) : (
              lowStockProducts.map(p => (
                <div
                  key={p.id}
                  className="p-2.5 bg-rose-50/40 dark:bg-rose-950/15 border border-rose-100/50 dark:border-rose-900/35 rounded-lg flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]" title={p.name}>
                      {p.name}
                    </div>
                    <div className="text-[9px] text-slate-400 font-mono leading-none">Part: {p.partNumber}</div>
                  </div>

                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-black ${p.currentStock === 0 ? 'bg-rose-600 text-white animate-pulse' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400'}`}>
                    {p.currentStock} Left
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 space-y-3 shadow-xs text-left">
        <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-205 uppercase tracking-wider">
            Recent Purchases
          </h3>
          <button
            onClick={() => setActiveTab('Purchases')}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            Manage Purchases
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-left bg-slate-50 dark:bg-slate-850/50">
                <th className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800">Purchase No</th>
                <th className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800">Supplier</th>
                <th className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 font-mono">Date</th>
                <th className="px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {recentPurchases.map(purchase => (
                <tr key={purchase.id} className="text-[11px] hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                  <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200 font-mono">
                    {purchase.purchaseNumber}
                  </td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-medium">
                    {purchase.supplierName}
                  </td>
                  <td className="px-3 py-2 text-slate-400 font-mono">
                    {purchase.date}
                  </td>
                  <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100 font-mono text-right">
                    ₹{purchase.grandTotal.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
