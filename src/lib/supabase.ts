import { createClient, type Session, type User } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const SUPABASE_URL = env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = env.VITE_SUPABASE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY in .env.');
}

const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// expose the raw client for direct queries where needed
export const supabase = client;

const TABLE_KEY_MAP: Record<string, string> = {
  invoice_customers: 'customers',
  invoice_products: 'products',
  invoice_suppliers: 'suppliers',
  invoice_records: 'invoices',
  invoice_invoices: 'invoices',
  invoice_purchases: 'purchases',
  invoice_credit_notes: 'invoice_credit_notes',
  invoice_payments: 'invoice_payments',
  invoice_supplier_payments: 'invoice_supplier_payments',
};

function userScopedKey(key: string, userId: string) {
  return `user:${userId}:${key}`;
}

const ensureString = (value: any) => (value === undefined || value === null) ? '' : String(value);
const ensureNumber = (value: any) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

function normalizeSupabaseRow(table: string, row: any) {
  const data = row?.data && typeof row.data === 'object' ? row.data : {};
  const merged = { ...row, ...data, id: row.id };

  if (table === 'products') {
    return {
      id: ensureString(merged.id),
      name: ensureString(merged.name),
      partNumber: ensureString(merged.partNumber ?? merged.part_no),
      brand: ensureString(merged.brand),
      brandId: ensureString(merged.brandId ?? merged.brand_id),
      category: ensureString(merged.category),
      categoryId: ensureString(merged.categoryId ?? merged.category_id),
      hsnCode: ensureString(merged.hsnCode ?? merged.hsn_code),
      sellingPrice: ensureNumber(merged.sellingPrice ?? merged.rate ?? merged.mrp),
      gstRate: ensureNumber(merged.gstRate ?? merged.gst_rate),
      currentStock: ensureNumber(merged.currentStock ?? merged.stock),
      isNetProduct: Boolean(merged.isNetProduct ?? merged.is_net_product),
      netRateProduct: Boolean(merged.netRateProduct ?? merged.net_rate_product),
    };
  }

  if (table === 'customers') {
    return {
      id: ensureString(merged.id),
      name: ensureString(merged.name),
      mobile: ensureString(merged.mobile),
      gstin: ensureString(merged.gstin),
      address: ensureString(merged.address),
      city: ensureString(merged.city),
      state: ensureString(merged.state),
      stateCode: ensureString(merged.stateCode ?? merged.state_code),
      routeId: ensureString(merged.routeId ?? merged.route_id),
      aadhar: ensureString(merged.aadhar),
      pan: ensureString(merged.pan),
      root: ensureString(merged.root),
      openingBalanceAmount: ensureNumber(merged.openingBalanceAmount ?? merged.opening_balance),
      openingBalanceType: ensureString(merged.openingBalanceType ?? merged.opening_balance_type),
      balanceType: ensureString(merged.balanceType ?? merged.balance_type),
      openingBalanceDate: ensureString(merged.openingBalanceDate ?? merged.opening_balance_date),
    };
  }

  if (table === 'invoices') {
    return {
      id: ensureString(row.id ?? merged.id),
      invoiceNumber: ensureString(merged.invoiceNumber ?? merged.invoice_no ?? merged.invoiceNo),
      date: ensureString(merged.date),
      customerId: ensureString(merged.customerId ?? merged.customer_id),
      customerName: ensureString(merged.customerName ?? merged.customer?.name),
      customerMobile: ensureString(merged.customerMobile ?? merged.customer?.mobile),
      customerEmail: ensureString(merged.customerEmail ?? merged.customer?.email),
      customerGstin: ensureString(merged.customerGstin ?? merged.customer?.gstin),
      customerAddress: ensureString(merged.customerAddress ?? merged.customer?.address),
      customerState: ensureString(merged.customerState ?? merged.customer?.state),
      items: Array.isArray(merged.items) ? merged.items : [],
      discountPercent: ensureNumber(merged.discountPercent),
      subtotal: ensureNumber(merged.subtotal),
      discountAmount: ensureNumber(merged.discountAmount ?? merged.discount),
      taxAmount: ensureNumber(merged.taxAmount ?? merged.tax),
      cgstAmount: ensureNumber(merged.cgstAmount),
      sgstAmount: ensureNumber(merged.sgstAmount),
      igstAmount: ensureNumber(merged.igstAmount),
      totalAmount: ensureNumber(merged.totalAmount ?? merged.total),
      isSameState: Boolean(merged.isSameState),
      status: ensureString(merged.status) || 'Paid',
      vehicleNo: ensureString(merged.vehicleNo ?? merged.vehicle_no),
      customerPan: ensureString(merged.customerPan ?? merged.customer_pan),
      customerAadhar: ensureString(merged.customerAadhar ?? merged.customer_aadhar),
      deliveryAddress: ensureString(merged.deliveryAddress ?? merged.delivery_address),
    };
  }

  return merged;
}

async function ensureClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY in .env.');
  }
  return client;
}

async function getActiveUser() {
  const supabase = await ensureClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('getActiveUser auth error', error);
    throw error;
  }
  return data.session?.user ?? null;
}

export async function getSession(): Promise<Session | null> {
  const supabase = await ensureClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('getSession error', error);
    throw error;
  }
  return data.session;
}

export async function signUpWithEmail(email: string, password: string, role = 'operator') {
  const supabase = await ensureClient();
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role },
    },
  });
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = await ensureClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOutSupabase() {
  const supabase = await ensureClient();
  return supabase.auth.signOut();
}

export async function createOrUpdateProfile(profile: { id: string; email: string; role: string; created_at?: string }) {
  const supabase = await ensureClient();
  const payload = {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    created_at: profile.created_at ?? new Date().toISOString(),
  };
  const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('createOrUpdateProfile error', error);
    throw error;
  }
  return payload;
}

export async function getProfile(userId: string) {
  const supabase = await ensureClient();
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (error) {
    console.error('getProfile error', error);
    throw error;
  }
  return data;
}

export async function isEmailVerified(user: User | null) {
  return Boolean(user?.confirmed_at || (user as any)?.email_confirmed_at);
}

async function getUserScopedRows(table: string) {
  const supabase = await ensureClient();
  const user = await getActiveUser();
  if (!user) return [];

  const { data, error } = await supabase.from(table).select('*').eq('user_id', user.id);
  if (error) {
    console.error(`getUserScopedRows error for ${table}`, error);
    throw error;
  }

  return (data || []).map((row: any) => normalizeSupabaseRow(table, row));
}

async function upsertUserScopedRows(table: string, rows: any[]) {
  if (!rows || rows.length === 0) return;
  const supabase = await ensureClient();
  const user = await getActiveUser();
  if (!user) return;

  const payload = rows.map((row) => {
    const base = {
      id: row.id,
      user_id: user.id,
      created_at: row.created_at ?? new Date().toISOString(),
      data: row,
    };

    if (table === 'invoices') {
      return {
        ...base,
        invoice_no: row.invoiceNumber ?? row.invoice_no ?? row.invoiceNo ?? '',
        customer_id: row.customerId,
        date: row.date,
        items: row.items ?? [],
        subtotal: row.subtotal ?? 0,
        discount: row.discountAmount ?? row.discount ?? 0,
        tax: row.taxAmount ?? 0,
        total: row.totalAmount ?? row.total ?? 0,
        status: row.status ?? 'Paid',
      };
    }

    if (table === 'products') {
      return {
        ...base,
        name: row.name,
        part_no: row.partNumber,
        hsn_code: row.hsnCode,
        rate: row.sellingPrice,
        gst_rate: row.gstRate,
        stock: row.currentStock,
        brand_id: row.brandId,
        category_id: row.categoryId,
        net_rate_product: row.netRateProduct,
      };
    }

    return base;
  });

  const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error(`upsertUserScopedRows error for ${table}`, error);
    throw error;
  }
}

export async function saveInvoice(invoice: any) {
  if (!invoice || !invoice.id) {
    throw new Error('Invoice payload must include an id');
  }

  const supabase = await ensureClient();
  const user = await getActiveUser();
  if (!user) {
    throw new Error('No authenticated Supabase user');
  }

  const payload = {
    id: invoice.id,
    user_id: user.id,
    created_at: invoice.created_at ?? new Date().toISOString(),
    invoice_no: invoice.invoiceNumber ?? invoice.invoice_no ?? invoice.invoiceNo ?? '',
    customer_id: invoice.customerId,
    date: invoice.date,
    items: invoice.items ?? [],
    subtotal: invoice.subtotal ?? 0,
    discount: invoice.discountAmount ?? invoice.discount ?? 0,
    tax: invoice.taxAmount ?? 0,
    total: invoice.totalAmount ?? invoice.total ?? 0,
    status: invoice.status ?? 'Paid',
    data: invoice,
  };

  const { error } = await supabase.from('invoices').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('saveInvoice error', error);
    throw error;
  }
}

async function getKeyValue(key: string) {
  const supabase = await ensureClient();
  const user = await getActiveUser();
  if (!user) return null;

  const normalizedKey = userScopedKey(key, user.id);
  const { data, error } = await supabase.from('invoice_kv').select('value').eq('key', normalizedKey).maybeSingle();
  if (error) {
    console.error(`getKeyValue error for ${normalizedKey}`, error);
    throw error;
  }
  return data?.value ?? null;
}

async function setKeyValue(key: string, value: string) {
  const supabase = await ensureClient();
  const user = await getActiveUser();
  if (!user) return;

  const normalizedKey = userScopedKey(key, user.id);
  const { error } = await supabase.from('invoice_kv').upsert({ key: normalizedKey, value }, { onConflict: 'key' });
  if (error) {
    console.error(`setKeyValue error for ${normalizedKey}`, error);
    throw error;
  }
}

async function deleteKeyValue(key: string) {
  const supabase = await ensureClient();
  const user = await getActiveUser();
  if (!user) return;

  const normalizedKey = userScopedKey(key, user.id);
  const { error } = await supabase.from('invoice_kv').delete().eq('key', normalizedKey);
  if (error) {
    console.error(`deleteKeyValue error for ${normalizedKey}`, error);
    throw error;
  }
}

export async function getItem(key: string): Promise<string | null> {
  return localStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  localStorage.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  localStorage.removeItem(key);
}

const exported = {
  getSession,
  signUpWithEmail,
  signInWithEmail,
  signOutSupabase,
  createOrUpdateProfile,
  getProfile,
  isEmailVerified,
  getItem,
  setItem,
  removeItem,
};

export default exported;
