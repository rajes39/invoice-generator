import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import DashboardCards from '../components/DashboardCards';
import { notificationService, Notification } from '../services/notificationService';
import { Bell, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import type { Invoice, Product } from '../types';

async function fetchDashboardMetrics() {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const [
    { data: invoices }, 
    { count: totalCustomers }, 
    { count: totalProducts },
    { data: products },
    { data: notifications }
  ] = await Promise.all([
    supabase.from('invoices').select('id,invoice_no,customer_name,date,grand_total,total_cgst,total_sgst,total_igst,status').eq('user_id', userId),
    supabase.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('products').select('id,stock,reorder_level').eq('user_id', userId),
    notificationService.fetchNotifications()
  ]);

  return {
    invoices: invoices ?? [],
    totalCustomers: totalCustomers ?? 0,
    totalProducts: totalProducts ?? 0,
    products: products ?? [],
    notifications: notifications ?? []
  };
}

export default function Dashboard() {
  const { data: metrics, isLoading } = useQuery({ 
    queryKey: ['dashboardMetrics'], 
    queryFn: fetchDashboardMetrics,
    refetchInterval: 30000 // Refetch every 30 seconds for real-time feel
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const salesTotal = metrics?.invoices.reduce((sum, inv) => sum + Number(inv.grand_total ?? 0), 0) ?? 0;
  const gstCollected = metrics?.invoices.reduce((sum, inv) => sum + Number(inv.total_cgst ?? 0) + Number(inv.total_sgst ?? 0) + Number(inv.total_igst ?? 0), 0) ?? 0;
  const pendingInvoices = metrics?.invoices.filter((inv) => inv.status !== 'Paid').length ?? 0;
  const lowStockCount = metrics?.products?.filter((p) => Number(p.stock) <= Number(p.reorder_level)).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">ERP Dashboard</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Real-time business overview and automated alerts.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <DashboardCards label="Total Sales" value={`₹${salesTotal.toLocaleString()}`} />
        <DashboardCards label="GST Collected" value={`₹${gstCollected.toLocaleString()}`} />
        <DashboardCards label="Pending Bills" value={pendingInvoices.toString()} />
        <DashboardCards label="Customers" value={metrics?.totalCustomers.toString() ?? '0'} />
        <DashboardCards label="Products" value={metrics?.totalProducts.toString() ?? '0'} />
        <DashboardCards label="Stock Alerts" value={lowStockCount.toString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Notifications */}
        <div className="lg:col-span-1 glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600" />
              Notifications
            </h3>
          </div>
          <div className="space-y-4">
            {metrics?.notifications.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No recent alerts.</p>
            ) : (
              metrics?.notifications.map((n: Notification) => (
                <div key={n.id} className={`p-3 rounded-2xl border ${n.is_read ? 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800' : 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-900/50'} flex gap-3`}>
                  <div className="shrink-0">
                    {n.type === 'stock_low' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                    {n.type === 'system' && <Clock className="w-5 h-5 text-blue-500" />}
                    {n.type === 'payment_due' && <Clock className="w-5 h-5 text-rose-500" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{n.title}</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{n.message}</p>
                    <span className="text-[9px] text-slate-400 mt-2 block">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity / Invoices */}
        <div className="lg:col-span-2 glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Invoices</h2>
            <button className="text-sm text-indigo-600 font-bold hover:underline">View All</button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-slate-400">
                  <th className="px-3 py-3">Invoice #</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                  <th className="px-3 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.invoices.slice(0, 5).map((invoice: any) => (
                  <tr key={invoice.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-3 py-4 font-mono font-bold text-slate-900 dark:text-slate-100">{invoice.invoice_number || invoice.invoice_no}</td>
                    <td className="px-3 py-4">{invoice.customer_name}</td>
                    <td className="px-3 py-4 text-slate-500">{invoice.date}</td>
                    <td className="px-3 py-4 text-right font-bold font-mono">₹{Number(invoice.grand_total).toLocaleString()}</td>
                    <td className="px-3 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                        {invoice.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
