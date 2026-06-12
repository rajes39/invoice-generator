import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Search, Package, MapPin, AlertTriangle, Loader, Download } from 'lucide-react';
import { downloadCsv } from '../lib/csv';

export default function Stock() {
  const [search, setSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('All');

  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products_stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('warehouses').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const filteredStock = useMemo(() => {
    return products.filter((p: any) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                           (p.part_no || '').toLowerCase().includes(search.toLowerCase());
      // For now, warehouse filtering is simple as we don't have a many-to-many warehouse-stock table
      // In a real ERP, we'd query a `warehouse_stock` table.
      return matchesSearch;
    });
  }, [products, search]);

  const handleExport = () => {
    const headers = ['Name', 'Part No', 'Category', 'Current Stock', 'Reorder Level', 'Unit'];
    const data = filteredStock.map((p: any) => ({
      Name: p.name,
      'Part No': p.part_no || p.sku || '',
      Category: p.category || '',
      'Current Stock': p.stock,
      'Reorder Level': p.reorder_level || 0,
      Unit: p.unit || 'pcs'
    }));
    downloadCsv(headers, data, 'current_stock_report.csv');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Inventory Stock</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Real-time visibility into your current stock levels across all locations.</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export Stock Report
        </button>
      </div>

      <div className="glass-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Product Name or Part No..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-400" />
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="All">All Warehouses</option>
              {warehouses.map((w: any) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">Product Description</th>
                <th className="px-4 py-3">Part No / SKU</th>
                <th className="px-4 py-3 text-center">Stock Level</th>
                <th className="px-4 py-3 text-center">Reorder Level</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {isLoadingProducts ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center"><Loader className="w-6 h-6 animate-spin mx-auto text-indigo-600" /></td></tr>
              ) : filteredStock.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500 italic">No products found.</td></tr>
              ) : (
                filteredStock.map((p: any) => {
                  const isLowStock = Number(p.stock) <= Number(p.reorder_level || 0);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{p.name}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-tighter">{p.category || 'Uncategorized'}</div>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs">{p.part_no || p.sku || '-'}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`text-lg font-black ${isLowStock ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {p.stock}
                        </span>
                        <span className="ml-1 text-[10px] font-bold text-slate-400 uppercase">{p.unit || 'pcs'}</span>
                      </td>
                      <td className="px-4 py-4 text-center font-bold text-slate-500">{p.reorder_level || 0}</td>
                      <td className="px-4 py-4 text-center">
                        {isLowStock ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase text-rose-700">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">
                            Healthy
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
