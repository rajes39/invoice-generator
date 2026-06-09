import { useState, useEffect } from 'react';
import { financialService, TrialBalanceLine } from '../services/financialService';
import { Calculator, Download, Loader2, Search } from 'lucide-react';

export default function TrialBalance() {
  const [data, setData] = useState<TrialBalanceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const tb = await financialService.fetchTrialBalance();
        setData(tb);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredData = data.filter(line => 
    line.account_name.toLowerCase().includes(search.toLowerCase()) ||
    line.account_type.toLowerCase().includes(search.toLowerCase())
  );

  const totals = filteredData.reduce((acc, line) => {
    acc.debit += line.total_debit;
    acc.credit += line.total_credit;
    return acc;
  }, { debit: 0, credit: 0 });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-slate-500 mt-4 text-sm font-medium">Loading Trial Balance...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calculator className="w-7 h-7 text-indigo-600" />
            Trial Balance
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Summarized balances of all ledger accounts for the current period.</p>
        </div>
        <button className="px-4 py-2 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity">
          <Download className="w-4 h-4" />
          Export PDF
        </button>
      </div>

      <div className="glass-card rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/30 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4">Account Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Debit (₹)</th>
                <th className="px-6 py-4 text-right">Credit (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredData.map((line) => (
                <tr key={line.account_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{line.account_name}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                      {line.account_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold">
                    {line.total_debit > 0 ? line.total_debit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold">
                    {line.total_credit > 0 ? line.total_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">No matching accounts found.</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700">
              <tr className="font-black">
                <td className="px-6 py-4" colSpan={2}>Grand Total</td>
                <td className="px-6 py-4 text-right font-mono text-indigo-600">₹{totals.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td className="px-6 py-4 text-right font-mono text-indigo-600">₹{totals.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
