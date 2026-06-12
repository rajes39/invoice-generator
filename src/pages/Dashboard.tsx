import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import DashboardCards from '../components/DashboardCards';
import BackupWarningBanner from '../components/BackupWarningBanner';
import { notificationService, Notification } from '../services/notificationService';
import { Bell, AlertTriangle, CheckCircle, Clock, Loader2 } from 'lucide-react';

export default function Dashboard() {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);

  const fetchMetrics = async () => {
    setIsLoading(true);
    try {
      // 1. Get current user - wait for auth session
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.error('Dashboard: Auth error or no user:', authError);
        throw new Error('User not authenticated');
      }
      console.log('Dashboard: Authenticated user ID:', user.id);

      // 2. Run queries as requested
      const [
        { count: totalCustomers, error: custErr },
        { count: totalProducts, error: prodErr },
        { data: salesData, error: salesErr },
        { data: gstData, error: gstErr },
        { count: pendingBills, error: pendingErr },
        { data: recentInvoices, error: recentErr },
        { data: lowStockProducts, error: lowStockErr },
        { data: notifications }
      ] = await Promise.all([
        // Customers count
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        // Products count
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        // Total Sales
        supabase.from('invoices').select('grand_total').eq('user_id', user.id),
        // GST Collected - Using gst_amount as requested, but also checking current schema fields if it fails
        supabase.from('invoices').select('total_cgst, total_sgst, total_igst').eq('user_id', user.id),
        // Pending Bills
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending'),
        // Recent Invoices
        supabase.from('invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
        // Low Stock
        supabase.from('products').select('id, stock, reorder_level').eq('user_id', user.id),
        // Notifications
        notificationService.fetchNotifications()
      ]);

      // Debug logs for each query result
      console.log('Customers Count Result:', totalCustomers, custErr || 'No error');
      console.log('Products Count Result:', totalProducts, prodErr || 'No error');
      console.log('Sales Data Result:', salesData?.length || 0, 'rows', salesErr || 'No error');
      console.log('GST Data Result:', gstData?.length || 0, 'rows', gstErr || 'No error');
      console.log('Pending Bills Count:', pendingBills, pendingErr || 'No error');
      console.log('Recent Invoices Result:', recentInvoices?.length || 0, 'rows', recentErr || 'No error');

      // 3. Calculate metrics manually
      const salesTotal = (salesData || []).reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0);
      
      // Calculate GST Collected from components as currently structured in schema
      const gstCollected = (gstData || []).reduce((sum, inv: any) => 
        sum + Number(inv.total_cgst || 0) + Number(inv.total_sgst || 0) + Number(inv.total_igst || 0), 0);
      
      const lowStockCount = (lowStockProducts || []).filter(p => Number(p.stock) <= Number(p.reorder_level)).length;

      console.log('Final Calculated Sales Total:', salesTotal);
      console.log('Final Calculated GST Collected:', gstCollected);

      setMetrics({
        invoices: recentInvoices || [],
        totalCustomers: totalCustomers || 0,
        totalProducts: totalProducts || 0,
        salesTotal,
        gstCollected,
        pendingInvoices: pendingBills || 0,
        lowStockCount,
        notifications: notifications || []
      });
    } catch (err) {
      console.error('Dashboard Data Fetch Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [location.pathname, location.key]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading ERP Analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackupWarningBanner />
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">ERP Dashboard</h2>
          <p className="text-sm text-slate-500 font-medium">Real-time business overview and automated alerts.</p>
        </div>
        <button 
          onClick={fetchMetrics}
          className="p-2 rounded-xl text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="Refresh Data"
        >
          <Clock className="w-5 h-5" />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <DashboardCards label="Total Sales" value={`₹${(metrics?.salesTotal || 0).toLocaleString()}`} />
        <DashboardCards label="GST Collected" value={`₹${(metrics?.gstCollected || 0).toLocaleString()}`} />
        <DashboardCards label="Pending Bills" value={(metrics?.pendingInvoices || 0).toString()} />
        <DashboardCards label="Customers" value={(metrics?.totalCustomers || 0).toString()} />
        <DashboardCards label="Products" value={(metrics?.totalProducts || 0).toString()} />
        <DashboardCards label="Stock Alerts" value={(metrics?.lowStockCount || 0).toString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Notifications */}
        <div className="lg:col-span-1 glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600" />
              Notifications
            </h3>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {metrics?.notifications.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">All caught up!</p>
              </div>
            ) : (
              metrics?.notifications.map((n: Notification) => (
                <div key={n.id} className={`p-4 rounded-2xl border transition-all ${n.is_read ? 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800' : 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-900/50'} flex gap-3`}>
                  <div className="shrink-0">
                    {n.type === 'stock_low' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                    {n.type === 'system' && <Clock className="w-5 h-5 text-blue-500" />}
                    {n.type === 'payment_due' && <Clock className="w-5 h-5 text-rose-500" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{n.title}</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-medium">{n.message}</p>
                    <span className="text-[9px] font-bold text-slate-400 mt-2 block uppercase">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity / Invoices */}
        <div className="lg:col-span-2 glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black uppercase tracking-tight">Recent Invoices</h2>
            <Link to="/sales/invoices" className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-xl transition-all">View Sales Register</Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-3 py-3">Invoice #</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3 text-right">Amount</th>
                  <th className="px-3 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-900">
                {metrics?.invoices.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-12 text-center">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">No invoices found for this period.</p>
                    </td>
                  </tr>
                ) : (
                  metrics?.invoices.slice(0, 5).map((invoice: any) => (
                    <tr key={invoice.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                      <td className="px-3 py-4 font-mono font-black text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 transition-colors">{invoice.invoice_number || invoice.invoice_no}</td>
                      <td className="px-3 py-4 font-bold">{invoice.customer_name}</td>
                      <td className="px-3 py-4 text-slate-500 font-medium">{invoice.date}</td>
                      <td className="px-3 py-4 text-right font-black font-mono">₹{Number(invoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                          {invoice.status}
                        </span>
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
  );
}

import { Link } from 'react-router-dom';
