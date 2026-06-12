import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Search, Package, MapPin, AlertTriangle, Loader, Download } from 'lucide-react';
import { downloadCsv } from '../lib/csv';

export default function Stock() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // -- Adjustment State --
  const [adjProductId, setAdjProductId] = useState('');
  const [adjProductName, setAdjProductName] = useState('');
  const [adjWarehouseId, setAdjWarehouseId] = useState('');
  const [adjQty, setAdjQty] = useState<number>(0);
  const [adjType, setAdjType] = useState<'In' | 'Out'>('In');
  const [adjReason, setAdjReason] = useState('');

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
    queryKey: ['warehouses_all'],
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

  const saveAdjustment = async () => {
    if (!adjProductId || !adjWarehouseId || adjQty <= 0) {
      toast.error('Please fill all fields correctly');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');

      // 1. Insert Stock Ledger Entry
      const { error: ledgerError } = await supabase.from('stock_ledger').insert([{
        user_id: session.user.id,
        product_id: adjProductId,
        warehouse_id: adjWarehouseId,
        quantity: adjType === 'In' ? adjQty : -adjQty,
        transaction_type: adjType,
        reference_type: 'Manual Adjustment',
        reference_id: `ADJ-${Date.now().toString().slice(-6)}`,
        notes: adjReason
      }]);

      if (ledgerError) throw ledgerError;

      // 2. Update Product Stock (Atomic increment/decrement would be better via RPC)
      const currentProd = products.find((p: any) => p.id === adjProductId);
      const newStock = adjType === 'In' ? (Number(currentProd.stock) + adjQty) : (Number(currentProd.stock) - adjQty);
      
      const { error: prodError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', adjProductId);

      if (prodError) throw prodError;

      toast.success('Stock adjusted successfully!');
      queryClient.invalidateQueries({ queryKey: ['products_stock'] });
      setIsModalOpen(false);
      resetAdjForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust stock');
    } finally {
      setIsSaving(false);
    }
  };

  const resetAdjForm = () => {
    setAdjProductId('');
    setAdjProductName('');
    setAdjWarehouseId('');
    setAdjQty(0);
    setAdjReason('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Inventory Stock</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Real-time visibility into your current stock levels across all locations.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Manual Adjustment
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export Stock Report
          </button>
        </div>
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

      {/* Manual Adjustment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Manual Stock Adjustment</h3>
              <button onClick={() => setIsModalOpen(false)} className="rounded-xl p-2 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Product</label>
                <SearchableDropdown
                  table="products"
                  displayField="name"
                  searchFields={['name', 'part_no']}
                  onSelect={(p) => {
                    setAdjProductId(p.id);
                    setAdjProductName(p.name);
                  }}
                  placeholder="Select Product..."
                  value={adjProductName}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Warehouse</label>
                <select
                  value={adjWarehouseId}
                  onChange={(e) => setAdjWarehouseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">Select Warehouse...</option>
                  {warehouses.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Adj Type</label>
                  <select
                    value={adjType}
                    onChange={(e) => setAdjType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none font-bold"
                  >
                    <option value="In">Add Stock (+)</option>
                    <option value="Out">Remove Stock (-)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Qty</label>
                  <input
                    type="number"
                    value={adjQty}
                    onChange={(e) => setAdjQty(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none font-black text-indigo-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reason / Remarks</label>
                <textarea
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="E.g. Damaged, Correction, etc."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none min-h-[80px]"
                />
              </div>

              <button
                disabled={isSaving}
                onClick={saveAdjustment}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20"
              >
                {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                Post Adjustment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

