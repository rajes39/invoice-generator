import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Settings } from '../types';

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery<Settings | null>({
    queryKey: ['appSettings'],
    queryFn: async () => {
      const { data } = await supabase.from('settings').select('*').single();
      return data ?? null;
    },
  });

  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [stateCode, setStateCode] = useState('');

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name);
      setAddress(settings.address);
      setGstin(settings.gstin);
      setStateCode(settings.state_code);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async (payload: Settings) => {
      const { data, error } = await supabase.from('settings').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appSettings'] }),
  });

  const handleSave = () => {
    mutation.mutate({
      id: settings?.id ?? 'settings',
      company_name: companyName,
      address,
      gstin,
      state_code: stateCode,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configure company details and taxation defaults.</p>
      </div>

      <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <span>Company Name</span>
            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
          </label>
          <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <span>GSTIN</span>
            <input value={gstin} onChange={(event) => setGstin(event.target.value)} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
          </label>
          <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
            <span>Address</span>
            <textarea value={address} onChange={(event) => setAddress(event.target.value)} className="min-h-[120px] w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
          </label>
          <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <span>State Code</span>
            <input value={stateCode} onChange={(event) => setStateCode(event.target.value)} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
          </label>
        </div>
        <button type="button" onClick={handleSave} className="mt-6 rounded-3xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
          Save Settings
        </button>
      </div>
    </div>
  );
}
