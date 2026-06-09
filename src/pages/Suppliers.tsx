import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '../lib/supabase';
import type { Supplier } from '../types';
import { downloadCsv, parseCsv } from '../lib/csv';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  contactPerson: z.string().min(1, 'Contact person is required'),
  mobile: z.string().min(1, 'Mobile is required'),
  email: z.string().email('Enter a valid email'),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  paymentTerms: z.string().optional(),
  openingBalance: z.number().default(0),
});

type FormValues = z.infer<typeof schema>;

const EXCEL_HEADERS = [
  'name', 'contactPerson', 'mobile', 'email', 'gstin', 'pan', 'address', 'city', 'state', 'paymentTerms', 'openingBalance'
];

export default function Suppliers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data } = await supabase.from('suppliers').select('*').order('created_at', { ascending: false });
      return (data ?? []).map(s => ({
        ...s,
        contactPerson: s.contact_person,
        paymentTerms: s.payment_terms,
        openingBalance: s.opening_balance
      }));
    },
  });

  const filteredSuppliers = useMemo(
    () => suppliers.filter((s: Supplier) => 
      s.name.toLowerCase().includes(search.toLowerCase()) || 
      (s.gstin && s.gstin.toLowerCase().includes(search.toLowerCase()))
    ),
    [suppliers, search],
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
        contact_person: values.contactPerson,
        mobile: values.mobile,
        email: values.email,
        gstin: values.gstin,
        pan: values.pan,
        address: values.address,
        city: values.city,
        state: values.state,
        payment_terms: values.paymentTerms,
        opening_balance: values.openingBalance,
        user_id: user.id,
        created_at: new Date().toISOString(),
        data: values,
      };

      if (editingSupplier) {
        const { error } = await supabase.from('suppliers').update(payload).eq('id', editingSupplier.id);
        if (error) throw error;
        setEditingSupplier(null);
        toast.success('Supplier updated');
      } else {
        const { error } = await supabase.from('suppliers').insert([{ id: crypto.randomUUID(), ...payload }]);
        if (error) throw error;
        toast.success('Supplier created');
      }

      reset();
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    } catch (err: any) {
      console.error('Error saving supplier:', err);
      toast.error(err.message || 'Failed to save supplier');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete supplier');
    }
  };

  const handleEdit = (s: Supplier) => {
    setEditingSupplier(s);
    reset({
      name: s.name,
      contactPerson: s.contactPerson,
      mobile: s.mobile,
      email: (s as any).email || '',
      gstin: s.gstin,
      pan: (s as any).pan || '',
      address: s.address,
      city: (s as any).city || '',
      state: s.state,
      paymentTerms: s.paymentTerms,
      openingBalance: s.openingBalance,
    });
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const handleDownloadFormat = () => {
    downloadCsv(EXCEL_HEADERS, [], 'suppliers_template.csv');
  };

  const handleDownloadExcel = () => {
    downloadCsv(EXCEL_HEADERS, suppliers, 'suppliers_list.csv');
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
        contact_person: sanitizeString(row.contactPerson),
        mobile: sanitizeString(row.mobile),
        email: sanitizeString(row.email),
        gstin: sanitizeString(row.gstin),
        pan: sanitizeString(row.pan),
        address: sanitizeString(row.address),
        city: sanitizeString(row.city),
        state: sanitizeString(row.state),
        payment_terms: sanitizeString(row.paymentTerms),
        opening_balance: Number(row.openingBalance || 0),
        user_id: user.id,
        created_at: new Date().toISOString(),
        data: row
      }));

      // Batch processing: 50 rows per batch
      const BATCH_SIZE = 50;
      for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
        const batch = payloads.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('suppliers').insert(batch);
        
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

      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      
      if (errorCount === 0) {
        toast.success(`Successfully imported all ${successCount} suppliers`);
      } else {
        toast.success(`Import complete: ${successCount} success, ${errorCount} failed`);
      }
    } catch (err: any) {
      console.error('Error importing suppliers:', err);
      toast.error(err.message || 'Failed to import suppliers');
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Suppliers</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage supplier master data and sync to Supabase.</p>
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

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search suppliers"
              className="w-full max-w-sm rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Contact</th>
                  <th className="px-3 py-3">Mobile</th>
                  <th className="px-3 py-3">City</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Loading...</td></tr>
                ) : filteredSuppliers.length === 0 ? (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">No suppliers found.</td></tr>
                ) : (
                  filteredSuppliers.map((s: Supplier) => (
                    <tr key={s.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">{s.name}</td>
                      <td className="px-3 py-3">{s.contactPerson}</td>
                      <td className="px-3 py-3">{s.mobile}</td>
                      <td className="px-3 py-3">{s.city}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(s)} className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">Edit</button>
                          <button onClick={() => handleDelete(s.id)} className="text-rose-600 hover:text-rose-900">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</h3>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>Company Name</span>
                <input type="text" {...register('name')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                {errors.name && <p className="text-sm text-rose-600">{errors.name.message}</p>}
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>Contact Person</span>
                <input type="text" {...register('contactPerson')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                {errors.contactPerson && <p className="text-sm text-rose-600">{errors.contactPerson.message}</p>}
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>Mobile</span>
                <input type="text" {...register('mobile')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>Email</span>
                <input type="email" {...register('email')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>GSTIN</span>
                <input type="text" {...register('gstin')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>PAN</span>
                <input type="text" {...register('pan')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-2">
                <span>Address</span>
                <input type="text" {...register('address')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
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
                <span>Payment Terms</span>
                <input type="text" {...register('paymentTerms')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>Opening Balance</span>
                <input type="number" step="0.01" {...register('openingBalance', { valueAsNumber: true })} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
            </div>
            <button type="submit" className="w-full rounded-3xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              {editingSupplier ? 'Update Supplier' : 'Create Supplier'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
