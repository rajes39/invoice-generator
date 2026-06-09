import { supabase } from '../lib/supabase';
import type { Customer } from '../types';

type ListParams = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function fetchCustomers({ search = '', page = 1, pageSize = 25 }: ListParams) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('customers').select('*', { count: 'exact' }).order('created_at', { ascending: false });

  if (search && search.trim().length > 0) {
    const q = `%${search.trim().toLowerCase()}%`;
    query = query.or(`name.ilike.${q},gstin.ilike.${q},email.ilike.${q},mobile.ilike.${q}`);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error('fetchCustomers error:', error);
    throw error;
  }

  return { data: data ?? [], count: count ?? 0 };
}

export async function createCustomer(payload: any) {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  
  if (!user) throw new Error('No authenticated user found');

  const id = crypto.randomUUID();
  const row = { 
    id, 
    ...payload, 
    user_id: user.id,
    created_at: new Date().toISOString(), 
    data: payload 
  };
  
  const { error } = await supabase.from('customers').insert([row]);
  if (error) {
    console.error('createCustomer error:', error);
    throw error;
  }
  return id;
}

export async function updateCustomer(id: string, payload: any) {
  const row = { ...payload, data: payload };
  const { error } = await supabase.from('customers').update(row).eq('id', id);
  if (error) {
    console.error('updateCustomer error:', error);
    throw error;
  }
  return id;
}

export async function deleteCustomer(id: string) {
  const { error } = await supabase.from('customers').delete().eq('id', id);
  if (error) {
    console.error('deleteCustomer error:', error);
    throw error;
  }
  return true;
}

export async function getCustomerById(id: string) {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error('getCustomerById error:', error);
    throw error;
  }
  return data ?? null;
}

const customerService = {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerById,
};

export default customerService;
