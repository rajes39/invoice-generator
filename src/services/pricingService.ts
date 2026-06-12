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

export interface CustomerCategoryDiscount {
  id: string;
  customerId: string;
  category: string;
  discountPercent: number;
}

export async function fetchCustomerDiscounts(customerId: string): Promise<CustomerDiscount[]> {
  const { data, error } = await supabase
    .from('customer_discounts')
    .select('*')
    .eq('customer_id', customerId);

  if (error) {
    console.error('Error fetching customer discounts:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    customerId: row.customer_id,
    type: row.type as 'BRAND' | 'PRODUCT',
    target: row.target || '',
    discountPercent: row.discount_percent,
  }));
}

export async function fetchCustomerNetRates(customerId: string): Promise<CustomerNetRate[]> {
  const { data, error } = await supabase
    .from('customer_net_rates')
    .select('*')
    .eq('customer_id', customerId);

  if (error) {
    console.error('Error fetching customer net rates:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    customerId: row.customer_id,
    productId: row.product_id,
    netRate: row.net_rate,
  }));
}

export async function fetchCustomerCategoryDiscounts(customerId: string): Promise<CustomerCategoryDiscount[]> {
  const { data, error } = await supabase
    .from('customer_category_discounts')
    .select('*')
    .eq('customer_id', customerId);

  if (error) {
    console.error('Error fetching customer category discounts:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    customerId: row.customer_id,
    category: row.category,
    discountPercent: row.discount_percent,
  }));
}

export async function saveCustomerDiscount(discount: Omit<CustomerDiscount, 'id'>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  // First, check if a rule for this target already exists and delete it to "upsert"
  await supabase
    .from('customer_discounts')
    .delete()
    .eq('customer_id', discount.customerId)
    .eq('type', discount.type)
    .eq('target', discount.target);

  const payload = {
    user_id: userId,
    type: discount.type,
    customer_id: discount.customerId,
    discount_percent: discount.discountPercent,
    target: discount.target,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('customer_discounts').insert([payload]);
  if (error) throw error;
}

export async function deleteCustomerDiscountByTarget(customerId: string, type: 'BRAND' | 'PRODUCT', target: string): Promise<void> {
  const { error } = await supabase
    .from('customer_discounts')
    .delete()
    .eq('customer_id', customerId)
    .eq('type', type)
    .eq('target', target);
  if (error) throw error;
}

export async function saveCustomerNetRate(rate: Omit<CustomerNetRate, 'id'>): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;

  // Delete existing to upsert
  await supabase
    .from('customer_net_rates')
    .delete()
    .eq('customer_id', rate.customerId)
    .eq('product_id', rate.productId);

  const payload = {
    user_id: userId,
    customer_id: rate.customerId,
    product_id: rate.productId,
    net_rate: rate.netRate,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('customer_net_rates').insert([payload]);
  if (error) throw error;
}

export async function deleteCustomerNetRate(customerId: string, productId: string): Promise<void> {
  const { error } = await supabase
    .from('customer_net_rates')
    .delete()
    .eq('customer_id', customerId)
    .eq('product_id', productId);
  if (error) throw error;
}

const pricingService = {
  fetchCustomerDiscounts,
  fetchCustomerNetRates,
  fetchCustomerCategoryDiscounts,
  saveCustomerDiscount,
  deleteCustomerDiscountByTarget,
  saveCustomerNetRate,
  deleteCustomerNetRate,
};

export default pricingService;
