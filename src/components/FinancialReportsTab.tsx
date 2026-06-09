import { useState, useEffect } from 'react';
import { financialService, ReportLine, TrialBalanceLine } from '../services/financialService';
import { FileText, TrendingUp, Landmark, Calculator, Loader2 } from 'lucide-react';

export function FinancialReportsTab() {
  const [profitAndLoss, setProfitAndLoss] = useState<ReportLine[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<ReportLine[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [pl, bs, tb] = await Promise.all([
          financialService.fetchProfitAndLoss(),
          financialService.fetchBalanceSheet(),
          financialService.fetchTrialBalance()
        ]);
        setProfitAndLoss(pl);
        setBalanceSheet(bs);
        setTrialBalance(tb);
      } catch (error) {
        console.error('Failed to load financial reports:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-slate-500 text-sm animate-pulse">Calculating financial statements...</p>
      </div>
    );
  }

  const plRevenue = profitAndLoss.filter(l => l.account_type === 'Revenue' || l.account_type === 'Income');
  const plExpense = profitAndLoss.filter(l => l.account_type === 'Expense');
  const netProfit = plRevenue.reduce((sum, l) => sum + l.balance, 0) - plExpense.reduce((sum, l) => sum + Math.abs(l.balance), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Financial Statements
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Automated real-time financial reporting derived from the central transaction engine.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Profit & Loss */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider">Profit & Loss Statement</h2>
          </div>
          <div className="p-6 space-y-4">
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Income / Revenue</h3>
              <div className="space-y-2">
                {plRevenue.map((line, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{line.account_name}</span>
                    <span className="font-mono font-bold">₹{line.balance.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Expenses</h3>
              <div className="space-y-2">
                {plExpense.map((line, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{line.account_name}</span>
                    <span className="font-mono font-bold text-rose-600">₹{Math.abs(line.balance).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>
            <div className="pt-4 border-t-2 border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <span className="text-sm font-black uppercase tracking-wider">Net Profit</span>
              <span className={`font-mono text-xl font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ₹{netProfit.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Balance Sheet */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider">Balance Sheet</h2>
          </div>
          <div className="p-6 space-y-4">
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Assets</h3>
              <div className="space-y-2">
                {balanceSheet.filter(l => l.account_type === 'Asset').map((line, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{line.account_name}</span>
                    <span className="font-mono font-bold">₹{line.balance.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Liabilities & Equity</h3>
              <div className="space-y-2">
                {balanceSheet.filter(l => l.account_type === 'Liability' || l.account_type === 'Equity').map((line, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{line.account_name}</span>
                    <span className="font-mono font-bold">₹{line.balance.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Trial Balance */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider">Trial Balance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Account Name</th>
                  <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px]">Type</th>
                  <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-right">Debit (₹)</th>
                  <th className="px-6 py-3 font-bold text-slate-400 uppercase tracking-widest text-[10px] text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {trialBalance.map((line, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">{line.account_name}</td>
                    <td className="px-6 py-3 text-slate-500">{line.account_type}</td>
                    <td className="px-6 py-3 text-right">{line.total_debit > 0 ? line.total_debit.toLocaleString() : '-'}</td>
                    <td className="px-6 py-3 text-right">{line.total_credit > 0 ? line.total_credit.toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
