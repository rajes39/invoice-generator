import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  Printer, 
  Download, 
  ArrowLeft,
  Loader,
  FileText,
  User,
  MapPin,
  RotateCcw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchCreditNoteById } from '../services/creditNoteService';
import { numberToWords } from '../services/invoiceService';
import type { CreditNote, CompanySettings } from '../types';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

export default function CreditNoteDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: creditNote, isLoading } = useQuery<CreditNote>({
    queryKey: ['credit_note', id],
    queryFn: () => fetchCreditNoteById(id as string),
    enabled: !!id
  });

  const { data: company } = useQuery<CompanySettings>({
    queryKey: ['company_settings'],
    queryFn: async () => {
      const { data } = await supabase.from('company_settings').select('*').maybeSingle();
      return data;
    },
  });

  const generatePDF = () => {
    if (!creditNote || !company) return;

    const doc = new jsPDF();
    const companyName = company.companyName || company.company_name || 'Misti Auto Centre';

    // Header
    doc.setFontSize(20);
    doc.text((companyName || '').toUpperCase(), 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(company.address || '', 105, 28, { align: 'center' });
    doc.text(`${company.city || ''}, ${company.state || ''} - ${company.pincode || ''}`, 105, 34, { align: 'center' });
    doc.text(`GSTIN: ${company.gstin || ''} | Ph: ${company.phone || ''}`, 105, 40, { align: 'center' });

    doc.line(20, 45, 190, 45);

    // Credit Note Info
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('CREDIT NOTE', 105, 55, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`CN No: ${creditNote.creditNoteNumber}`, 20, 65);
    doc.text(`Date: ${new Date(creditNote.date).toLocaleDateString()}`, 20, 71);
    doc.setFont(undefined, 'bold');
    doc.text(`Ref Invoice: ${creditNote.originalInvoiceNumber}`, 20, 77);
    doc.setFont(undefined, 'normal');
    
    // Buyer Info
    doc.text('Customer:', 120, 65);
    doc.setFont(undefined, 'bold');
    doc.text(creditNote.customerName, 120, 71);
    doc.setFont(undefined, 'normal');
    doc.text(creditNote.customerAddress || '', 120, 77, { maxWidth: 80 });
    doc.text(`GSTIN: ${creditNote.customerGstin}`, 120, 89);

    // Table
    (doc as any).autoTable({
      startY: 100,
      head: [['Part No', 'Description', 'HSN', 'Qty', 'MRP', 'Basic', 'GST%', 'Total']],
      body: creditNote.items.map(item => [
        item.partNo,
        item.productName,
        item.hsnCode,
        item.qty,
        item.mrpPerUnit.toFixed(2),
        item.basicAmount.toFixed(2),
        item.gstRate + '%',
        item.lineTotal.toFixed(2)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [185, 28, 28] }, // Red for credit note
      styles: { fontSize: 8 }
    });

    const finalY = (doc as any).lastAutoTable.finalY;

    // Totals
    doc.setFontSize(10);
    doc.text(`Taxable Amount:`, 120, finalY + 10);
    doc.text(formatCurrency(creditNote.subtotalBasic), 190, finalY + 10, { align: 'right' });

    doc.text(`CGST:`, 120, finalY + 16);
    doc.text(formatCurrency(creditNote.totalCgst), 190, finalY + 16, { align: 'right' });

    doc.text(`SGST:`, 120, finalY + 22);
    doc.text(formatCurrency(creditNote.totalSgst), 190, finalY + 22, { align: 'right' });

    if (creditNote.roundOff !== 0) {
      doc.text(`Round Off:`, 120, finalY + 28);
      doc.text(creditNote.roundOff.toFixed(2), 190, finalY + 28, { align: 'right' });
    }

    doc.setFont(undefined, 'bold');
    doc.text(`Total Credit Amount:`, 120, finalY + 36);
    doc.text(formatCurrency(creditNote.totalAmount), 190, finalY + 36, { align: 'right' });

    doc.setFont(undefined, 'normal');
    doc.text(`Amount in words: ${numberToWords(creditNote.totalAmount)}`, 20, finalY + 50);
    doc.text(`Reason: ${creditNote.reason}`, 20, finalY + 60);

    doc.save(`CreditNote_${creditNote.creditNoteNumber}.pdf`);
  };

  if (isLoading) return <div className="p-8 text-center"><Loader className="animate-spin mx-auto" /> Loading Credit Note...</div>;
  if (!creditNote) return <div className="p-8 text-center">Credit Note not found</div>;

  const companyName = company?.companyName || company?.company_name || 'Misti Auto Centre';

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 pb-20">
      <div className="flex justify-between items-center no-print">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors flex items-center gap-2 text-sm font-bold">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex gap-4">
          <button onClick={() => window.print()} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 flex items-center gap-2 text-sm font-bold">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={generatePDF} className="px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 flex items-center gap-2 text-sm font-bold">
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-200 invoice-paper relative overflow-hidden">
        {/* Credit Note Badge */}
        <div className="absolute top-0 right-0 bg-rose-600 text-white px-10 py-2 rotate-45 translate-x-8 translate-y-4 font-black text-xs uppercase tracking-widest shadow-lg">
          Credit Note
        </div>

        {/* Header */}
        <div className="text-center border-b-2 border-slate-900 pb-8 mb-8">
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">{companyName}</h1>
          <div className="text-sm text-slate-500 mt-2 space-y-1">
            <p>{company?.address}</p>
            <p>{company?.city}, {company?.state} - {company?.pincode}</p>
            <p className="font-black text-slate-900">GSTIN: {company?.gstin} | Phone: {company?.phone}</p>
          </div>
        </div>

        <div className="text-center mb-8">
           <h2 className="text-xl font-black border-2 border-rose-600 text-rose-600 inline-block px-10 py-1 rounded-full uppercase">Credit Note</h2>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-8">
          <div className="bg-slate-50 p-6 rounded-2xl">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><User className="w-3 h-3" /> Customer Details</h3>
            <div className="text-sm space-y-1">
              <p className="font-black text-slate-900 text-lg underline underline-offset-4">{creditNote.customerName}</p>
              <p className="text-slate-600 font-medium leading-relaxed">{creditNote.customerAddress}</p>
              <p className="font-black mt-3">GSTIN: {creditNote.customerGstin}</p>
              {creditNote.customerPhone && <p>Phone: {creditNote.customerPhone}</p>}
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
               <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-3 flex items-center gap-2"><RotateCcw className="w-3 h-3" /> Return Info</h3>
               <div className="grid grid-cols-2 gap-4 text-sm">
                 <div>
                   <p className="text-[10px] text-slate-400 font-bold uppercase">CN Number</p>
                   <p className="font-black text-rose-600">{creditNote.creditNoteNumber}</p>
                 </div>
                 <div>
                   <p className="text-[10px] text-slate-400 font-bold uppercase">Date</p>
                   <p className="font-black">{new Date(creditNote.date).toLocaleDateString()}</p>
                 </div>
                 <div className="col-span-2">
                   <p className="text-[10px] text-slate-400 font-bold uppercase">Original Invoice</p>
                   <p className="font-black flex items-center gap-2"><FileText className="w-3 h-3" /> {creditNote.originalInvoiceNumber}</p>
                 </div>
               </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
           <p className="text-sm font-bold text-slate-700 bg-slate-100 px-4 py-2 rounded-lg">
             <span className="text-slate-400 uppercase text-[10px] font-black mr-2">Reason for Return:</span>
             {creditNote.reason}
           </p>
        </div>

        {/* Table */}
        <div className="border border-slate-900 rounded-xl overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-white">
              <tr className="text-[10px] font-black uppercase tracking-widest text-left">
                <th className="px-4 py-4">Sr</th>
                <th className="px-4 py-4">Item Description</th>
                <th className="px-4 py-4 text-center">HSN</th>
                <th className="px-4 py-4 text-center">Qty</th>
                <th className="px-4 py-4 text-right">MRP</th>
                <th className="px-4 py-4 text-right">Basic</th>
                <th className="px-4 py-4 text-center">GST%</th>
                <th className="px-4 py-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {creditNote.items.map((item, idx) => (
                <tr key={idx} className="text-slate-700">
                  <td className="px-4 py-4 text-slate-400 font-bold">{idx + 1}</td>
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-900">{item.productName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{item.partNo}</p>
                  </td>
                  <td className="px-4 py-4 text-center font-mono text-xs">{item.hsnCode}</td>
                  <td className="px-4 py-4 text-center font-black text-rose-600">{item.qty}</td>
                  <td className="px-4 py-4 text-right font-medium">₹{item.mrpPerUnit.toFixed(2)}</td>
                  <td className="px-4 py-4 text-right font-medium">₹{item.basicAmount.toFixed(2)}</td>
                  <td className="px-4 py-4 text-center text-slate-400 font-bold">{item.gstRate}%</td>
                  <td className="px-4 py-4 text-right font-black text-slate-900">₹{item.lineTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="flex justify-end border-t-2 border-slate-900 pt-8">
          <div className="w-72 space-y-3">
            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
              <span>Total Taxable</span>
              <span className="font-mono">₹{creditNote.subtotalBasic.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
              <span>Total CGST</span>
              <span className="font-mono">₹{creditNote.totalCgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
              <span>Total SGST</span>
              <span className="font-mono">₹{creditNote.totalSgst.toFixed(2)}</span>
            </div>
            {creditNote.roundOff !== 0 && (
              <div className="flex justify-between text-xs text-slate-400 italic font-bold">
                <span>Round Off</span>
                <span className="font-mono">{creditNote.roundOff > 0 ? '+' : ''}{creditNote.roundOff.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-black text-rose-600 border-t border-slate-200 pt-4">
              <span className="uppercase tracking-tighter">Total Credit</span>
              <span className="font-black">{formatCurrency(creditNote.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Amount in words</p>
           <p className="text-sm font-black text-slate-900 italic underline underline-offset-4 decoration-rose-200">{numberToWords(creditNote.totalAmount)}</p>
        </div>

        <div className="mt-20 grid grid-cols-2 gap-12 text-center">
           <div className="pt-8 border-t border-slate-200">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Signature</p>
           </div>
           <div className="pt-8 border-t border-slate-200">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">For {(companyName || '').toUpperCase()}</p>
             <p className="text-[10px] font-bold text-slate-900 mt-10 tracking-widest uppercase">Authorized Signatory</p>
           </div>
        </div>

        <p className="text-center text-[9px] font-black text-slate-300 uppercase tracking-[0.4em] mt-16">This credit note reverses the tax liability of original invoice</p>

      </div>
    </div>
  );
}
