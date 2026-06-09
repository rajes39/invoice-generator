import { supabase } from '../lib/supabase';
import type { Product } from '../types';

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProduct(payload: Omit<Product, 'id' | 'createdAt'>): Promise<void> {
  await supabase.from('products').insert([{ id: crypto.randomUUID(), ...payload, created_at: new Date().toISOString(), data: payload }]);
}

export async function updateProduct(id: string, payload: Partial<Product>): Promise<void> {
  await supabase.from('products').update({ ...payload, data: payload }).eq('id', id);
}

export async function deleteProduct(id: string): Promise<void> {
  await supabase.from('products').delete().eq('id', id);
}
