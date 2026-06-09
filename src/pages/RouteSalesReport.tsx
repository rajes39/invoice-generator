import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Invoice } from '../types';

function buildCsv(rows: string[][]) {
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export default function RouteSalesReport() {
  const [fromDate, setFromDate] = useState(new Date().toISOString().slice(0, 7) + '-01');
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['routeSalesReport', fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .gte('date', fromDate)
        .lte('date', toDate)
        .order('date', { ascending: false });
      return data ?? [];
    },
  });

  const routeWiseSummary = useMemo(() => {
    const summary: Record<string, { totalSales: number; totalGst: number; invoiceCount: number }> = {};
    
    invoices.forEach((invoice: Invoice) => {
      const route = invoice.routeName || 'No Route';
      if (!summary[route]) {
        summary[route] = { totalSales: 0, totalGst: 0, invoiceCount: 0 };
      }
      summary[route].totalSales += Number(invoice.grand_total ?? 0);
      summary[route].totalGst += Number(invoice.total_cgst ?? 0) + Number(invoice.total_sgst ?? 0) + Number(invoice.total_igst ?? 0);
      summary[route].invoiceCount += 1;
    });

    return Object.entries(summary).map(([name, data]) => ({
      name,
      ...data,
    })).sort((a, b) => b.totalSales - a.totalSales);
  }, [invoices]);

  const exportExcel = () => {
    const rows = [['Route Name', 'Invoice Count', 'Total GST', 'Total Sales']];
    routeWiseSummary.forEach((r) => {
      rows.push([r.name, r.invoiceCount.toString(), r.totalGst.toFixed(2), r.totalSales.toFixed(2)]);
    });
    
    const csvContent = buildCsv(rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `route-sales-report-${fromDate}-to-${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Route-wise Sales Report</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Analyze sales performance grouped by delivery routes.</p>
        </div>
        <button
          onClick={exportExcel}
          className="inline-flex items-center justify-center rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
        >
          Download Excel (CSV)
        </button>
      </div>

      <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <span>From Date</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <span>To Date</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        </div>
      </div>

      <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead>
              <tr className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                <th className="px-3 py-3">Route Name</th>
                <th className="px-3 py-3 text-right">Invoice Count</th>
                <th className="px-3 py-3 text-right">Total GST</th>
                <th className="px-3 py-3 text-right">Total Sales</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500">Loading data...</td>
                </tr>
              ) : routeWiseSummary.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-500">No sales found for selected range.</td>
                </tr>
              ) : (
                routeWiseSummary.map((route) => (
                  <tr key={route.name} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">{route.name}</td>
                    <td className="px-3 py-3 text-right">{route.invoiceCount}</td>
                    <td className="px-3 py-3 text-right">₹{route.totalGst.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-semibold">₹{route.totalSales.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
