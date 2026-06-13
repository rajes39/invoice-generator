import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const menuGroups = [
  {
    title: 'Dashboard',
    items: [{ label: 'Overview', path: '/dashboard' }],
  },
  {
    title: 'Masters',
    items: [
      { label: 'Customers', path: '/masters/customers' },
      { label: 'Suppliers', path: '/masters/suppliers' },
      { label: 'Products', path: '/masters/products' },
      { label: 'Warehouses', path: '/masters/warehouses' },
      { label: 'Discount Setup', path: '/masters/discounts' },
      { label: 'Net Rate Setup', path: '/masters/net-rates' },
      { label: 'Company Profile', path: '/masters/company-settings' },
    ],
  },
  {
    title: 'Purchase',
    items: [
      { label: 'Purchase Orders', path: '/purchase/orders' },
      { label: 'Goods Receipt', path: '/purchase/grn' },
      { label: 'Purchase Reports', path: '/purchase/reports' },
    ],
  },
  {
    title: 'Sales',
    items: [
      { label: 'Scanner Invoice', path: '/sales/scanner' },
      { label: 'Sales Orders', path: '/sales/orders' },
      { label: 'Invoices', path: '/sales/invoices' },
      { label: 'Returns', path: '/sales/returns' },
      { label: 'Payments', path: '/sales/payments' },
      { label: 'Route Sales Report', path: '/sales/reports' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Current Stock', path: '/inventory/stock' },
      { label: 'Movements', path: '/inventory/movements' },
      { label: 'Alerts', path: '/inventory/alerts' },
    ],
  },
  {
    title: 'Accounts',
    items: [
      { label: 'Journal', path: '/accounts/journal' },
      { label: 'Ledger', path: '/accounts/ledger' },
      { label: 'Trial Balance', path: '/accounts/trial-balance' },
      { label: 'Profit & Loss', path: '/accounts/profit-and-loss' },
      { label: 'Balance Sheet', path: '/accounts/balance-sheet' },
      { label: 'GST Reports', path: '/accounts/gst-reports' },
      { label: 'Audit Log', path: '/accounts/audit-log' },
    ],
  },
  {
    title: 'HR',
    items: [
      { label: 'Employees', path: '/hr/employees' },
      { label: 'Attendance', path: '/hr/attendance' },
      { label: 'Payroll', path: '/hr/payroll' },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'P&L Statement', path: '/reports/pl' },
      { label: 'Balance Sheet', path: '/reports/balance-sheet' },
      { label: 'Cash Flow', path: '/reports/cash-flow' },
      { label: 'GST Summary', path: '/reports/gst-summary' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Company Settings', path: '/masters/company-settings' },
      { label: 'Backup', path: '/settings/backup' },
    ],
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  return (
    <aside className="w-80 border-r border-green-900 bg-[#14532d] text-white">
      <div className="flex h-full flex-col gap-6 p-6">
        <div>
          <div className="mb-6 flex items-center gap-3">
            <div className="h-12 w-12 rounded-3xl bg-green-500 text-white flex items-center justify-center text-xl font-bold">S</div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-green-300">Enterprise Suite</p>
              <p className="font-black text-xl tracking-tight text-white">SONALI ERP</p>
            </div>
          </div>
          <div className="rounded-3xl border border-green-800 bg-green-900/50 p-4">
            <p className="text-[10px] uppercase tracking-[0.3em] text-green-400">Authorized Session</p>
            <p className="mt-1 text-sm font-bold text-white truncate">{user?.email ?? 'User'}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto pr-1 custom-scrollbar">
          {menuGroups.map((group) => (
            <div key={group.title} className="space-y-3">
              <p className="px-4 text-[10px] font-black uppercase tracking-[0.3em] text-green-500">{group.title}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `block rounded-2xl px-4 py-3 text-sm font-black transition-all duration-200 ${
                        isActive
                          ? 'bg-[#22c55e] text-white shadow-lg shadow-green-900/50 scale-[1.02]'
                          : 'text-green-100 hover:bg-green-800/50 hover:translate-x-1'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-green-800">
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate('/login');
              }}
              className="w-full rounded-2xl bg-green-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-green-500 active:scale-95"
            >
              Logout Portal
            </button>
          </div>
        </nav>
      </div>
    </aside>
  );
}
