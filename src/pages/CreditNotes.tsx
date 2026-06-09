import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Search, 
  Eye, 
  Trash2, 
  RotateCcw,
  Calendar,
  User,
  FileText,
  Loader
} from 'lucide-react';
import { fetchCreditNotes, deleteCreditNote } from '../services/creditNoteService';
import type { CreditNote } from '../types';

export default function CreditNotes() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: creditNotes = [], isLoading } = useQuery<CreditNote[]>({
    queryKey: ['credit_notes'],
    queryFn: fetchCreditNotes
  });

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this credit note? This will revert the customer balance.')) return;
    
    try {
      await deleteCreditNote(id);
      toast.success('Credit note deleted and balance reverted');
      queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete credit note');
    }
  };

  const filteredCNs = creditNotes.filter(cn => 
    cn.creditNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cn.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cn.originalInvoiceNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <div className="p-8 text-center"><Loader className="animate-spin mx-auto" /> Loading returns...</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">Customer Returns</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage credit notes and sales returns.</p>
        </div>
        <button 
          onClick={() => navigate('/sales/returns/new')}
          className="inline-flex items-center gap-2 rounded-3xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800 shadow-lg active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Create New Return
        </button>
      </header>

      <div className="glass-card rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search by CN No, Customer or Invoice..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <div className="flex gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">{filteredCNs.length} Total Records</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-6 py-4">CN Number</th>
                <th className="px-6 py-4">Customer / Details</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Original Invoice</th>
                <th className="px-6 py-4 text-right">Refund Amount</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCNs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium italic">
                    No returns found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCNs.map((cn) => (
                  <tr key={cn.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><RotateCcw className="w-4 h-4" /></div>
                        <span className="font-black text-slate-900 dark:text-slate-100">{cn.creditNoteNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                        <User className="w-3 h-3 text-slate-400" /> {cn.customerName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium ml-5">{cn.customerGstin}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500 font-medium">
                        <Calendar className="w-3 h-3" /> {new Date(cn.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-bold text-indigo-600">
                        <FileText className="w-3 h-3" /> {cn.originalInvoiceNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-black text-rose-600">₹{cn.totalAmount.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => navigate(`/sales/returns/${cn.id}`)}
                          className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(cn.id)}
                          className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          title="Delete Return"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
