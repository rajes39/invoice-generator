import { supabase } from '../lib/supabase';

export interface ReportLine {
  account_name: string;
  account_type: string;
  balance: number;
}

export interface TrialBalanceLine {
  account_id: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  net_balance: number;
}

export async function fetchProfitAndLoss(): Promise<ReportLine[]> {
  const { data, error } = await supabase
    .from('view_profit_and_loss')
    .select('*');
  
  if (error) {
    console.error('Error fetching P&L:', error);
    throw error;
  }
  return data || [];
}

export async function fetchBalanceSheet(): Promise<ReportLine[]> {
  const { data, error } = await supabase
    .from('view_balance_sheet')
    .select('*');
  
  if (error) {
    console.error('Error fetching Balance Sheet:', error);
    throw error;
  }
  return data || [];
}

export async function fetchTrialBalance(): Promise<TrialBalanceLine[]> {
  const { data, error } = await supabase
    .from('view_trial_balance')
    .select('*');
  
  if (error) {
    console.error('Error fetching Trial Balance:', error);
    throw error;
  }
  return data || [];
}

export const financialService = {
  fetchProfitAndLoss,
  fetchBalanceSheet,
  fetchTrialBalance
};
