import { useState, useEffect } from 'react';
import { financialService, ReportLine } from '../services/financialService';
import { Landmark, Download, Loader2, PieChart } from 'lucide-react';

export default function BalanceSheet() {
  const [data, setData] = useState<ReportLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const bs = await financialService.fetchBalanceSheet();
        setData(bs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const assets = data.filter(l => l.account_type === 'Asset');
  const liabilities = data.filter(l => l.account_type === 'Liability');
  const equity = data.filter(l => l.account_type === 'Equity');
  
  const totalAssets = assets.reduce((sum, l) => sum + l.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
  const totalEquity = equity.reduce((sum, l) => sum + l.balance, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-slate-500 mt-4 text-sm font-medium">Assembling Balance Sheet...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Landmark className="w-7 h-7 text-indigo-600" />
            Balance Sheet
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Financial position at a specific point in time.</p>
        </div>
        <button className="px-4 py-2 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Download className="w-4 h-4" />
          Export Statement
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Assets Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-blue-50/50 dark:bg-blue-950/20 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-xs font-black uppercase tracking-widest text-blue-800 dark:text-blue-400">Assets</h3>
            <span className="text-sm font-black font-mono">₹{totalAssets.toLocaleString()}</span>
          </div>
          <div className="p-6 space-y-4">
            {assets.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No asset records found.</p>
            ) : (
              assets.map((line, i) => (
                <div key={i} className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{line.account_name}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">₹{line.balance.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <span className="text-xs font-black uppercase tracking-wider">Total Assets</span>
            <span className="text-lg font-black font-mono text-indigo-600">₹{totalAssets.toLocaleString()}</span>
          </div>
        </div>

        {/* Liabilities & Equity Section */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-rose-50/50 dark:bg-rose-950/20 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-rose-800 dark:text-rose-400">Liabilities</h3>
              <span className="text-sm font-black font-mono">₹{totalLiabilities.toLocaleString()}</span>
            </div>
            <div className="p-6 space-y-4">
              {liabilities.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No liability records found.</p>
              ) : (
                liabilities.map((line, i) => (
                  <div key={i} className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{line.account_name}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">₹{line.balance.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-amber-50/50 dark:bg-amber-950/20 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-amber-800 dark:text-amber-400">Equity & Capital</h3>
              <span className="text-sm font-black font-mono">₹{totalEquity.toLocaleString()}</span>
            </div>
            <div className="p-6 space-y-4">
              {equity.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No equity records found.</p>
              ) : (
                equity.map((line, i) => (
                  <div key={i} className="flex justify-between items-center pb-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{line.account_name}</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">₹{line.balance.toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-indigo-600 rounded-3xl p-6 text-white flex justify-between items-center shadow-lg shadow-indigo-200 dark:shadow-none">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Total Liabilities + Equity</p>
              <h4 className="text-2xl font-black font-mono mt-1">₹{(totalLiabilities + totalEquity).toLocaleString()}</h4>
            </div>
            <PieChart className="w-10 h-10 opacity-30" />
          </div>
        </div>
      </div>
    </div>
  );
}
