import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '../lib/supabase';
import type { Warehouse } from '../types';
import { downloadCsv, parseCsv } from '../lib/csv';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: z.string().min(1, 'Location is required'),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

const EXCEL_HEADERS = ['name', 'location', 'isActive'];

export default function Warehouses() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data } = await supabase.from('warehouses').select('*').order('created_at', { ascending: false });
      return (data ?? []).map(w => ({
        ...w,
        isActive: w.is_active ?? w.isActive
      }));
    },
  });

  const filteredWarehouses = useMemo(
    () => warehouses.filter((w: Warehouse) => 
      w.name.toLowerCase().includes(search.toLowerCase()) || 
      w.location.toLowerCase().includes(search.toLowerCase())
    ),
    [warehouses, search],
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
        location: values.location,
        is_active: values.isActive,
        user_id: user.id,
        created_at: new Date().toISOString(),
        data: values,
      };

      if (editingWarehouse) {
        const { error } = await supabase.from('warehouses').update(payload).eq('id', editingWarehouse.id);
        if (error) throw error;
        setEditingWarehouse(null);
        toast.success('Warehouse updated');
      } else {
        const { error } = await supabase.from('warehouses').insert([{ id: crypto.randomUUID(), ...payload }]);
        if (error) throw error;
        toast.success('Warehouse created');
      }

      reset({ name: '', location: '', isActive: true });
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    } catch (err: any) {
      console.error('Error saving warehouse:', err);
      toast.error(err.message || 'Failed to save warehouse');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('warehouses').delete().eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Warehouse deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete warehouse');
    }
  };

  const handleEdit = (w: Warehouse) => {
    setEditingWarehouse(w);
    reset({
      name: w.name,
      location: w.location,
      isActive: w.isActive,
    });
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const handleDownloadFormat = () => {
    downloadCsv(EXCEL_HEADERS, [], 'warehouses_template.csv');
  };

  const handleDownloadExcel = () => {
    downloadCsv(EXCEL_HEADERS, warehouses, 'warehouses_list.csv');
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
        location: sanitizeString(row.location),
        is_active: String(row.isActive).toLowerCase() === 'true',
        user_id: user.id,
        created_at: new Date().toISOString(),
        data: row
      }));

      // Batch processing: 50 rows per batch
      const BATCH_SIZE = 50;
      for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
        const batch = payloads.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('warehouses').insert(batch);
        
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

      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      
      if (errorCount === 0) {
        toast.success(`Successfully imported all ${successCount} warehouses`);
      } else {
        toast.success(`Import complete: ${successCount} success, ${errorCount} failed`);
      }
    } catch (err: any) {
      console.error('Error importing warehouses:', err);
      toast.error(err.message || 'Failed to import warehouses');
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
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Warehouses</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage warehouse locations and inventory points.</p>
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
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search warehouses"
            className="w-full max-w-sm rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">Loading...</td></tr>
                ) : filteredWarehouses.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No warehouses found.</td></tr>
                ) : (
                  filteredWarehouses.map((w: Warehouse) => (
                    <tr key={w.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">{w.name}</td>
                      <td className="px-3 py-3">{w.location}</td>
                      <td className="px-3 py-3">
                        <span className={w.isActive ? 'text-emerald-600' : 'text-rose-600'}>
                          {w.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(w)} className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">Edit</button>
                          <button onClick={() => handleDelete(w.id)} className="text-rose-600 hover:text-rose-900">Delete</button>
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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editingWarehouse ? 'Edit Warehouse' : 'Add Warehouse'}</h3>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <span>Warehouse Name</span>
              <input type="text" {...register('name')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              {errors.name && <p className="text-sm text-rose-600">{errors.name.message}</p>}
            </label>
            <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <span>Location</span>
              <input type="text" {...register('location')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              {errors.location && <p className="text-sm text-rose-600">{errors.location.message}</p>}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" {...register('isActive')} className="rounded border-slate-300 bg-slate-50" />
              <span>Active</span>
            </label>
            <button type="submit" className="w-full rounded-3xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              {editingWarehouse ? 'Update Warehouse' : 'Create Warehouse'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
