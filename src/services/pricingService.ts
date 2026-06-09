import { supabase } from '../lib/supabase';

export interface CustomerDiscount {
  id: string;
  customerId: string;
  type: 'BRAND' | 'PRODUCT';
  target: string; // Brand name or Product ID
  discountPercent: number;
}

export interface CustomerNetRate {
  id: string;
  customerId: string;
  productId: string;
  netRate: number;
}

export async function fetchCustomerDiscounts(customerId: string): Promise<CustomerDiscount[]> {
  const { data, error } = await supabase
    .from('discount_settings')
    .select('*')
    .eq('reference_id', customerId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching customer discounts:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    customerId: row.reference_id,
    type: row.type as 'BRAND' | 'PRODUCT',
    target: row.data?.target || '',
    discountPercent: row.discount_percent,
  }));
}

export async function saveCustomerDiscount(discount: Omit<CustomerDiscount, 'id'>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  // First, check if a rule for this target already exists and delete it to "upsert"
  await supabase
    .from('discount_settings')
    .delete()
    .eq('reference_id', discount.customerId)
    .eq('type', discount.type)
    .filter('data->>target', 'eq', discount.target);

  const payload = {
    id: crypto.randomUUID(),
    user_id: userId,
    type: discount.type,
    reference_id: discount.customerId,
    discount_percent: discount.discountPercent,
    is_active: true,
    data: { target: discount.target },
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('discount_settings').insert([payload]);
  if (error) throw error;
}

export async function deleteCustomerDiscountByTarget(customerId: string, type: 'BRAND' | 'PRODUCT', target: string): Promise<void> {
  const { error } = await supabase
    .from('discount_settings')
    .delete()
    .eq('reference_id', customerId)
    .eq('type', type)
    .filter('data->>target', 'eq', target);
  if (error) throw error;
}

export async function saveCustomerNetRate(rate: Omit<CustomerNetRate, 'id'>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  // Delete existing to upsert
  await supabase
    .from('customer_product_net_rates')
    .delete()
    .eq('customer_id', rate.customerId)
    .eq('product_id', rate.productId);

  const payload = {
    id: crypto.randomUUID(),
    user_id: userId,
    customer_id: rate.customerId,
    product_id: rate.productId,
    net_rate: rate.netRate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    data: {},
  };

  const { error } = await supabase.from('customer_product_net_rates').insert([payload]);
  if (error) throw error;
}

export async function deleteCustomerNetRate(customerId: string, productId: string): Promise<void> {
  const { error } = await supabase
    .from('customer_product_net_rates')
    .delete()
    .eq('customer_id', customerId)
    .eq('product_id', productId);
  if (error) throw error;
}

const pricingService = {
  fetchCustomerDiscounts,
  saveCustomerDiscount,
  deleteCustomerDiscountByTarget,
  fetchCustomerNetRates,
  saveCustomerNetRate,
  deleteCustomerNetRate,
};

export default pricingService;
