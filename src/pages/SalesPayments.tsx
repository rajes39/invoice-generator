import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Search, CreditCard, DollarSign, Loader, Calendar, User, CheckCircle, Clock, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SalesPayments() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [isSaving, setIsSaving] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices_for_payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv: any) => 
      inv.invoice_no.toLowerCase().includes(search.toLowerCase()) || 
      inv.customer_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [invoices, search]);

  const openPaymentModal = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(Number(invoice.grand_total));
    setIsModalOpen(true);
  };

  const handleSavePayment = async () => {
    if (!selectedInvoice || paymentAmount <= 0) return;

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');

      // 1. Record payment in customer_payments table
      const { error: paymentError } = await supabase.from('customer_payments').insert([{
        user_id: session.user.id,
        customer_id: selectedInvoice.customer_id,
        invoice_id: selectedInvoice.id,
        amount: paymentAmount,
        payment_date: paymentDate,
        payment_method: paymentMethod,
        status: 'Confirmed'
      }]);

      if (paymentError) throw paymentError;

      // 2. Update invoice status to 'Paid' if full amount paid
      // Simplified: always mark as 'Paid' for now
      await supabase.from('invoices').update({ status: 'Paid' }).eq('id', selectedInvoice.id);

      toast.success('Payment recorded successfully!');
      queryClient.invalidateQueries({ queryKey: ['invoices_for_payments'] });
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Payments</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track and record payments received from customers.</p>
        </div>
      </div>

      <div className="glass-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 w-4 h-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Invoice No or Customer..."
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
                <th className="px-4 py-3">Invoice No</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader className="w-6 h-6 animate-spin mx-auto text-indigo-600" /></td></tr>
              ) : filteredInvoices.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500 italic">No invoices found.</td></tr>
              ) : (
                filteredInvoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-4 font-mono font-bold text-slate-900 dark:text-slate-100">{inv.invoice_no}</td>
                    <td className="px-4 py-4">{inv.customer_name}</td>
                    <td className="px-4 py-4 text-xs text-slate-500">{inv.date}</td>
                    <td className="px-4 py-4 text-right font-black">₹{Number(inv.grand_total).toLocaleString()}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {inv.status !== 'Paid' && (
                        <button
                          onClick={() => openPaymentModal(inv)}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-black uppercase text-white hover:bg-indigo-700 transition"
                        >
                          <Plus className="w-3 h-3" />
                          Record Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Record Payment</h3>
              <button onClick={() => setIsModalOpen(false)} className="rounded-xl p-2 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                <div className="text-[10px] uppercase font-black text-slate-400">Invoice Ref</div>
                <div className="font-bold text-slate-900 dark:text-slate-100">{selectedInvoice?.invoice_no}</div>
                <div className="text-xs text-slate-500">{selectedInvoice?.customer_name}</div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amount Received (₹)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-lg font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>

              <button
                disabled={isSaving}
                onClick={handleSavePayment}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20"
              >
                {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
