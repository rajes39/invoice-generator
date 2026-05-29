import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  Package,
  FileSpreadsheet,
  Settings,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  User,
  ShieldAlert,
  HelpCircle,
  TrendingUp,
  BarChart3,
  RefreshCcw,
  BookOpen,
  Barcode,
  ScanSearch,
  GitBranch,
  Building2,
  ShoppingCart,
  WalletCards
} from 'lucide-react';

// Core Subcomponents
import { DashboardTab } from './components/DashboardTab';
import { CustomersTab } from './components/CustomersTab';
import { ProductsTab } from './components/ProductsTab';
import { InvoiceGeneratorTab } from './components/InvoiceGeneratorTab';
import { InvoicesListTab } from './components/InvoicesListTab';
import { SettingsTab } from './components/SettingsTab';
import { ReportsTab } from './components/ReportsTab';
import { LoginScreen } from './components/LoginScreen';
import { ToastContainer, ToastMessage } from './components/Toast';
import { BarcodeGeneratorTab } from './components/BarcodeGeneratorTab';
import { ScanAndInvoiceTab } from './components/ScanAndInvoiceTab';

// Three New Tabs
import { ReturnsCreditNotesTab } from './components/ReturnsCreditNotesTab';
import { CustomerLedgerTab } from './components/CustomerLedgerTab';
import { SalesReportTab } from './components/SalesReportTab';
import { RootSalesReportTab } from './components/RootSalesReportTab';
import { SuppliersTab } from './components/SuppliersTab';
import { PurchasesTab } from './components/PurchasesTab';
import { SupplierLedgerTab } from './components/SupplierLedgerTab';

// Core Types & Mocks
import { Customer, Product, Invoice, BusinessProfile, CreditNote, Payment, Purchase, Supplier, SupplierPayment } from './types';
import {
  INITIAL_BUSINESS_PROFILE,
  INITIAL_CUSTOMERS,
  INITIAL_PRODUCTS,
  INITIAL_INVOICES
} from './data';

export default function App() {
  // 1. Authentication states
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // 2. Navigation
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 3. Theme
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 4. Shared persistent states (Loaded from localStorage or standard demo data on first load)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [purchaseCounters, setPurchaseCounters] = useState({ lastNumber: 0, financialYear: '2024-25' });
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(INITIAL_BUSINESS_PROFILE);

  // 5. Toast Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // 6. Selected Invoice State for Quick Details Redirects
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // 7. Edit Invoice State
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);

  // Initialize and check user details / lists on mount
  useEffect(() => {
    // Auth Check
    const savedUserJson = localStorage.getItem('invoice_logged_in_user');
    if (savedUserJson) {
      try {
        const parsed = JSON.parse(savedUserJson);
        setCurrentUserEmail(parsed.email);
      } catch (err) {
        localStorage.removeItem('invoice_logged_in_user');
      }
    }

    // Customers list
    const savedCustomers = localStorage.getItem('invoice_customers');
    if (savedCustomers) {
      setCustomers(JSON.parse(savedCustomers));
    } else {
      setCustomers(INITIAL_CUSTOMERS);
      localStorage.setItem('invoice_customers', JSON.stringify(INITIAL_CUSTOMERS));
    }

    // Products list
    const savedProducts = localStorage.getItem('invoice_products');
    if (savedProducts) {
      setProducts(JSON.parse(savedProducts));
    } else {
      setProducts(INITIAL_PRODUCTS);
      localStorage.setItem('invoice_products', JSON.stringify(INITIAL_PRODUCTS));
    }

    // Invoices list
    const savedInvoices = localStorage.getItem('invoice_records');
    if (savedInvoices) {
      setInvoices(JSON.parse(savedInvoices));
    } else {
      setInvoices(INITIAL_INVOICES);
      localStorage.setItem('invoice_records', JSON.stringify(INITIAL_INVOICES));
    }

    // Credit Notes list
    const savedCreditNotes = localStorage.getItem('invoice_credit_notes');
    if (savedCreditNotes) {
      setCreditNotes(JSON.parse(savedCreditNotes));
    } else {
      setCreditNotes([]);
      localStorage.setItem('invoice_credit_notes', JSON.stringify([]));
    }

    // Payments list
    const savedPayments = localStorage.getItem('invoice_payments');
    if (savedPayments) {
      setPayments(JSON.parse(savedPayments));
    } else {
      setPayments([]);
      localStorage.setItem('invoice_payments', JSON.stringify([]));
    }

    // Suppliers list
    const savedSuppliers = localStorage.getItem('invoice_suppliers');
    if (savedSuppliers) {
      setSuppliers(JSON.parse(savedSuppliers));
    } else {
      setSuppliers([]);
      localStorage.setItem('invoice_suppliers', JSON.stringify([]));
    }

    // Purchases list
    const savedPurchases = localStorage.getItem('invoice_purchases');
    if (savedPurchases) {
      setPurchases(JSON.parse(savedPurchases));
    } else {
      setPurchases([]);
      localStorage.setItem('invoice_purchases', JSON.stringify([]));
    }

    // Supplier payments
    const savedSupplierPayments = localStorage.getItem('invoice_supplier_payments');
    if (savedSupplierPayments) {
      setSupplierPayments(JSON.parse(savedSupplierPayments));
    } else {
      setSupplierPayments([]);
      localStorage.setItem('invoice_supplier_payments', JSON.stringify([]));
    }

    // Purchase counters
    const savedPurchaseCounters = localStorage.getItem('invoice_purchase_counters');
    if (savedPurchaseCounters) {
      setPurchaseCounters(JSON.parse(savedPurchaseCounters));
    } else {
      const currentYear = new Date().getFullYear();
      const fyStart = new Date().getMonth() >= 3 ? currentYear : currentYear - 1;
      const defaultPurchaseCounters = {
        lastNumber: 0,
        financialYear: `${fyStart}-${String(fyStart + 1).slice(-2)}`,
      };
      setPurchaseCounters(defaultPurchaseCounters);
      localStorage.setItem('invoice_purchase_counters', JSON.stringify(defaultPurchaseCounters));
    }

    // Profile Settings
    const savedProfile = localStorage.getItem('invoice_business_profile');
    if (savedProfile) {
      setBusinessProfile(JSON.parse(savedProfile));
    } else {
      setBusinessProfile(INITIAL_BUSINESS_PROFILE);
      localStorage.setItem('invoice_business_profile', JSON.stringify(INITIAL_BUSINESS_PROFILE));
    }

    // Theme Check
    const localTheme = localStorage.getItem('invoice_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (localTheme === 'dark' || (!localTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Save changes to localStorage automatically on state adjustments
  useEffect(() => {
    if (customers.length > 0) {
      localStorage.setItem('invoice_customers', JSON.stringify(customers));
    }
  }, [customers]);

  useEffect(() => {
    if (products.length > 0) {
      localStorage.setItem('invoice_products', JSON.stringify(products));
    }
  }, [products]);

  useEffect(() => {
    if (invoices.length > 0) {
      localStorage.setItem('invoice_records', JSON.stringify(invoices));
    }
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('invoice_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('invoice_purchases', JSON.stringify(purchases));
  }, [purchases]);

  useEffect(() => {
    localStorage.setItem('invoice_supplier_payments', JSON.stringify(supplierPayments));
  }, [supplierPayments]);

  useEffect(() => {
    localStorage.setItem('invoice_purchase_counters', JSON.stringify(purchaseCounters));
  }, [purchaseCounters]);

  useEffect(() => {
    localStorage.setItem('invoice_business_profile', JSON.stringify(businessProfile));
  }, [businessProfile]);

  // Toast Notifier trigger
  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    // Auto dismiss
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Toggle Day vs Night layout
  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    if (nextTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('invoice_theme', 'dark');
      showToast("Dark Mode theme enabled", "info");
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('invoice_theme', 'light');
      showToast("Light Mode theme enabled", "info");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('invoice_logged_in_user');
    setCurrentUserEmail(null);
    showToast("Signed out successfully", "info");
  };

  // Side navigation menu options
  const NAV_ITEMS = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'New Invoice', icon: FileSpreadsheet, highlight: true },
    { name: 'Barcode Generator', icon: Barcode },
    { name: 'Scan & Invoice', icon: ScanSearch },
    { name: 'Invoices', icon: FileSpreadsheet },
    { name: 'Returns / Credit Notes', icon: RefreshCcw },
    { name: 'Customer Ledger', icon: BookOpen },
    { name: 'Sales Report', icon: BarChart3 },
    { name: 'Root Sales Report', icon: GitBranch },
    { name: 'Customers', icon: Users },
    { name: 'Products', icon: Package },
    { name: 'Suppliers', icon: Building2 },
    { name: 'Purchases', icon: ShoppingCart },
    { name: 'Supplier Ledger', icon: WalletCards },
    { name: 'Settings', icon: Settings },
  ];

  if (!currentUserEmail) {
    return (
      <>
        <LoginScreen
          onLoginSuccess={(email) => setCurrentUserEmail(email)}
          showToast={showToast}
        />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#f8fafc] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200">
      
      {/* Toast Notifications container overlay */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 border-r border-slate-200 dark:border-slate-800 bg-[#0f172a] overflow-y-auto shrink-0 z-10">
        
        {/* Company Title */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-2">
          <span className="p-1.5 bg-blue-600 rounded-lg text-white font-black text-sm leading-none flex items-center justify-center">
            {businessProfile.logo || "⚡"}
          </span>
          <div>
            <h2 className="text-xs font-black text-white tracking-tight leading-none uppercase">
              SONALI ERP
            </h2>
            <span className="text-[9px] text-blue-400 font-bold block mt-1 tracking-wider uppercase">
              GST COMPLIANT
            </span>
          </div>
        </div>

        {/* Regular list items */}
        <nav className="flex-1 px-2.5 py-4 space-y-1 text-left">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  if (item.name === 'New Invoice' && activeTab !== 'New Invoice') {
                    setInvoiceToEdit(null);
                  } else if (item.name !== 'New Invoice') {
                    setInvoiceToEdit(null);
                  }
                  setActiveTab(item.name);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-white border-l-3 border-blue-500 pl-2'
                    : item.highlight
                    ? 'bg-blue-950/40 text-blue-400 hover:bg-slate-800'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Active Logged In User & Theme Controls */}
        <div className="p-3 border-t border-slate-800 space-y-2">
          
          <div className="bg-slate-900/60 p-2 rounded-lg flex items-center justify-between border border-slate-800/60">
            <div className="flex items-center gap-1.5 text-left truncate">
              <div className="p-1 bg-slate-800 text-blue-400 rounded">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="truncate">
                <div className="text-[10px] font-bold text-slate-200 truncate leading-tight">
                  {currentUserEmail}
                </div>
                <span className="text-[8px] text-slate-400 font-semibold block uppercase">
                  Operator Role
                </span>
              </div>
            </div>

            <button
              onClick={toggleTheme}
              className="p-1 rounded-md bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white border border-slate-700/50 cursor-pointer"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-3 h-3 text-amber-500" /> : <Moon className="w-3 h-3 text-blue-300" />}
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-1.5 bg-slate-900 hover:bg-rose-950/20 hover:text-rose-400 text-slate-400 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-slate-800 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout Account
          </button>

        </div>
      </aside>

      {/* Mobile Drawer Sidebar Backdrops */}
      <AnimatePresence>
        {isSidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black"
            />

            {/* Container drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative flex flex-col w-2/3 max-w-sm bg-[#0f172a] border-r border-slate-800 p-4 z-50 h-full overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                <span className="text-xs font-black text-white tracking-widest uppercase">
                  SONALI ERP Menu
                </span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 py-4 space-y-1 text-left">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.name;
                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        if (item.name === 'New Invoice' && activeTab !== 'New Invoice') {
                          setInvoiceToEdit(null);
                        } else if (item.name !== 'New Invoice') {
                          setInvoiceToEdit(null);
                        }
                        setActiveTab(item.name);
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                        isActive
                          ? 'bg-slate-800 text-white border-l-3 border-blue-500 pl-2'
                          : item.highlight
                          ? 'bg-blue-950/40 text-blue-400'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      {item.name}
                    </button>
                  );
                })}
              </nav>

              <div className="pt-3 border-t border-slate-800 space-y-2">
                <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-200 truncate max-w-[130px] font-bold">{currentUserEmail}</span>
                  <button onClick={toggleTheme} className="p-1 rounded bg-slate-800 border border-slate-700">
                    {isDarkMode ? <Sun className="w-3 h-3 text-amber-400" /> : <Moon className="w-3 h-3 text-blue-400" />}
                  </button>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full py-1.5 bg-rose-950/20 text-rose-400 duration-150 border border-rose-900/30 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Log Out
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Page Content Body */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top bar for mobile */}
        <header className="lg:hidden flex items-center justify-between p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
            <span className="font-extrabold text-slate-900 dark:text-slate-50 text-xs tracking-tight flex items-center gap-1">
              <span>{businessProfile.logo}</span>
              SONALI ERP
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[9px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide">
              {activeTab}
            </span>
          </div>
        </header>

        {/* Dynamic Inner Tab container */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {activeTab === 'Dashboard' && (
              <DashboardTab
                invoices={invoices}
                products={products}
                customers={customers}
                purchases={purchases}
                suppliers={suppliers}
                setActiveTab={setActiveTab}
                showToast={showToast}
                setSelectedInvoice={setSelectedInvoice}
              />
            )}

            {activeTab === 'New Invoice' && (
              <InvoiceGeneratorTab
                customers={customers}
                setCustomers={setCustomers}
                products={products}
                setProducts={setProducts}
                invoices={invoices}
                setInvoices={setInvoices}
                businessProfile={businessProfile}
                showToast={showToast}
                setActiveTab={setActiveTab}
                invoiceToEdit={invoiceToEdit}
                setInvoiceToEdit={setInvoiceToEdit}
              />
            )}

            {activeTab === 'Barcode Generator' && (
              <BarcodeGeneratorTab
                products={products}
                showToast={showToast}
              />
            )}

            {activeTab === 'Scan & Invoice' && (
              <ScanAndInvoiceTab
                products={products}
                showToast={showToast}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'Invoices' && (
              <InvoicesListTab
                invoices={invoices}
                setInvoices={setInvoices}
                businessProfile={businessProfile}
                showToast={showToast}
                // If a redirect is triggered from the DashboardTab details click, open it!
                selectedInvoice={selectedInvoice}
                setSelectedInvoice={setSelectedInvoice}
                onEditInvoice={(inv) => {
                  setInvoiceToEdit(inv);
                  setActiveTab('New Invoice');
                }}
              />
            )}

            {activeTab === 'Customers' && (
              <CustomersTab
                customers={customers}
                setCustomers={setCustomers}
                products={products}
                showToast={showToast}
              />
            )}

            {activeTab === 'Products' && (
              <ProductsTab
                products={products}
                setProducts={setProducts}
                showToast={showToast}
              />
            )}

            {activeTab === 'Suppliers' && (
              <SuppliersTab
                suppliers={suppliers}
                setSuppliers={setSuppliers}
                showToast={showToast}
              />
            )}

            {activeTab === 'Purchases' && (
              <PurchasesTab
                purchases={purchases}
                setPurchases={setPurchases}
                products={products}
                setProducts={setProducts}
                suppliers={suppliers}
                businessProfile={businessProfile}
                purchaseCounters={purchaseCounters}
                setPurchaseCounters={setPurchaseCounters}
                showToast={showToast}
              />
            )}

            {activeTab === 'Supplier Ledger' && (
              <SupplierLedgerTab
                suppliers={suppliers}
                purchases={purchases}
                supplierPayments={supplierPayments}
                setSupplierPayments={setSupplierPayments}
                showToast={showToast}
              />
            )}

            {activeTab === 'Reports' && (
              <ReportsTab
                invoices={invoices}
                customers={customers}
                products={products}
                purchases={purchases}
                suppliers={suppliers}
                supplierPayments={supplierPayments}
                businessProfile={businessProfile}
                showToast={showToast}
              />
            )}

            {activeTab === 'Returns / Credit Notes' && (
              <ReturnsCreditNotesTab
                invoices={invoices}
                products={products}
                setProducts={setProducts}
                creditNotes={creditNotes}
                setCreditNotes={setCreditNotes}
                businessProfile={businessProfile}
                showToast={showToast}
              />
            )}

            {activeTab === 'Customer Ledger' && (
              <CustomerLedgerTab
                customers={customers}
                invoices={invoices}
                creditNotes={creditNotes}
                payments={payments}
                setPayments={setPayments}
                showToast={showToast}
              />
            )}

            {activeTab === 'Sales Report' && (
              <SalesReportTab
                customers={customers}
                invoices={invoices}
                showToast={showToast}
              />
            )}

            {activeTab === 'Root Sales Report' && (
              <RootSalesReportTab
                customers={customers}
                invoices={invoices}
                showToast={showToast}
              />
            )}

            {activeTab === 'Settings' && (
              <SettingsTab
                businessProfile={businessProfile}
                setBusinessProfile={setBusinessProfile}
                showToast={showToast}
              />
            )}
          </motion.div>
        </main>

      </div>

    </div>
  );
}
