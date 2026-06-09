import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Calculator, 
  CreditCard, 
  Loader, 
  Plus, 
  Trash2,
  ArrowLeft,
  Search,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { fetchInvoices } from '../services/invoiceService';
import { createCreditNote } from '../services/creditNoteService';
import type { Invoice, Customer, CreditNoteItem, CreditNote } from '../types';

export default function CreditNoteCreate() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // -- Form State --
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [reason, setReason] = useState('Goods Returned');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // -- Data Fetching --
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*').order('name');
      return data ?? [];
    },
  });

  const { data: allInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: fetchInvoices
  });

  const customerInvoices = useMemo(() => {
    return allInvoices.filter(inv => inv.customerId === selectedCustomerId);
  }, [allInvoices, selectedCustomerId]);

  const selectedInvoice = useMemo(() => {
    return allInvoices.find(inv => inv.id === selectedInvoiceId);
  }, [allInvoices, selectedInvoiceId]);

  // When invoice changes, reset return items
  useEffect(() => {
    if (selectedInvoice) {
      setReturnItems(selectedInvoice.items.map(item => ({
        ...item,
        returnQty: 0,
        selected: false
      })));
    } else {
      setReturnItems([]);
    }
  }, [selectedInvoice]);

  const toggleItemSelection = (idx: number) => {
    const newItems = [...returnItems];
    newItems[idx].selected = !newItems[idx].selected;
    if (newItems[idx].selected && newItems[idx].returnQty === 0) {
      newItems[idx].returnQty = newItems[idx].qty;
    }
    setReturnItems(newItems);
  };

  const updateReturnQty = (idx: number, val: number) => {
    const newItems = [...returnItems];
    const max = newItems[idx].qty;
    newItems[idx].returnQty = Math.min(Math.max(0, val), max);
    if (newItems[idx].returnQty > 0) {
      newItems[idx].selected = true;
    }
    setReturnItems(newItems);
  };

  // -- Computations --
  const totals = useMemo(() => {
    const selectedItems = returnItems.filter(item => item.selected && item.returnQty > 0);
    
    let subtotalBasic = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    selectedItems.forEach(item => {
      const ratio = item.returnQty / item.qty;
      const taxable = item.basicAmount * ratio;
      const gst = item.gstAmount * ratio;
      
      subtotalBasic += taxable;
      if (selectedInvoice?.isInterstate) {
        totalIgst += gst;
      } else {
        totalCgst += gst / 2;
        totalSgst += gst / 2;
      }
    });

    const rawTotal = subtotalBasic + totalCgst + totalSgst + totalIgst;
    const finalTotal = Math.round(rawTotal);
    const roundOff = Math.round((finalTotal - rawTotal) * 100) / 100;

    return {
      subtotalBasic: Math.round(subtotalBasic * 100) / 100,
      totalCgst: Math.round(totalCgst * 100) / 100,
      totalSgst: Math.round(totalSgst * 100) / 100,
      totalIgst: Math.round(totalIgst * 100) / 100,
      roundOff,
      totalAmount: finalTotal
    };
  }, [returnItems, selectedInvoice]);

  const saveCreditNote = async () => {
    const selectedItems = returnItems.filter(item => item.selected && item.returnQty > 0);
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }
    
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');

      const cnItems: CreditNoteItem[] = selectedItems.map(item => {
        const ratio = item.returnQty / item.qty;
        return {
          id: crypto.randomUUID(),
          creditNoteId: '', // Filled by service
          productId: item.productId,
          productName: item.productName,
          partNo: item.partNo,
          hsnCode: item.hsnCode,
          qty: item.returnQty,
          mrpPerUnit: item.mrpPerUnit,
          effectivePrice: item.effectivePrice,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount * ratio,
          gstRate: item.gstRate,
          basicAmount: item.basicAmount * ratio,
          gstAmount: item.gstAmount * ratio,
          lineTotal: item.lineTotal * ratio
        };
      });

      const cnData: Omit<CreditNote, 'id' | 'createdAt' | 'creditNoteNumber'> = {
        userId: session.user.id,
        originalInvoiceId: selectedInvoiceId,
        originalInvoiceNumber: selectedInvoice?.invoiceNumber,
        customerId: selectedCustomerId,
        customerName: selectedInvoice?.customerName || '',
        customerGstin: selectedInvoice?.customerGstin || '',
        customerPhone: selectedInvoice?.customerPhone || '',
        customerAddress: selectedInvoice?.customerAddress || '',
        date,
        reason,
        items: cnItems,
        subtotalBasic: totals.subtotalBasic,
        totalCgst: totals.totalCgst,
        totalSgst: totals.totalSgst,
        totalIgst: totals.totalIgst,
        roundOff: totals.roundOff,
        totalAmount: totals.totalAmount,
        status: 'Applied'
      };

      await createCreditNote(cnData);
      
      // Update stock (add back returned items)
      for (const item of cnItems) {
        await supabase.from('stock_ledger').insert([{
          user_id: session.user.id,
          product_id: item.productId,
          quantity: item.qty, // Positive quantity for return (In)
          transaction_type: 'In',
          reference_id: selectedInvoiceId,
          reference_type: 'Return',
          date,
          data: item
        }]);
      }

      toast.success('Credit Note generated and balance updated!');
      queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigate('/sales/returns');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save credit note');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">Customer Return / Credit Note</h2>
          <p className="text-sm text-slate-500 font-medium">Issue a credit note against an existing invoice for returned goods.</p>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_350px]">
        <div className="space-y-6">
          {/* Step 1: Selection */}
          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">1. Select Customer</label>
                <SearchableDropdown
                  table="customers"
                  searchFields={['name', 'gstin', 'mobile']}
                  displayField="name"
                  helperFields={['gstin', 'mobile']}
                  onSelect={(c) => {
                    setSelectedCustomerId(c.id);
                    setSelectedInvoiceId('');
                  }}
                  placeholder="Search Customer..."
                  value={customers.find(c => c.id === selectedCustomerId)?.name}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">2. Select Original Invoice</label>
                <select 
                  disabled={!selectedCustomerId}
                  value={selectedInvoiceId} 
                  onChange={e => setSelectedInvoiceId(e.target.value)} 
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 disabled:opacity-50"
                >
                  <option value="">{selectedCustomerId ? 'Choose Invoice...' : 'Select customer first'}</option>
                  {customerInvoices.map(inv => <option key={inv.id} value={inv.id}>{inv.invoiceNumber} - ₹{inv.grandTotal} ({new Date(inv.date).toLocaleDateString()})</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reason for Return</label>
                <input 
                  value={reason} 
                  onChange={e => setReason(e.target.value)} 
                  placeholder="e.g. Damage, Wrong Item, etc."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none shadow-sm dark:bg-slate-950 dark:border-slate-700" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Return Date</label>
                <input 
                  type="date"
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none shadow-sm dark:bg-slate-950 dark:border-slate-700" 
                />
              </div>
            </div>
          </div>

          {/* Step 2: Items Table */}
          <div className="glass-card rounded-3xl border border-slate-200 overflow-hidden shadow-sm dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 p-4 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Items from Invoice {selectedInvoice?.invoiceNumber}</h3>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Select items and enter return quantity</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">Select</th>
                    <th className="px-3 py-3">Product / Part No</th>
                    <th className="px-3 py-3 text-center">Orig. Qty</th>
                    <th className="px-3 py-3 text-center">Return Qty</th>
                    <th className="px-3 py-3 text-right">Price</th>
                    <th className="px-3 py-3 text-right w-32">Return Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {!selectedInvoiceId ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-medium italic">
                        Select an invoice above to see its items.
                      </td>
                    </tr>
                  ) : returnItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-medium italic">
                        No items found in this invoice.
                      </td>
                    </tr>
                  ) : (
                    returnItems.map((item, i) => (
                      <tr key={i} className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors ${item.selected ? 'bg-indigo-50/30 dark:bg-indigo-900/5' : ''}`}>
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={item.selected} 
                            onChange={() => toggleItemSelection(i)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{item.productName}</div>
                          <div className="text-[10px] font-medium text-slate-400">{item.partNo}</div>
                        </td>
                        <td className="px-3 py-3 text-center font-bold">{item.qty}</td>
                        <td className="px-3 py-3 text-center">
                          <input 
                            type="number" 
                            min="0" 
                            max={item.qty} 
                            value={item.returnQty} 
                            onChange={e => updateReturnQty(i, Number(e.target.value))}
                            className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm outline-none text-center shadow-sm" 
                          />
                        </td>
                        <td className="px-3 py-3 text-right">₹{item.effectivePrice.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right font-black text-indigo-600">₹{(item.effectivePrice * item.returnQty * (1 + item.gstRate/100)).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar: Totals */}
        <aside className="space-y-6">
          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-xl dark:border-slate-800 sticky top-6 bg-slate-900 text-white">
            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2 border-b border-white/10 pb-4 mb-6">
              <Calculator className="w-5 h-5 text-indigo-400" /> Credit Summary
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span>Taxable Amount</span>
                <span className="font-mono">₹{totals.subtotalBasic.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Total GST</span>
                <span className="font-mono">₹{(totals.totalCgst + totals.totalSgst + totals.totalIgst).toFixed(2)}</span>
              </div>
              {totals.roundOff !== 0 && (
                <div className="flex justify-between text-[10px] font-bold text-slate-500 italic">
                  <span>Round Off</span>
                  <span className="font-mono">{totals.roundOff > 0 ? '+' : ''}{totals.roundOff.toFixed(2)}</span>
                </div>
              )}
              
              <div className="pt-6 mt-6 border-t border-white/20">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Refund Amount</p>
                <div className="text-4xl font-black text-indigo-400 tracking-tighter">
                  ₹{totals.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <button 
              disabled={isSaving || totals.totalAmount === 0}
              onClick={saveCreditNote}
              className="w-full rounded-3xl bg-indigo-600 px-5 py-4 text-sm font-black text-white transition hover:bg-indigo-500 disabled:opacity-50 shadow-2xl active:scale-95 flex items-center justify-center gap-3 mt-8"
            >
              {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              {isSaving ? 'SAVING...' : 'CONFIRM RETURN'}
            </button>
          </div>
          
          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
             <h4 className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 mb-3">
                <Plus className="w-3.5 h-3.5 text-indigo-500" /> Auto-Sequence
             </h4>
             <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
               The credit note will follow the pattern <span className="font-bold">CN/YY-YY/XXXX</span>. 
               The refund amount will be automatically deducted from the customer's outstanding balance.
             </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
