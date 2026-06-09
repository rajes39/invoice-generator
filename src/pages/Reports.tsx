import { useState } from 'react';
import { FinancialReportsTab } from '../components/FinancialReportsTab';
import { FileText, PieChart, Landmark } from 'lucide-react';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'financial' | 'sales' | 'gst'>('financial');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Enterprise Reports</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Comprehensive business intelligence and financial accounting reports.</p>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('financial')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'financial'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Landmark className="w-4 h-4" />
            Financials
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'sales'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <PieChart className="w-4 h-4" />
            Sales
          </button>
          <button
            onClick={() => setActiveTab('gst')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'gst'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            GST Compliance
          </button>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'financial' && <FinancialReportsTab />}
        {activeTab === 'sales' && (
          <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
            <p className="text-slate-500">Legacy sales report view migrated to Financials / Sales Account.</p>
          </div>
        )}
        {activeTab === 'gst' && (
          <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
            <p className="text-slate-500">GST GSTR-1 & GSTR-3B summaries currently in development.</p>
          </div>
        )}
      </div>
    </div>
  );
}
