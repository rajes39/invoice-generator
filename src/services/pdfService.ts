import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, CompanySettings } from '../types/index';
import { numberToWords } from './invoiceService';

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

export function generateInvoicePDFPage(doc: jsPDF, invoice: Invoice, company: CompanySettings | null) {
  // Safe company field getter
  const getComp = (field: string, fallback: string = '') => {
    if (!company) return fallback;
    const c = company as any;
    return c[field] || fallback;
  };

  const cName = getComp('company_name') || getComp('name') || 'YOUR COMPANY NAME';
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

  // 1. Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(cName.toUpperCase(), 40, 50);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${cAddr}${cCity ? ', ' + cCity : ''}${cPin ? ' - ' + cPin : ''}`, 40, 65);
  doc.text(`Phone: ${cPhone || 'N/A'} | Email: ${cEmail || 'N/A'}`, 40, 77);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN: ${cGstin || 'N/A'}  |  PAN: ${cPan || 'N/A'}  |  STATE: ${cState.toUpperCase() || 'N/A'} (${cStateCode || ''})`, 40, 89);

  doc.setLineWidth(1.5);
  doc.line(40, 100, 555, 100);

  // 2. Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.rect(200, 110, 200, 25);
  doc.text("TAX INVOICE", 300, 127, { align: 'center' });

  // 3. Info Grid (BUYER vs META)
  doc.setFontSize(8);
  // Left Box: Buyer
  doc.rect(40, 145, 255, 90);
  doc.setFont('helvetica', 'bold');
  doc.text("BUYER (BILL TO)", 45, 157);
  doc.line(45, 159, 120, 159);
  
  doc.setFontSize(10);
  doc.text(invoice.customerName, 45, 172);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.customerAddress || '', 45, 185, { maxWidth: 240 });
  doc.text(`${invoice.customerCity || ''} - ${invoice.customerState || ''}`, 45, 205);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`GSTIN: ${invoice.customerGstin || 'URD'}`, 45, 218);
  doc.text(`PAN: ${invoice.customerPan || 'N/A'} | Phone: ${invoice.customerPhone || 'N/A'}`, 45, 228);

  // Right Box: Meta Info (divided into rows)
  doc.rect(300, 145, 255, 90);
  // Vertical line in meta box
  doc.line(427, 145, 427, 210);
  // Horizontal lines
  doc.line(300, 167, 555, 167);
  doc.line(300, 189, 555, 189);
  doc.line(300, 210, 555, 210);

  // Meta Rows
  doc.setFont('helvetica', 'bold');
  doc.text("Invoice No:", 305, 156);
  doc.text(invoice.invoiceNumber, 305, 164);
  doc.text("Dated:", 432, 156);
  doc.text((invoice.date || '').split('T')[0], 432, 164);

  doc.text("Order No:", 305, 178);
  doc.text(invoice.orderNo || 'N/A', 305, 186);
  doc.text("Due Date:", 432, 178);
  doc.text((invoice.dueDate || '').split('T')[0], 432, 186);

  doc.text("IRN No:", 305, 200);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.irnNo || 'N/A', 305, 207, { maxWidth: 120 });
  
  doc.setFont('helvetica', 'bold');
  doc.text("Ack No:", 432, 200);
  doc.text(invoice.ackNo || 'N/A', 432, 207);

  doc.text("Ack Date:", 432, 221);
  doc.text(invoice.ackDate || 'N/A', 432, 229);

  // 4. Ship To
  doc.rect(40, 240, 515, 45);
  doc.setFont('helvetica', 'bold');
  doc.text("CONSIGNEE (SHIP TO)", 45, 252);
  doc.line(45, 254, 150, 254);
  doc.setFontSize(9);
  doc.text(invoice.customerName, 45, 265);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const shipAddr = invoice.deliveryAddress?.address || invoice.customerAddress || '';
  const shipCity = invoice.deliveryAddress?.city || invoice.customerCity || '';
  const shipState = invoice.deliveryAddress?.state || invoice.customerState || '';
  const shipPin = invoice.deliveryAddress?.pincode || '';
  doc.text(`${shipAddr}, ${shipCity} - ${shipState} (${shipPin})`, 45, 276);

  // 5. Items Table
  const tableData = (invoice.items || []).map((item, idx) => [
    idx + 1,
    item.productName || '',
    item.hsnCode || '',
    (item.mrpPerUnit || 0).toFixed(2),
    (item.effectivePrice || 0).toFixed(2),
    item.qty,
    `${item.discountPercent || 0}%`,
    (item.basicAmount || 0).toFixed(2),
    `${item.gstRate || 0}%`,
    (item.lineTotal || 0).toFixed(2)
  ]);

  if (invoice.freightCharges > 0) {
    tableData.push([
      (invoice.items?.length || 0) + 1,
      'Freight Charges',
      '9965',
      '',
      '',
      1,
      '',
      (invoice.freightCharges || 0).toFixed(2),
      '18%',
      (invoice.freightCharges + (invoice.freightGst || 0)).toFixed(2)
    ]);
  }

  autoTable(doc, {
    head: [['Sr', 'Description of Goods', 'HSN', 'MRP', 'Rate', 'Qty', 'Disc%', 'Taxable', 'GST%', 'Amount']],
    body: tableData,
    startY: 295,
    styles: { fontSize: 7, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.5 },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 160 },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'center' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'center' },
      9: { halign: 'right', fontStyle: 'bold' }
    }
  });

  let finalY = (doc as any).lastAutoTable.finalY;

  // 5.1 GST Breakup Table
  const gstSummary = (invoice.items || []).reduce((acc: any, item) => {
    const rate = item.gstRate || 0;
    if (!acc[rate]) {
      acc[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    }
    acc[rate].taxable += (item.basicAmount || 0);
    if (invoice.totalIgst > 0) {
      acc[rate].igst += (item.gstAmount || 0);
    } else {
      acc[rate].cgst += (item.gstAmount || 0) / 2;
      acc[rate].sgst += (item.gstAmount || 0) / 2;
    }
    return acc;
  }, {});

  if (invoice.freightCharges > 0) {
    const rate = 18;
    if (!gstSummary[rate]) gstSummary[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    gstSummary[rate].taxable += invoice.freightCharges;
    if (invoice.totalIgst > 0) {
      gstSummary[rate].igst += invoice.freightGst;
    } else {
      gstSummary[rate].cgst += invoice.freightGst / 2;
      gstSummary[rate].sgst += invoice.freightGst / 2;
    }
  }

  const gstTableRows = Object.entries(gstSummary).map(([rate, vals]: [string, any]) => {
    if (invoice.totalIgst > 0) {
      return [
        `${rate}%`,
        vals.taxable.toFixed(2),
        `${rate}%`,
        vals.igst.toFixed(2),
        (vals.igst).toFixed(2)
      ];
    } else {
      return [
        `${rate}%`,
        vals.taxable.toFixed(2),
        `${parseFloat(rate)/2}%`,
        vals.cgst.toFixed(2),
        `${parseFloat(rate)/2}%`,
        vals.sgst.toFixed(2),
        (vals.cgst + vals.sgst).toFixed(2)
      ];
    }
  });

  const gstHead = invoice.totalIgst > 0 
    ? [['GST Rate', 'Taxable Val', 'IGST Rate', 'IGST Amt', 'Total Tax']]
    : [['GST Rate', 'Taxable Val', 'CGST Rate', 'CGST Amt', 'SGST Rate', 'SGST Amt', 'Total Tax']];

  autoTable(doc, {
    head: gstHead,
    body: gstTableRows,
    startY: finalY + 5,
    styles: { fontSize: 6, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.5 },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold' },
    margin: { left: 40, right: 300 } // Keep it on the left half
  });

  finalY = (doc as any).lastAutoTable.finalY;

  // 6. Totals Section (Split Box)
  const totalsY = finalY + 10;
  doc.rect(40, totalsY, 515, 100);
  doc.line(360, totalsY, 360, totalsY + 100); // Vertical divide

  // Left side: Words and Bank
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text("AMOUNT IN WORDS", 45, totalsY + 15);
  doc.line(45, totalsY + 17, 130, totalsY + 17);
  doc.setFont('helvetica', 'bolditalic');
  doc.text(`${numberToWords(invoice.grandTotal)} ONLY`, 45, totalsY + 30, { maxWidth: 300 });

  doc.setFont('helvetica', 'bold');
  doc.text("BANK DETAILS", 45, totalsY + 55);
  doc.line(45, totalsY + 57, 110, totalsY + 57);
  doc.setFont('helvetica', 'normal');
  doc.text(`Bank: ${cBank || 'N/A'}`, 45, totalsY + 68);
  doc.text(`A/c No: ${cAcc || 'N/A'}`, 45, totalsY + 78);
  doc.text(`IFSC: ${cIfsc || 'N/A'} | Branch: ${cBranch || 'N/A'}`, 45, totalsY + 88);

  // Right side: Totals
  const totalRow = (label: string, value: string, y: number, isBold: boolean = false) => {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.text(label, 365, y);
    doc.text(value, 550, y, { align: 'right' });
  };

  totalRow("Goods Taxable:", formatCurrency(invoice.subtotalBasic), totalsY + 15);
  if (invoice.freightCharges > 0) {
    totalRow("Freight Charges:", formatCurrency(invoice.freightCharges), totalsY + 27);
    totalRow("Freight GST (18%):", formatCurrency(invoice.freightGst), totalsY + 39);
  }
  totalRow("Total GST:", formatCurrency(invoice.totalIgst || (invoice.totalCgst + invoice.totalSgst)), totalsY + 51);
  if (invoice.roundOff !== 0) {
    totalRow("Round Off:", `${invoice.roundOff > 0 ? '+' : ''}${invoice.roundOff.toFixed(2)}`, totalsY + 63);
  }

  // Bill Total Highlight
  doc.setFillColor(245, 245, 245);
  doc.rect(360.5, totalsY + 75, 194, 24.5, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text("BILL TOTAL:", 365, totalsY + 91);
  doc.setFontSize(12);
  doc.text(formatCurrency(invoice.grandTotal), 550, totalsY + 91, { align: 'right' });

  // 7. Terms & Conditions
  const tcY = totalsY + 115;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text("TERMS & CONDITIONS", 40, tcY);
  doc.line(40, tcY + 2, 135, tcY + 2);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  TERMS.slice(0, 5).forEach((t, idx) => {
    doc.text(`• ${t}`, 40, tcY + 12 + (idx * 10));
  });

  // 8. Signatures
  const sigY = totalsY + 185;
  doc.setFontSize(9);
  doc.rect(40, sigY, 515, 60);
  doc.line(297, sigY, 297, sigY + 60);

  doc.setFont('helvetica', 'bolditalic');
  doc.text("Certified that the particulars given above are correct and complete.", 45, sigY + 12);
  doc.setFont('helvetica', 'bold');
  doc.text("Receiver's Signature", 45, sigY + 50);
  doc.line(45, sigY + 42, 150, sigY + 42);

  doc.text(`For ${cName.toUpperCase()}`, 550, sigY + 12, { align: 'right' });
  doc.text("Authorised Signatory", 550, sigY + 50, { align: 'right' });
  doc.line(440, sigY + 42, 550, sigY + 42);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text("This is a computer generated tax invoice", 300, sigY + 75, { align: 'center' });
}

export async function generateSingleInvoicePDF(invoice: Invoice, company: CompanySettings | null): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  generateInvoicePDFPage(doc, invoice, company);
  return doc.output('blob');
}
