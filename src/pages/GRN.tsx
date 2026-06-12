import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Search, Plus, Loader, Package, Calendar, User, FileText, CheckCircle, Clock, Trash2, X } from 'lucide-react';
import { SearchableDropdown } from '../components/SearchableDropdown';
import toast from 'react-hot-toast';

type GRNStatus = 'Draft' | 'Confirmed';

interface GRNHeader {
  id: string;
  grn_no: string;
  supplier_id: string;
  po_id: string;
  date: string;
  warehouse_id: string;
  status: GRNStatus;
  remarks: string;
  total_amount: number;
  supplier?: { name: string };
  purchase_order?: { po_number: string };
  warehouse?: { name: string };
}

interface GRNItem {
  product_id: string;
  product_name?: string;
  part_no?: string;
  ordered_qty: number;
  received_qty: number;
  unit_rate: number;
  line_amount: number;
}

export default function GRN() {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // -- Form State --
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedPoId, setSelectedPoId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [lineItems, setLineItems] = useState<GRNItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // -- Data Fetching --
  const { data: grns = [], isLoading: isLoadingGrns } = useQuery({
    queryKey: ['grn_headers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grn_headers')
        .select('*, supplier:suppliers(name), purchase_order:purchase_orders(po_number), warehouse:warehouses(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as GRNHeader[];
    }
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ['purchase_orders', selectedSupplierId],
    enabled: !!selectedSupplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('supplier_id', selectedSupplierId)
        .neq('status', 'Received');
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

  // Load PO items when PO is selected
  const handlePoSelect = async (po: any) => {
    setSelectedPoId(po.id);
    try {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('*, product:products(name, part_no)')
        .eq('po_id', po.id);
      
      if (error) throw error;

      const items = data.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product?.name,
        part_no: item.product?.part_no,
        ordered_qty: Number(item.quantity),
        received_qty: Number(item.quantity), // Default to full receipt
        unit_rate: Number(item.unit_price),
        line_amount: Number(item.amount)
      }));
      setLineItems(items);
    } catch (err) {
      toast.error('Failed to load PO items');
    }
  };

  const updateLineQty = (index: number, qty: number) => {
    const newItems = [...lineItems];
    newItems[index].received_qty = qty;
    newItems[index].line_amount = qty * newItems[index].unit_rate;
    setLineItems(newItems);
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + item.line_amount, 0);

  const saveGRN = async (status: GRNStatus) => {
    if (!selectedSupplierId || !selectedPoId || !selectedWarehouseId || lineItems.length === 0) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');

      const grn_no = `GRN-${Date.now().toString().slice(-6)}`;

      // 1. Insert Header
      const { data: header, error: headerError } = await supabase
        .from('grn_headers')
        .insert([{
          user_id: session.user.id,
          grn_no,
          supplier_id: selectedSupplierId,
          po_id: selectedPoId,
          date: receiptDate,
          warehouse_id: selectedWarehouseId,
          status,
          remarks,
          total_amount: totalAmount
        }])
        .select()
        .single();

      if (headerError) throw headerError;

      // 2. Insert Items
      const itemsToInsert = lineItems.map(item => ({
        user_id: session.user.id,
        grn_id: header.id,
        product_id: item.product_id,
        ordered_qty: item.ordered_qty,
        received_qty: item.received_qty,
        unit_rate: item.unit_rate,
        line_amount: item.line_amount
      }));

      const { error: itemsError } = await supabase.from('grn_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // 3. If Confirmed, update stock and PO status
      if (status === 'Confirmed') {
        // Update Stock Ledger
        const stockEntries = lineItems.map(item => ({
          user_id: session.user.id,
          product_id: item.product_id,
          warehouse_id: selectedWarehouseId,
          quantity: item.received_qty,
          transaction_type: 'In',
          reference_id: header.id,
          reference_type: 'GRN',
          date: receiptDate,
          data: { grn_no }
        }));

        const { error: stockError } = await supabase.from('stock_ledger').insert(stockEntries);
        if (stockError) throw stockError;

        // Check if PO is fully received
        // For simplicity, we mark PO as 'Received' if this GRN is confirmed
        // A more complex logic would check total received vs ordered across all GRNs
        await supabase.from('purchase_orders').update({ status: 'Received' }).eq('id', selectedPoId);
      }

      toast.success(`GRN ${status === 'Confirmed' ? 'confirmed' : 'saved as draft'}`);
      queryClient.invalidateQueries({ queryKey: ['grn_headers'] });
      setIsFormOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save GRN');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedSupplierId('');
    setSelectedPoId('');
    setSelectedWarehouseId('');
    setLineItems([]);
    setRemarks('');
  };

  const filteredGrns = grns.filter(g => 
    g.grn_no.toLowerCase().includes(searchQuery.toLowerCase()) || 
    g.supplier?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Goods Receipt Notes (GRN)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Record and manage stock receipts against purchase orders.</p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New GRN
        </button>
      </div>

      {/* List View */}
      <div className="glass-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by GRN No or Supplier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-widest text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">GRN No</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">PO Ref</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {isLoadingGrns ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                  </td>
                </tr>
              ) : filteredGrns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 italic">No GRNs found.</td>
                </tr>
              ) : (
                filteredGrns.map((grn) => (
                  <tr key={grn.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-4 font-mono font-bold text-slate-900 dark:text-slate-100">{grn.grn_no}</td>
                    <td className="px-4 py-4">{grn.supplier?.name}</td>
                    <td className="px-4 py-4 text-xs font-mono">{grn.purchase_order?.po_number || 'N/A'}</td>
                    <td className="px-4 py-4 text-slate-500">{grn.date}</td>
                    <td className="px-4 py-4 font-bold">₹{Number(grn.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${grn.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {grn.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button className="text-slate-400 hover:text-indigo-600 transition-colors"><FileText className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New GRN Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Create New GRN</h3>
                <p className="text-xs text-slate-500">Receipt of goods against an existing Purchase Order.</p>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                  <User className="w-3 h-3" /> Supplier
                </label>
                <SearchableDropdown
                  table="suppliers"
                  displayField="name"
                  searchFields={['name', 'gstin']}
                  onSelect={(s) => { setSelectedSupplierId(s.id); setSelectedPoId(''); setLineItems([]); }}
                  placeholder="Select Supplier..."
                  value={selectedSupplierId ? (grns.find(g => g.supplier_id === selectedSupplierId)?.supplier?.name || '') : ''}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> Purchase Order
                </label>
                <select
                  disabled={!selectedSupplierId}
                  value={selectedPoId}
                  onChange={(e) => {
                    const po = purchaseOrders.find(p => p.id === e.target.value);
                    if (po) handlePoSelect(po);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 disabled:opacity-50"
                >
                  <option value="">Select PO...</option>
                  {purchaseOrders.map((po: any) => (
                    <option key={po.id} value={po.id}>{po.po_number} ({po.date})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Receipt Date
                </label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                  <Package className="w-3 h-3" /> Warehouse
                </label>
                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">Select Warehouse...</option>
                  {warehouses.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div className="mb-8 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product Description</th>
                    <th className="px-4 py-3 text-center">Ordered</th>
                    <th className="px-4 py-3 text-center">Received</th>
                    <th className="px-4 py-3 text-right">Unit Rate</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">Select a Purchase Order to load items.</td>
                    </tr>
                  ) : (
                    lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{item.product_name}</div>
                          <div className="text-[10px] text-slate-500">{item.part_no}</div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-slate-400">{item.ordered_qty}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            value={item.received_qty}
                            onChange={(e) => updateLineQty(idx, Number(e.target.value))}
                            className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center font-bold text-indigo-600 outline-none"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-mono">₹{item.unit_rate.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-black">₹{item.line_amount.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {lineItems.length > 0 && (
                  <tfoot className="bg-slate-50 dark:bg-slate-900/50 font-black">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-slate-500 uppercase tracking-widest text-[10px]">Grand Total</td>
                      <td className="px-4 py-3 text-right text-indigo-600">₹{totalAmount.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="mb-8">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Remarks / Notes</label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any observations on received goods..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950 min-h-[100px]"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                disabled={isSaving}
                onClick={() => setIsFormOpen(false)}
                className="rounded-xl px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                disabled={isSaving || lineItems.length === 0}
                onClick={() => saveGRN('Draft')}
                className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Save Draft
              </button>
              <button
                disabled={isSaving || lineItems.length === 0}
                onClick={() => saveGRN('Confirmed')}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirm Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
