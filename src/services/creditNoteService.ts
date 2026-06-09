import { supabase } from '../lib/supabase';
import type { CreditNote, CreditNoteItem } from '../types';
import { getFinancialYear } from './invoiceService';
import { updateCustomerBalance } from './paymentService';

export function mapCreditNoteFromDb(row: any): CreditNote {
  if (!row) return null as any;
  const data = row.data || {};
  return {
    id: row.id,
    userId: row.user_id,
    creditNoteNumber: row.credit_note_number || data.creditNoteNumber,
    originalInvoiceId: row.original_invoice_id || data.originalInvoiceId,
    originalInvoiceNumber: row.original_invoice_number || data.originalInvoiceNumber,
    customerId: row.customer_id || data.customerId,
    customerName: row.customer_name || data.customerName,
    customerGstin: row.customer_gstin || data.customerGstin,
    customerPhone: row.customer_phone || data.customerPhone,
    customerAddress: row.customer_address || data.customerAddress,
    date: row.date || data.date,
    reason: row.reason || data.reason,
    items: row.items || data.items || [],
    subtotalBasic: Number(row.subtotal_basic ?? data.subtotalBasic ?? 0),
    totalCgst: Number(row.total_cgst ?? data.totalCgst ?? 0),
    totalSgst: Number(row.total_sgst ?? data.totalSgst ?? 0),
    totalIgst: Number(row.total_igst ?? data.totalIgst ?? 0),
    roundOff: Number(row.round_off ?? data.roundOff ?? 0),
    totalAmount: Number(row.total_amount ?? data.totalAmount ?? 0),
    status: row.status || data.status || 'Applied',
    createdAt: row.created_at || data.createdAt
  };
}

export async function fetchCreditNotes(): Promise<CreditNote[]> {
  const { data, error } = await supabase.from('credit_notes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapCreditNoteFromDb);
}

export async function fetchCreditNoteById(id: string): Promise<CreditNote | null> {
  const { data, error } = await supabase.from('credit_notes').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapCreditNoteFromDb(data) : null;
}

export async function createCreditNote(cn: Omit<CreditNote, 'id' | 'createdAt' | 'creditNoteNumber'>): Promise<string> {
  // 1. Get settings for sequence
  let { data: settings } = await supabase.from('company_settings').select('*').eq('user_id', cn.userId).maybeSingle();
  
  const prefix = 'CN';
  const rawFY = settings?.financial_year || settings?.financialYear || getFinancialYear(new Date());
  const fy = rawFY.length > 5 ? rawFY.replace(/^\d{2}/, '') : rawFY;
  
  // Use a fallback sequence if cn_sequence doesn't exist in settings
  const nextSeq = (Number(settings?.cn_sequence || settings?.data?.cn_sequence || 0)) + 1;
  const cnNumber = `${prefix}/${fy}/${String(nextSeq).padStart(4, '0')}`;
  
  const cnId = crypto.randomUUID();
  
  const payload = {
    id: cnId,
    user_id: cn.userId,
    credit_note_number: cnNumber,
    original_invoice_id: cn.originalInvoiceId,
    original_invoice_number: cn.originalInvoiceNumber,
    customer_id: cn.customerId,
    customer_name: cn.customerName,
    customer_gstin: cn.customerGstin,
    customer_phone: cn.customerPhone,
    customer_address: cn.customerAddress,
    date: cn.date,
    reason: cn.reason,
    items: cn.items,
    subtotal_basic: cn.subtotalBasic,
    total_cgst: cn.totalCgst,
    total_sgst: cn.totalSgst,
    total_igst: cn.totalIgst,
    round_off: cn.roundOff,
    total_amount: cn.totalAmount,
    status: cn.status,
    data: { ...cn, creditNoteNumber: cnNumber }
  };

  const { error } = await supabase.from('credit_notes').insert([payload]);
  if (error) throw error;

  // 2. Update sequence in settings (store in data if column missing)
  await supabase.from('company_settings').update({ 
    cn_sequence: nextSeq,
    data: { ...settings?.data, cn_sequence: nextSeq }
  }).eq('user_id', cn.userId);

  // 3. Update customer balance
  await updateCustomerBalance(cn.customerId);

  return cnId;
}

export async function deleteCreditNote(id: string): Promise<void> {
  const { data: cn } = await supabase.from('credit_notes').select('customer_id').eq('id', id).single();
  const { error } = await supabase.from('credit_notes').delete().eq('id', id);
  if (error) throw error;
  if (cn) {
    await updateCustomerBalance(cn.customer_id);
  }
}
