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

  const shouldShowValue = (value: any) => {
    if (value === undefined || value === null) return false;
    const formatted = String(value).trim().toLowerCase();
    return formatted !== '' && formatted !== 'null' && formatted !== 'undefined';
  };

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
        line.rate.toFixed(2),
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
              <RATE>${lineMetrics.rate.toFixed(2)}</RATE>
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
    const mrp = Number(item.sellingPrice || 0); // MRP = original selling price (GST-inclusive)
    const quantity = Number(item.quantity || 0);
    const gstRate = Number(item.gstRate || 0);
    const discountPercent = fixedPrice > 0 ? 0 : Number(item.discountPercent || 0);

    const effectiveMrp = fixedPrice > 0 ? fixedPrice : mrp;
    const rate = gstRate > 0 ? effectiveMrp / (1 + gstRate / 100) : effectiveMrp;
    const discountRs = discountPercent > 0 ? rate * (discountPercent / 100) * quantity : 0;
    const taxableValue = Math.max(0, rate * quantity - discountRs);
    const gstAmount = taxableValue * (gstRate / 100);
    const rowTotal = taxableValue + gstAmount;

    return {
      mrp,
      rate,
      discountPercent,
      discountRs,
      taxableValue,
      gstAmount,
      rowTotal,
    };
  };

  const convertAmountToWords = (amount: number) => {
    if (amount === 0) return 'INR ZERO Only';
    const words = ['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tensWords = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const numberToWords = (num: number): string => {
      if (num < 20) return words[num];
      if (num < 100) return tensWords[Math.floor(num / 10)] + (num % 10 ? ' ' + words[num % 10] : '');
      if (num < 1000) return words[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
      if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
      if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
      return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
    };

    const intAmount = Math.round(amount);
    return `INR ${numberToWords(intAmount).toUpperCase()} Only`;
  };

  const getInvoiceFooterSummary = (invoice: Invoice) => {
    const taxableSubtotal = invoice.subtotal - invoice.discountAmount;
    const taxTotal = invoice.taxAmount || 0;
    const grandTotal = taxableSubtotal + taxTotal;
    const roundedTotal = Math.round(grandTotal);
    const roundOff = Number((roundedTotal - grandTotal).toFixed(2));

    return {
      totalMRP: invoice.subtotal,
      totalDiscount: invoice.discountAmount,
      taxableAmount: taxableSubtotal,
      taxTotal,
      roundedTotal,
      roundOff,
      amountInWords: convertAmountToWords(roundedTotal)
    };
  };

  const buildHsnSummary = (invoice: Invoice) => {
    const summary = new Map<string, { taxRate: number; taxableValue: number; quantity: number; cgst: number; sgst: number; igst: number }>();

    invoice.items.forEach(item => {
      const line = calculateLineMetrics(item);
      const hsn = item.hsnCode || 'N/A';
      const current = summary.get(hsn) || { taxRate: Number(item.gstRate || 0), taxableValue: 0, quantity: 0, cgst: 0, sgst: 0, igst: 0 };
      const rowCgst = invoice.isSameState ? line.gstAmount / 2 : 0;
      const rowSgst = invoice.isSameState ? line.gstAmount / 2 : 0;
      const rowIgst = invoice.isSameState ? 0 : line.gstAmount;

      summary.set(hsn, {
        taxRate: current.taxRate,
        taxableValue: current.taxableValue + line.taxableValue,
        quantity: current.quantity + Number(item.quantity || 0),
        cgst: current.cgst + rowCgst,
        sgst: current.sgst + rowSgst,
        igst: current.igst + rowIgst,
      });
    });

    return Array.from(summary.entries()).sort((a, b) => a[0].localeCompare(b[0]));
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
                <div id="print-area" className="bg-white text-slate-800 border p-6 rounded-lg shadow-sm border-slate-200 space-y-5 max-w-[210mm] mx-auto printing-card print:w-[210mm] print:min-h-[297mm]">
                  
                  {/* STYLE INJECTION EXCLUSIVELY FOR EMBEDDED PRINTING */}
                  <style>{`
                    @media print {
                      @page {
                        size: A4 portrait;
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
                        width: 210mm;
                        min-height: 297mm;
                        padding: 16px;
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
                      .invoice-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        table-layout: fixed !important;
                        font-size: 8px !important;
                      }
                      .invoice-table th,
                      .invoice-table td {
                        padding: 3px 5px !important;
                        border: 1px solid #e2e8f0 !important;
                        white-space: nowrap !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                      }
                      .invoice-table th {
                        font-size: 8px !important;
                      }
                      .invoice-summary,
                      .invoice-signature,
                      .invoice-header-block {
                        page-break-inside: avoid !important;
                      }
                    }
                  `}</style>

                  {/* Corporate Header */}
                  <div className="border-b border-slate-200 pb-5 invoice-header-block">
                    <div className="text-center">
                      <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-900 text-white text-4xl font-black mx-auto">{businessProfile.logo || '⚡'}</div>
                      <div className="text-3xl md:text-4xl font-black uppercase tracking-tight mt-4 text-slate-900">{businessProfile.name}</div>
                      <div className="mt-3 text-xs md:text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto">{businessProfile.address}</div>
                      <div className="mt-2 text-[10px] text-slate-600 space-y-1">
                        {shouldShowValue(businessProfile.phone) && <div>Phone: {businessProfile.phone}</div>}
                        {shouldShowValue(businessProfile.email) && <div>Email: {businessProfile.email}</div>}
                        {shouldShowValue(businessProfile.gstin) && <div>GSTIN: {businessProfile.gstin}</div>}
                        {shouldShowValue(businessProfile.state) && <div>State: {businessProfile.state}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 invoice-header-block">
                    <div className="border border-slate-200 rounded-xl p-4 bg-white text-[10px]">
                      <div className="font-black uppercase tracking-[0.25em] text-slate-500 mb-3">Billing Address</div>
                      <div className="font-semibold text-slate-900">{selectedInvoice.customerName || '-'}</div>
                      <div className="mt-1 text-slate-600 leading-relaxed">{selectedInvoice.customerAddress || '-'}</div>
                      <div className="mt-3 space-y-1 text-slate-700">
                        {shouldShowValue(selectedInvoice.customerGstin) && <div>GSTIN: <span className="font-mono">{selectedInvoice.customerGstin}</span></div>}
                        {shouldShowValue(selectedInvoice.customerPan) && <div>PAN: <span className="font-mono">{selectedInvoice.customerPan}</span></div>}
                        {shouldShowValue(selectedInvoice.customerMobile) && <div>Phone: <span className="font-mono">{selectedInvoice.customerMobile}</span></div>}
                        {shouldShowValue(selectedInvoice.customerAadhar) && <div>Aadhar: <span className="font-mono">{selectedInvoice.customerAadhar}</span></div>}
                        {shouldShowValue(selectedInvoice.customerEmail) && <div>Email: <span className="font-mono">{selectedInvoice.customerEmail}</span></div>}
                        {shouldShowValue(selectedInvoice.customerState) && <div>State: <span className="font-mono">{selectedInvoice.customerState}</span></div>}
                      </div>
                    </div>

                    <div className="border border-slate-200 rounded-xl p-4 bg-white text-[10px]">
                      <div className="font-black uppercase tracking-[0.25em] text-slate-500 mb-3">Delivery Address</div>
                      <div className="font-semibold text-slate-900">{selectedInvoice.customerName || '-'}</div>
                      <div className="mt-1 text-slate-600 leading-relaxed">{selectedInvoice.deliveryAddress || selectedInvoice.customerAddress || '-'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 mt-4 invoice-header-block">
                    <div className="border border-slate-200 rounded-xl p-4 bg-white text-[10px]">
                      <div className="font-black uppercase tracking-[0.25em] text-slate-500 mb-3">Invoice Info</div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Invoice No</span>
                        <span className="font-mono font-semibold text-slate-900">{selectedInvoice.invoiceNumber}</span>
                      </div>
                      <div className="flex justify-between gap-4 mt-2">
                        <span className="text-slate-500">Invoice Date</span>
                        <span className="font-mono font-semibold text-slate-900">{selectedInvoice.date}</span>
                      </div>
                      {shouldShowValue(selectedInvoice.orderNo) && (
                        <div className="flex justify-between gap-4 mt-2">
                          <span className="text-slate-500">Order No</span>
                          <span className="font-mono font-semibold text-slate-900">{selectedInvoice.orderNo}</span>
                        </div>
                      )}
                      {shouldShowValue(selectedInvoice.remark) && (
                        <div className="flex justify-between gap-4 mt-2">
                          <span className="text-slate-500">Remark</span>
                          <span className="font-mono font-semibold text-slate-900">{selectedInvoice.remark}</span>
                        </div>
                      )}
                    </div>
                    {(shouldShowValue(selectedInvoice.irnNo) || shouldShowValue(selectedInvoice.ackNo) || shouldShowValue(selectedInvoice.ackDate)) && (
                      <div className="border border-slate-200 rounded-xl p-4 bg-white text-[10px]">
                        <div className="font-black uppercase tracking-[0.25em] text-slate-500 mb-3">Additional Info</div>
                        {shouldShowValue(selectedInvoice.irnNo) && (
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">IRN No</span>
                            <span className="font-mono font-semibold text-slate-900">{selectedInvoice.irnNo}</span>
                          </div>
                        )}
                        {shouldShowValue(selectedInvoice.ackNo) && (
                          <div className="flex justify-between gap-4 mt-2">
                            <span className="text-slate-500">Ack No</span>
                            <span className="font-mono font-semibold text-slate-900">{selectedInvoice.ackNo}</span>
                          </div>
                        )}
                        {shouldShowValue(selectedInvoice.ackDate) && (
                          <div className="flex justify-between gap-4 mt-2">
                            <span className="text-slate-500">Ack Date</span>
                            <span className="font-mono font-semibold text-slate-900">{selectedInvoice.ackDate}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Main Line ledger */}
                  <div className="overflow-x-auto">
                    <table className="invoice-table w-full text-left border-collapse border-slate-150">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          <th className="py-2.5 px-3" style={{ width: '4%' }}>Sr No</th>
                          <th className="py-2.5 px-2" style={{ width: '8%' }}>Part No</th>
                          <th className="py-2.5 px-2" style={{ width: '20%' }}>Description</th>
                          <th className="py-2.5 px-2 font-mono text-xs" style={{ width: '7%' }}>HSN No</th>
                          <th className="py-2.5 px-2 text-right" style={{ width: '8%' }}>MRP</th>
                          <th className="py-2.5 px-2 text-right" style={{ width: '8%' }}>Rate</th>
                          <th className="py-2.5 px-2 text-center" style={{ width: '5%' }}>Qty</th>
                          <th className="py-2.5 px-2 text-center" style={{ width: '5%' }}>Disc%</th>
                          <th className="py-2.5 px-2 text-right" style={{ width: '8%' }}>Disc (Rs.)</th>
                          <th className="py-2.5 px-2 text-right" style={{ width: '10%' }}>Taxable Amt</th>
                          <th className="py-2.5 px-2 text-center" style={{ width: '5%' }}>GST%</th>
                          <th className="py-2.5 px-3 text-right" style={{ width: '10%' }}>GST TAX</th>
                          <th className="py-2.5 px-3 text-right" style={{ width: '10%' }}>AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-650">
                        {selectedInvoice.items.map((item, index) => {
                          const lineMetrics = calculateLineMetrics(item);

                          return (
                            <tr key={item.id} className="align-middle">
                              <td className="py-3 px-3 font-semibold">{index + 1}</td>
                              <td className="py-3 px-2 font-mono text-slate-600">{item.partNumber || '-'}</td>
                              <td className="py-3 px-2">
                                <div className="font-bold text-slate-900">{item.productName}</div>
                              </td>
                              <td className="py-3 px-2 font-mono text-slate-500">{item.hsnCode || '-'}</td>
                              <td className="py-3 px-2 text-right font-mono">₹{lineMetrics.mrp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="py-3 px-2 text-right font-mono">₹{lineMetrics.rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="py-3 px-2 text-center font-mono font-semibold">{item.quantity}</td>
                              <td className="py-3 px-2 text-center font-mono font-bold text-amber-600">{(item.discountPercent || 0).toFixed(2)}%</td>
                              <td className="py-3 px-2 text-right font-mono">₹{(lineMetrics.discountRs || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="py-3 px-2 text-right font-mono">₹{(lineMetrics.taxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="py-3 px-2 text-center font-mono font-bold text-slate-500">{item.gstRate}%</td>
                              <td className="py-3 px-3 text-right font-mono">₹{(lineMetrics.gstAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">₹{(lineMetrics.rowTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* HSN & Tax Rate Summaries */}
                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
                    <div className="border border-slate-100 p-3 rounded-xl text-xs">
                      <div className="font-black uppercase text-[10px] text-slate-500 mb-2">HSN Summary</div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-500 bg-slate-50 text-[11px]">
                            <th className="py-1 px-2 text-left">HSN</th>
                            <th className="py-1 px-2 text-right">Tax Rate</th>
                            <th className="py-1 px-2 text-right">Taxable Value</th>
                            <th className="py-1 px-2 text-right">QTY</th>
                            <th className="py-1 px-2 text-right">CGST</th>
                            <th className="py-1 px-2 text-right">SGST</th>
                            <th className="py-1 px-2 text-right">IGST</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-700">
                          {buildHsnSummary(selectedInvoice).map(([hsn, vals]) => (
                            <tr key={hsn}>
                              <td className="py-1 px-2">{hsn}</td>
                              <td className="py-1 px-2 text-right">{vals.taxRate}%</td>
                              <td className="py-1 px-2 text-right">₹{vals.taxableValue.toFixed(2)}</td>
                              <td className="py-1 px-2 text-right">{vals.quantity}</td>
                              <td className="py-1 px-2 text-right">₹{vals.cgst.toFixed(2)}</td>
                              <td className="py-1 px-2 text-right">₹{vals.sgst.toFixed(2)}</td>
                              <td className="py-1 px-2 text-right">₹{vals.igst.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="border border-slate-100 p-3 rounded-xl text-xs">
                      <div className="font-black uppercase text-[10px] text-slate-500 mb-2">Tax Rate Summary</div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-500 bg-slate-50 text-[11px]">
                            <th className="py-1 px-2 text-left">Tax Rate</th>
                            <th className="py-1 px-2 text-right">Taxable Value</th>
                            <th className="py-1 px-2 text-right">QTY</th>
                            <th className="py-1 px-2 text-right">CGST</th>
                            <th className="py-1 px-2 text-right">SGST</th>
                            <th className="py-1 px-2 text-right">IGST</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-700">
                          {buildTaxRateSummary(selectedInvoice).map(([rate, vals]) => (
                            <tr key={rate}>
                              <td className="py-1 px-2">{rate}%</td>
                              <td className="py-1 px-2 text-right">₹{vals.taxableValue.toFixed(2)}</td>
                              <td className="py-1 px-2 text-right">{vals.quantity}</td>
                              <td className="py-1 px-2 text-right">₹{vals.cgst.toFixed(2)}</td>
                              <td className="py-1 px-2 text-right">₹{vals.sgst.toFixed(2)}</td>
                              <td className="py-1 px-2 text-right">₹{vals.igst.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary math calculations */}
                  <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start text-xs text-slate-600 text-left">
                    <div className="space-y-2 border border-slate-100 p-4 rounded-xl invoice-summary bg-slate-50/50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Declaration Terms</span>
                      <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
                        Certified that the particulars given above are correct and complete. The quantities listed match our verified inventory catalog. No additional fees apply. Taxes charged reflect applicable {selectedInvoice.isSameState ? "CGST & SGST Intrastate" : "IGST Interstate"} routing guidelines under the Central Goods and Services Act, 2017.
                      </p>
                    </div>

                    <div className="border border-slate-150 p-4 rounded-xl invoice-summary bg-white">
                      {(() => {
                        const summary = getInvoiceFooterSummary(selectedInvoice);
                        return (
                          <div className="space-y-3 text-[10px] text-slate-700">
                            <div className="flex justify-between">
                              <span>Total MRP</span>
                              <span className="font-mono">₹{summary.totalMRP.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Total Discount</span>
                              <span className="font-mono">₹{summary.totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Taxable Amount</span>
                              <span className="font-mono">₹{summary.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            {selectedInvoice.isSameState ? (
                              <>
                                <div className="flex justify-between">
                                  <span>CGST</span>
                                  <span className="font-mono">₹{selectedInvoice.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>SGST</span>
                                  <span className="font-mono">₹{selectedInvoice.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                              </>
                            ) : (
                              <div className="flex justify-between">
                                <span>IGST</span>
                                <span className="font-mono">₹{selectedInvoice.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            <div className="flex justify-between border-t border-slate-200 pt-2">
                              <span>Round Off</span>
                              <span className="font-mono">₹{summary.roundOff.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 pt-3 font-black text-slate-900">
                              <span>Bill Total</span>
                              <span className="font-mono text-indigo-600">₹{summary.roundedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="pt-2 text-[10px] text-slate-500">{summary.amountInWords}</div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Certified Signatory footer */}
                  <div className="flex justify-between items-start pt-8 border-t border-slate-100 text-xs">
                    <div className="w-2/3">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="border border-slate-200 rounded-xl p-4">
                          <div className="font-semibold text-slate-900 mb-2">Bank Details</div>
                          <div className="text-slate-500 text-[11px] leading-snug">
                            {businessProfile.bankName && <div>Bank: {businessProfile.bankName}</div>}
                            {businessProfile.accountNumber && <div>A/C No: {businessProfile.accountNumber}</div>}
                            {businessProfile.ifscCode && <div>IFSC: {businessProfile.ifscCode}</div>}
                          </div>
                        </div>

                        <div className="border border-slate-200 rounded-xl p-4">
                          <div className="font-semibold text-slate-900 mb-2">Terms & Conditions</div>
                          <div className="text-slate-700 text-[11px] mt-1 space-y-1">
                            {businessProfile.terms && businessProfile.terms.slice(0,6).map((t, i) => (
                              <div key={i} className="leading-snug">{i+1}. {t}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-1/3 text-right">
                      <div className="mb-8">
                        <div className="text-sm font-semibold">Receivers signature</div>
                        <div className="h-10 border-b mt-6"></div>
                      </div>

                      <div>
                        <div className="text-sm font-semibold">Authorised Signatory</div>
                        <div className="h-10 border-b mt-6"></div>
                        <div className="text-xs mt-2 font-bold">{businessProfile.name}</div>
                      </div>
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
