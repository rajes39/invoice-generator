import { useState, useMemo, Dispatch, SetStateAction, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  TrendingUp, 
  BookOpen, 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  Building, 
  DollarSign, 
  ChevronRight, 
  CreditCard,
  Calendar,
  X,
  FileText
} from 'lucide-react';
import { Customer, Invoice, CreditNote, Payment } from '../types';

interface CustomerLedgerTabProps {
  customers: Customer[];
  invoices: Invoice[];
  creditNotes: CreditNote[];
  payments: Payment[];
  setPayments: Dispatch<SetStateAction<Payment[]>>;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function CustomerLedgerTab({
  customers,
  invoices,
  creditNotes,
  payments,
  setPayments,
  showToast
}: CustomerLedgerTabProps) {
  const [selectedCustId, setSelectedCustId] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Payment form states
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payType, setPayType] = useState<'CASH' | 'UPI'>('UPI');
  const [payModeDetail, setPayModeDetail] = useState('BANK TRANSFER'); // Detail like e.g. Card, Transfer
  const [payNotes, setPayNotes] = useState('');

  // 1. Fetch opening balance from localStorage
  const activeCustomer = useMemo(() => {
    const cust = customers.find(c => c.id === selectedCustId);
    if (cust) {
      const savedOp = localStorage.getItem(`customer_op_bal_${cust.id}`);
      setOpeningBalance(savedOp ? Number(savedOp) : 0);
    }
    return cust || null;
  }, [selectedCustId, customers]);

  // Update opening balance handler
  const handleUpdateOpeningBalance = (val: number) => {
    if (!activeCustomer) return;
    setOpeningBalance(val);
    localStorage.setItem(`customer_op_bal_${activeCustomer.id}`, String(val));
    showToast(`Opening balance for ${activeCustomer.name} updated to ₹${val}`, "success");
  };

  // 2. Compile Ledger Entries Chronologically
  const ledgerEntries = useMemo(() => {
    if (!selectedCustId) return [];

    const entries: {
      id: string;
      date: string;
      type: 'INVOICE' | 'RETURN' | 'PAYMENT';
      refNumber: string;
      description: string;
      debit: number;  // increases balance
      credit: number; // decreases balance
    }[] = [];

    // Add Invoices (Debits)
    invoices
      .filter(inv => inv.customerId === selectedCustId)
      .forEach(inv => {
        entries.push({
          id: inv.id,
          date: inv.date,
          type: 'INVOICE',
          refNumber: inv.invoiceNumber,
          description: `Sales Invoice Ledger Posting [Vehicle No: ${inv.vehicleNo || 'N/A'}]`,
          debit: inv.totalAmount,
          credit: 0
        });
      });

    // Add Credit Notes (Credits)
    creditNotes
      .filter(cn => cn.customerId === selectedCustId)
      .forEach(cn => {
        entries.push({
          id: cn.id,
          date: cn.date,
          type: 'RETURN',
          refNumber: cn.creditNoteNumber,
          description: `Credit Note Return Posting [Inv Ref: ${cn.invoiceNumber}]`,
          debit: 0,
          credit: cn.totalAmount
        });
      });

    // Add Payments (Credits)
    payments
      .filter(p => p.customerId === selectedCustId)
      .forEach(p => {
        entries.push({
          id: p.id,
          date: p.date,
          type: 'PAYMENT',
          refNumber: `REC-${p.id.slice(-5).toUpperCase()}`,
          description: `Collected Receipt [Payment Mode: ${p.type} ${p.mode ? `(${p.mode})` : ''}]`,
          debit: 0,
          credit: p.amount
        });
      });

    // Sort Chronologically
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Compute continuous running balances
    let runningVal = openingBalance;
    return entries.map(item => {
      runningVal = runningVal + item.debit - item.credit;
      return {
        ...item,
        runningBalance: runningVal
      };
    });
  }, [selectedCustId, invoices, creditNotes, payments, openingBalance]);

  // Combined calculations for dynamic KPI cards
  const financials = useMemo(() => {
    let salesVal = 0;
    let returnsVal = 0;
    let paymentsVal = 0;

    ledgerEntries.forEach(ent => {
      salesVal += ent.debit;
      if (ent.type === 'RETURN') {
        returnsVal += ent.credit;
      } else if (ent.type === 'PAYMENT') {
        paymentsVal += ent.credit;
      }
    });

    const totalOutstanding = openingBalance + salesVal - returnsVal - paymentsVal;

    return {
      totalSales: salesVal,
      totalReturns: returnsVal,
      totalPayments: paymentsVal,
      balance: totalOutstanding
    };
  }, [ledgerEntries, openingBalance]);

  // Overall aggregate list for overview (if no customer is selected)
  const masterOverview = useMemo(() => {
    return customers.map(cust => {
      // Calculate opening, invoices, returns, payments
      const savedOp = localStorage.getItem(`customer_op_bal_${cust.id}`);
      const op = savedOp ? Number(savedOp) : 0;

      const custInvoices = invoices.filter(inv => inv.customerId === cust.id);
      const custNotes = creditNotes.filter(cn => cn.customerId === cust.id);
      const custPayments = payments.filter(p => p.customerId === cust.id);

      const sales = custInvoices.reduce((acc, current) => acc + current.totalAmount, 0);
      const returns = custNotes.reduce((acc, current) => acc + current.totalAmount, 0);
      const paySum = custPayments.reduce((acc, current) => acc + current.amount, 0);
      const closingOutstanding = op + sales - returns - paySum;

      return {
        id: cust.id,
        name: cust.name,
        gstin: cust.gstin || "URD",
        mobile: cust.mobile || "N/A",
        state: cust.state,
        openingBalance: op,
        sales,
        returns,
        payments: paySum,
        balance: closingOutstanding
      };
    });
  }, [customers, invoices, creditNotes, payments]);

  // Filter master overview by search input
  const searchedOverview = masterOverview.filter(row => 
    row.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.mobile.includes(searchQuery) ||
    row.gstin.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 3. Record collected payments
  const handleSavePayment = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCustId) return;

    if (!payAmount || Number(payAmount) <= 0) {
      showToast("Please enter a valid payment collection amount", "error");
      return;
    }

    const valueNum = Number(payAmount);

    const newPayment: Payment = {
      id: `pay-${Date.now()}`,
      customerId: selectedCustId,
      amount: valueNum,
      mode: payNotes.trim() || payModeDetail,
      date: payDate,
      type: payType
    };

    const updatedList = [newPayment, ...payments];
    setPayments(updatedList);
    localStorage.setItem('invoice_payments', JSON.stringify(updatedList));

    showToast(`Payment receipt of ₹${valueNum.toLocaleString('en-IN')} posted successfully!`, "success");

    // Close and reset modal
    setPayAmount('');
    setPayNotes('');
    setIsRecordModalOpen(false);
  };

  // 4. Delete payment
  const handleDeletePayment = (payId: string) => {
    const fresh = payments.filter(p => p.id !== payId);
    setPayments(fresh);
    localStorage.setItem('invoice_payments', JSON.stringify(fresh));
    showToast("Payment receipt deleted, balance adjusted", "info");
  };

  // 5. Excel/CSV Statement download
  const handleExportCSV = () => {
    if (!activeCustomer) return;

    let csvContent = `Customer Ledger Statement: ${activeCustomer.name}\n`;
    csvContent += `Mobile: ${activeCustomer.mobile || 'None'}, GSTIN: ${activeCustomer.gstin || 'URD'}, State: ${activeCustomer.state}\n`;
    csvContent += `Opening Balance,₹${openingBalance.toFixed(2)}\n\n`;
    csvContent += `Transaction Date,Event Description,Reference Number,Debits (+),Credits (-),Running Balance Accounts\n`;

    // Write entries
    let balVal = openingBalance;
    ledgerEntries.forEach(row => {
      csvContent += `"${row.date}","${row.description}","${row.refNumber}",${row.debit > 0 ? row.debit.toFixed(2) : '-'},${row.credit > 0 ? row.credit.toFixed(2) : '-'},₹${row.runningBalance.toFixed(2)}\n`;
    });

    csvContent += `\nSummary,Total Sales Invoice value,Total Return Credits,Total Collected Payments,Final Ledger Balance\n`;
    csvContent += `,₹${financials.totalSales.toFixed(2)},₹${financials.totalReturns.toFixed(2)},₹${financials.totalPayments.toFixed(2)},₹${financials.balance.toFixed(2)}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Ledger_Statement_${activeCustomer.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Customer Ledger Statement Spreadsheet downloaded successfully!", "success");
  };

  return (
    <div className="space-y-4 font-sans text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Customer Ledger & Balances
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Log invoice value entries, merchandise returns, and client payment collections in master accounts.
          </p>
        </div>

        {selectedCustId && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleExportCSV}
              className="bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Statement Sheet
            </button>
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-555 text-white cursor-pointer transition-colors text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Payment Recv'd
            </button>
          </div>
        )}
      </div>

      {/* Selector banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl px-3.5 py-2.5 flex items-center gap-2 shadow-xs">
          <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">Selected Client Ledger:</span>
          <select
            value={selectedCustId}
            onChange={(e) => setSelectedCustId(e.target.value)}
            className="w-full text-xs text-indigo-600 font-bold bg-transparent border-none outline-none focus:ring-0 cursor-pointer dark:text-slate-100"
          >
            <option value="" className="dark:bg-slate-900 font-semibold text-slate-400">--- View Master Balance Sheet Overview ---</option>
            {customers.map(c => (
              <option key={c.id} value={c.id} className="dark:bg-slate-900">{c.name} {c.mobile ? `(${c.mobile})` : ''}</option>
            ))}
          </select>
        </div>

        {selectedCustId && (
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl px-3.5 py-1.5 flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[9px] font-black text-slate-400 block uppercase tracking-widest leading-none">Starting Op Balance:</span>
              <span className="text-xs font-bold text-slate-950 dark:text-slate-100 block mt-1 font-mono">₹{openingBalance.toLocaleString('en-IN')}</span>
            </div>
            <button
              onClick={() => {
                const updated = prompt("Enter customer opening balance (E.g. 5000 or -1500 for advances):", String(openingBalance));
                if (updated !== null && !isNaN(Number(updated))) {
                  handleUpdateOpeningBalance(Number(updated));
                }
              }}
              className="text-[10px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-1 rounded transition-colors"
            >
              Modify Op Bal
            </button>
          </div>
        )}
      </div>

      {/* MAIN VIEW AREA */}
      {selectedCustId && activeCustomer ? (
        <div className="space-y-4">
          
          {/* KPI Dashboard inside specific client statement */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-xl p-4 border border-slate-800 shadow-sm text-left">
              <span className="text-[9px] text-indigo-400 uppercase font-black tracking-widest block">Opening Balance</span>
              <div className="text-lg font-black font-mono mt-1">₹{openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <span className="text-[9.5px] text-slate-450 block mt-0.5 font-medium">Original statement base value</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-left shadow-xs">
              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Total Sales (+ Debits)</span>
              <div className="text-lg font-black font-mono text-slate-900 dark:text-slate-100 mt-1">₹{financials.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <span className="text-[9.5px] text-slate-400 block mt-0.5 font-medium font-mono">{invoices.filter(i => i.customerId === selectedCustId).length} billing invoices posted</span>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 text-left shadow-xs">
              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Returns & Payments (- Credits)</span>
              <div className="text-lg font-black font-mono text-emerald-600 mt-1">₹{(financials.totalReturns + financials.totalPayments).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <span className="text-[9.5px] text-slate-450 block mt-0.5">Returns: ₹{financials.totalReturns.toLocaleString('en-IN')} | Receipts: ₹{financials.totalPayments.toLocaleString('en-IN')}</span>
            </div>

            <div className="bg-rose-50 dark:bg-rose-950/20 text-slate-900 dark:text-slate-100 rounded-xl p-4 border border-rose-100 dark:border-rose-900/40 text-left shadow-xs">
              <span className="text-[9px] text-rose-600 dark:text-rose-400 uppercase font-black tracking-widest block">Ledger Balance (Rounded)</span>
              <div className="text-lg font-black font-mono text-rose-700 dark:text-rose-400 mt-1">₹{Math.round(financials.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <span className={`text-[9.5px] font-bold block mt-0.5 uppercase ${financials.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {financials.balance > 0 ? "Outstanding Receivable" : "Prepaid Advance Credit"}
              </span>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-955 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-800 dark:text-slate-200 text-xs flex justify-between items-center">
              <span>Account Ledger Book Statement: {activeCustomer.name}</span>
              <span className="font-mono text-[10px] text-slate-400">Mobile: {activeCustomer.mobile || 'None'} | GSTIN: {activeCustomer.gstin || 'URD'}</span>
            </div>

            {ledgerEntries.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <FileText className="w-5 h-5 mx-auto text-slate-300 mb-2" />
                No transactions recorded for this client. Outstanding is equal to Opening Balance (₹{openingBalance}).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-sans text-xs">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-150 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 whitespace-nowrap">
                      <th className="py-2.5 px-4 w-28">Trade Entry Date</th>
                      <th className="py-2.5 px-3">Description Event Name</th>
                      <th className="py-2.5 px-2 w-32">Docket Ref #</th>
                      <th className="py-2.5 px-3 text-right w-28">Debits (+)</th>
                      <th className="py-2.5 px-3 text-right w-28">Credits (-)</th>
                      <th className="py-2.5 px-4 text-right w-32">Running Balance</th>
                      <th className="py-2.5 px-2 text-center w-12">Cancel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {/* Display Opening Row */}
                    <tr className="bg-slate-50/20 dark:bg-slate-950/10 font-bold text-slate-500 italic text-[11px]">
                      <td className="py-2.5 px-4">-</td>
                      <td className="py-2.5 px-3">Master Statement Starting Opening Balance</td>
                      <td className="py-2.5 px-2">-</td>
                      <td className="py-2.5 px-3 text-right font-mono">{openingBalance >= 0 ? `₹${openingBalance.toFixed(2)}` : '-'}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{openingBalance < 0 ? `₹${Math.abs(openingBalance).toFixed(2)}` : '-'}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-800 dark:text-slate-200">₹{openingBalance.toFixed(2)}</td>
                      <td className="py-2.5 px-2"></td>
                    </tr>

                    {ledgerEntries.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-955/20 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-slate-500">{row.date}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">{row.description}</td>
                        <td className="py-2.5 px-2 font-mono font-bold text-indigo-600 dark:text-indigo-400 select-all">{row.refNumber}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-900 dark:text-slate-105 font-semibold">
                          {row.debit > 0 ? `₹${row.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600 font-semibold">
                          {row.credit > 0 ? `₹${row.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          ₹{row.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {row.type === 'PAYMENT' ? (
                            <button
                              onClick={() => {
                                if (confirm(`Delete collected receipt ${row.refNumber} from ledger book accounts?`)) {
                                  handleDeletePayment(row.id);
                                }
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                              title="Delete Receipt Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* MASTER OVERVIEW REPORT DASHBOARD */
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-3xl text-left flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-500" />
                Master Ledger Outstandings Overview
              </h3>
              <p className="text-slate-400 dark:text-slate-500 text-[10px] mt-0.5">
                Displays the consolidated summaries (Sales, Returns, Payments) and receivables for all clients.
              </p>
            </div>

            {/* Master search */}
            <div className="w-full md:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search master accounts list..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-transparent border-none focus:outline-none dark:text-slate-150"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-955 border-b border-slate-205 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-500 whitespace-nowrap">
                    <th className="py-2.5 px-4">Client Name</th>
                    <th className="py-2.5 px-3">Contact Code</th>
                    <th className="py-2.5 px-3 text-right">Opening Bal (₹)</th>
                    <th className="py-2.5 px-3 text-right">Sales billed (₹)</th>
                    <th className="py-2.5 px-3 text-right font-medium text-amber-600">Goods Ret (₹)</th>
                    <th className="py-2.5 px-3 text-right font-medium text-emerald-600">Payments Recv (₹)</th>
                    <th className="py-2.5 px-4 text-right w-36">Closing Balance (₹)</th>
                    <th className="py-2.5 px-4 text-center w-28">Ledger Book</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {searchedOverview.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-xs text-slate-400 font-medium">
                        No customer Master Accounts match query filter.
                      </td>
                    </tr>
                  ) : (
                    searchedOverview.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-955/20 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">{row.name}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          <div>{row.mobile}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-0.5">GSTIN: {row.gstin}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">₹{row.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-805 dark:text-slate-350">₹{row.sales.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-amber-600">₹{row.returns.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-600">₹{row.payments.toLocaleString('en-IN', { minimumFractionDigits: 1 })}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-black text-rose-600 dark:text-rose-450 text-xs">
                          ₹{Math.round(row.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => setSelectedCustId(row.id)}
                            className="text-[10px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/45 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded-lg font-bold flex items-center gap-1 mx-auto transition-colors cursor-pointer"
                          >
                            Open Account
                            <ChevronRight className="w-3 h-3" />
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
      )}

      {/* RECORD PAYMENT COLLECTION MODAL */}
      <AnimatePresence>
        {isRecordModalOpen && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-emerald-500" />
                  Post Client Cash Receipt
                </h3>
                <button
                  onClick={() => setIsRecordModalOpen(false)}
                  className="p-1 rounded text-slate-400"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <form onSubmit={handleSavePayment} className="space-y-3.5 text-left">
                {activeCustomer && (
                  <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg text-[10px] border border-slate-150 dark:border-slate-850">
                    Client Target Profile: <span className="font-extrabold text-slate-850 dark:text-slate-100">{activeCustomer.name}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-black text-slate-550 uppercase tracking-widest mb-1.5">Collection Amount (INR) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-250"
                    placeholder="Enter collected value rupee count"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-550 uppercase tracking-widest mb-1.5">Collection Date *</label>
                    <input
                      type="date"
                      required
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-250 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-550 uppercase tracking-widest mb-1.5">Payment Format *</label>
                    <select
                      value={payType}
                      onChange={(e) => setPayType(e.target.value as 'CASH' | 'UPI')}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-250 cursor-pointer"
                    >
                      <option value="UPI">UPI Digital Scan</option>
                      <option value="CASH">CASH Handover</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-550 uppercase tracking-widest mb-1">Remarks / Note Tracker (Optional)</label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-250"
                    placeholder="E.g., RTGS ICICI Chq#1240"
                  />
                </div>

                <div className="flex gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsRecordModalOpen(false)}
                    className="flex-1 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-650 dark:text-slate-400 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-555 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Submit Receipt Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
