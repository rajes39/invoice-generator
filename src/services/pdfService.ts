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
  doc.setFont('helvetica', 'bold');
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, 40, 140);
  doc.text(`Date: ${(invoice.date || '').split('T')[0]}`, 40, 152);
  doc.text(`Due Date: ${(invoice.dueDate || '').split('T')[0]}`, 40, 164);
  
  doc.text(`IRN: ${invoice.irnNo || 'N/A'}`, 300, 140);
  doc.text(`Ack No/Date: ${invoice.ackNo || ''} ${invoice.ackDate ? `(${invoice.ackDate})` : ''}`, 300, 152);
  doc.text(`Order No: ${invoice.orderNo || 'N/A'}`, 300, 164);

  // 4. Parties Boxes
  doc.rect(40, 175, 255, 80);
  doc.text("BUYER (BILL TO)", 45, 187);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.customerName, 45, 200);
  doc.text(invoice.customerAddress || '', 45, 210, { maxWidth: 240 });
  doc.text(`GSTIN: ${invoice.customerGstin || 'URD'} | PAN: ${invoice.customerPan || 'N/A'}`, 45, 235);
  doc.text(`Phone: ${invoice.customerPhone || 'N/A'}`, 45, 245);

  doc.rect(300, 175, 255, 80);
  doc.setFont('helvetica', 'bold');
  doc.text("CONSIGNEE (SHIP TO)", 305, 187);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.customerName, 305, 200);
  doc.text(invoice.deliveryAddress?.address || invoice.customerAddress || '', 305, 210, { maxWidth: 240 });

  // 5. Items Table
  const tableData = (invoice.items || []).map((item, idx) => [
    idx + 1,
    item.partNo || '',
    item.productName || '',
    item.hsnCode || '',
    (item.mrpPerUnit || 0).toFixed(2),
    (item.effectivePrice || 0).toFixed(2),
    item.qty,
    `${item.discountPercent || 0}%`,
    (item.discountAmount || 0).toFixed(2),
    (item.basicAmount || 0).toFixed(2),
    `${item.gstRate || 0}%`,
    (item.gstAmount || 0).toFixed(2),
    (item.lineTotal || 0).toFixed(2)
  ]);

  if (invoice.freightCharges > 0) {
    tableData.push([
      (invoice.items?.length || 0) + 1,
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

  autoTable(doc, {
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
  doc.text(formatCurrency(invoice.subtotalBasic), 550, finalY + 20, { align: 'right' });

  let yOff = 20;
  if (invoice.freightCharges > 0) {
    yOff += 12;
    doc.text(`Freight + GST:`, 400, finalY + yOff);
    doc.text(formatCurrency(invoice.freightCharges + invoice.freightGst), 550, finalY + yOff, { align: 'right' });
  }

  yOff += 12;
  doc.text(`Total GST:`, 400, finalY + yOff);
  doc.text(formatCurrency(invoice.totalIgst || (invoice.totalCgst + invoice.totalSgst)), 550, finalY + yOff, { align: 'right' });

  yOff += 12;
  doc.text(`Round Off:`, 400, finalY + yOff);
  doc.text(`${invoice.roundOff > 0 ? '+' : ''}${invoice.roundOff.toFixed(2)}`, 550, finalY + yOff, { align: 'right' });

  yOff += 12;
  doc.setFontSize(11);
  doc.rect(395, finalY + yOff, 160, 25);
  doc.text(`BILL TOTAL:`, 400, finalY + yOff + 17);
  doc.text(formatCurrency(invoice.grandTotal), 550, finalY + yOff + 17, { align: 'right' });

  // 7. Amount in Words
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bolditalic');
  doc.text(`Amount in Words: ${numberToWords(invoice.grandTotal)} Only`, 40, finalY + yOff + 40);

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
