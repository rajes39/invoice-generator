import type { Invoice } from '../types';
import { Link } from 'react-router-dom';

export default function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-300">
        <thead className="bg-[#dcfce7] dark:bg-green-950/20">
          <tr className="text-[10px] uppercase font-black tracking-[0.3em] text-green-800 dark:text-green-500">
            <th className="px-4 py-4">Docket #</th>
            <th className="px-4 py-4">Client Receiver</th>
            <th className="px-4 py-4">Date</th>
            <th className="px-4 py-4 text-right">Total Base Amount</th>
            <th className="px-4 py-4 text-center">Status</th>
            <th className="px-4 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-green-50/30 dark:hover:bg-green-900/5 transition-colors">
              <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-slate-100">{invoice.invoiceNumber}</td>
              <td className="px-4 py-3 font-medium">{invoice.customerName}</td>
              <td className="px-4 py-3 font-mono text-xs">{invoice.date}</td>
              <td className="px-4 py-3 text-right font-mono font-bold">₹{invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td className="px-4 py-3 text-center">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  invoice.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {invoice.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link to={`/invoices/${invoice.id}`} className="inline-block rounded-lg bg-[#16a34a] px-4 py-1.5 text-xs font-black uppercase tracking-wider text-white hover:bg-green-700 transition-colors shadow-sm">
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
