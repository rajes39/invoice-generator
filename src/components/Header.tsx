import { useLocation } from 'react-router-dom';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/customers': 'Customers',
  '/products': 'Products',
  '/invoices': 'Invoices',
  '/invoices/new': 'Create Invoice',
  '/credit-notes': 'Credit Notes',
  '/ledger': 'Customer Ledger',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export default function Header() {
  const location = useLocation();
  const title = titles[location.pathname] || 'SONALI ERP';

  return (
    <header className="border-b border-green-100 bg-white/95 px-6 py-4 shadow-sm backdrop-blur dark:border-green-900/30 dark:bg-slate-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-green-600 font-black dark:text-green-500">Authorized ERP Console</p>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight">{title}</h1>
        </div>
      </div>
    </header>
  );
}
