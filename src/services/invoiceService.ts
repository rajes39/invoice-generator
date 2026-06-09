import { supabase } from '../lib/supabase';
import type { Invoice, InvoiceItem, CompanySettings } from '../types';
import { updateCustomerBalance } from './paymentService';

export function getFinancialYear(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;
  return `${fyStart}-${fyEnd.toString().slice(-2)}`;
}

export function numberToWords(amount: number): string {
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
    if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    return '';
  }

  if (amount === 0) return 'Zero Rupees Only';

  let result = '';
  const whole = Math.floor(amount);
  const paise = Math.round((amount - whole) * 100);

  if (whole > 0) {
    const crore = Math.floor(whole / 10000000);
    const lakh = Math.floor((whole % 10000000) / 100000);
    const thousand = Math.floor((whole % 100000) / 1000);
    const remainder = whole % 1000;

    if (crore > 0) result += convert(crore) + ' Crore ';
    if (lakh > 0) result += convert(lakh) + ' Lakh ';
    if (thousand > 0) result += convert(thousand) + ' Thousand ';
    if (remainder > 0) result += convert(remainder);
    result += ' Rupees';
  }

  if (paise > 0) {
    if (result !== '') result += ' and ';
    result += convert(paise) + ' Paise';
  }

  return result + ' Only';
}

export function calculateBasicRate(mrp: number, gstRate: number) {
  if (!mrp || isNaN(mrp)) return 0;
  return Math.round((mrp / (1 + (gstRate || 0) / 100)) * 100) / 100;
}

export function calculateGstAmount(taxable: number, gstRate: number) {
  if (!taxable || isNaN(taxable)) return 0;
  return Math.round((taxable * (gstRate || 0) / 100) * 100) / 100;
}

export function createInvoiceNumber(prefix: string, sequence: number, fy: string) {
  const seqStr = String(sequence).padStart(4, '0');
  return `${prefix}/${fy}/${seqStr}`;
}

export function mapInvoiceFromDb(dbRow: any): Invoice {
  if (!dbRow) return null as any;
  
  // Merge from data column if exists for backward compatibility/extra fields
  const data = dbRow.data || {};
  
  return {
    id: dbRow.id,
    userId: dbRow.user_id,
    invoiceNumber: dbRow.invoice_no || data.invoiceNumber,
    irnNo: dbRow.irn_no || data.irnNo,
    ackNo: dbRow.ack_no || data.ackNo,
    ackDate: dbRow.ack_date || data.ackDate,
    customerId: dbRow.customer_id || data.customerId,
    customerName: dbRow.customer_name || data.customerName,
    customerGstin: dbRow.customer_gstin || data.customerGstin,
    customerPan: dbRow.customer_pan || data.customerPan,
    customerAadhar: dbRow.customer_aadhar || data.customerAadhar,
    customerPhone: dbRow.customer_phone || data.customerPhone || data.customerMobile,
    customerEmail: dbRow.customer_email || data.customerEmail,
    customerAddress: dbRow.customer_address || data.customerAddress,
    customerCity: dbRow.customer_city || data.customerCity,
    customerState: dbRow.customer_state || data.customerState,
    customerStateCode: dbRow.customer_state_code || data.customerStateCode,
    deliveryAddress: {
      address: dbRow.delivery_address || (data.deliveryAddress?.address) || '',
      city: dbRow.delivery_city || (data.deliveryAddress?.city) || '',
      state: dbRow.delivery_state || (data.deliveryAddress?.state) || '',
      stateCode: dbRow.delivery_state_code || (data.deliveryAddress?.stateCode) || '',
      pincode: dbRow.delivery_pincode || (data.deliveryAddress?.pincode) || '',
    },
    date: dbRow.date || data.date,
    dueDate: dbRow.due_date || data.dueDate,
    orderNo: dbRow.order_no || data.orderNo,
    remark: dbRow.remark || data.remark,
    subtotalMrp: Number(dbRow.subtotal_mrp ?? data.subtotalMrp ?? 0),
    totalDiscountAmount: Number(dbRow.total_discount_amount ?? data.totalDiscountAmount ?? 0),
    subtotalBasic: Number(dbRow.subtotal_basic ?? data.subtotalBasic ?? 0),
    totalCgst: Number(dbRow.total_cgst ?? data.totalCgst ?? 0),
    totalSgst: Number(dbRow.total_sgst ?? data.totalSgst ?? 0),
    totalIgst: Number(dbRow.total_igst ?? data.totalIgst ?? 0),
    freightCharges: Number(dbRow.freight_charges ?? data.freightCharges ?? 0),
    freightGst: Number(dbRow.freight_gst ?? data.freightGst ?? 0),
    roundOff: Number(dbRow.round_off ?? data.roundOff ?? 0),
    grandTotal: Number(dbRow.grand_total ?? data.grandTotal ?? 0),
    isInterstate: dbRow.is_interstate ?? data.isInterstate ?? false,
    status: dbRow.status || data.status || 'Draft',
    items: Array.isArray(dbRow.items) ? dbRow.items : (data.items || []),
    createdAt: dbRow.created_at || data.createdAt,
  };
}

export async function fetchInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapInvoiceFromDb);
}

export async function fetchInvoiceById(id: string): Promise<Invoice | null> {
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapInvoiceFromDb(data) : null;
}

export async function createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'>): Promise<string> {
  // 0. Fetch or create company settings
  let { data: settings, error: settingsError } = await supabase
    .from('company_settings')
    .select('*')
    .eq('user_id', invoice.userId)
    .maybeSingle();

  if (settingsError) {
    console.error('Error fetching settings:', settingsError);
  }

  // If settings not found, create a default row automatically
  if (!settings) {
    const currentFY = getFinancialYear(new Date());
    const settingsId = invoice.userId; // Use user_id as PK
    
    const defaultSettings = {
      id: settingsId,
      user_id: invoice.userId,
      invoice_prefix: 'INV',
      invoice_sequence: 0,
      financial_year: currentFY,
      company_name: 'Misti Auto Centre'
    };

    const { data: newSettings, error: insertError } = await supabase
      .from('company_settings')
      .insert([defaultSettings])
      .select()
      .maybeSingle();

    if (insertError) {
      console.warn('Failed to create default settings, using fallback values:', insertError);
      settings = { 
        ...defaultSettings,
        id: settingsId,
        invoice_prefix: 'INV',
        invoice_sequence: 0,
        financial_year: currentFY
      } as any;
    } else {
      settings = newSettings;
    }
  }

  // Use fallback values if settings are somehow still incomplete
  const prefix = settings?.invoice_prefix || 'INV';
  const rawFY = settings?.financial_year || getFinancialYear(new Date());
  // Fallback format: INV/26-27/0001 (ensure 2-digit FY if currently 2026-27)
  const financialYear = rawFY.length > 5 ? rawFY.replace(/^\d{2}/, '') : rawFY;
  
  const nextSequence = (settings?.invoice_sequence || 0) + 1;
  const invoiceNo = createInvoiceNumber(prefix, nextSequence, financialYear);
  const invoiceId = crypto.randomUUID();

  // 1. Insert Invoice
  const insertObject = {
    id: invoiceId,
    user_id: invoice.userId,
    invoice_no: invoiceNo,
    irn_no: invoice.irnNo,
    ack_no: invoice.ackNo,
    ack_date: invoice.ackDate,
    customer_id: invoice.customerId,
    customer_name: invoice.customerName,
    customer_gstin: invoice.customerGstin,
    customer_pan: invoice.customerPan,
    customer_aadhar: invoice.customerAadhar,
    customer_phone: invoice.customerPhone,
    customer_email: invoice.customerEmail,
    customer_address: invoice.customerAddress,
    customer_city: invoice.customerCity,
    customer_state: invoice.customerState,
    customer_state_code: invoice.customerStateCode,
    delivery_address: invoice.deliveryAddress.address,
    delivery_city: invoice.deliveryAddress.city,
    delivery_state: invoice.deliveryAddress.state,
    delivery_state_code: invoice.deliveryAddress.stateCode,
    delivery_pincode: invoice.deliveryAddress.pincode,
    date: invoice.date.split('T')[0],
    due_date: invoice.dueDate.split('T')[0],
    order_no: invoice.orderNo,
    remark: invoice.remark,
    subtotal_mrp: invoice.subtotalMrp,
    total_discount_amount: invoice.totalDiscountAmount,
    subtotal_basic: invoice.subtotalBasic,
    total_cgst: invoice.totalCgst,
    total_sgst: invoice.totalSgst,
    total_igst: invoice.totalIgst,
    freight_charges: invoice.freightCharges,
    freight_gst: invoice.freightGst,
    round_off: invoice.roundOff,
    grand_total: invoice.grandTotal,
    is_interstate: invoice.isInterstate,
    status: invoice.status,
    items: invoice.items,
    data: { ...invoice, invoiceNumber: invoiceNo }
  };

  console.log('Inserting into invoices table:', insertObject);

  const { error: invError } = await supabase.from('invoices').insert([insertObject]);

  if (invError) {
    console.error('Invoice insert error:', invError);
    throw invError;
  }

  // 2. Insert Items
  const itemsToInsert = invoice.items.map(item => ({
    id: crypto.randomUUID(),
    user_id: invoice.userId,
    invoice_id: invoiceId,
    product_id: item.productId,
    product_name: item.productName,
    part_no: item.partNo,
    hsn_code: item.hsnCode,
    qty: item.qty,
    mrp_per_unit: item.mrpPerUnit,
    effective_price: item.effectivePrice,
    discount_percent: item.discountPercent,
    discount_amount: item.discountAmount,
    is_net_rate: item.isNetRate,
    gst_rate: item.gstRate,
    basic_rate_per_unit: item.basicRatePerUnit,
    basic_amount: item.basicAmount,
    gst_amount: item.gstAmount,
    line_total: item.lineTotal,
    data: item
  }));

  const { error: itemsError } = await supabase.from('invoice_items').insert(itemsToInsert);
  if (itemsError) {
    console.error('Items insert error:', itemsError);
    throw itemsError;
  }

  // 3. Update Sequence
  await supabase.from('company_settings')
    .update({ 
      invoice_sequence: nextSequence
    })
    .eq('id', settings.id);

  return invoiceId;
}

export async function updateInvoice(id: string, invoice: Partial<Invoice>): Promise<void> {
  const { error } = await supabase.from('invoices').update({ 
    ...invoice, 
    data: invoice,
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteInvoice(id: string): Promise<void> {
  const { data: invoice } = await supabase.from('invoices').select('customer_id').eq('id', id).single();
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) throw error;
  if (invoice?.customer_id) {
    await updateCustomerBalance(invoice.customer_id);
  }
}
