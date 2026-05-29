import { useState, Dispatch, SetStateAction } from 'react';
import { Invoice, BusinessProfile } from '../types';
import { Search, Printer, Download, FileSpreadsheet, Trash2, Eye, X, Landmark, FileText, Calendar, ShieldCheck, Sparkles, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InvoicesListTabProps {
  invoices: Invoice[];
  setInvoices: Dispatch<SetStateAction<Invoice[]>>;
  businessProfile: BusinessProfile;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  selectedInvoice: Invoice | null;
  setSelectedInvoice: Dispatch<SetStateAction<Invoice | null>>;
  onEditInvoice?: (invoice: Invoice) => void;
}

export function InvoicesListTab({ 
  invoices, 
  setInvoices, 
  businessProfile, 
  showToast,
  selectedInvoice,
  setSelectedInvoice,
  onEditInvoice
}: InvoicesListTabProps) {

  const [searchQuery, setSearchQuery] = useState('');
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  // 1. Filtering invoices
  const filteredInvoices = invoices.filter(inv => {
    const query = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(query) ||
      inv.customerName.toLowerCase().includes(query) ||
      inv.customerMobile.includes(query)
    );
  });

  // 2. Export ALL to Excel/CSV
  const exportAllToCSV = () => {
    if (invoices.length === 0) {
      showToast("No invoices to export", "info");
      return;
    }

    const headers = ["Invoice Number", "Date", "Customer Name", "Customer State", "Customer GSTIN", "Excl Tax Subtotal", "Discount Amount", "Tax Amount", "Net Total Amount"];
    
    const rows = invoices.map(inv => [
      `"${inv.invoiceNumber}"`,
      `"${inv.date}"`,
      `"${inv.customerName.replace(/"/g, '""')}"`,
      `"${inv.customerState}"`,
      `"${inv.customerGstin || 'URD'}"`,
      inv.subtotal.toFixed(2),
      inv.discountAmount.toFixed(2),
      inv.taxAmount.toFixed(2),
      Math.round(inv.totalAmount).toFixed(2)
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Invoices_Dump_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Successfully exported all invoices as CSV!", "success");
  };

  // 3. Export SINGLE invoice to Excel/CSV
  const exportSingleToCSV = (inv: Invoice) => {
    const headers = [
      "Line Ref",
      "Product Name",
      "Part Number",
      "HSN Code",
      "Selling Price",
      "Discount %",
      "After Discount Price",
      "Qty",
      "Taxable Value",
      "GST Rate (%)",
      "GST Amount",
      "Row Total"
    ];
    
    // Add item lines
    const rows = inv.items.map((item, idx) => {
      const line = calculateLineMetrics(item);
      return [
        idx + 1,
        `"${item.productName.replace(/"/g, '""')}"`,
        `"${item.partNumber}"`,
        `"${item.hsnCode}"`,
        item.sellingPrice.toFixed(2),
        `${(item.discountPercent || 0).toFixed(2)}%`,
        line.afterDiscountPrice.toFixed(2),
        item.quantity,
        line.taxableValue.toFixed(2),
        `${item.gstRate}%`,
        line.gstAmount.toFixed(2),
        line.rowTotal.toFixed(2)
      ];
    });

    const infoRows = [
      [],
      ["Invoice Metadata Details"],
      ["Invoice Number", inv.invoiceNumber],
      ["Date", inv.date],
      ["Customer Name", inv.customerName],
      ["customer Address", inv.customerAddress || ""],
      ["State Routing", inv.customerState],
      ["Subtotal Due", inv.subtotal.toFixed(2)],
      ["Invoice Trade Discount", `${inv.discountPercent}% (${inv.discountAmount.toFixed(2)})`],
      ["Calculated GST Tax", inv.taxAmount.toFixed(2)],
      ["Invoice Final Total Due", Math.round(inv.totalAmount).toFixed(2)]
    ];

    const csvContent = [
      headers.join(","), 
      ...rows.map(e => e.join(",")),
      ...infoRows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Invoice_${inv.invoiceNumber.replace(/\//g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Successfully exported invoice as CSV spreadsheet!", "success");
  };

  // 4. Trigger window print with specific layout styles
  const handlePrint = () => {
    window.print();
  };

  const escapeXML = (unsafe: string): string => {
    return (unsafe || '').replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  };

  const generateTallyXML = (invoicesList: Invoice[]) => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXML(businessProfile.name)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>`;

    invoicesList.forEach(inv => {
      const totalAmountRounded = Math.round(inv.totalAmount);
      const dateFormatted = inv.date.replace(/-/g, ''); // Tally expects YYYYMMDD
      const cgstAmount = inv.cgstAmount || 0;
      const sgstAmount = inv.sgstAmount || 0;
      const igstAmount = inv.igstAmount || 0;
      const placeOfSupply = inv.customerState || 'Others';
      const customerGstin = inv.customerGstin || 'URD';
      const invoiceTaxTotal = cgstAmount + sgstAmount + igstAmount;
      
      xml += `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="InvoiceVoucherView">
            <DATE>${dateFormatted}</DATE>
            <VOUCHERNUMBER>${escapeXML(inv.invoiceNumber)}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>${escapeXML(inv.customerName)}</PARTYLEDGERNAME>
            <PARTYGSTIN>${escapeXML(customerGstin)}</PARTYGSTIN>
            <STATENAME>${escapeXML(placeOfSupply)}</STATENAME>
            <PLACEOFSUPPLY>${escapeXML(placeOfSupply)}</PLACEOFSUPPLY>
            <EFFECTIVEDATE>${dateFormatted}</EFFECTIVEDATE>
            <HASEXPIREDLISTS>No</HASEXPIREDLISTS>
            <ISCONSOLIDATED>No</ISCONSOLIDATED>
            <ISOPTION>No</ISOPTION>
            <ISDELETED>No</ISDELETED>
            <RAWVOUCHERYN>No</RAWVOUCHERYN>
            <NARRATION>Invoice No ${escapeXML(inv.invoiceNumber)} generated from Invoice Generator App</NARRATION>`;

      inv.items.forEach(item => {
        const lineMetrics = calculateLineMetrics(item);
        xml += `
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${escapeXML(item.productName)}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${lineMetrics.taxableValue.toFixed(2)}</AMOUNT>
              <RATE>${lineMetrics.afterDiscountPrice.toFixed(2)}</RATE>
              <BILLEDQTY>${item.quantity}</BILLEDQTY>
              <ACTUALQTY>${item.quantity}</ACTUALQTY>
              <UNITNAME>Nos</UNITNAME>
              <HSNCODE>${escapeXML(item.hsnCode || '')}</HSNCODE>
              <GSTCLASS/>
              <VATASSESSABLEVALUE>${lineMetrics.taxableValue.toFixed(2)}</VATASSESSABLEVALUE>
            </ALLINVENTORYENTRIES.LIST>`;
      });

      xml += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXML(inv.customerName)}</LEDGERNAME>
              <GSTCLASS/>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>-${totalAmountRounded.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Sales Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <AMOUNT>${inv.subtotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;

      if (cgstAmount > 0) {
        xml += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>CGST Duty</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <AMOUNT>${cgstAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
      }

      if (sgstAmount > 0) {
        xml += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>SGST Duty</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <AMOUNT>${sgstAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
      }

      if (igstAmount > 0) {
        xml += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>IGST Duty</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <AMOUNT>${igstAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
      }

      const rawTotal = inv.subtotal - (inv.discountAmount || 0) + (cgstAmount + sgstAmount + igstAmount);
      const roundingDiff = totalAmountRounded - rawTotal;
      if (Math.abs(roundingDiff) > 0.01) {
        xml += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Round Off</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${roundingDiff < 0 ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <AMOUNT>${Math.abs(roundingDiff).toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
      }

      xml += `
          </VOUCHER>
        </TALLYMESSAGE>`;
    });

    xml += `
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

    return xml;
  };

  const handleBulkExportToTally = () => {
    if (invoices.length === 0) {
      showToast("No invoices to export to Tally", "info");
      return;
    }
    const xmlContent = generateTallyXML(invoices);
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Tally_Sales_Import_Bulk_${new Date().toISOString().split('T')[0]}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${invoices.length} invoices to Tally purchase/sales XML ledger!`, "success");
  };

  const handleSingleExportToTally = (inv: Invoice) => {
    const xmlContent = generateTallyXML([inv]);
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const safeInvoiceNumber = inv.invoiceNumber.replace(/[^\w.-]+/g, '_');
    link.setAttribute("download", `Invoice_${safeInvoiceNumber}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Tally XML file downloaded. Import in Tally via Gateway of Tally → Import Data → Vouchers.", "success");
  };

  // 5. Handle Delete
  const handleDeleteInvoice = () => {
    if (invoiceToDelete) {
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceToDelete.id));
      showToast(`Invoice ${invoiceToDelete.invoiceNumber} permanently removed`, "info");
      setInvoiceToDelete(null);
    }
  };

  const calculateLineMetrics = (item: Invoice['items'][number]) => {
    const fixedPrice = Number(item.netPriceApplied || 0);
    const discountPercent = fixedPrice > 0 ? 0 : Number(item.discountPercent || 0);
    const sellingPrice = fixedPrice > 0 ? fixedPrice : Number(item.sellingPrice || 0);
    const quantity = Number(item.quantity || 0);
    const gstRate = Number(item.gstRate || 0);

    const afterDiscountPrice = sellingPrice - (sellingPrice * (discountPercent / 100));
    const taxableValue = afterDiscountPrice * quantity;
    const gstAmount = taxableValue * (gstRate / 100);
    const rowTotal = taxableValue + gstAmount;

    return {
      afterDiscountPrice,
      taxableValue,
      gstAmount,
      rowTotal,
    };
  };

  const getInvoiceFooterSummary = (invoice: Invoice) => {
    const discountedSubtotal = invoice.items.reduce((sum, item) => {
      return sum + calculateLineMetrics(item).taxableValue;
    }, 0);

    const taxTotal = invoice.taxAmount || 0;
    const grandTotal = discountedSubtotal + taxTotal;

    return {
      discountedSubtotal,
      taxTotal,
      grandTotal,
    };
  };

  const buildTaxRateSummary = (invoice: Invoice) => {
    const summary = new Map<number, { taxableValue: number; quantity: number; cgst: number; sgst: number; igst: number }>();

    invoice.items.forEach(item => {
      const line = calculateLineMetrics(item);
      const rate = Number(item.gstRate || 0);
      const current = summary.get(rate) || { taxableValue: 0, quantity: 0, cgst: 0, sgst: 0, igst: 0 };

      const rowCgst = invoice.isSameState ? line.gstAmount / 2 : 0;
      const rowSgst = invoice.isSameState ? line.gstAmount / 2 : 0;
      const rowIgst = invoice.isSameState ? 0 : line.gstAmount;

      summary.set(rate, {
        taxableValue: current.taxableValue + line.taxableValue,
        quantity: current.quantity + Number(item.quantity || 0),
        cgst: current.cgst + rowCgst,
        sgst: current.sgst + rowSgst,
        igst: current.igst + rowIgst,
      });
    });

    return Array.from(summary.entries()).sort((a, b) => b[0] - a[0]);
  };

  return (
    <div className="space-y-4">
      
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Invoices Archive
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Browse through historical billing logs, print active corporate GST sheets or export records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportAllToCSV}
            className="bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export All to Excel
          </button>

          <button
            onClick={handleBulkExportToTally}
            className="bg-amber-600 hover:bg-amber-500 text-white cursor-pointer transition-colors text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs"
            title="Import Sales & Tax Ledger XML directly to Tally Prime"
          >
            <FileText className="w-3.5 h-3.5" />
            Bulk Export to Tally
          </button>
        </div>
      </div>

      {/* Searching filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg p-2.5 flex items-center gap-2.5 shadow-xs">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by invoice number (e.g., INV/2025-26/0001) or customer name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs bg-transparent border-none focus:outline-none dark:text-slate-150"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold px-2 py-0.5"
          >
            Clear
          </button>
        )}
      </div>

      {/* Main invoices table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800/80 rounded-lg overflow-hidden shadow-xs">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-55 dark:bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100 dark:border-slate-800">
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Invoices Found</h3>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              {searchQuery ? "Try searching for matching customers or different fiscal year patterns." : "Complete drafting process to log your first invoice."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-955/50 border-b border-slate-200 dark:border-slate-800/80">
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Invoice Ref</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Issue Date</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Client Name</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amt Paid/Due</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">GST Class</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-955/20 transition-colors text-xs">
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-slate-800 dark:text-slate-150 font-mono text-[11px]">{inv.invoiceNumber}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 font-mono font-medium text-xs">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {inv.date}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-slate-800 dark:text-slate-150 text-[13px]">{inv.customerName}</div>
                      <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">{inv.customerState}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-105 font-mono">
                      ₹{Math.round(inv.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-55/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                        <ShieldCheck className="w-3 h-3" />
                        Settled
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleSingleExportToTally(inv)}
                          className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold border border-emerald-500 transition-colors cursor-pointer whitespace-nowrap"
                          title="Move to Tally"
                        >
                          📤 Move to Tally
                        </button>
                        <button
                          onClick={() => onEditInvoice && onEditInvoice(inv)}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-850 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-205 dark:border-slate-800 transition-colors cursor-pointer"
                          title="Edit Invoice"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-850 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-205 dark:border-slate-800 transition-colors cursor-pointer"
                          title="View Invoice Sheet"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setInvoiceToDelete(inv)}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-850 hover:bg-rose-50 dark:hover:bg-rose-955/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-455 border border-slate-205 dark:border-slate-800 transition-colors cursor-pointer"
                          title="Delete Slip"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Viewer Modal (Pixel Perfect Document Layout) */}
      <AnimatePresence>
        {selectedInvoice && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-w-4xl w-full rounded-xl shadow-lg flex flex-col max-h-[90vh] overflow-hidden"
            >
              
              {/* Modal controls */}
              <div className="flex justify-between items-center p-3 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <span className="p-1 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded">
                    <FileText className="w-3 h-3" />
                  </span>
                  Invoice Reader
                </span>

                <div className="flex items-center gap-1.5 print:hidden">
                  <button
                    onClick={handlePrint}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-350 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3 h-3" />
                    Print
                  </button>

                   <button
                    onClick={() => exportSingleToCSV(selectedInvoice)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-350 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    CSV
                  </button>

                  <button
                    onClick={() => handleSingleExportToTally(selectedInvoice)}
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-700 text-amber-500 hover:text-amber-400 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Move to Tally ERP"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Move to Tally
                  </button>

                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Printable Invoice Sheet Body */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950/20">
                
                {/* Print design wrapping div */}
                <div id="print-area" className="bg-white text-slate-800 border p-6 rounded-lg shadow-sm border-slate-200 space-y-5 max-w-3xl mx-auto printing-card">
                  
                  {/* STYLE INJECTION EXCLUSIVELY FOR EMBEDDED PRINTING */}
                  <style>{`
                    @media print {
                      @page {
                        size: auto;
                        margin: 10mm;
                      }
                      body * {
                        visibility: hidden;
                      }
                      #print-area, #print-area * {
                        visibility: visible;
                      }
                      #print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        color: black !important;
                        font-family: sans-serif;
                      }
                      .printing-card {
                        border: none !important;
                        padding: 0 !important;
                      }
                    }
                  `}</style>

                  {/* Corporate Header */}
                  <div className="border-b border-slate-200 pb-4">
                    <div className="text-center space-y-1">
                      <div className="text-4xl">{businessProfile.logo || "⚡"}</div>
                      <h2 className="text-2xl font-black text-slate-900 uppercase tracking-[0.2em]">{businessProfile.name}</h2>
                      <p className="text-[10px] text-slate-600 leading-relaxed">
                        {businessProfile.address} <br />
                        Phone: {businessProfile.phone} | Email: {businessProfile.email} | State: {businessProfile.state}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Invoice Info Box</div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                          <div>
                            <div className="text-[9px] uppercase text-slate-500">Invoice No</div>
                            <div className="font-bold font-mono text-slate-900">{selectedInvoice.invoiceNumber}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase text-slate-500">Date of Issue</div>
                            <div className="font-bold font-mono text-slate-900">{selectedInvoice.date}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase text-slate-500">GSTIN</div>
                            <div className="font-bold font-mono text-slate-900">{businessProfile.gstin}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase text-slate-500">Place of Supply</div>
                            <div className="font-bold text-slate-900">{businessProfile.state}</div>
                          </div>
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Document Status</div>
                        <div className="mt-2 text-xs text-slate-700 space-y-1">
                          <div><span className="font-bold">Tax Invoice</span></div>
                          <div><span className="text-slate-500">Billing State:</span> <span className="font-bold text-slate-900">{selectedInvoice.customerState}</span></div>
                          <div><span className="text-slate-500">Invoice Type:</span> <span className="font-bold text-slate-900">{selectedInvoice.isSameState ? 'Intra-State' : 'Inter-State'}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer CRM info */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                    <div className="border border-slate-200 rounded-lg p-3 bg-white">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">BILLED TO (CLIENT RECEIVER)</div>
                      <div className="mt-2 text-sm font-bold text-slate-900">{selectedInvoice.customerName}</div>
                      {selectedInvoice.customerMobile && (
                        <div className="mt-1 text-[10px] text-slate-600">Mobile: <span className="font-semibold">{selectedInvoice.customerMobile}</span></div>
                      )}
                      {selectedInvoice.customerGstin ? (
                        <div className="mt-1 text-[10px] text-slate-600">GSTIN: <span className="font-mono font-semibold">{selectedInvoice.customerGstin}</span></div>
                      ) : (
                        <div className="mt-1 text-[10px] text-slate-600 font-semibold italic">Unregistered Buyer (URD)</div>
                      )}

                      {(() => {
                        try {
                          const storedCusts = localStorage.getItem('invoice_app_customers');
                          if (storedCusts) {
                            const parsedCusts: any[] = JSON.parse(storedCusts);
                            const found = parsedCusts.find(c => c.id === selectedInvoice.customerId);
                            if (found) {
                              return (
                                <div className="mt-2 pt-2 border-t border-slate-200 text-[9px] text-slate-500 font-mono space-y-0.5">
                                  {found.aadhar && <div>AADHAR: {found.aadhar}</div>}
                                  {found.pan && <div>PAN ID: {found.pan.toUpperCase()}</div>}
                                </div>
                              );
                            }
                          }
                        } catch (err) {
                          console.error("Error drawing printed Aadhar/PAN cards:", err);
                        }
                        return null;
                      })()}
                    </div>

                    <div className="border border-slate-200 rounded-lg p-3 bg-white">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">DELIVERY OUTPOST DESTINATION</div>
                      <div className="mt-2 text-xs text-slate-700 leading-relaxed">
                        {selectedInvoice.customerAddress || "No physical delivery address logged."}
                      </div>
                      <div className="mt-2 text-[10px] text-slate-600">
                        Tax Class State: <span className="font-bold text-slate-900">{selectedInvoice.customerState}</span>
                      </div>
                      {selectedInvoice.vehicleNo && (
                        <div className="mt-1 text-[10px] text-slate-600">
                          Vehicle / Gari No: <span className="font-bold text-slate-900 uppercase">{selectedInvoice.vehicleNo}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Main Line ledger */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse border-b border-slate-150">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-2">Description of Goods</th>
                          <th className="py-2.5 px-2 font-mono text-xs">HSN Code</th>
                          <th className="py-2.5 px-2 text-right">Selling Price</th>
                          <th className="py-2.5 px-2 text-center">Disc %</th>
                          <th className="py-2.5 px-2 text-right">After Discount</th>
                          <th className="py-2.5 px-2 text-center">Qty</th>
                          <th className="py-2.5 px-2 text-right">Taxable Value</th>
                          <th className="py-2.5 px-2 text-center">GST Rate</th>
                          <th className="py-2.5 px-3 text-right">GST Amount</th>
                          <th className="py-2.5 px-3 text-right">Row Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-650">
                        {selectedInvoice.items.map((item, index) => {
                          const lineMetrics = calculateLineMetrics(item);

                          return (
                            <tr key={item.id} className="align-middle">
                              <td className="py-3 px-3 font-semibold">{index + 1}</td>
                              <td className="py-3 px-2">
                                <div className="font-bold text-slate-900">{item.productName}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">Part No: {item.partNumber}</div>
                                {item.netPriceApplied ? (
                                  <div className="mt-1 inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide">Net Price (Fixed)</div>
                                ) : null}
                              </td>
                              <td className="py-3 px-2 font-mono text-slate-500">{item.hsnCode}</td>
                              <td className="py-3 px-2 text-right font-mono">₹{item.sellingPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="py-3 px-2 text-center font-mono font-bold text-amber-600">{(item.discountPercent || 0).toFixed(2)}%</td>
                              <td className="py-3 px-2 text-right font-mono">₹{lineMetrics.afterDiscountPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="py-3 px-2 text-center font-mono font-semibold">{item.quantity}</td>
                              <td className="py-3 px-2 text-right font-mono">₹{lineMetrics.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="py-3 px-2 text-center font-mono font-bold text-slate-500">{item.gstRate}%</td>
                              <td className="py-3 px-3 text-right font-mono">₹{lineMetrics.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">₹{lineMetrics.rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary math calculations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start text-xs text-slate-600 text-left">
                    <div className="space-y-2 border border-slate-100 p-4 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Declaration Terms</span>
                      <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
                        Certified that the particulars given above are correct and complete. The quantities listed match our verified inventory catalog. No additional fees apply. Taxes charged reflect applicable {selectedInvoice.isSameState ? "CGST & SGST Intrastate" : "IGST Interstate"} routing guidelines under the Central Goods and Services Act, 2017.
                      </p>
                    </div>

                    <div className="border border-slate-150 p-4 bg-slate-50/50 rounded-xl space-y-2 text-slate-600 font-medium">
                      {(() => {
                        const summary = getInvoiceFooterSummary(selectedInvoice);
                        return (
                          <>
                            <div className="flex justify-between">
                              <span>Subtotal (Taxable Value after all discounts)</span>
                              <span className="font-mono text-slate-900 font-bold">₹{summary.discountedSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>

                            {selectedInvoice.isSameState ? (
                              <>
                                <div className="flex justify-between text-[11px] text-slate-500">
                                  <span>CGST Total</span>
                                  <span className="font-mono">₹{selectedInvoice.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-[11px] text-slate-500">
                                  <span>SGST Total</span>
                                  <span className="font-mono">₹{selectedInvoice.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex justify-between text-[11px] text-slate-500">
                                <span>IGST Total</span>
                                <span className="font-mono">₹{selectedInvoice.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}

                            <div className="flex justify-between border-t border-slate-150/80 pt-2 text-slate-900 font-bold">
                              <span>Total Tax</span>
                              <span className="font-mono text-slate-900">₹{summary.taxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>

                            <div className="border-t border-slate-200 pt-2.5 flex justify-between items-center text-slate-900 font-black">
                              <span className="text-xs uppercase tracking-wider">Grand Total (Subtotal + Total Tax)</span>
                              <span className="text-base text-indigo-600 font-mono">
                                ₹{summary.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Certified Signatory footer */}
                  <div className="flex justify-between items-end pt-8 border-t border-slate-100 text-xs">
                    <div className="flex gap-4 items-center">
                      <div className="text-left space-y-1">
                        <div className="font-semibold text-slate-900">Corporate Banking details:</div>
                        <div className="text-slate-500 font-mono">ICICI Bank CURRENT A/C: 002405011299</div>
                        <div className="text-slate-500 font-mono">IFSC: ICIC0000024 (Kolkata Sector V)</div>
                        <div className="text-slate-500 font-mono text-[9px] mt-0.5">UPI ID: <a href={`upi://pay?pa=sonalierp@okhdfcbank&pn=${encodeURIComponent(businessProfile.name)}&am=${Math.round(selectedInvoice.totalAmount)}&cu=INR`} className="text-indigo-600 font-semibold underline">sonalierp@okhdfcbank</a></div>
                      </div>
                      <div className="flex flex-col items-center border border-slate-200 p-1 rounded-lg bg-white shrink-0">
                        <img 
                          src={`https://chart.googleapis.com/chart?chs=80x80&cht=qr&chl=${encodeURIComponent(`upi://pay?pa=sonalierp@okhdfcbank&pn=${businessProfile.name}&am=${Math.round(selectedInvoice.totalAmount)}&cu=INR`)}`} 
                          alt="Pay QR" 
                          className="w-16 h-16"
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-[7px] font-black text-slate-500 mt-0.5 tracking-tight uppercase">Scan QR to Pay (₹{Math.round(selectedInvoice.totalAmount)})</span>
                      </div>
                    </div>
                    
                    <div className="text-center space-y-8 w-48 border-t border-slate-200/80 pt-2">
                      <div className="font-mono text-slate-400 font-semibold text-[9px] uppercase tracking-widest">Digital Stamp Signatory</div>
                      <div className="font-bold text-slate-800 tracking-tight leading-none">{businessProfile.name}</div>
                    </div>
                  </div>

                </div>

              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {invoiceToDelete && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-105 dark:border-slate-805 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4"
            >
              <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 rounded-full flex items-center justify-center mx-auto text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                  Are you absolutely sure?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Deleting the invoice <strong>{invoiceToDelete.invoiceNumber}</strong> removes history forever. Stock adjustments logged during draft generation do not auto-revert.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setInvoiceToDelete(null)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-705 dark:text-slate-305 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteInvoice}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
                >
                  Remove Slip
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
