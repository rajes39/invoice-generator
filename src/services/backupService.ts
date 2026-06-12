import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

export async function fetchAllUserData(userId: string) {
  const tables = [
    'customers',
    'suppliers',
    'products',
    'invoices',
    'invoice_items',
    'discount_settings',
    'customer_product_net_rates',
    'product_schemes',
    'brands',
    'categories',
    'warehouses',
    'stock_ledger',
    'purchase_orders',
    'goods_receipt_notes'
  ];

  const results: Record<string, any[]> = {};

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId);
    
    if (error) {
      console.warn(`Error fetching ${table}:`, error);
      results[table] = [];
    } else {
      results[table] = data || [];
    }
  }

  return results;
}

export async function createAndDownloadBackup(userId: string) {
  const data = await fetchAllUserData(userId);
  const wb = XLSX.utils.book_new();

  for (const [tableName, rows] of Object.entries(data)) {
    if (rows.length > 0) {
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, tableName.slice(0, 31)); // Excel sheet name limit
    } else {
      // Add empty sheet if no data
      const ws = XLSX.utils.json_to_sheet([]);
      XLSX.utils.book_append_sheet(wb, ws, tableName.slice(0, 31));
    }
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `SONALI_ERP_Backup_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);

  // Log the backup
  await logBackup(userId);

  return true;
}

async function logBackup(userId: string) {
  const { error } = await supabase.from('backup_log').insert([{
    user_id: userId,
    backup_date: new Date().toISOString().split('T')[0],
    status: 'success'
  }]);

  if (error) {
    console.error('Error logging backup:', error);
  }
}

export async function getLastBackup(userId: string) {
  const { data, error } = await supabase
    .from('backup_log')
    .select('*')
    .eq('user_id', userId)
    .order('backup_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching last backup:', error);
    return null;
  }
  return data;
}

export async function getBackupHistory(userId: string, limit = 30) {
  const { data, error } = await supabase
    .from('backup_log')
    .select('*')
    .eq('user_id', userId)
    .order('backup_time', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching backup history:', error);
    return [];
  }
  return data || [];
}

export async function checkAndTriggerAutoBackup(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  const lastBackup = await getLastBackup(userId);

  if (!lastBackup || lastBackup.backup_date !== today) {
    try {
      await createAndDownloadBackup(userId);
      toast.success('Daily backup downloaded successfully', {
        style: {
          borderRadius: '10px',
          background: '#10b981',
          color: '#fff',
          fontWeight: 'bold',
        },
      });
      return true;
    } catch (error) {
      console.error('Daily backup failed:', error);
      toast.error('Daily backup failed - please download manually', {
        style: {
          borderRadius: '10px',
          background: '#ef4444',
          color: '#fff',
          fontWeight: 'bold',
        },
      });
      return false;
    }
  }
  return false;
}
