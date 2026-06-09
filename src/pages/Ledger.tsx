import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { fetchPayments, recordPayment, deletePayment } from '../services/paymentService';
import { fetchCreditNotes } from '../services/creditNoteService';
import type { Customer, Invoice, Payment, CreditNote } from '../types';
import { toast } from 'react-hot-toast';
import { downloadCsv } from '../lib/csv';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
}

const EXCEL_HEADERS = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];

export default function Ledger() {
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payType, setPayType] = useState<'CASH' | 'UPI'>('UPI');
  const [payNotes, setPayNotes] = useState('');

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*').order('name');
      return (data ?? []).map(c => ({
        ...c,
        openingBalance: c.opening_balance || 0,
        openingBalanceType: c.opening_balance_type || 'They owe us'
      }));
    },
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data } = await supabase.from('invoices').select('*').order('date', { ascending: true });
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery<Payment[]>({
    queryKey: ['payments'],
    queryFn: () => fetchPayments(),
  });

  const { data: creditNotes = [] } = useQuery<CreditNote[]>({
    queryKey: ['creditNotes'],
    queryFn: () => fetchCreditNotes(),
  });

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const ledgerEntries = useMemo(() => {
    if (!selectedCustomerId || !selectedCustomer) return [];

    const entries: any[] = [];
    const opBal = Number(selectedCustomer.openingBalance || 0);
    const opType = selectedCustomer.openingBalanceType;

    // 1. Add Opening Balance
    entries.push({
      id: 'OP-BAL',
      date: '---',
      description: 'Opening Balance',
      debit: (opType === 'They owe us' || opType === 'debit') ? opBal : 0,
      credit: (opType === 'We owe them' || opType === 'credit') ? opBal : 0,
      type: 'OPENING',
      sortDate: '0000-00-00'
    });

    // 2. Add Invoices
    invoices
      .filter(inv => (inv.customerId || (inv as any).customer_id) === selectedCustomerId)
      .forEach(inv => {
        entries.push({
          id: inv.id,
          date: inv.date,
          description: `Invoice ${inv.invoiceNumber || (inv as any).invoice_no}`,
          debit: inv.grandTotal || (inv as any).total || 0,
          credit: 0,
          type: 'INVOICE',
          sortDate: inv.date
        });
      });

    // 3. Add Payments
    payments
      .filter(p => p.customerId === selectedCustomerId)
      .forEach(p => {
        entries.push({
          id: p.id,
          date: p.date,
          description: `Payment [${p.type}] ${p.mode || ''}`,
          debit: 0,
          credit: p.amount,
          type: 'PAYMENT',
          sortDate: p.date
        });
      });

    // 4. Add Credit Notes
    creditNotes
      .filter(cn => cn.customerId === selectedCustomerId)
      .forEach(cn => {
        entries.push({
          id: cn.id,
          date: cn.date,
          description: `Credit Note ${cn.creditNoteNumber} (Ref: ${cn.originalInvoiceNumber})`,
          debit: 0,
          credit: cn.totalAmount,
          type: 'RETURN',
          sortDate: cn.date
        });
      });

    // Sort by date
    const sorted = entries.sort((a, b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime());

    // Calculate running balance
    let runningBalance = 0;
    return sorted.map(entry => {
      runningBalance += (entry.debit - entry.credit);
      return { ...entry, balance: runningBalance };
    }).reverse(); // Reverse for display (newest first)
  }, [selectedCustomerId, selectedCustomer, invoices, payments]);

  const handleExportExcel = () => {
    if (!selectedCustomer || ledgerEntries.length === 0) return;
    const data = [...ledgerEntries].reverse().map(e => ({
      Date: e.date,
      Description: e.description,
      Debit: e.debit,
      Credit: e.credit,
      Balance: e.balance
    }));
    downloadCsv(EXCEL_HEADERS, data, `Ledger_${selectedCustomer.name}.csv`);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !payAmount) return;

    try {
      await recordPayment({
        customerId: selectedCustomerId,
        amount: Number(payAmount),
        date: payDate,
        type: payType,
        mode: payNotes
      });

      toast.success('Payment recorded successfully');
      setPayAmount('');
      setPayNotes('');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment?')) return;
    try {
      await deletePayment(id, selectedCustomerId);
      toast.success('Payment deleted');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete payment');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Customer Ledger</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Record payments and track customer transaction history.</p>
        </div>
        {selectedCustomerId && (
          <button 
            onClick={handleExportExcel}
            className="rounded-3xl border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            Export to Excel
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <div className="space-y-6">
          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <SearchableDropdown
                table="customers"
                searchFields={['name', 'gstin', 'mobile']}
                displayField="name"
                helperFields={['gstin', 'mobile']}
                onSelect={(c) => setSelectedCustomerId(c.id)}
                placeholder="Search Customer for Ledger..."
                className="flex-1 max-w-md"
                value={selectedCustomer?.name}
              />
              {selectedCustomer && (
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Current Balance</p>
                  <p className={`text-xl font-bold ${Number(selectedCustomer.balance) >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(Math.abs(selectedCustomer.balance || 0))} 
                    <span className="ml-1 text-xs uppercase">{Number(selectedCustomer.balance) >= 0 ? 'Dr' : 'Cr'}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-300">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Description</th>
                    <th className="px-3 py-3 text-right">Debit (+)</th>
                    <th className="px-3 py-3 text-right">Credit (-)</th>
                    <th className="px-3 py-3 text-right">Balance</th>
                    <th className="px-3 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                        {selectedCustomerId ? 'No transactions found for this customer.' : 'Select a customer to view transaction history.'}
                      </td>
                    </tr>
                  ) : (
                    ledgerEntries.map((entry) => (
                      <tr key={entry.id} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-3 py-3">{entry.date}</td>
                        <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">{entry.description}</td>
                        <td className="px-3 py-3 text-right text-rose-600">{entry.debit > 0 ? formatCurrency(entry.debit) : '-'}</td>
                        <td className="px-3 py-3 text-right text-emerald-600">{entry.credit > 0 ? formatCurrency(entry.credit) : '-'}</td>
                        <td className={`px-3 py-3 text-right font-semibold ${entry.balance >= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {formatCurrency(Math.abs(entry.balance))} {entry.balance >= 0 ? 'Dr' : 'Cr'}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {entry.type === 'PAYMENT' && (
                            <button onClick={() => handleDeletePayment(entry.id)} className="text-slate-400 hover:text-rose-600">
                              Delete
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
        </div>

        <aside>
          <div className="glass-card sticky top-6 rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Record Payment</h3>
            <form onSubmit={handleRecordPayment} className="mt-4 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Amount</label>
                <input 
                  type="number" 
                  required 
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date</label>
                <input 
                  type="date" 
                  required 
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Mode</label>
                <select 
                  value={payType}
                  onChange={(e) => setPayType(e.target.value as any)}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Notes</label>
                <textarea 
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Payment details..."
                  rows={2}
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <button 
                type="submit" 
                disabled={!selectedCustomerId}
                className="w-full rounded-3xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                Save Payment
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
