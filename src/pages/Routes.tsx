import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '../lib/supabase';
import type { Route } from '../types';

const schema = z.object({
  name: z.string().min(1, 'Route name is required'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

export default function Routes() {
  const queryClient = useQueryClient();
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => {
      const { data } = await supabase.from('routes').select('*').order('name');
      return data ?? [];
    },
  });

  const onSubmit = async (values: FormValues) => {
    const user = (await supabase.auth.getSession()).data.session?.user;
    const payload = {
      ...values,
      user_id: user?.id,
      created_at: new Date().toISOString(),
      data: values,
    };

    if (editingRoute) {
      await supabase.from('routes').update(payload).eq('id', editingRoute.id);
      setEditingRoute(null);
    } else {
      await supabase.from('routes').insert([{ id: crypto.randomUUID(), ...payload }]);
    }

    reset({ name: '', description: '', isActive: true });
    queryClient.invalidateQueries({ queryKey: ['routes'] });
  };

  const handleDelete = async (routeId: string) => {
    await supabase.from('routes').delete().eq('id', routeId);
    queryClient.invalidateQueries({ queryKey: ['routes'] });
  };

  const handleEdit = (route: Route) => {
    setEditingRoute(route);
    reset({
      name: route.name,
      description: route.description,
      isActive: route.isActive,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Routes</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage delivery routes and areas.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-3">Route Name</th>
                  <th className="px-3 py-3">Description</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                      Loading routes...
                    </td>
                  </tr>
                ) : routes.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                      No routes found.
                    </td>
                  </tr>
                ) : (
                  routes.map((route: any) => (
                    <tr key={route.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">{route.name}</td>
                      <td className="px-3 py-3">{route.description}</td>
                      <td className="px-3 py-3">
                        <span className={route.isActive ? 'text-emerald-600' : 'text-rose-600'}>
                          {route.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(route)}
                            className="rounded-2xl border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(route.id)}
                            className="rounded-2xl border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-900/20"
                          >
                            Delete
                          </button>
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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editingRoute ? 'Edit Route' : 'Add Route'}</h3>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <span>Route Name</span>
              <input type="text" {...register('name')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              {errors.name && <p className="text-sm text-rose-600">{errors.name.message}</p>}
            </label>
            <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <span>Description</span>
              <textarea {...register('description')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" {...register('isActive')} className="rounded border-slate-300 bg-slate-50" />
              <span>Active</span>
            </label>

            <button type="submit" className="w-full rounded-3xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              {editingRoute ? 'Update Route' : 'Create Route'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
