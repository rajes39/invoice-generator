import { supabase } from '../lib/supabase';
import type { CompanySettings } from '../types';

export async function getCompanySettings(): Promise<CompanySettings | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();
    
  if (error) throw error;
  return data ?? null;
}

export async function saveCompanySettings(payload: Partial<CompanySettings>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Unauthorized');
  
  const id = session.user.id; // Use user_id as PK
  const record = {
    id,
    user_id: session.user.id,
    ...payload,
    updated_at: new Date().toISOString(),
    data: payload,
  };
  const { error } = await supabase.from('company_settings').upsert(record, { onConflict: 'id' });
  if (error) throw error;
}
