import { supabase } from '../lib/supabase';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'stock_low' | 'payment_due' | 'system';
  is_read: boolean;
  created_at: string;
}

export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
  return data || [];
}

export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  
  if (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

export const notificationService = {
  fetchNotifications,
  markAsRead
};
