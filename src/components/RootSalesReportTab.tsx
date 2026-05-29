import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, GitBranch, Package, ReceiptText, BarChart3 } from 'lucide-react';
import { Customer, Invoice } from '../types';

interface RootSalesReportTabProps {
  customers: Customer[];
  invoices: Invoice[];
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function RootSalesReportTab({ customers, invoices, showToast }: RootSalesReportTabProps) {
  const customerMap = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const uniqueRoots = useMemo(() => [
    'All Roots',
    ...Array.from(new Set(customers.map((customer) => customer.root?.trim()).filter(Boolean))).sort()
  ], [customers]);

  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date();
  monthStart.setDate(1);

  const [selectedRoot, setSelectedRoot] = useState('All Roots');
  const [fromDate, setFromDate] = useState(monthStart.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(today);
  const [reportRows, setReportRows] = useState<Array<{
    invoiceNumber: string;
    date: string;
    customerName: string;
    mobile: string;
    root: string;
    quantity: number;
    itemCount: number;
    totalAmount: number;
  }>>([]);

  const generateReport = () => {
    if (!fromDate || !toDate) {
      showToast("Please select valid date range", "error");
      return;
    }

    const rows = invoices
      .filter((invoice) => {
        const withinRange = invoice.date >= fromDate && invoice.date <= toDate;
        if (!withinRange) return false;

        const customer = customerMap.get(invoice.customerId);
        const customerRoot = customer?.root?.trim() || 'Unassigned';
        return selectedRoot === 'All Roots' ? true : customerRoot === selectedRoot;
      })
      .map((invoice) => {
        const customer = customerMap.get(invoice.customerId);
        const root = customer?.root?.trim() || 'Unassigned';
        const quantity = invoice.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

        return {
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.date,
          customerName: invoice.customerName,
          mobile: invoice.customerMobile,
          root,
          quantity,
          itemCount: invoice.items.length,
          totalAmount: invoice.totalAmount,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNumber.localeCompare(b.invoiceNumber));

    setReportRows(rows);
    showToast(`Generated ${rows.length} invoice rows for ${selectedRoot === 'All Roots' ? 'all roots' : selectedRoot}`, 'success');
  };

  const summary = useMemo(() => {
    const totalSales = reportRows.reduce((sum, row) => sum + row.totalAmount, 0);
    const totalQty = reportRows.reduce((sum, row) => sum + row.quantity, 0);
    return {
      invoiceCount: reportRows.length,
      totalSales,
      totalQty,
    };
  }, [reportRows]);

  const exportReport = () => {
    if (reportRows.length === 0) {
      showToast("Generate the report first before exporting.", "info");
      return;
    }

    try {
      const XLSX = (window as any).XLSX;
      if (!XLSX) {
        showToast("SheetJS library not loaded. Please try again.", "error");
        return;
      }

      const sheetData = [
        ["Invoice No", "Date", "Customer", "Mobile", "Root / Branch", "Quantity", "Item Count", "Total Amount"],
        ...reportRows.map((row) => [
          row.invoiceNumber,
          row.date,
          row.customerName,
          row.mobile,
          row.root,
          row.quantity,
          row.itemCount,
          row.totalAmount,
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Root Sales Report");
      XLSX.writeFile(wb, `Root_Sales_Report_${selectedRoot === 'All Roots' ? 'All_Roots' : selectedRoot.replace(/[^a-z0-9]+/gi, '_')}_${fromDate}_${toDate}.xlsx`);
      showToast("Exported root sales report to Excel", "success");
    } catch (err: any) {
      showToast("Failed to export report: " + err.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">Root Sales Report</h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                Compare sales by root or branch across a selected date window.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={generateReport}
            className="bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition-colors text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Generate Report
          </button>

          <button
            onClick={exportReport}
            className="bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export to Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px,220px,220px,1fr] gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 shadow-xs">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Root / Branch</label>
          <select
            value={selectedRoot}
            onChange={(e) => setSelectedRoot(e.target.value)}
            className="w-full px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs dark:text-slate-100"
          >
            {uniqueRoots.map((rootName) => (
              <option key={rootName} value={rootName}>{rootName}</option>
            ))}
          </select>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 shadow-xs">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs dark:text-slate-100"
          />
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 shadow-xs">
          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-2 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs dark:text-slate-100"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 shadow-xs">
            <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
              <ReceiptText className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-wider">Invoices</span>
            </div>
            <p className="text-xl font-extrabold text-slate-900 dark:text-slate-50">{summary.invoiceCount}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 shadow-xs">
            <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
              <Package className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-wider">Units</span>
            </div>
            <p className="text-xl font-extrabold text-slate-900 dark:text-slate-50">{summary.totalQty}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 shadow-xs">
            <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-wider">Sales</span>
            </div>
            <p className="text-xl font-extrabold text-slate-900 dark:text-slate-50">₹{summary.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden shadow-xs">
        {reportRows.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <GitBranch className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Root Sales Data Yet</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Select a root and date window, then generate the report.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoice No</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mobile</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Root / Branch</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Items</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {reportRows.map((row) => (
                  <tr key={`${row.invoiceNumber}-${row.date}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40 text-xs">
                    <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-100">{row.invoiceNumber}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{row.date}</td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 font-medium">{row.customerName}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 font-mono">{row.mobile}</td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">{row.root}</td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200 font-semibold">{row.quantity}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{row.itemCount}</td>
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-100 font-bold">₹{row.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
