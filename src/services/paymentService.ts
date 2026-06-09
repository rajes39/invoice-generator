import { supabase } from '../lib/supabase';
import type { Payment } from '../types';

export async function fetchPayments(customerId?: string): Promise<Payment[]> {
  let query = supabase.from('invoice_payments').select('*');
  if (customerId) {
    query = query.eq('customer_id', customerId);
  }
  const { data, error } = await query.order('date', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    customerId: row.customer_id,
    id: row.id,
    amount: row.amount,
    date: row.date,
    type: row.type,
    mode: row.mode
  }));
}

export async function recordPayment(payment: Omit<Payment, 'id'>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  const payload = {
    id: crypto.randomUUID(),
    user_id: userId,
    customer_id: payment.customerId,
    amount: payment.amount,
    date: payment.date,
    type: payment.type,
    mode: payment.mode,
    data: payment
  };

  const { error } = await supabase.from('invoice_payments').insert([payload]);
  if (error) throw error;
}

export async function deletePayment(id: string, customerId: string): Promise<void> {
  const { error } = await supabase.from('invoice_payments').delete().eq('id', id);
  if (error) throw error;
}

export async function updateCustomerBalance(customerId: string): Promise<void> {
  // 1. Fetch opening balance
  const { data: customer, error: custError } = await supabase
    .from('customers')
    .select('opening_balance, opening_balance_type')
    .eq('id', customerId)
    .single();
  
  if (custError) throw custError;

  const opBal = Number(customer.opening_balance || 0);
  const opType = customer.opening_balance_type || 'debit'; // Default to 'debit' if null

  // 2. Fetch all invoices
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('grand_total')
    .eq('customer_id', customerId);
  
  if (invError) throw invError;

  // 3. Fetch all payments
  const { data: payments, error: payError } = await supabase
    .from('invoice_payments')
    .select('amount')
    .eq('customer_id', customerId);
  
  if (payError) throw payError;

  // 4. Fetch all credit notes
  const { data: creditNotes, error: cnError } = await supabase
    .from('credit_notes')
    .select('total_amount')
    .eq('customer_id', customerId);
  
  if (cnError) {
    console.warn('Could not fetch credit notes for balance calculation:', cnError);
  }

  // Calculate total balance
  let balance = (opType === 'We owe them' || opType === 'credit') ? -opBal : opBal;
  
  console.log(`Starting balance for ${customerId}: ${balance} (Op Bal: ${opBal}, Type: ${opType})`);

  invoices.forEach(inv => {
    balance += Number(inv.grand_total || 0);
  });
  console.log(`Balance after ${invoices.length} invoices: ${balance}`);

  payments.forEach(pay => {
    balance -= Number(pay.amount || 0);
  });
  console.log(`Balance after ${payments.length} payments: ${balance}`);

  if (creditNotes) {
    creditNotes.forEach(cn => {
      balance -= Number(cn.total_amount || 0);
    });
    console.log(`Balance after ${creditNotes.length} credit notes: ${balance}`);
  }

  console.log(`Final calculated balance for ${customerId}: ${balance}`);

  // 5. Update customer balance in DB
  const { error: updateError } = await supabase
    .from('customers')
    .update({ 
      balance: balance,
      balance_type: balance >= 0 ? 'They owe us' : 'We owe them'
    })
    .eq('id', customerId);
  
  if (updateError) throw updateError;
}
