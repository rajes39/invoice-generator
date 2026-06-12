import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Search, Plus, FileText, User, Calendar, Loader, ChevronRight, X, Trash2, Package } from 'lucide-react';
import { SearchableDropdown } from '../components/SearchableDropdown';
import toast from 'react-hot-toast';

interface POItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export default function PurchaseOrders() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // -- Form State --
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDate, setExpectedDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lineItems, setLineItems] = useState<POItem[]>([]);
  
  // -- Line Item Input State --
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProductName, setSelectedProductName] = useState('');
  const [qty, setQty] = useState<number>(1);
  const [rate, setRate] = useState<number>(0);

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

  const { data: products = [] } = useQuery({
    queryKey: ['products_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('name');
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

  const addLineItem = () => {
    if (!selectedProductId || qty <= 0) {
      toast.error('Please select a product and quantity');
      return;
    }
    setLineItems([...lineItems, { 
      product_id: selectedProductId, 
      product_name: selectedProductName, 
      quantity: qty, 
      unit_price: rate 
    }]);
    setSelectedProductId('');
    setSelectedProductName('');
    setQty(1);
    setRate(0);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const savePO = async () => {
    if (!selectedSupplierId || lineItems.length === 0) {
      toast.error('Please select a supplier and add at least one item');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');

      const po_number = `PO-${Date.now().toString().slice(-6)}`;

      // 1. Insert Header
      const { data: header, error: headerError } = await supabase
        .from('purchase_orders')
        .insert([{
          user_id: session.user.id,
          supplier_id: selectedSupplierId,
          po_number,
          date: poDate,
          total_amount: totalAmount,
          remarks,
          status: 'Pending'
        }])
        .select()
        .single();

      if (headerError) throw headerError;

      // 2. Insert Items
      const itemsToInsert = lineItems.map(item => ({
        user_id: session.user.id,
        po_id: header.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price
      }));

      const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      toast.success(`Purchase Order ${po_number} created!`);
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      setIsFormOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save PO');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedSupplierId('');
    setLineItems([]);
    setRemarks('');
    setPoDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Orders</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage and track procurement from your suppliers.</p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition shadow-sm"
        >
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
                <th className="px-4 py-3 text-right">Total Amount</th>
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
                    <td className="px-4 py-4 text-right font-black">₹{Number(o.total_amount || 0).toLocaleString()}</td>
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

      {/* Create PO Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">New Purchase Order</h3>
                <p className="text-xs text-slate-500">Generate a procurement request for a supplier.</p>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mb-8">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Supplier</label>
                <SearchableDropdown
                  table="suppliers"
                  displayField="name"
                  searchFields={['name', 'gstin']}
                  onSelect={(s) => setSelectedSupplierId(s.id)}
                  placeholder="Select Supplier..."
                  value={selectedSupplierId ? (orders.find((o: any) => o.supplier_id === selectedSupplierId)?.supplier?.name || '') : ''}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">PO Date</label>
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
                />
              </div>
            </div>

            {/* Line Item Adder */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl mb-6 border border-slate-100 dark:border-slate-800">
              <div className="grid gap-4 md:grid-cols-4 items-end">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Product</label>
                  <SearchableDropdown
                    table="products"
                    displayField="name"
                    searchFields={['name', 'part_no']}
                    onSelect={(p) => {
                      setSelectedProductId(p.id);
                      setSelectedProductName(p.name);
                      setRate(Number(p.purchase_price || 0));
                    }}
                    placeholder="Search Product..."
                    value={selectedProductName}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Qty</label>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none"
                  />
                </div>
                <button
                  onClick={addLineItem}
                  className="bg-indigo-600 text-white rounded-xl px-4 py-2 text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="mb-8 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lineItems.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No items added yet.</td></tr>
                  ) : (
                    lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 font-bold">{item.product_name}</td>
                        <td className="px-4 py-3 text-center font-mono">{item.quantity}</td>
                        <td className="px-4 py-3 text-right font-mono">₹{item.unit_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-black">₹{(item.quantity * item.unit_price).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => removeLineItem(idx)} className="text-rose-500 hover:text-rose-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {lineItems.length > 0 && (
                  <tfoot className="bg-slate-50 dark:bg-slate-900/50 font-black">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right text-[10px] uppercase text-slate-500">Grand Total</td>
                      <td className="px-4 py-3 text-right text-indigo-600">₹{totalAmount.toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="flex justify-end gap-3">
              <button disabled={isSaving} onClick={() => setIsFormOpen(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button
                disabled={isSaving || lineItems.length === 0}
                onClick={savePO}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-2.5 text-sm font-black text-white hover:bg-indigo-700 shadow-lg disabled:opacity-50"
              >
                {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
