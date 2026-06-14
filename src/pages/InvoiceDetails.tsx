import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  Printer, 
  Download, 
  FileSpreadsheet, 
  Loader,
  Truck,
  ExternalLink
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Invoice, CompanySettings } from '../types/index';
import { numberToWords, fetchInvoiceById } from '../services/invoiceService';
import { generateInvoicePDFPage } from '../services/pdfService';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
}

const TERMS = [
  "GOODS ONCE SOLD CANNOT BE TAKEN BACK",
  "OUR RESPONSIBILITY CEASES WHEN GOODS LEAVE OUR PREMISES",
  "INTEREST @18% PA WILL BE CHARGED IF BILL NOT PAID WITHIN 7 DAYS",
  "ALL DISPUTES ARE SUBJECT TO LOCAL JURISDICTION ONLY",
  "ALL CHEQUES ARE SUBJECT TO REALIZATION",
  "CHEQUE DISHONOURED CHARGES @ RS.500/- PER LEAF"
];

function EWayBillButton({ invoice, companyGstin }: { invoice: any; companyGstin: string }) {
  const [showInfo, setShowInfo] = useState(false);

  const copyDetails = () => {
    const details = `E-Way Bill Details:
Invoice No: ${invoice.invoiceNumber}
Invoice Date: ${invoice.date?.split('T')[0]}
Supplier GSTIN: ${companyGstin || 'N/A'}
Recipient GSTIN: ${invoice.customerGstin}
Recipient Name: ${invoice.customerName}
Invoice Value: ₹${invoice.grandTotal}
Delivery State: ${invoice.deliveryAddress?.state || 'N/A'}
Delivery Pincode: ${invoice.deliveryAddress?.pincode || 'N/A'}`;
    navigator.clipboard.writeText(details);
    alert('Details copied! E-Way Bill portal এ paste করুন।');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="rounded-3xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-500 flex items-center gap-2 shadow-lg"
      >
        <Truck className="w-4 h-4" /> E-Way Bill
      </button>
      {showInfo && (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl bg-white border border-blue-200 shadow-xl p-4 space-y-3">
          <p className="text-xs font-black text-blue-800 uppercase tracking-wider">E-Way Bill Details</p>
          <div className="space-y-1 text-xs text-slate-700">
            <div className="flex justify-between"><span className="text-slate-500">Invoice No:</span><span className="font-bold">{invoice.invoiceNumber}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Supplier GSTIN:</span><span className="font-bold">{companyGstin || 'Company Profile এ set করুন'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Recipient GSTIN:</span><span className="font-bold">{invoice.customerGstin}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Invoice Value:</span><span className="font-bold">₹{invoice.grandTotal?.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Delivery State:</span><span className="font-bold">{invoice.deliveryAddress?.state || 'N/A'}</span></div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={copyDetails} className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700">
              Copy Details
            </button>
            <button onClick={() => window.open('https://ewaybillgst.gov.in', '_blank')} className="flex-1 rounded-xl bg-green-600 py-2 text-xs font-bold text-white hover:bg-green-700 flex items-center justify-center gap-1">
              Open Portal <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 italic">Details copy করুন → Portal এ login করুন → paste করে submit করুন</p>
        </div>
      )}
    </div>
  );
}

export default function InvoiceDetails() {
  const { id } = useParams();

  const { data: invoice, isLoading: isInvLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => fetchInvoiceById(id as string),
    enabled: Boolean(id),
  });

  const { data: company, isLoading: isSettingsLoading } = useQuery<CompanySettings>({
    queryKey: ['company_settings_session'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null as any;
      
      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      return data;
    },
  });

  // Combine GST Summary for goods and freight
  const goodsGstSummary = invoice ? invoice.items.reduce((acc: any, item) => {
    const rate = item.gstRate;
    if (!acc[rate]) {
      acc[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    }
    acc[rate].taxable += item.basicAmount;
    if (invoice.totalIgst > 0) {
      acc[rate].igst += item.gstAmount;
    } else {
      acc[rate].cgst += item.gstAmount / 2;
      acc[rate].sgst += item.gstAmount / 2;
    }
    return acc;
  }, {}) : {};

  if (invoice && invoice.freightCharges > 0) {
    const rate = 18;
    if (!goodsGstSummary[rate]) {
      goodsGstSummary[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    }
    goodsGstSummary[rate].taxable += invoice.freightCharges;
    if (invoice.totalIgst > 0) {
      goodsGstSummary[rate].igst += invoice.freightGst;
    } else {
      goodsGstSummary[rate].cgst += invoice.freightGst / 2;
      goodsGstSummary[rate].sgst += invoice.freightGst / 2;
    }
  }

  const gstSummary = goodsGstSummary;

  // Safe company field getter
  const getCompanyField = (field: string, fallback: string = '') => {
    if (!company) return fallback;
    const c = company as any;
    return c[field] || fallback;
  };

  const companyName = getCompanyField('company_name') || getCompanyField('name') || 'YOUR COMPANY NAME';
  const companyAddress = getCompanyField('address') || '';
  const companyCity = getCompanyField('city') || '';
  const companyPincode = getCompanyField('pincode') || '';
  const companyPhone = getCompanyField('phone') || getCompanyField('mobile') || '';
  const companyEmail = getCompanyField('email') || '';
  const companyGstin = getCompanyField('gstin') || '';
  const companyPan = getCompanyField('pan') || '';
  const companyState = getCompanyField('state') || '';
  const companyStateCode = getCompanyField('state_code') || '';
  const companyLogoUrl = getCompanyField('logo_url') || '';
  const companyBankName = getCompanyField('bank_name') || '';
  const companyAccountNumber = getCompanyField('account_number') || '';
  const companyIfsc = getCompanyField('ifsc_code') || '';
  const companyBranch = getCompanyField('branch') || '';

  const exportExcel = () => {
    if (!invoice) return;
    let csv = `TAX INVOICE\n\n`;
    csv += `Company,${companyName}\nGSTIN,${companyGstin}\n\n`;
    csv += `Invoice No,${invoice.invoiceNumber}\nDate,${invoice.date}\nCustomer,${invoice.customerName}\n\n`;
    csv += 'Sr,Part No,Description,HSN,MRP,Rate,Qty,Disc %,Disc Rs,Taxable Amt,GST %,GST Tax,Amount\n';
    
    invoice.items.forEach((item, i) => {
      csv += `${i+1},${item.partNo},"${item.productName}",${item.hsnCode},${item.mrpPerUnit},${item.effectivePrice},${item.qty},${item.discountPercent},${item.discountAmount},${item.basicAmount},${item.gstRate},${item.gstAmount},${item.lineTotal}\n`;
    });

    if (invoice.freightCharges > 0) {
      csv += `${invoice.items.length + 1},9965,Freight Charges,9965,,,1,,,${invoice.freightCharges},18,${invoice.freightGst},${(invoice.freightCharges + invoice.freightGst)}\n`;
    }
    
    csv += `\n,,,TOTALS,,,,,,${(invoice.subtotalBasic + invoice.freightCharges)},,${(invoice.totalCgst + invoice.totalSgst + invoice.totalIgst)},${invoice.grandTotal}\n`;
    csv += `Amount in Words,${numberToWords(invoice.grandTotal)}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_${invoice.invoiceNumber.replace(/\//g, '_')}.csv`;
    a.click();
  };

  const downloadPdf = () => {
    if (!invoice) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    generateInvoicePDFPage(doc, invoice, company || null);
    doc.save(`Invoice_${invoice.invoiceNumber.replace(/\//g, '_')}.pdf`);
  };


  if (isInvLoading || isSettingsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader className="animate-spin w-8 h-8 text-slate-400" />
      </div>
    );
  }

  if (!invoice) {
    return <div className="p-10 text-center font-bold">Error: Invoice Data Not Found.</div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <style>{`
        .invoice-paper {
          font-family: 'Inter', system-ui, sans-serif;
          width: 210mm;
          min-height: 297mm;
          background: white;
          color: black;
          line-height: 1.2;
        }
        .item-table th, .item-table td { border: 0.5pt solid #e2e8f0; }
        .gst-table th, .gst-table td { border: 0.5pt solid #e2e8f0; }
        .dark .item-table th, .dark .item-table td { border-color: #1e293b; }
        @media print {
          .invoice-paper {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .item-table th, .item-table td, .gst-table th, .gst-table td { 
            border: 0.5pt solid #000 !important; 
          }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Buttons */}
      <div className="no-print flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-0">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Tax Invoice Preview</h2>
          <p className="text-sm text-slate-500 font-medium">Professional GST-compliant document for {invoice.invoiceNumber}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => window.print()} className="rounded-3xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 flex items-center gap-2 shadow-sm">
            <Printer className="w-4 h-4" /> Print (A4)
          </button>
          <button onClick={exportExcel} className="rounded-3xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-900/10">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={downloadPdf} className="rounded-3xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 flex items-center gap-2 shadow-lg">
            <Download className="w-4 h-4" /> Download PDF
          </button>
          <EWayBillButton invoice={invoice} companyGstin={companyGstin} />
        </div>
      </div>

      {/* Invoice Paper Layout */}
      <div className="invoice-paper invoice-print-area mx-auto border border-slate-200 p-8 shadow-2xl dark:border-slate-800 rounded-sm">
        
        {/* Company Header */}
        <div className="border-b-2 border-black pb-4 mb-4">
          <div className="flex justify-between items-start gap-6">
            <div className="space-y-1 text-left flex-1">
              <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">{companyName}</h1>
              <div className="text-[10px] font-bold text-slate-700 space-y-0.5">
                <p>{companyAddress}{companyCity ? ', ' + companyCity : ''}{companyPincode ? ' - ' + companyPincode : ''}</p>
                <p>Phone: {companyPhone || 'N/A'} | Email: {companyEmail || 'N/A'}</p>
                <div className="flex gap-4 pt-1">
                  <p className="text-black font-black">GSTIN: {companyGstin || 'N/A'}</p>
                  <p className="text-black font-black">PAN: {companyPan || 'N/A'}</p>
                  <p className="font-black">STATE: {companyState.toUpperCase() || 'N/A'} ({companyStateCode || ''})</p>
                </div>
              </div>
            </div>
            {companyLogoUrl && (
              <div className="shrink-0 border border-slate-200 p-1">
                <img src={companyLogoUrl} className="h-16 w-auto object-contain" alt="Logo" />
              </div>
            )}
          </div>
        </div>

        <div className="text-center mb-4">
           <h2 className="text-lg font-black border-2 border-black inline-block px-10 py-0.5 uppercase tracking-widest">Tax Invoice</h2>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-0 border border-black mb-4 text-[10px]">
           <div className="border-r border-black p-2 space-y-1">
             <p className="font-black border-b border-black pb-0.5 uppercase mb-1">Buyer (Bill To)</p>
             <p className="text-[11px] font-black">{invoice.customerName}</p>
             <p className="font-bold leading-tight">{invoice.customerAddress}</p>
             <p className="font-bold">{invoice.customerCity} - {invoice.customerState}</p>
             <div className="pt-1">
               <p className="font-black">GSTIN: <span className="font-mono">{invoice.customerGstin || 'URD'}</span></p>
               <p className="font-bold">PAN: <span className="font-mono">{invoice.customerPan || 'N/A'}</span></p>
               <p className="font-bold">Phone: <span className="font-mono">{invoice.customerPhone || 'N/A'}</span></p>
             </div>
           </div>

           <div className="grid grid-rows-4 divide-y divide-black">
             <div className="grid grid-cols-2 divide-x divide-black p-2">
               <div>
                 <p className="text-[8px] font-black uppercase text-slate-500">Invoice No</p>
                 <p className="font-black">{invoice.invoiceNumber}</p>
               </div>
               <div>
                 <p className="text-[8px] font-black uppercase text-slate-500">Dated</p>
                 <p className="font-black">{invoice.date.split('T')[0]}</p>
               </div>
             </div>
             <div className="grid grid-cols-2 divide-x divide-black p-2">
               <div>
                 <p className="text-[8px] font-black uppercase text-slate-500">Order No</p>
                 <p className="font-bold">{invoice.orderNo || 'N/A'}</p>
               </div>
               <div>
                 <p className="text-[8px] font-black uppercase text-slate-500">Due Date</p>
                 <p className="font-bold">{invoice.dueDate.split('T')[0]}</p>
               </div>
             </div>
             <div className="p-2">
                <p className="text-[8px] font-black uppercase text-slate-500">IRN No</p>
                <p className="font-bold truncate text-[9px]">{invoice.irnNo || 'N/A'}</p>
             </div>
             <div className="grid grid-cols-2 divide-x divide-black p-2">
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-500">Ack No</p>
                  <p className="font-bold">{invoice.ackNo || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black uppercase text-slate-500">Ack Date</p>
                  <p className="font-bold">{invoice.ackDate || 'N/A'}</p>
                </div>
             </div>
           </div>
        </div>

        {/* Ship To Section */}
        <div className="border border-black border-t-0 p-2 text-[10px] mb-4">
          <p className="font-black border-b border-black pb-0.5 uppercase mb-1 w-fit pr-4">Consignee (Ship To)</p>
          <p className="font-black">{invoice.customerName}</p>
          <p className="font-bold">{invoice.deliveryAddress.address || invoice.customerAddress}</p>
          <p className="font-bold">{invoice.deliveryAddress.city} - {invoice.deliveryAddress.state} ({invoice.deliveryAddress.pincode})</p>
        </div>

        {/* Item Table */}
        <div className="border border-black overflow-hidden mb-0">
          <table className="min-w-full text-[9px] text-left border-collapse item-table">
            <thead className="bg-slate-50 text-black uppercase font-black border-b border-black">
              <tr>
                <th className="px-1 py-1 border-r border-black text-center w-8">Sr</th>
                <th className="px-1 py-1 border-r border-black">Description of Goods</th>
                <th className="px-1 py-1 border-r border-black text-center">HSN</th>
                <th className="px-1 py-1 border-r border-black text-right">MRP</th>
                <th className="px-1 py-1 border-r border-black text-right">Rate</th>
                <th className="px-1 py-1 border-r border-black text-center">Qty</th>
                <th className="px-1 py-1 border-r border-black text-right">Disc%</th>
                <th className="px-1 py-1 border-r border-black text-right">Taxable</th>
                <th className="px-1 py-1 border-r border-black text-center">GST%</th>
                <th className="px-1 py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i} className="font-medium h-6">
                  <td className="px-1 py-0.5 border-r border-black text-center">{i + 1}</td>
                  <td className="px-1 py-0.5 border-r border-black">
                    <p className="font-black uppercase">{item.productName}</p>
                    <p className="text-[7px] text-slate-500">PART NO: {item.partNo}</p>
                  </td>
                  <td className="px-1 py-0.5 border-r border-black text-center font-mono">{item.hsnCode}</td>
                  <td className="px-1 py-0.5 border-r border-black text-right">₹{item.mrpPerUnit.toFixed(2)}</td>
                  <td className="px-1 py-0.5 border-r border-black text-right font-bold">₹{item.effectivePrice.toFixed(2)}</td>
                  <td className="px-1 py-0.5 border-r border-black text-center font-black">{item.qty}</td>
                  <td className="px-1 py-0.5 border-r border-black text-right">{item.discountPercent}%</td>
                  <td className="px-1 py-0.5 border-r border-black text-right font-bold">₹{item.basicAmount.toFixed(2)}</td>
                  <td className="px-1 py-0.5 border-r border-black text-center font-bold">{item.gstRate}%</td>
                  <td className="px-1 py-0.5 text-right font-black">₹{item.lineTotal.toFixed(2)}</td>
                </tr>
              ))}
              {/* Freight Row if applicable */}
              {invoice.freightCharges > 0 && (
                <tr className="font-medium h-6 border-t border-black">
                  <td className="px-1 py-0.5 border-r border-black text-center">{invoice.items.length + 1}</td>
                  <td className="px-1 py-0.5 border-r border-black font-black uppercase">Freight Charges</td>
                  <td className="px-1 py-0.5 border-r border-black text-center font-mono">9965</td>
                  <td className="px-1 py-0.5 border-r border-black text-right"></td>
                  <td className="px-1 py-0.5 border-r border-black text-right"></td>
                  <td className="px-1 py-0.5 border-r border-black text-center font-black">1</td>
                  <td className="px-1 py-0.5 border-r border-black text-right"></td>
                  <td className="px-1 py-0.5 border-r border-black text-right font-bold">₹{invoice.freightCharges.toFixed(2)}</td>
                  <td className="px-1 py-0.5 border-r border-black text-center font-bold">18%</td>
                  <td className="px-1 py-0.5 text-right font-black">₹{(invoice.freightCharges + invoice.freightGst).toFixed(2)}</td>
                </tr>
              )}
              {/* Filler rows */}
              {[...Array(Math.max(0, 15 - invoice.items.length - (invoice.freightCharges > 0 ? 1 : 0)))].map((_, idx) => (
                <tr key={`filler-${idx}`} className="h-6">
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className="border-r border-black"></td>
                  <td className=""></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-black border-t border-black">
              <tr>
                <td colSpan={5} className="px-1 py-1 text-right uppercase text-[8px]">Totals</td>
                <td className="px-1 py-1 text-center border-l border-black">{invoice.items.reduce((sum, item) => sum + item.qty, 0) + (invoice.freightCharges > 0 ? 1 : 0)}</td>
                <td className="px-1 py-1 text-right border-l border-black">{invoice.totalDiscountAmount.toFixed(2)}</td>
                <td className="px-1 py-1 text-right border-l border-black">₹{(invoice.subtotalBasic + invoice.freightCharges).toFixed(2)}</td>
                <td className="px-1 py-1 border-l border-black"></td>
                <td className="px-1 py-1 text-right border-l border-black">₹{invoice.grandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* GST Tax Summary Table */}
        <div className="mb-0 border border-black border-t-0 overflow-hidden">
          <table className="min-w-full text-[8px] text-left border-collapse gst-table">
            <thead className="bg-slate-50 text-black uppercase font-bold">
              <tr>
                <th rowSpan={2} className="px-1 py-0.5 border-r border-black text-center">GST Rate</th>
                <th rowSpan={2} className="px-1 py-0.5 border-r border-black text-right">Taxable Val</th>
                {invoice.totalIgst > 0 ? (
                  <th colSpan={2} className="px-1 py-0.5 border-b border-black text-center">IGST</th>
                ) : (
                  <>
                    <th colSpan={2} className="px-1 py-0.5 border-r border-b border-black text-center">CGST</th>
                    <th colSpan={2} className="px-1 py-0.5 border-b border-black text-center">SGST</th>
                  </>
                )}
                <th rowSpan={2} className="px-1 py-0.5 text-right">Total Tax</th>
              </tr>
              <tr className="bg-slate-50 border-b border-black">
                {invoice.totalIgst > 0 ? (
                  <>
                    <th className="px-1 py-0.5 border-r border-black text-right">Rate</th>
                    <th className="px-1 py-0.5 border-r border-black text-right">Amount</th>
                  </>
                ) : (
                  <>
                    <th className="px-1 py-0.5 border-r border-black text-right">Rate</th>
                    <th className="px-1 py-0.5 border-r border-black text-right">Amount</th>
                    <th className="px-1 py-0.5 border-r border-black text-right">Rate</th>
                    <th className="px-1 py-0.5 border-r border-black text-right">Amount</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-black font-mono">
              {Object.entries(gstSummary).map(([rate, vals]: [string, any]) => (
                <tr key={rate}>
                  <td className="px-1 py-0.5 border-r border-black text-center font-bold">{rate}%</td>
                  <td className="px-1 py-0.5 border-r border-black text-right">₹{vals.taxable.toFixed(2)}</td>
                  {invoice.totalIgst > 0 ? (
                    <>
                      <td className="px-1 py-0.5 border-r border-black text-right">{rate}%</td>
                      <td className="px-1 py-0.5 border-r border-black text-right">₹{vals.igst.toFixed(2)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-1 py-0.5 border-r border-black text-right">{(parseFloat(rate)/2)}%</td>
                      <td className="px-1 py-0.5 border-r border-black text-right">₹{vals.cgst.toFixed(2)}</td>
                      <td className="px-1 py-0.5 border-r border-black text-right">{(parseFloat(rate)/2)}%</td>
                      <td className="px-1 py-0.5 border-r border-black text-right">₹{vals.sgst.toFixed(2)}</td>
                    </>
                  )}
                  <td className="px-1 py-0.5 text-right font-black">₹{(vals.igst || (vals.cgst + vals.sgst)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-black border-t border-black bg-slate-50">
              <tr>
                <td className="px-1 py-0.5 border-r border-black text-right">TOTAL</td>
                <td className="px-1 py-0.5 border-r border-black text-right">₹{(invoice.subtotalBasic + invoice.freightCharges).toFixed(2)}</td>
                {invoice.totalIgst > 0 ? (
                   <>
                    <td className="border-r border-black"></td>
                    <td className="px-1 py-0.5 border-r border-black text-right">₹{invoice.totalIgst.toFixed(2)}</td>
                   </>
                ) : (
                  <>
                    <td className="border-r border-black"></td>
                    <td className="px-1 py-0.5 border-r border-black text-right">₹{invoice.totalCgst.toFixed(2)}</td>
                    <td className="border-r border-black"></td>
                    <td className="px-1 py-0.5 border-r border-black text-right">₹{invoice.totalSgst.toFixed(2)}</td>
                  </>
                )}
                <td className="px-1 py-0.5 text-right">₹{(invoice.totalIgst || (invoice.totalCgst + invoice.totalSgst)).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer Section */}
        <div className="border border-black border-t-0 grid grid-cols-12 text-[9px]">
           <div className="col-span-8 p-2 border-r border-black space-y-2">
              <div>
                <p className="font-black uppercase text-[8px] text-slate-500 underline">Amount in words</p>
                <p className="font-black italic uppercase leading-tight">{numberToWords(invoice.grandTotal)} Only</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <p className="font-black uppercase text-[8px] text-slate-500 underline">Bank Details</p>
                   <p className="font-black">{companyBankName || 'N/A'}</p>
                   <p className="font-bold">A/C No: <span className="font-black font-mono">{companyAccountNumber || 'N/A'}</span></p>
                   <p className="font-bold">IFSC: <span className="font-black font-mono">{companyIfsc || 'N/A'}</span></p>
                   <p className="font-bold uppercase text-[7px]">Branch: {companyBranch || 'N/A'}</p>
                 </div>
                 <div>
                   <p className="font-black uppercase text-[8px] text-slate-500 underline">Terms & Conditions</p>
                   <div className="space-y-0.5">
                     {TERMS.slice(0, 4).map((t, idx) => <p key={idx} className="text-[7px] font-bold leading-tight uppercase">• {t}</p>)}
                   </div>
                 </div>
              </div>
           </div>

           <div className="col-span-4 flex flex-col divide-y divide-black">
              <div className="flex-1 p-2 space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Goods Taxable</span>
                  <span>₹{invoice.subtotalBasic.toFixed(2)}</span>
                </div>
                {invoice.freightCharges > 0 && (
                  <>
                    <div className="flex justify-between font-bold text-blue-700">
                      <span>Freight Charges</span>
                      <span>₹{invoice.freightCharges.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-blue-700">
                      <span>Freight GST (18%)</span>
                      <span>₹{invoice.freightGst.toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-bold">
                  <span>Total GST</span>
                  <span>₹{(invoice.totalIgst || (invoice.totalCgst + invoice.totalSgst)).toFixed(2)}</span>
                </div>
                {invoice.roundOff !== 0 && (
                  <div className="flex justify-between font-bold italic">
                    <span>Round Off</span>
                    <span>{invoice.roundOff > 0 ? '+' : ''}{invoice.roundOff.toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="p-2 bg-slate-50">
                 <div className="flex justify-between items-end">
                   <p className="font-black uppercase text-[8px]">Net Total</p>
                   <p className="text-xl font-black tracking-tighter leading-none">₹{invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Declaration & Signatures */}
        <div className="border border-black border-t-0 grid grid-cols-2 text-[10px]">
           <div className="p-2 border-r border-black flex flex-col justify-between">
              <p className="font-bold italic text-[8px]">Certified that the particulars given above are correct and complete.</p>
              <div className="pt-10">
                <div className="h-px border-b border-black w-32 mb-1"></div>
                <p className="font-black uppercase text-[8px]">Receiver's Signature</p>
              </div>
           </div>
           <div className="p-2 text-right flex flex-col justify-between items-end">
              <p className="font-black uppercase">For {companyName.toUpperCase()}</p>
              <div className="pt-10">
                <div className="h-px border-b border-black w-40 mb-1"></div>
                <p className="font-black uppercase text-[8px]">Authorised Signatory</p>
              </div>
           </div>
        </div>

        <div className="mt-2 text-center">
          <p className="text-[8px] font-black uppercase tracking-[0.4em] text-slate-400">This is a computer generated tax invoice</p>
        </div>

      </div>
    </div>
  );
}
