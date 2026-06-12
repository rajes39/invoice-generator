import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { deleteInvoice, fetchInvoiceById, numberToWords } from '../services/invoiceService';
import type { Invoice, CompanySettings } from '../types';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  Calendar, 
  X, 
  FileSpreadsheet, 
  FileText, 
  Search, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Loader,
  Filter
} from 'lucide-react';

const TERMS = [
  "GOODS ONCE SOLD CANNOT BE TAKEN BACK",
  "OUR RESPONSIBILITY CEASES WHEN GOODS LEAVE OUR PREMISES",
  "INTEREST @18% PA WILL BE CHARGED IF BILL NOT PAID WITHIN 7 DAYS",
  "ALL DISPUTES ARE SUBJECT TO LOCAL JURISDICTION ONLY",
  "ALL CHEQUES ARE SUBJECT TO REALIZATION",
  "CHEQUE DISHONOURED CHARGES @ RS.500/- PER LEAF"
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
}

export default function Invoices() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });
      
      return (data ?? []).map(inv => ({
        ...inv,
        invoiceNumber: inv.invoice_no,
        customerName: inv.customer_name || 'N/A',
        grandTotal: inv.grand_total || 0,
      }));
    },
  });

  const { data: company } = useQuery<CompanySettings>({
    queryKey: ['company_settings_global'],
    queryFn: async () => {
      const { data } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
      return data;
    },
  });

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
                           inv.customerName.toLowerCase().includes(search.toLowerCase());
      
      const invDate = inv.date.split('T')[0];
      const matchesFrom = !fromDate || invDate >= fromDate;
      const matchesTo = !toDate || invDate <= toDate;

      return matchesSearch && matchesFrom && matchesTo;
    }).sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [invoices, search, fromDate, toDate]);

  const handleDelete = async (id: string) => {
    if (!confirm('PERMANENT ACTION: Are you sure you want to delete this invoice? This will revert customer balance.')) return;
    try {
      await deleteInvoice(id);
      toast.success('Invoice deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete invoice');
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
  };

  const handleBulkExportExcel = async () => {
    if (filteredInvoices.length === 0) {
      toast.error('No invoices to export');
      return;
    }

    setIsExporting(true);
    try {
      const allLines: any[] = [];
      
      // Fetch full details for each invoice to get line items
      for (const inv of filteredInvoices) {
        const fullInv = await fetchInvoiceById(inv.id);
        if (fullInv) {
          fullInv.items.forEach(item => {
            allLines.push({
              'Invoice No': fullInv.invoiceNumber,
              'Customer Name': fullInv.customerName,
              'Billing Date': fullInv.date.split('T')[0],
              'MRP': item.mrpPerUnit,
              'Rate': item.effectivePrice,
              'Disc%': item.discountPercent,
              'Taxable Amount': item.basicAmount,
              'GST%': item.gstRate,
              'GST Amount': item.gstAmount,
              'Grand Total': fullInv.grandTotal
            });
          });

          if (fullInv.freightCharges > 0) {
            allLines.push({
              'Invoice No': fullInv.invoiceNumber,
              'Customer Name': fullInv.customerName,
              'Billing Date': fullInv.date.split('T')[0],
              'MRP': 0,
              'Rate': fullInv.freightCharges,
              'Disc%': 0,
              'Taxable Amount': fullInv.freightCharges,
              'GST%': 18,
              'GST Amount': fullInv.freightGst,
              'Grand Total': fullInv.grandTotal
            });
          }
        }
      }

      const ws = XLSX.utils.json_to_sheet(allLines);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Invoices");
      
      const fileName = `Invoices_${fromDate || 'Start'}_to_${toDate || 'End'}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Excel export complete');
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkExportPdf = async () => {
    if (filteredInvoices.length === 0) {
      toast.error('No invoices to export');
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading('Generating PDF...');

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      
      const getCompanyField = (field: string, fallback: string = '') => {
        if (!company) return fallback;
        const c = company as any;
        return c[field] || fallback;
      };

      const companyName = getCompanyField('company_name') || getCompanyField('name') || 'YOUR COMPANY NAME';
      const companyAddress = getCompanyField('address') || '';
      const companyCity = getCompanyField('city') || '';
      const companyPincode = getCompanyField('pincode') || '';
      const companyPhone = getCompanyField('phone') || '';
      const companyEmail = getCompanyField('email') || '';
      const companyGstin = getCompanyField('gstin') || '';
      const companyPan = getCompanyField('pan') || '';
      const companyState = getCompanyField('state') || '';
      const companyStateCode = getCompanyField('state_code') || '';

      for (let i = 0; i < filteredInvoices.length; i++) {
        const invSummary = filteredInvoices[i];
        const invoice = await fetchInvoiceById(invSummary.id);
        if (!invoice) continue;

        if (i > 0) doc.addPage();

        // Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(companyName.toUpperCase(), 297, 40, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const headerLines = [
          companyAddress,
          `${companyCity}${companyPincode ? ' - ' + companyPincode : ''}`,
          `Phone: ${companyPhone} | Email: ${companyEmail}`,
          `GSTIN: ${companyGstin} | PAN: ${companyPan} | State: ${companyState} (${companyStateCode})`
        ].filter(Boolean);
        headerLines.forEach((line, j) => doc.text(line, 297, 55 + (j * 12), { align: 'center' }));

        doc.setLineWidth(1);
        doc.line(40, 105, 555, 105);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("TAX INVOICE", 297, 120, { align: 'center' });

        doc.setFontSize(8);
        doc.text(`Invoice No: ${invoice.invoiceNumber}`, 40, 140);
        doc.text(`Date: ${invoice.date.split('T')[0]}`, 40, 152);
        doc.text(`Due Date: ${invoice.dueDate.split('T')[0]}`, 40, 164);
        
        doc.text(`IRN: ${invoice.irnNo || 'N/A'}`, 300, 140);
        doc.text(`Ack No: ${invoice.ackNo || 'N/A'}`, 300, 152);
        doc.text(`Order No: ${invoice.orderNo || 'N/A'}`, 300, 164);

        // Parties
        doc.rect(40, 175, 255, 80);
        doc.text("BUYER (BILL TO)", 45, 187);
        doc.setFont('helvetica', 'normal');
        doc.text(invoice.customerName, 45, 200);
        doc.text(invoice.customerAddress, 45, 210, { maxWidth: 240 });
        doc.text(`GSTIN: ${invoice.customerGstin} | PAN: ${invoice.customerPan}`, 45, 235);

        doc.rect(300, 175, 255, 80);
        doc.setFont('helvetica', 'bold');
        doc.text("CONSIGNEE (SHIP TO)", 305, 187);
        doc.setFont('helvetica', 'normal');
        doc.text(invoice.customerName, 305, 200);
        doc.text(invoice.deliveryAddress.address || invoice.customerAddress, 305, 210, { maxWidth: 240 });

        // Table
        const tableData = invoice.items.map((item, idx) => [
          idx + 1,
          item.partNo,
          item.productName,
          item.hsnCode,
          item.mrpPerUnit.toFixed(2),
          item.effectivePrice.toFixed(2),
          item.qty,
          `${item.discountPercent}%`,
          item.discountAmount.toFixed(2),
          item.basicAmount.toFixed(2),
          `${item.gstRate}%`,
          item.gstAmount.toFixed(2),
          item.lineTotal.toFixed(2)
        ]);

        if (invoice.freightCharges > 0) {
          tableData.push([
            invoice.items.length + 1,
            '9965',
            'Freight Charges',
            '9965',
            '',
            '',
            1,
            '',
            '',
            invoice.freightCharges.toFixed(2),
            '18%',
            invoice.freightGst.toFixed(2),
            (invoice.freightCharges + invoice.freightGst).toFixed(2)
          ]);
        }

        (doc as any).autoTable({
          head: [['Sr', 'Part', 'Description', 'HSN', 'MRP', 'Rate', 'Qty', 'D%', 'D(Rs)', 'Taxable', 'G%', 'G(Rs)', 'Amt']],
          body: tableData,
          startY: 265,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [40, 40, 40] }
        });

        let finalY = (doc as any).lastAutoTable.finalY;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`Goods Taxable: ${formatCurrency(invoice.subtotalBasic)}`, 400, finalY + 20);
        doc.text(`Total GST: ${formatCurrency(invoice.totalIgst || (invoice.totalCgst + invoice.totalSgst))}`, 400, finalY + 32);
        doc.text(`BILL TOTAL: ${formatCurrency(invoice.grandTotal)}`, 400, finalY + 45);
        doc.text(`Amount in Words: ${numberToWords(invoice.grandTotal)}`, 40, finalY + 60);

        doc.setFontSize(6);
        TERMS.forEach((t, idx) => doc.text(`${idx+1}. ${t}`, 40, finalY + 80 + (idx * 8)));
      }

      const fileName = `Invoices_${fromDate || 'Start'}_to_${toDate || 'End'}.pdf`;
      doc.save(fileName);
      toast.success('PDF export complete', { id: toastId });
    } catch (err) {
      toast.error('PDF export failed', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Sales Register</h2>
          <p className="text-sm text-slate-500 font-medium">Manage and track all GST-compliant invoices.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            disabled={isExporting}
            onClick={handleBulkExportExcel}
            className="rounded-3xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
          </button>
          <button 
            disabled={isExporting}
            onClick={handleBulkExportPdf}
            className="rounded-3xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-rose-600" /> PDF
          </button>
          <Link
            to="/sales/invoices/new"
            className="inline-flex items-center gap-2 justify-center rounded-3xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 shadow-lg"
          >
            <Plus className="w-4 h-4" /> Generate New
          </Link>
        </div>
      </div>

      <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by invoice # or buyer name..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm outline-none transition focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950"
              />
            </div>
            
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-950">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent text-xs font-bold outline-none" 
                  placeholder="From"
                />
                <span className="text-slate-300">/</span>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent text-xs font-bold outline-none" 
                  placeholder="To"
                />
              </div>
              {(search || fromDate || toDate) && (
                <button 
                  onClick={handleClearFilters}
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors"
                  title="Clear Filters"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
            <Filter className="w-3 h-3" />
            Showing {filteredInvoices.length} of {invoices.length} Invoices
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-300">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-black border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-4">Invoice Number</th>
                <th className="px-4 py-4">Buyer / Customer</th>
                <th className="px-4 py-4 text-center">Billing Date</th>
                <th className="px-4 py-4 text-right">Grand Total</th>
                <th className="px-4 py-4 text-center">Status</th>
                <th className="px-4 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-900">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader className="w-6 h-6 animate-spin text-indigo-600" />
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Fetching Sales Records...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest italic">No matching invoices found.</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group">
                    <td className="px-4 py-4 font-mono">
                      <Link 
                        to={`/sales/invoices/${invoice.id}`}
                        className="font-black text-slate-900 dark:text-slate-100 hover:text-indigo-600 transition-colors"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                      {invoice.irnNo && <div className="text-[9px] font-bold text-slate-400 truncate w-32">IRN: {invoice.irnNo}</div>}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-700 dark:text-slate-300">{invoice.customerName}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="font-mono text-xs text-slate-500">{invoice.date.split('T')[0]}</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="font-black text-slate-900 dark:text-slate-100">₹{invoice.grandTotal.toFixed(2)}</div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        invoice.status === 'Draft' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-center gap-1">
                        <Link
                          to={`/sales/invoices/${invoice.id}`}
                          title="View Details"
                          className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-all"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/sales/invoices/edit/${invoice.id}`}
                          title="Edit Invoice"
                          className="p-2 rounded-xl text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-all"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(invoice.id)}
                          title="Delete Invoice"
                          className="p-2 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
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

