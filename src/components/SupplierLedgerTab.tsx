import { useMemo, useState, useEffect, Dispatch, SetStateAction, FormEvent } from 'react';
import { Purchase, Supplier, SupplierPayment } from '../types';
import { Search, Plus, Download, WalletCards, X, CircleDollarSign } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { SearchableDropdown } from './SearchableDropdown';
import { supabase } from '../lib/supabase';

interface SupplierLedgerTabProps {
  suppliers: Supplier[];
  purchases: Purchase[];
  supplierPayments: SupplierPayment[];
  setSupplierPayments: Dispatch<SetStateAction<SupplierPayment[]>>;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function SupplierLedgerTab({ suppliers, purchases, supplierPayments, setSupplierPayments, showToast }: SupplierLedgerTabProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);

  const selectedSupplier = useMemo(() => suppliers.find(supplier => supplier.id === selectedSupplierId) || null, [selectedSupplierId, suppliers]);

  const [openingBalanceMeta, setOpeningBalanceMeta] = useState<{ amount: number; type: string; date: string }>({ amount: 0, type: 'We owe them', date: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    if (!selectedSupplierId) {
      setOpeningBalanceMeta({ amount: 0, type: 'We owe them', date: new Date().toISOString().split('T')[0] });
      return;
    }
    (async () => {
      try {
        const storedAmount = await localStorage.getItem(`supplier_opening_balance_amount_${selectedSupplierId}`);
        const storedType = await localStorage.getItem(`supplier_opening_balance_type_${selectedSupplierId}`);
        const storedDate = await localStorage.getItem(`supplier_opening_balance_date_${selectedSupplierId}`);
        const amount = storedAmount ? Number(storedAmount) : 0;
        setOpeningBalanceMeta({ amount, type: storedType === 'They owe us' ? 'They owe us' : 'We owe them', date: storedDate || new Date().toISOString().split('T')[0] });
      } catch (err) {
        console.error(err);
      }
    })();
  }, [selectedSupplierId]);

  const ledgerEntries = useMemo(() => {
    if (!selectedSupplierId) return [];

    const purchaseEntries = purchases
      .filter(purchase => purchase.supplierId === selectedSupplierId)
      .map(purchase => ({
        id: purchase.id,
        date: purchase.date,
        type: 'Purchase',
        invoiceNo: purchase.purchaseNumber,
        debit: purchase.grandTotal,
        credit: 0,
      }));

    const paymentEntries = supplierPayments
      .filter(payment => payment.supplierId === selectedSupplierId)
      .map(payment => ({
        id: payment.id,
        date: payment.date,
        type: 'Payment',
        invoiceNo: `PAY-${payment.id.slice(-5).toUpperCase()}`,
        debit: 0,
        credit: payment.amount,
      }));

    const combined = [...purchaseEntries, ...paymentEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = openingBalanceMeta.amount;

    return combined.map(entry => {
      runningBalance = runningBalance + entry.debit - entry.credit;
      return {
        ...entry,
        runningBalance,
      };
    });
  }, [purchases, selectedSupplierId, supplierPayments, openingBalanceMeta.amount]);

  const summary = useMemo(() => {
    const totalPurchaseAmount = ledgerEntries.filter(entry => entry.type === 'Purchase').reduce((sum, entry) => sum + entry.debit, 0);
    const totalPayments = ledgerEntries.filter(entry => entry.type === 'Payment').reduce((sum, entry) => sum + entry.credit, 0);
    const outstandingBalance = openingBalanceMeta.amount + totalPurchaseAmount - totalPayments;

    return { totalPurchaseAmount, totalPayments, outstandingBalance };
  }, [ledgerEntries, openingBalanceMeta.amount]);

  const handleSavePayment = (e: FormEvent) => {
    e.preventDefault();

    if (!selectedSupplierId) {
      showToast('Select a supplier before recording payment', 'error');
      return;
    }

    if (!paymentAmount || Number(paymentAmount) <= 0) {
      showToast('Enter a valid payment amount', 'error');
      return;
    }

    const supplier = suppliers.find(item => item.id === selectedSupplierId);
    if (!supplier) return;

    const newPayment: SupplierPayment = {
      id: `supp-pay-${Date.now()}`,
      supplierId: selectedSupplier.id || selectedSupplierId,
      supplierName: supplier.name,
      amount: Number(paymentAmount),
      mode: paymentMode,
      date: paymentDate,
    };

    const updatedPayments = [newPayment, ...supplierPayments];
    setSupplierPayments(updatedPayments);
    showToast('Supplier payment recorded', 'success');
    setPaymentAmount('');
    setPaymentMode('Bank Transfer');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setIsPaymentModalOpen(false);
  };

  const exportLedger = () => {
    if (!selectedSupplier) return;

    const rows = ledgerEntries.map((entry, index) => ({
      'S.No': index + 1,
      'Date': entry.date,
      'Transaction Type': entry.type,
      'Invoice No': entry.invoiceNo,
      'Debit': entry.debit,
      'Credit': entry.credit,
      'Running Balance': entry.runningBalance,
    }));

    const XLSX = (window as Window & { XLSX?: any }).XLSX;
    if (!XLSX) {
      showToast('SheetJS library not loaded', 'error');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${selectedSupplier.name} Ledger`);
    XLSX.writeFile(workbook, `${selectedSupplier.name.replace(/\s+/g, '_')}_Ledger.xlsx`);
    showToast('Supplier ledger exported', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row justify-between gap-3 items-start lg:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">Supplier Ledger</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Review supplier purchase debits, payment credits, and running balances.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            disabled={!selectedSupplier}
            className={`text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 ${selectedSupplier ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'}`}
          >
            <Plus className="w-3.5 h-3.5" />
            Record Payment
          </button>
          <button
            onClick={exportLedger}
            disabled={!selectedSupplier}
            className={`text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 ${selectedSupplier ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed'}`}
          >
            <Download className="w-3.5 h-3.5" />
            Export Ledger
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-xs">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Supplier</p>
          <div className="mt-2">
            <SearchableDropdown
              table="suppliers"
              searchFields={['name', 'gstin', 'mobile']}
              displayField="name"
              helperFields={['gstin', 'mobile']}
              onSelect={(s) => setSelectedSupplierId(s.id)}
              placeholder="Search Supplier..."
              value={selectedSupplier?.name}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-xs">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Opening Balance</p>
          <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-50">₹{openingBalanceMeta.amount.toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{openingBalanceMeta.type} as of {openingBalanceMeta.date}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-xs">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Total Purchases</p>
          <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-50">₹{summary.totalPurchaseAmount.toLocaleString('en-IN')}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-xs">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Balance</p>
          <p className="mt-2 text-lg font-bold text-emerald-600 dark:text-emerald-300">₹{summary.outstandingBalance.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {selectedSupplier ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">{selectedSupplier.name} Ledger</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">GSTIN: {selectedSupplier.gstin} • Mobile: {selectedSupplier.mobile}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Invoice No</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  <th className="px-3 py-2 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr className="bg-slate-50/70 dark:bg-slate-950/40">
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{openingBalanceMeta.date}</td>
                  <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">Opening Balance</td>
                  <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">—</td>
                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">₹{openingBalanceMeta.amount > 0 ? openingBalanceMeta.amount.toLocaleString('en-IN') : '0.00'}</td>
                  <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">₹{openingBalanceMeta.amount < 0 ? Math.abs(openingBalanceMeta.amount).toLocaleString('en-IN') : '0.00'}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-50">₹{openingBalanceMeta.amount.toLocaleString('en-IN')}</td>
                </tr>
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/30">
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{entry.date}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-100">{entry.type}</td>
                    <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">{entry.invoiceNo}</td>
                    <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">₹{entry.debit.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-200">₹{entry.credit.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-50">₹{entry.runningBalance.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 text-center text-sm text-slate-500 dark:text-slate-300">Select a supplier to view its ledger and payment history.</div>
      )}

      <AnimatePresence>
        {isPaymentModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Record Supplier Payment</h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Post cash, UPI, or bank transfer payments against the selected supplier.</p>
                </div>
                <button onClick={() => setIsPaymentModalOpen(false)} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSavePayment} className="space-y-3">
                <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Amount
                  <input type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" required />
                </label>

                <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Mode
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm">
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Payment Date
                  <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" required />
                </label>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">Cancel</button>
                  <button type="submit" className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer">Save Payment</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
