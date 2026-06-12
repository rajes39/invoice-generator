import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Search, Plus, FileText, User, Calendar, Loader, ChevronRight } from 'lucide-react';

export default function PurchaseOrders() {
  const [search, setSearch] = useState('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['purchase_orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, supplier:suppliers(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const filteredOrders = useMemo(() => {
    return orders.filter((o: any) => 
      (o.po_number || '').toLowerCase().includes(search.toLowerCase()) || 
      (o.supplier?.name || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [orders, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Orders</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage and track procurement from your suppliers.</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition shadow-sm">
          <Plus className="w-4 h-4" />
          Create Purchase Order
        </button>
      </div>

      <div className="glass-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by PO No or Supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">PO Number</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader className="w-6 h-6 animate-spin mx-auto text-indigo-600" /></td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500 italic">No purchase orders found.</td></tr>
              ) : (
                filteredOrders.map((o: any) => (
                  <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-4 font-mono font-bold text-slate-900 dark:text-slate-100">{o.po_number || 'N/A'}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {o.supplier?.name}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-500 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {o.date}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-black">₹{Number(o.total_amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        o.status === 'Received' ? 'bg-emerald-100 text-emerald-700' : 
                        o.status === 'Draft' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {o.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
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
