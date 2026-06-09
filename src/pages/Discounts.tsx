import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { SearchableDropdown } from '../components/SearchableDropdown';
import type { Customer, Product } from '../types';
import toast from 'react-hot-toast';
import { Users, Tag, Gift, ChevronDown } from 'lucide-react';

type Tab = 'brand_product' | 'category' | 'scheme';

export default function Discounts() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('brand_product');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomerName, setSelectedCustomerName] = useState('');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*').order('name');
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*');
      return data ?? [];
    }
  });

  const brands = useMemo(() => Array.from(new Set(products.map((p: any) => p.brand).filter(Boolean))), [products]);
  const categories = useMemo(() => Array.from(new Set(products.map((p: any) => p.category).filter(Boolean))), [products]);

  const { data: discountRules = [], refetch: refetchRules } = useQuery({
    queryKey: ['customer_discounts', selectedCustomerId],
    enabled: !!selectedCustomerId,
    queryFn: async () => {
      const { data } = await supabase.from('customer_discounts').select('*').eq('customer_id', selectedCustomerId);
      return data ?? [];
    },
  });

  const { data: categoryRules = [], refetch: refetchCategoryRules } = useQuery({
    queryKey: ['customer_category_discounts', selectedCustomerId],
    enabled: !!selectedCustomerId,
    queryFn: async () => {
      const { data } = await supabase.from('customer_category_discounts').select('*').eq('customer_id', selectedCustomerId);
      return data ?? [];
    },
  });

  const { data: schemes = [], refetch: refetchSchemes } = useQuery({
    queryKey: ['product_schemes'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];
      const { data } = await supabase.from('product_schemes').select('*').eq('user_id', session.user.id).eq('is_active', true);
      return data ?? [];
    },
  });

  // --- Brand/Product Discount ---
  const addRule = async (type: 'BRAND' | 'PRODUCT', target: string, value: number) => {
    if (!selectedCustomerId) return;
    const cleanTarget = (target || '').replace(/\u0000/g, '').trim();
    if (!cleanTarget) { toast.error('Please select a target brand or product'); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');
      const { error } = await supabase.from('customer_discounts').insert([{
        user_id: session.user.id,
        customer_id: selectedCustomerId,
        type, target: cleanTarget,
        discount_percent: value
      }]);
      if (error) throw error;
      refetchRules();
      toast.success('Discount rule added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add rule');
    }
  };

  const removeRule = async (id: string) => {
    try {
      const { error } = await supabase.from('customer_discounts').delete().eq('id', id);
      if (error) throw error;
      refetchRules();
      toast.success('Rule removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove rule');
    }
  };

  // --- Apply to All Customers ---
  const applyToAll = async (type: 'BRAND' | 'PRODUCT', target: string, value: number) => {
    const cleanTarget = (target || '').replace(/\u0000/g, '').trim();
    if (!cleanTarget || customers.length === 0) return;
    const confirmed = window.confirm(`Apply this ${type} discount (${value}%) to ALL ${customers.length} customers?`);
    if (!confirmed) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');

      let successCount = 0;
      for (const customer of customers as any[]) {
        const { error } = await supabase.from('customer_discounts').insert([{
          user_id: session.user.id,
          customer_id: customer.id,
          type, target: cleanTarget,
          discount_percent: value
        }]);
        if (!error) successCount++;
      }
      queryClient.invalidateQueries({ queryKey: ['customer_discounts'] });
      toast.success(`Applied to ${successCount} customers!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    }
  };

  // --- Category Discount ---
  const addCategoryRule = async (category: string, value: number) => {
    if (!selectedCustomerId) return;
    const cleanCategory = (category || '').replace(/\u0000/g, '').trim();
    if (!cleanCategory) { toast.error('Please select a category'); return; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');
      const { error } = await supabase.from('customer_category_discounts').insert([{
        user_id: session.user.id,
        customer_id: selectedCustomerId,
        category: cleanCategory,
        discount_percent: value
      }]);
      if (error) throw error;
      refetchCategoryRules();
      toast.success('Category discount added');
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    }
  };

  const removeCategoryRule = async (id: string) => {
    try {
      const { error } = await supabase.from('customer_category_discounts').delete().eq('id', id);
      if (error) throw error;
      refetchCategoryRules();
      toast.success('Rule removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    }
  };

  const applyCategoryToAll = async (category: string, value: number) => {
    const cleanCategory = (category || '').replace(/\u0000/g, '').trim();
    if (!cleanCategory || customers.length === 0) return;
    const confirmed = window.confirm(`Apply ${category} category discount (${value}%) to ALL ${customers.length} customers?`);
    if (!confirmed) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');
      let successCount = 0;
      for (const customer of customers as any[]) {
        const { error } = await supabase.from('customer_category_discounts').insert([{
          user_id: session.user.id,
          customer_id: customer.id,
          category: cleanCategory,
          discount_percent: value
        }]);
        if (!error) successCount++;
      }
      queryClient.invalidateQueries({ queryKey: ['customer_category_discounts'] });
      toast.success(`Applied to ${successCount} customers!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    }
  };

  // --- Scheme ---
  const addScheme = async (productId: string, minQty: number, schemePrice: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');
      const { error } = await supabase.from('product_schemes').insert([{
        user_id: session.user.id,
        product_id: productId,
        min_qty: minQty,
        scheme_price: schemePrice,
        is_active: true
      }]);
      if (error) throw error;
      refetchSchemes();
      toast.success('Scheme added successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add scheme');
    }
  };

  const removeScheme = async (id: string) => {
    try {
      const { error } = await supabase.from('product_schemes').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      refetchSchemes();
      toast.success('Scheme removed');
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    }
  };

  const tabs = [
    { id: 'brand_product' as Tab, label: 'Brand / Product', icon: Tag },
    { id: 'category' as Tab, label: 'Category Wise', icon: ChevronDown },
    { id: 'scheme' as Tab, label: 'Scheme Setup', icon: Gift },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Discount Setup</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage customer-wise brand, product, category discounts and schemes.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-amber-500 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Brand/Product Discount */}
      {activeTab === 'brand_product' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Customer</label>
              <SearchableDropdown
                table="customers"
                searchFields={['name', 'gstin', 'mobile']}
                displayField="name"
                helperFields={['gstin', 'mobile']}
                onSelect={(c) => { setSelectedCustomerId(c.id); setSelectedCustomerName(c.name); }}
                placeholder="Search Customer..."
                className="max-w-md"
                value={selectedCustomerName}
              />
            </div>
            <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-slate-500">
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Target</th>
                  <th className="px-3 py-3">Discount %</th>
                  <th className="px-3 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {!selectedCustomerId ? (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">Select a customer to view discount rules.</td></tr>
                ) : discountRules.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">No discount rules found.</td></tr>
                ) : (
                  discountRules.map((rule: any) => (
                    <tr key={rule.id} className="border-t border-slate-200">
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase">{rule.type}</span>
                      </td>
                      <td className="px-3 py-3 font-medium">
                        {rule.type === 'BRAND' ? rule.target : (products.find((p: any) => p.id === rule.target) as any)?.name || rule.target}
                      </td>
                      <td className="px-3 py-3 font-bold text-indigo-600">{rule.discount_percent}%</td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => removeRule(rule.id)} className="text-rose-600 hover:text-rose-900 text-xs font-bold">Remove</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <aside>
            <div className="glass-card sticky top-6 rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Add Discount Rule</h3>
              <p className="text-xs text-slate-500 mb-6">Discounts are automatically applied during invoice creation.</p>
              <DiscountRuleForm
                brands={brands as string[]}
                products={products as any[]}
                onAdd={addRule}
                onApplyAll={applyToAll}
                disabled={!selectedCustomerId}
              />
            </div>
          </aside>
        </div>
      )}

      {/* TAB 2: Category Wise Discount */}
      {activeTab === 'category' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Customer</label>
              <SearchableDropdown
                table="customers"
                searchFields={['name', 'gstin', 'mobile']}
                displayField="name"
                helperFields={['gstin', 'mobile']}
                onSelect={(c) => { setSelectedCustomerId(c.id); setSelectedCustomerName(c.name); }}
                placeholder="Search Customer..."
                className="max-w-md"
                value={selectedCustomerName}
              />
            </div>
            <table className="min-w-full text-left text-sm text-slate-700">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-slate-500">
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Discount %</th>
                  <th className="px-3 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {!selectedCustomerId ? (
                  <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-500">Select a customer to view category discounts.</td></tr>
                ) : categoryRules.length === 0 ? (
                  <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-500">No category discount rules found.</td></tr>
                ) : (
                  categoryRules.map((rule: any) => (
                    <tr key={rule.id} className="border-t border-slate-200">
                      <td className="px-3 py-3 font-medium">
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 uppercase">{rule.category}</span>
                      </td>
                      <td className="px-3 py-3 font-bold text-green-600">{rule.discount_percent}%</td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => removeCategoryRule(rule.id)} className="text-rose-600 hover:text-rose-900 text-xs font-bold">Remove</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <aside>
            <div className="glass-card sticky top-6 rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Add Category Discount</h3>
              <p className="text-xs text-slate-500 mb-6">Apply discount based on product category.</p>
              <CategoryDiscountForm
                categories={categories as string[]}
                onAdd={addCategoryRule}
                onApplyAll={applyCategoryToAll}
                disabled={!selectedCustomerId}
              />
            </div>
          </aside>
        </div>
      )}

      {/* TAB 3: Scheme Setup */}
      {activeTab === 'scheme' && (
        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Active Schemes</h3>
            <table className="min-w-full text-left text-sm text-slate-700">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-slate-500 border-b border-slate-200">
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3">Part No</th>
                  <th className="px-3 py-3 text-center">Min Qty</th>
                  <th className="px-3 py-3 text-right">Scheme Price</th>
                  <th className="px-3 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {schemes.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No active schemes. Add one from the right panel.</td></tr>
                ) : (
                  schemes.map((scheme: any) => {
                    const product = (products as any[]).find(p => p.id === scheme.product_id);
                    return (
                      <tr key={scheme.id} className="border-t border-slate-200">
                        <td className="px-3 py-3 font-medium">{product?.name || 'Unknown'}</td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-500">{product?.sku || product?.part_no || '-'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">Min {scheme.min_qty} pc</span>
                        </td>
                        <td className="px-3 py-3 text-right font-black text-green-700">₹{Number(scheme.scheme_price).toFixed(2)}</td>
                        <td className="px-3 py-3 text-center">
                          <button onClick={() => removeScheme(scheme.id)} className="text-rose-600 hover:text-rose-900 text-xs font-bold">Remove</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <aside>
            <div className="glass-card sticky top-6 rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Add Scheme</h3>
              <p className="text-xs text-slate-500 mb-2">If customer buys minimum qty, scheme price applies automatically. No extra discount.</p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-700 font-medium">
                📦 Example: 20k170ls Hero Chain Kit — Buy 5 pcs → ₹700 (instead of ₹740). No discount on top.
              </div>
              <SchemeForm products={products as any[]} onAdd={addScheme} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

// --- Brand/Product Discount Form ---
function DiscountRuleForm({ brands, products, onAdd, onApplyAll, disabled }: {
  brands: string[], products: any[], onAdd: any, onApplyAll: any, disabled: boolean
}) {
  const [type, setType] = useState<'BRAND' | 'PRODUCT'>('BRAND');
  const [target, setTarget] = useState('');
  const [value, setValue] = useState(0);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Rule Type</label>
        <select value={type} onChange={(e) => { setType(e.target.value as any); setTarget(''); }}
          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none">
          <option value="BRAND">Brand Wise Discount</option>
          <option value="PRODUCT">Product Wise Discount</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Target</label>
        {type === 'BRAND' ? (
          <select value={target} onChange={(e) => setTarget(e.target.value)}
            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none">
            <option value="">Select Brand</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        ) : (
          <SearchableDropdown table="products" searchFields={['name', 'sku']} displayField="name"
            helperFields={['sku']} onSelect={(p) => setTarget(p.id)} placeholder="Search Product..."
            value={products.find(p => p.id === target)?.name} />
        )}
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Discount Percentage</label>
        <div className="relative">
          <input type="number" step="0.01" value={value} onChange={(e) => setValue(Number(e.target.value))}
            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none pr-8" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
        </div>
      </div>
      <button disabled={disabled || !target} onClick={() => { onAdd(type, target, value); setTarget(''); setValue(0); }}
        className="w-full rounded-3xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">
        Add Discount Rule
      </button>
      <button disabled={!target || value <= 0} onClick={() => onApplyAll(type, target, value)}
        className="w-full rounded-3xl bg-amber-600 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2">
        <Users className="w-4 h-4" /> Apply to ALL Customers
      </button>
      <p className="text-[10px] text-slate-400 text-center italic">↑ Customer select না করেও সব customer এ apply হবে</p>
    </div>
  );
}

// --- Category Discount Form ---
function CategoryDiscountForm({ categories, onAdd, onApplyAll, disabled }: {
  categories: string[], onAdd: any, onApplyAll: any, disabled: boolean
}) {
  const [category, setCategory] = useState('');
  const [value, setValue] = useState(0);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Product Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none">
          <option value="">Select Category</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Discount Percentage</label>
        <div className="relative">
          <input type="number" step="0.01" value={value} onChange={(e) => setValue(Number(e.target.value))}
            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none pr-8" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
        </div>
      </div>
      <button disabled={disabled || !category} onClick={() => { onAdd(category, value); setCategory(''); setValue(0); }}
        className="w-full rounded-3xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">
        Add Category Discount
      </button>
      <button disabled={!category || value <= 0} onClick={() => onApplyAll(category, value)}
        className="w-full rounded-3xl bg-amber-600 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2">
        <Users className="w-4 h-4" /> Apply to ALL Customers
      </button>
      <p className="text-[10px] text-slate-400 text-center italic">↑ Customer select না করেও সব customer এ apply হবে</p>
    </div>
  );
}

// --- Scheme Form ---
function SchemeForm({ products, onAdd }: { products: any[], onAdd: any }) {
  const [productId, setProductId] = useState('');
  const [minQty, setMinQty] = useState(1);
  const [schemePrice, setSchemePrice] = useState(0);
  const selectedProduct = products.find(p => p.id === productId);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Select Product</label>
        <SearchableDropdown table="products" searchFields={['name', 'sku', 'part_no']} displayField="name"
          helperFields={['sku', 'mrp']} onSelect={(p) => { setProductId(p.id); setSchemePrice(Number(p.mrp || 0)); }}
          placeholder="Search by Name or Part No..." value={selectedProduct?.name} />
        {selectedProduct && (
          <div className="text-xs text-slate-500 px-1">
            MRP: <span className="font-black text-slate-800">₹{Number(selectedProduct.mrp).toFixed(2)}</span>
            {selectedProduct.sku && <span className="ml-2">SKU: {selectedProduct.sku}</span>}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Minimum Quantity (pcs)</label>
        <input type="number" min="1" value={minQty} onChange={(e) => setMinQty(Number(e.target.value))}
          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 text-sm outline-none" />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Scheme Price (₹) — No Discount on Top</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
          <input type="number" step="0.01" value={schemePrice} onChange={(e) => setSchemePrice(Number(e.target.value))}
            className="w-full rounded-2xl border border-slate-300 bg-slate-50 pl-8 pr-4 py-2 text-sm outline-none" />
        </div>
        {selectedProduct && schemePrice < Number(selectedProduct.mrp) && (
          <p className="text-xs text-green-600 font-bold">
            Saving: ₹{(Number(selectedProduct.mrp) - schemePrice).toFixed(2)} per unit
          </p>
        )}
      </div>
      <button disabled={!productId || minQty <= 0 || schemePrice <= 0}
        onClick={() => { onAdd(productId, minQty, schemePrice); setProductId(''); setMinQty(1); setSchemePrice(0); }}
        className="w-full rounded-3xl bg-green-700 py-3 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-50 flex items-center justify-center gap-2">
        <Gift className="w-4 h-4" /> Add Scheme
      </button>
    </div>
  );
}
