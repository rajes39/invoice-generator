import { useMemo, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  FileSpreadsheet, 
  Users, 
  TrendingUp, 
  BarChart3, 
  Download, 
  DollarSign, 
  Tags,
  Search,
  ShoppingCart
} from 'lucide-react';
import { Customer, Invoice } from '../types';

interface SalesReportTabProps {
  customers: Customer[];
  invoices: Invoice[];
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function SalesReportTab({
  customers,
  invoices,
  showToast
}: SalesReportTabProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Calculate aggregated Customer-Wise sales metrics
  const customerSalesMetrics = useMemo(() => {
    return customers.map(cust => {
      const custInvoices = invoices.filter(inv => inv.customerId === cust.id);
      
      const salesCount = custInvoices.length;
      const totalTaxable = custInvoices.reduce((sum, inv) => sum + inv.subtotal, 0);
      const totalTax = custInvoices.reduce((sum, inv) => sum + inv.taxAmount, 0);
      const grossSales = custInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

      return {
        id: cust.id,
        name: cust.name,
        gstin: cust.gstin || "URD",
        mobile: cust.mobile || "N/A",
        state: cust.state,
        salesCount,
        totalTaxable,
        totalTax,
        grossSales
      };
    });
  }, [customers, invoices]);

  // Overall sums for KPI boxes
  const aggregateTotals = useMemo(() => {
    return customerSalesMetrics.reduce((totals, row) => {
      totals.taxable += row.totalTaxable;
      totals.tax += row.totalTax;
      totals.gross += row.grossSales;
      totals.count += row.salesCount;
      return totals;
    }, { taxable: 0, tax: 0, gross: 0, count: 0 });
  }, [customerSalesMetrics]);

  // Sorted list of top buyers for the visual chart
  const topBuyersChartData = useMemo(() => {
    return [...customerSalesMetrics]
      .filter(row => row.grossSales > 0)
      .sort((a, b) => b.grossSales - a.grossSales)
      .slice(0, 5)
      .map(row => ({
        name: row.name.length > 15 ? `${row.name.slice(0, 12)}...` : row.name,
        fullName: row.name,
        "Gross Purchases (₹)": Math.round(row.grossSales)
      }));
  }, [customerSalesMetrics]);

  // Filter calculations based on search query
  const filteredMetrics = customerSalesMetrics.filter(row =>
    row.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.gstin.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.mobile.includes(searchQuery)
  );

  // 2. Export Master CSV spreadsheet
  const handleExportCSV = () => {
    let csv = "SONALI ERP - Customer-Wise Sales Aggregate Report\n";
    csv += `Date Generated: ${new Date().toISOString().split('T')[0]}\n\n`;
    csv += "Customer Name,GSTIN Account Code,Contact Mobile,Billing Invoices Count,Taxable Value (₹),VAT / GST Tax (₹),Total Gross Sales Sales (₹),Jurisdiction State\n";

    customerSalesMetrics.forEach(row => {
      csv += `"${row.name}","${row.gstin}","${row.mobile}",${row.salesCount},${row.totalTaxable.toFixed(2)},${row.totalTax.toFixed(2)},${row.grossSales.toFixed(2)},"${row.state}"\n`;
    });

    csv += `\nAggregate Total Record Sums,,-,${aggregateTotals.count},${aggregateTotals.taxable.toFixed(2)},${aggregateTotals.tax.toFixed(2)},${aggregateTotals.gross.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Customer_Wise_Sales_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Master Customer-wise Sales Report Spreadsheet downloaded!", "success");
  };

  return (
    <div className="space-y-4 font-sans text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Sales & Taxation Report
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Aggregated corporate records summarizing billing counts, taxable bases, and GST collection amounts per customer accounts.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="bg-indigo-600 hover:bg-indigo-555 text-white transition-colors cursor-pointer text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Export Customer-wise Sales to Excel
        </button>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-left shadow-xs">
          <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest block">Total Billing Invoices</span>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-slate-100 mt-1">{aggregateTotals.count} Slips</div>
          <span className="text-[9.5px] text-slate-450 block mt-0.5">Across active customer profiles</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-left shadow-xs">
          <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest block">Aggregate Taxable Subtotal</span>
          <div className="text-xl font-black font-mono text-slate-900 dark:text-slate-100 mt-1">₹{aggregateTotals.taxable.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</div>
          <span className="text-[9.5px] text-slate-450 block mt-0.5 font-sans">Pre-tax merchandise volumes</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-left shadow-xs">
          <span className="text-[9px] text-slate-400 uppercase font-black tracking-widest block">Collected GST Tax Pool</span>
          <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">₹{aggregateTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</div>
          <span className="text-[9.5px] text-slate-450 block mt-0.5">CGST, SGST, & IGST accounts</span>
        </div>

        <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-xl p-4 border border-slate-800 text-left shadow-xs">
          <span className="text-[9px] text-indigo-400 uppercase font-black tracking-widest block">Gross Billing Volume</span>
          <div className="text-xl font-black font-mono mt-1">₹{aggregateTotals.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <span className="text-[9.5px] text-slate-400 block mt-0.5 font-sans">Total revenue after tax</span>
        </div>
      </div>

      {/* Visual top accounts buyers and detail lists panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Horizontal purchase volume graph */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-xl text-left shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black text-slate-805 dark:text-slate-100 uppercase tracking-widest flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              Top 5 Customer Purchases
            </h3>
            <span className="text-[10px] text-slate-400 block leading-tight">Purchased volume sums (₹ Gross GST-Inclusive).</span>
          </div>

          <div className="h-52 w-full mt-4 text-[9px] font-mono select-none">
            {topBuyersChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No purchases registered yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topBuyersChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <XAxis type="number" stroke="#94a3b8" fontSize={8} tickFormatter={(v) => `₹${v/1000}k`} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={8} width={65} />
                  <Tooltip 
                    formatter={(value) => [`₹${value.toLocaleString()}`, "Purchases"]}
                    contentStyle={{ fontSize: '10px', background: '#0f172a', color: '#fff', borderRadius: '8px' }}
                  />
                  <Bar dataKey="Gross Purchases (₹)" fill="#217346" radius={[0, 4, 4, 0]}>
                    {topBuyersChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#217346' : index === 1 ? '#2E8B57' : '#3cb371'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Client summaries list table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col justify-between">
          <div>
            {/* Table title with master search input */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-955 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5 justify-between items-start sm:items-center">
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1">
                <Users className="w-4 h-4 text-slate-455" />
                Customer-wise Consolidated Statement Matrix
              </span>
              <div className="w-full sm:w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 flex items-center gap-1.5 shadow-2xs">
                <Search className="w-3 h-3 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Filter client records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-[10px] bg-transparent border-none focus:outline-none dark:text-slate-150"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-155 dark:border-slate-800 text-[9px] uppercase font-bold text-slate-500 whitespace-nowrap">
                    <th className="py-2.5 px-4">Client Name</th>
                    <th className="py-2.5 px-3">Gstin Account</th>
                    <th className="py-2.5 px-3 text-center">Billed Slips</th>
                    <th className="py-2.5 px-3 text-right">Taxable base (₹)</th>
                    <th className="py-2.5 px-3 text-right">GST Collect (₹)</th>
                    <th className="py-2.5 px-4 text-right pr-6">Gross Sales (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {filteredMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                        No customer sales summaries found.
                      </td>
                    </tr>
                  ) : (
                    filteredMetrics.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-955/20 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-100">
                          <div>{row.name}</div>
                          <div className="text-[9px] text-slate-400 font-normal mt-0.5 font-mono">PH: {row.mobile}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px] font-bold select-all">{row.gstin}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-705 dark:text-slate-300 font-semibold">{row.salesCount} Invoices</td>
                        <td className="py-2.5 px-3 text-right font-mono">₹{row.totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600">₹{row.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white pr-6">
                          ₹{row.grossSales.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
