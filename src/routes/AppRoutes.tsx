import { Navigate, Route, Routes } from 'react-router-dom';
import CreditNotes from '../pages/CreditNotes';
import CreditNoteCreate from '../pages/CreditNoteCreate';
import CreditNoteDetails from '../pages/CreditNoteDetails';
import Customers from '../pages/Customers';
import Suppliers from '../pages/Suppliers';
import Products from '../pages/Products';
import Warehouses from '../pages/Warehouses';
import RoutesPage from '../pages/Routes';
import Dashboard from '../pages/Dashboard';
import InvoiceCreate from '../pages/InvoiceCreate';
import InvoiceDetails from '../pages/InvoiceDetails';
import Invoices from '../pages/Invoices';
import Ledger from '../pages/Ledger';
import Login from '../pages/Login';
import Reports from '../pages/Reports';
import RouteSalesReport from '../pages/RouteSalesReport';
import Settings from '../pages/Settings';
import CompanySettingsPage from '../pages/CompanySettings';
import InvoiceEdit from '../pages/InvoiceEdit';
import Discounts from '../pages/Discounts';
import NetRates from '../pages/NetRates';
import TrialBalance from '../pages/TrialBalance';
import ProfitAndLoss from '../pages/ProfitAndLoss';
import BalanceSheet from '../pages/BalanceSheet';
import AuditLog from '../pages/AuditLog';
import BackupRestore from '../pages/BackupRestore';
import ProtectedRoute from '../components/ProtectedRoute';

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="glass-card mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">{description}</p>
    </div>
  );
}

import ScannerInvoice from '../pages/ScannerInvoice';
import GRN from '../pages/GRN';
import PurchaseOrders from '../pages/PurchaseOrders';
import Stock from '../pages/Stock';
import InventoryMovements from '../pages/InventoryMovements';
import SalesPayments from '../pages/SalesPayments';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/masters/customers"
        element={
          <ProtectedRoute>
            <Customers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/masters/suppliers"
        element={
          <ProtectedRoute>
            <Suppliers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/masters/products"
        element={
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/masters/routes"
        element={
          <ProtectedRoute>
            <RoutesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/masters/warehouses"
        element={
          <ProtectedRoute>
            <Warehouses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/masters/discounts"
        element={
          <ProtectedRoute>
            <Discounts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/masters/net-rates"
        element={
          <ProtectedRoute>
            <NetRates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/masters/company-settings"
        element={
          <ProtectedRoute>
            <CompanySettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase/orders"
        element={
          <ProtectedRoute>
            <PurchaseOrders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase/grn"
        element={
          <ProtectedRoute>
            <GRN />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase/reports"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Purchase Reports" description="Review purchase register and supplier ledger reports." />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/orders"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Sales Orders" description="Create sales orders and convert them to invoices." />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/scanner"
        element={
          <ProtectedRoute>
            <ScannerInvoice />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/invoices"
        element={
          <ProtectedRoute>
            <Invoices />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/invoices/new"
        element={
          <ProtectedRoute>
            <InvoiceCreate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/invoices/edit/:id"
        element={
          <ProtectedRoute>
            <InvoiceEdit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/invoices/:id"
        element={
          <ProtectedRoute>
            <InvoiceDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/returns"
        element={
          <ProtectedRoute>
            <CreditNotes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/returns/new"
        element={
          <ProtectedRoute>
            <CreditNoteCreate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/returns/:id"
        element={
          <ProtectedRoute>
            <CreditNoteDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/payments"
        element={
          <ProtectedRoute>
            <SalesPayments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/reports"
        element={
          <ProtectedRoute>
            <RouteSalesReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory/stock"
        element={
          <ProtectedRoute>
            <Stock />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory/movements"
        element={
          <ProtectedRoute>
            <InventoryMovements />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory/alerts"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Inventory Alerts" description="See low stock alerts and reorder recommendations." />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/journal"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Journal Entries" description="Record manual journal entries for accounting." />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/ledger"
        element={
          <ProtectedRoute>
            <Ledger />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/trial-balance"
        element={
          <ProtectedRoute>
            <TrialBalance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/profit-and-loss"
        element={
          <ProtectedRoute>
            <ProfitAndLoss />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/balance-sheet"
        element={
          <ProtectedRoute>
            <BalanceSheet />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/gst-reports"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="GST Reports" description="Generate GSTR summaries and tax compliance reports." />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/audit-log"
        element={
          <ProtectedRoute>
            <AuditLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/employees"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Employees" description="Manage employee master data and salary details." />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/attendance"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Attendance" description="Track daily attendance and shift timings." />
          </ProtectedRoute>
        }
      />
      <Route
        path="/hr/payroll"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Payroll" description="Process monthly payroll and payroll slips." />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/backup"
        element={
          <ProtectedRoute>
            <BackupRestore />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
