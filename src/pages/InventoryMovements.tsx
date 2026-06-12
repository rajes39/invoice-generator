import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Search, History, ArrowUpRight, ArrowDownLeft, Loader, Calendar, Package } from 'lucide-react';

export default function InventoryMovements() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['stock_ledger'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_ledger')
        .select('*, product:products(name), warehouse:warehouses(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const filteredMovements = useMemo(() => {
    return movements.filter((m: any) => {
      const matchesSearch = (m.product?.name || '').toLowerCase().includes(search.toLowerCase()) || 
                           (m.reference_id || '').toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'All' || m.transaction_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [movements, search, typeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Inventory Movements</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Audit trail of all stock additions and deductions.</p>
        </div>
      </div>

      <div className="glass-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Product or Ref No..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="All">All Movements</option>
            <option value="In">Stock In (+)</option>
            <option value="Out">Stock Out (-)</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3 text-center">Type</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader className="w-6 h-6 animate-spin mx-auto text-indigo-600" /></td></tr>
              ) : filteredMovements.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500 italic">No movements found.</td></tr>
              ) : (
                filteredMovements.map((m: any) => (
                  <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(m.created_at).toLocaleDateString()} 
                        <span className="text-[10px] opacity-50">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{m.product?.name}</div>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {m.warehouse?.name}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${m.transaction_type === 'In' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {m.transaction_type === 'In' ? <ArrowDownLeft className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
                        {m.transaction_type}
                      </span>
                    </td>
                    <td className={`px-4 py-4 text-right font-black ${m.transaction_type === 'In' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {m.transaction_type === 'In' ? '+' : '-'}{Math.abs(m.quantity)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{m.reference_type}</div>
                      <div className="font-mono text-xs text-indigo-600 font-bold">{m.reference_id?.slice(-8) || '-'}</div>
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
