import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, getItem, setItem } from '../lib/supabase';
import { SearchableDropdown } from '../components/SearchableDropdown';
import type { Customer, PricingRule, Product } from '../types';
import toast from 'react-hot-toast';

export default function NetRates() {
  const queryClient = useQueryClient();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

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

  const { data: netRates = [], refetch: refetchRules } = useQuery({
    queryKey: ['customer_net_rates', selectedCustomerId],
    enabled: !!selectedCustomerId,
    queryFn: async () => {
      const { data } = await supabase
        .from('customer_net_rates')
        .select('*')
        .eq('customer_id', selectedCustomerId);
      return data ?? [];
    },
  });

  const addRule = async (target: string, value: number) => {
    if (!selectedCustomerId) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');

      const { error } = await supabase.from('customer_net_rates').insert([{
        user_id: session.user.id,
        customer_id: selectedCustomerId,
        product_id: target,
        net_rate: value
      }]);

      if (error) throw error;
      
      refetchRules();
      toast.success('Net Rate rule added');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to add rule');
    }
  };

  const removeRule = async (id: string) => {
    try {
      const { error } = await supabase.from('customer_net_rates').delete().eq('id', id);
      if (error) throw error;
      
      refetchRules();
      toast.success('Rule removed');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to remove rule');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Net Rate Setup</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage fixed prices per product for specific customers.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Customer</label>
            <SearchableDropdown
              table="customers"
              searchFields={['name', 'gstin', 'mobile']}
              displayField="name"
              helperFields={['gstin', 'mobile']}
              onSelect={(c) => setSelectedCustomerId(c.id)}
              placeholder="Search Customer..."
              className="max-w-md"
              value={customers.find(c => c.id === selectedCustomerId)?.name}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-3">Product Name</th>
                  <th className="px-3 py-3">Fixed Net Rate</th>
                  <th className="px-3 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {!selectedCustomerId ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-slate-500">Select a customer to view net rate rules.</td>
                  </tr>
                ) : netRates.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-slate-500">No net rate rules found for this customer.</td>
                  </tr>
                ) : (
                  netRates.map((rule: any) => (
                    <tr key={rule.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {products.find(p => p.id === rule.product_id)?.name || rule.product_id}
                      </td>
                      <td className="px-3 py-3 font-bold text-emerald-600">₹{rule.net_rate.toFixed(2)}</td>
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => removeRule(rule.id)} className="text-rose-600 hover:text-rose-900">Remove</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside>
          <div className="glass-card sticky top-6 rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Add Net Rate Rule</h3>
            <p className="text-xs text-slate-500 mt-1 mb-6">Net rates override all discounts and apply a fixed selling price.</p>
            
            <NetRateRuleForm products={products} onAdd={addRule} disabled={!selectedCustomerId} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function NetRateRuleForm({ products, onAdd, disabled }: { products: Product[], onAdd: any, disabled: boolean }) {
  const [target, setTarget] = useState('');
  const [value, setValue] = useState(0);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Product</label>
        <SearchableDropdown
          table="products"
          searchFields={['name', 'sku']}
          displayField="name"
          helperFields={['sku']}
          onSelect={(p) => {
            setTarget(p.id);
            setValue(p.mrp || 0);
          }}
          placeholder="Search Product..."
          value={products.find(p => p.id === target)?.name}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Fixed Rate (₹)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
          <input 
            disabled={disabled}
            type="number" 
            step="0.01" 
            value={value} 
            onChange={(e) => setValue(Number(e.target.value))} 
            className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2 pl-8 text-sm outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
      </div>

      <button 
        disabled={disabled || !target}
        onClick={() => { onAdd(target, value); setTarget(''); setValue(0); }}
        className="w-full rounded-3xl bg-slate-900 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        Add Net Rate Rule
      </button>
    </div>
  );
}
