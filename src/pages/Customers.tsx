import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '../lib/supabase';
import type { Customer, PricingRule, Product } from '../types';
import { downloadCsv, parseCsv } from '../lib/csv';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  gstin: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  pincode: z.string().min(6, 'Pincode is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  stateCode: z.string().min(1, 'State code is required'),
  mobile: z.string().min(1, 'Mobile is required'),
  email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  route: z.string().optional(),
  openingBalance: z.number().default(0),
});

type FormValues = z.infer<typeof schema>;

const EXCEL_HEADERS = [
  'name', 'gstin', 'address', 'pincode', 'city', 'state', 'stateCode', 'mobile', 'email', 'route', 'openingBalance'
];

export default function Customers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [pricingCustomer, setPricingCustomer] = useState<Customer | null>(null);
  const [rules, setRules] = useState<PricingRule[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ 
    resolver: zodResolver(schema),
    defaultValues: {
      openingBalance: 0,
      email: ''
    }
  });

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
      if (error) {
        toast.error('Failed to fetch customers: ' + error.message);
        throw error;
      }
      return (data ?? []).map(c => ({
        ...c,
        userId: c.user_id,
        stateCode: c.state_code || c.stateCode,
        openingBalance: c.opening_balance || c.openingBalance,
        mobile: c.mobile || c.phone,
        pincode: c.pincode || '',
        email: c.email || ''
      }));
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*');
      return data ?? [];
    }
  });

  const brands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))), [products]);

  useEffect(() => {
    const loadRules = async () => {
      const saved = await localStorage.getItem('customer_pricing_rules');
      if (saved) setRules(JSON.parse(saved));
    };
    loadRules();
  }, []);

  const saveRules = async (newRules: PricingRule[]) => {
    setRules(newRules);
    await localStorage.setItem('customer_pricing_rules', JSON.stringify(newRules));
  };

  const filteredCustomers = useMemo(
    () => customers.filter((customer: Customer) => 
      customer.name.toLowerCase().includes(search.toLowerCase()) || 
      (customer.gstin && customer.gstin.toLowerCase().includes(search.toLowerCase())) ||
      (customer.pincode && customer.pincode.includes(search))
    ),
    [customers, search],
  );

  const onSubmit = async (values: FormValues) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      if (!user) {
        toast.error('You must be logged in to save data');
        return;
      }

      const payload = {
        name: values.name,
        gstin: values.gstin,
        address: values.address,
        pincode: values.pincode,
        city: values.city,
        state: values.state,
        state_code: values.stateCode,
        mobile: values.mobile,
        email: values.email,
        route: values.route,
        opening_balance: values.openingBalance,
        user_id: user.id,
        created_at: new Date().toISOString(),
        data: values,
      };

      if (editingCustomer) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editingCustomer.id);
        if (error) throw error;
        setEditingCustomer(null);
        toast.success('Customer updated');
      } else {
        const { error } = await supabase.from('customers').insert([{ id: crypto.randomUUID(), ...payload }]);
        if (error) throw error;
        toast.success('Customer created');
      }

      reset();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (err: any) {
      console.error('Error saving customer:', err);
      toast.error(err.message || 'Failed to save customer');
    }
  };

  const handleDelete = async (customerId: string) => {
    try {
      const { error } = await supabase.from('customers').delete().eq('id', customerId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete customer');
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    reset({
      name: customer.name,
      gstin: customer.gstin,
      address: customer.address,
      pincode: customer.pincode,
      city: customer.city,
      state: customer.state,
      stateCode: customer.stateCode,
      mobile: customer.mobile,
      email: (customer as any).email || '',
      route: (customer as any).route || '',
      openingBalance: customer.openingBalance,
    });
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const handleDownloadFormat = () => {
    downloadCsv(EXCEL_HEADERS, [], 'customers_template.csv');
  };

  const handleDownloadExcel = () => {
    downloadCsv(EXCEL_HEADERS, customers, 'customers_list.csv');
  };

  const sanitizeString = (val: any) => {
    if (typeof val !== 'string') return val;
    // Remove null bytes (\u0000) and other non-printable control characters
    return val.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const data = await parseCsv(file);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        toast.error('You must be logged in to upload data');
        return;
      }

      setUploadProgress({ current: 0, total: data.length });
      
      const payloads = data.map(row => ({
        id: crypto.randomUUID(),
        name: sanitizeString(row.name),
        gstin: sanitizeString(row.gstin),
        address: sanitizeString(row.address),
        pincode: sanitizeString(row.pincode),
        city: sanitizeString(row.city),
        state: sanitizeString(row.state),
        state_code: sanitizeString(row.stateCode),
        mobile: sanitizeString(row.mobile || row.phone),
        email: sanitizeString(row.email),
        route: sanitizeString(row.route),
        opening_balance: Number(row.openingBalance || 0),
        user_id: user.id,
        created_at: new Date().toISOString(),
        data: row
      }));

      // Batch processing: 50 rows per batch
      const BATCH_SIZE = 50;
      for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
        const batch = payloads.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('customers').insert(batch);
        
        if (error) {
          console.error(`Error in batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
        }

        setUploadProgress(prev => ({ ...prev, current: Math.min(i + BATCH_SIZE, payloads.length) }));
        
        if (i + BATCH_SIZE < payloads.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      queryClient.invalidateQueries({ queryKey: ['customers'] });
      
      if (errorCount === 0) {
        toast.success(`Successfully imported all ${successCount} customers`);
      } else {
        toast.success(`Import complete: ${successCount} success, ${errorCount} failed`);
      }
    } catch (err: any) {
      console.error('Error importing customers:', err);
      toast.error(err.message || 'Failed to import customers');
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });
      if (e.target) e.target.value = '';
    }
  };

  const addPricingRule = (type: PricingRule['type'], target: string, value: number) => {
    if (!pricingCustomer) return;
    const newRule: PricingRule = {
      id: crypto.randomUUID(),
      customerId: pricingCustomer.id,
      type,
      target,
      value
    };
    saveRules([...rules, newRule]);
    toast.success('Pricing rule added');
  };

  const removePricingRule = (id: string) => {
    saveRules(rules.filter(r => r.id !== id));
    toast.success('Pricing rule removed');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Customers</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage customers and sync data to Supabase.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isUploading && (
            <div className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-indigo-600 bg-indigo-50 rounded-3xl animate-pulse">
              <span className="w-2 h-2 bg-indigo-600 rounded-full animate-ping"></span>
              Uploading: {uploadProgress.current} / {uploadProgress.total}
            </div>
          )}
          <button disabled={isUploading} onClick={handleDownloadFormat} className="rounded-3xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 disabled:opacity-50">
            Download Format
          </button>
          <button disabled={isUploading} onClick={handleDownloadExcel} className="rounded-3xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 disabled:opacity-50">
            Download Excel
          </button>
          <label className={`cursor-pointer rounded-3xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {isUploading ? 'Uploading...' : 'Upload Excel'}
            <input type="file" accept=".csv" className="hidden" onChange={handleUploadExcel} disabled={isUploading} />
          </label>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customers"
              className="w-full max-w-sm rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">GSTIN</th>
                  <th className="px-3 py-3">Route</th>
                  <th className="px-3 py-3">Mobile</th>
                  <th className="px-3 py-3">Pincode</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                      Loading customers...
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer: Customer) => (
                    <tr key={customer.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">{customer.name}</td>
                      <td className="px-3 py-3">{customer.gstin || 'Unregistered'}</td>
                      <td className="px-3 py-3">{(customer as any).route || 'N/A'}</td>
                      <td className="px-3 py-3">{customer.mobile}</td>
                      <td className="px-3 py-3">{customer.pincode}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => setPricingCustomer(customer)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400">Pricing</button>
                          <button onClick={() => handleEdit(customer)} className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">Edit</button>
                          <button onClick={() => handleDelete(customer.id)} className="text-rose-600 hover:text-rose-900">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
                  <span>Name</span>
                  <input type="text" {...register('name')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                  {errors.name && <p className="text-sm text-rose-600">{errors.name.message}</p>}
                </label>
                <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <span>GSTIN (Optional)</span>
                  <input type="text" {...register('gstin')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
                <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <span>Mobile</span>
                  <input type="text" {...register('mobile')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                  {errors.mobile && <p className="text-sm text-rose-600">{errors.mobile.message}</p>}
                </label>
                <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <span>Email</span>
                  <input type="email" {...register('email')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                  {errors.email && <p className="text-sm text-rose-600">{errors.email.message}</p>}
                </label>
                <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
                  <span>Address</span>
                  <input type="text" {...register('address')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
                <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <span>Pincode</span>
                  <input type="text" {...register('pincode')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
                <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <span>City</span>
                  <input type="text" {...register('city')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
                <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <span>State</span>
                  <input type="text" {...register('state')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
                <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  <span>State Code</span>
                  <input type="text" {...register('stateCode')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
                <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
                  <span>Route <span className="text-slate-400 font-normal">(e.g. MALDA, KRISHNAGAR)</span></span>
                  <input type="text" {...register('route')} placeholder="Enter route name..." className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                </label>
              </div>

              <button type="submit" className="w-full rounded-3xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                {editingCustomer ? 'Update Customer' : 'Create Customer'}
              </button>
            </form>
          </div>

          {pricingCustomer && (
            <div className="glass-card rounded-3xl border border-indigo-200 bg-indigo-50/30 p-6 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/20">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">Pricing Rules: {pricingCustomer.name}</h3>
                <button onClick={() => setPricingCustomer(null)} className="text-slate-500 hover:text-slate-900">Close</button>
              </div>
              
              <div className="mt-6 space-y-4">
                <PricingRuleForm brands={brands} products={products} onAdd={addPricingRule} />
                
                <div className="mt-6 space-y-2">
                  {rules.filter(r => r.customerId === pricingCustomer.id).map(rule => (
                    <div key={rule.id} className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{rule.type.replace('_', ' ')}</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {rule.type === 'BRAND_DISCOUNT' ? rule.target : (products.find(p => p.id === rule.target)?.name || rule.target)}
                        </p>
                        <p className="text-sm text-indigo-600 font-bold">
                          {rule.type === 'PRODUCT_NET_RATE' ? `₹${rule.value.toFixed(2)}` : `${rule.value}% Discount`}
                        </p>
                      </div>
                      <button onClick={() => removePricingRule(rule.id)} className="text-rose-600 hover:text-rose-900">Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PricingRuleForm({ brands, products, onAdd }: { brands: string[], products: Product[], onAdd: any }) {
  const [type, setType] = useState<PricingRule['type']>('BRAND_DISCOUNT');
  const [target, setTarget] = useState('');
  const [value, setValue] = useState(0);

  return (
    <div className="grid gap-3 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800">
      <select value={type} onChange={(e) => { setType(e.target.value as any); setTarget(''); }} className="rounded-xl border border-slate-300 p-2 text-sm">
        <option value="BRAND_DISCOUNT">Brand Discount %</option>
        <option value="PRODUCT_DISCOUNT">Product Discount %</option>
        <option value="PRODUCT_NET_RATE">Fixed Net Rate ₹</option>
      </select>

      {type === 'BRAND_DISCOUNT' ? (
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-xl border border-slate-300 p-2 text-sm">
          <option value="">Select Brand</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      ) : (
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-xl border border-slate-300 p-2 text-sm">
          <option value="">Select Product</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
        </select>
      )}

      <input 
        type="number" 
        step="0.01" 
        placeholder={type === 'PRODUCT_NET_RATE' ? "Amount ₹" : "Discount %"} 
        value={value} 
        onChange={(e) => setValue(Number(e.target.value))} 
        className="rounded-xl border border-slate-300 p-2 text-sm"
      />

      <button 
        onClick={() => { if (target) { onAdd(type, target, value); setTarget(''); setValue(0); } }}
        className="rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white hover:bg-indigo-700"
      >
        Add Rule
      </button>
    </div>
  );
}
