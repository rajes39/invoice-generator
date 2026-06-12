import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { deleteInvoice, mapInvoiceFromDb, numberToWords } from '../services/invoiceService';
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
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data ?? []).map(mapInvoiceFromDb);
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
    let result = invoices.filter(inv => {
      const matchesSearch = inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
                           inv.customerName.toLowerCase().includes(search.toLowerCase());
      
      const invDate = (inv.date || '').split('T')[0];
      const matchesFrom = !fromDate || invDate >= fromDate;
      const matchesTo = !toDate || invDate <= toDate;

      return matchesSearch && matchesFrom && matchesTo;
    });

    return result.sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [invoices, search, fromDate, toDate]);

  const handleDelete = async (id: string) => {
    if (!confirm('PERMANENT ACTION: Are you sure you want to delete this invoice?')) return;
    try {
      await deleteInvoice(id);
      toast.success('Invoice deleted');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
  };

  const handleBulkExportExcel = () => {
    if (filteredInvoices.length === 0) {
      toast.error('No data to export');
      return;
    }

    setIsExporting(true);
    try {
      const allLines: any[] = [];
      
      filteredInvoices.forEach(inv => {
        (inv.items || []).forEach(item => {
          allLines.push({
            'Invoice No': inv.invoiceNumber,
            'Customer Name': inv.customerName,
            'Billing Date': (inv.date || '').split('T')[0],
            'MRP': item.mrpPerUnit || item.mrp_per_unit || 0,
            'Rate': item.effectivePrice || item.effective_price || 0,
            'Disc%': item.discountPercent || item.discount_percent || 0,
            'Taxable Amount': item.basicAmount || item.basic_amount || 0,
            'GST%': item.gstRate || item.gst_rate || 0,
            'GST Amount': item.gstAmount || item.gst_amount || 0,
            'Grand Total': inv.grandTotal
          });
        });

        if (inv.freightCharges > 0) {
          allLines.push({
            'Invoice No': inv.invoiceNumber,
            'Customer Name': inv.customerName,
            'Billing Date': (inv.date || '').split('T')[0],
            'MRP': 0,
            'Rate': inv.freightCharges,
            'Disc%': 0,
            'Taxable Amount': inv.freightCharges,
            'GST%': 18,
            'GST Amount': inv.freightGst,
            'Grand Total': inv.grandTotal
          });
        }
      });

      const ws = XLSX.utils.json_to_sheet(allLines);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Invoices");
      
      const fileName = `Invoices_${fromDate || 'Start'}_to_${toDate || 'End'}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Excel downloaded');
    } catch (err) {
      console.error('Excel Export Error:', err);
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
    const toastId = toast.loading('Generating Bulk PDF...');

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      
      // Helper for company fields
      const getComp = (field: string, fallback: string = '') => {
        if (!company) return fallback;
        const c = company as any;
        return c[field] || fallback;
      };

      const cName = getComp('company_name') || getComp('name') || 'MISTI AUTO CENTRE';
      const cAddr = getComp('address') || '';
      const cCity = getComp('city') || '';
      const cPin = getComp('pincode') || '';
      const cPhone = getComp('phone') || getComp('mobile') || '';
      const cEmail = getComp('email') || '';
      const cGstin = getComp('gstin') || '';
      const cPan = getComp('pan') || '';
      const cState = getComp('state') || '';
      const cStateCode = getComp('state_code') || '';
      const cBank = getComp('bank_name') || '';
      const cAcc = getComp('account_number') || '';
      const cIfsc = getComp('ifsc_code') || '';
      const cBranch = getComp('branch') || '';

      for (let i = 0; i < filteredInvoices.length; i++) {
        const inv = filteredInvoices[i];
        if (i > 0) doc.addPage();

        // 1. Header
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(cName.toUpperCase(), 297, 40, { align: 'center' });
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const headerLines = [
          cAddr,
          `${cCity}${cPin ? ' - ' + cPin : ''}`,
          `Phone: ${cPhone} | Email: ${cEmail}`,
          `GSTIN: ${cGstin} | PAN: ${cPan} | State: ${cState} (${cStateCode})`
        ].filter(Boolean);
        headerLines.forEach((line, j) => doc.text(line, 297, 55 + (j * 12), { align: 'center' }));

        doc.setLineWidth(1);
        doc.line(40, 105, 555, 105);

        // 2. Title
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("TAX INVOICE", 297, 120, { align: 'center' });

        // 3. Meta Info
        doc.setFontSize(8);
        doc.text(`Invoice No: ${inv.invoiceNumber}`, 40, 140);
        doc.text(`Date: ${(inv.date || '').split('T')[0]}`, 40, 152);
        doc.text(`Due Date: ${(inv.dueDate || '').split('T')[0]}`, 40, 164);
        
        doc.text(`IRN: ${inv.irnNo || 'N/A'}`, 300, 140);
        doc.text(`Ack No/Date: ${inv.ackNo || ''} ${inv.ackDate ? `(${inv.ackDate})` : ''}`, 300, 152);
        doc.text(`Order No: ${inv.orderNo || 'N/A'}`, 300, 164);

        // 4. Parties Boxes
        doc.rect(40, 175, 255, 80);
        doc.text("BUYER (BILL TO)", 45, 187);
        doc.setFont('helvetica', 'normal');
        doc.text(inv.customerName, 45, 200);
        doc.text(inv.customerAddress || '', 45, 210, { maxWidth: 240 });
        doc.text(`GSTIN: ${inv.customerGstin || 'URD'} | PAN: ${inv.customerPan || 'N/A'}`, 45, 235);
        doc.text(`Phone: ${inv.customerPhone || 'N/A'}`, 45, 245);

        doc.rect(300, 175, 255, 80);
        doc.setFont('helvetica', 'bold');
        doc.text("CONSIGNEE (SHIP TO)", 305, 187);
        doc.setFont('helvetica', 'normal');
        doc.text(inv.customerName, 305, 200);
        doc.text(inv.deliveryAddress?.address || inv.customerAddress || '', 305, 210, { maxWidth: 240 });

        // 5. Items Table
        const tableData = (inv.items || []).map((item, idx) => [
          idx + 1,
          item.partNo || item.part_no || '',
          item.productName || item.product_name || '',
          item.hsnCode || item.hsn_code || '',
          (item.mrpPerUnit || item.mrp_per_unit || 0).toFixed(2),
          (item.effectivePrice || item.effective_price || 0).toFixed(2),
          item.qty,
          `${item.discountPercent || item.discount_percent || 0}%`,
          (item.discountAmount || item.discount_amount || 0).toFixed(2),
          (item.basicAmount || item.basic_amount || 0).toFixed(2),
          `${item.gstRate || item.gst_rate || 0}%`,
          (item.gstAmount || item.gst_amount || 0).toFixed(2),
          (item.lineTotal || item.line_total || 0).toFixed(2)
        ]);

        if (inv.freightCharges > 0) {
          tableData.push([
            (inv.items?.length || 0) + 1,
            '9965',
            'Freight Charges',
            '9965',
            '',
            '',
            1,
            '',
            '',
            inv.freightCharges.toFixed(2),
            '18%',
            inv.freightGst.toFixed(2),
            (inv.freightCharges + inv.freightGst).toFixed(2)
          ]);
        }

        (doc as any).autoTable({
          head: [['Sr', 'Part', 'Description', 'HSN', 'MRP', 'Rate', 'Qty', 'D%', 'D(Rs)', 'Taxable', 'G%', 'G(Rs)', 'Amt']],
          body: tableData,
          startY: 265,
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [40, 40, 40] },
          columnStyles: {
            0: { cellWidth: 20 },
            2: { cellWidth: 100 },
            12: { halign: 'right', fontStyle: 'bold' }
          }
        });

        let finalY = (doc as any).lastAutoTable.finalY;

        // 6. Totals Section
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`Goods Taxable:`, 400, finalY + 20);
        doc.text(formatCurrency(inv.subtotalBasic), 550, finalY + 20, { align: 'right' });

        let yOff = 20;
        if (inv.freightCharges > 0) {
          yOff += 12;
          doc.text(`Freight + GST:`, 400, finalY + yOff);
          doc.text(formatCurrency(inv.freightCharges + inv.freightGst), 550, finalY + yOff, { align: 'right' });
        }

        yOff += 12;
        doc.text(`Total GST:`, 400, finalY + yOff);
        doc.text(formatCurrency(inv.totalIgst || (inv.totalCgst + inv.totalSgst)), 550, finalY + yOff, { align: 'right' });

        yOff += 12;
        doc.setFontSize(11);
        doc.rect(395, finalY + yOff, 160, 25);
        doc.text(`BILL TOTAL:`, 400, finalY + yOff + 17);
        doc.text(formatCurrency(inv.grandTotal), 550, finalY + yOff + 17, { align: 'right' });

        // 7. Amount in Words
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bolditalic');
        doc.text(`Amount in Words: ${numberToWords(inv.grandTotal)} Only`, 40, finalY + yOff + 40);

        // 8. Bank Details
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text("BANK DETAILS:", 40, finalY + yOff + 60);
        doc.setFont('helvetica', 'normal');
        if (cBank) doc.text(`Bank: ${cBank} | A/c: ${cAcc}`, 40, finalY + yOff + 72);
        if (cIfsc) doc.text(`IFSC: ${cIfsc} | Branch: ${cBranch}`, 40, finalY + yOff + 84);

        // 9. T&C
        doc.setFont('helvetica', 'bold');
        doc.text("TERMS & CONDITIONS:", 40, finalY + yOff + 105);
        doc.setFontSize(6);
        TERMS.forEach((t, idx) => doc.text(`${idx+1}. ${t}`, 40, finalY + yOff + 115 + (idx * 8)));

        // 10. Signatures
        doc.line(40, finalY + yOff + 180, 150, finalY + yOff + 180);
        doc.text("Receiver Signature", 40, finalY + yOff + 192);

        doc.setFontSize(8);
        doc.text(`For ${cName.toUpperCase()}`, 400, finalY + yOff + 170);
        doc.line(400, finalY + yOff + 180, 555, finalY + yOff + 180);
        doc.text("Authorised Signatory", 400, finalY + yOff + 192);
      }

      const fileName = `Invoices_${fromDate || 'Start'}_to_${toDate || 'End'}.pdf`;
      doc.save(fileName);
      toast.success('Bulk PDF Downloaded', { id: toastId });
    } catch (err) {
      console.error('PDF Export Error:', err);
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
            disabled={isExporting || isLoading}
            onClick={handleBulkExportExcel}
            className="rounded-3xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isExporting ? <Loader className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
            Excel
          </button>
          <button 
            disabled={isExporting || isLoading}
            onClick={handleBulkExportPdf}
            className="rounded-3xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isExporting ? <Loader className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-rose-600" />}
            PDF
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
                      <div className="font-mono text-xs text-slate-500">{(invoice.date || '').split('T')[0]}</div>
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
