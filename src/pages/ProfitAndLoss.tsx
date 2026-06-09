import { useState, useEffect } from 'react';
import { financialService, ReportLine } from '../services/financialService';
import { TrendingUp, Download, Loader2, Calendar } from 'lucide-react';

export default function ProfitAndLoss() {
  const [data, setData] = useState<ReportLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const pl = await financialService.fetchProfitAndLoss();
        setData(pl);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const revenue = data.filter(l => l.account_type === 'Revenue' || l.account_type === 'Income');
  const expenses = data.filter(l => l.account_type === 'Expense');
  
  const totalRevenue = revenue.reduce((sum, l) => sum + l.balance, 0);
  const totalExpenses = expenses.reduce((sum, l) => sum + Math.abs(l.balance), 0);
  const netProfit = totalRevenue - totalExpenses;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-slate-500 mt-4 text-sm font-medium">Calculating Profit & Loss...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-indigo-600" />
            Profit & Loss Statement
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Trading, Profit & Loss account for the selected period.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <Calendar className="w-4 h-4" />
            Select Period
          </button>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-500 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Revenue</p>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100">₹{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Expenses</p>
          <p className="text-2xl font-black font-mono text-rose-600">₹{totalExpenses.toLocaleString()}</p>
        </div>
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm border-b-4 ${netProfit >= 0 ? 'border-b-emerald-500' : 'border-b-rose-500'}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Net Profit / Loss</p>
          <p className={`text-2xl font-black font-mono ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            ₹{netProfit.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Detail */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-400">Income & Revenue</h3>
          </div>
          <div className="p-6 space-y-4">
            {revenue.map((line, i) => (
              <div key={i} className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{line.account_name}</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">₹{line.balance.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expense Detail */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-rose-50/50 dark:bg-rose-950/20 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-widest text-rose-800 dark:text-rose-400">Operating Expenses</h3>
          </div>
          <div className="p-6 space-y-4">
            {expenses.map((line, i) => (
              <div key={i} className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{line.account_name}</span>
                <span className="font-mono font-bold text-rose-600">₹{Math.abs(line.balance).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
