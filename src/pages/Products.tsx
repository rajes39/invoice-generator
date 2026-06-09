import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '../lib/supabase';
import type { Product } from '../types';
import { downloadCsv, parseCsv } from '../lib/csv';
import toast from 'react-hot-toast';

const schema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Product name is required'),
  brand: z.string().min(1, 'Brand is required'),
  category: z.string().min(1, 'Category is required'),
  hsnCode: z.string().min(1, 'HSN code is required'),
  mrp: z.number().min(0, 'MRP must be positive'),
  gstRate: z.number().min(0, 'GST rate is required'),
  unit: z.string().min(1, 'Unit is required'),
  stock: z.number().min(0, 'Stock is required'),
  reorderLevel: z.number().min(0, 'Reorder level is required'),
});

type FormValues = z.infer<typeof schema>;

const EXCEL_HEADERS = ['sku', 'name', 'brand', 'category', 'hsnCode', 'mrp', 'gstRate', 'unit', 'stock', 'reorderLevel'];

export default function Products() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ 
    resolver: zodResolver(schema), 
    defaultValues: { mrp: 0, gstRate: 0, stock: 0, reorderLevel: 0, brand: '', category: '' } 
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (error) {
        toast.error('Failed to fetch products: ' + error.message);
        throw error;
      }
      return (data ?? []).map(p => ({
        ...p,
        userId: p.user_id,
        hsnCode: p.hsn_code || p.hsnCode || '',
        gstRate: Number(p.gst_rate || p.gstRate || 0),
        reorderLevel: Number(p.reorder_level || p.reorderLevel || 0),
        mrp: Number(p.mrp || 0),
        stock: Number(p.stock || 0),
        partNo: p.part_no || p.sku || ''
      }));
    },
  });

  const filteredProducts = useMemo(
    () => products.filter((product: Product) => 
      (product.name || '').toLowerCase().includes(search.toLowerCase()) || 
      (product.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      (product.brand && product.brand.toLowerCase().includes(search.toLowerCase()))
    ),
    [products, search],
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
        sku: values.sku,
        part_no: values.sku, // Map SKU to part_no for consistency
        name: values.name,
        brand: values.brand,
        category: values.category,
        hsn_code: values.hsnCode,
        mrp: values.mrp,
        rate: values.mrp, // Set rate to MRP by default
        gst_rate: values.gstRate,
        unit: values.unit,
        stock: values.stock,
        reorder_level: values.reorderLevel,
        user_id: user.id,
        created_at: new Date().toISOString(),
        data: values,
      };

      if (editingProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
        setEditingProduct(null);
        toast.success('Product updated');
      } else {
        const { error } = await supabase.from('products').insert([{ id: crypto.randomUUID(), ...payload }]);
        if (error) throw error;
        toast.success('Product created');
      }

      reset({ sku: '', name: '', brand: '', category: '', hsnCode: '', mrp: 0, gstRate: 0, unit: '', stock: 0, reorderLevel: 0 });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err: any) {
      console.error('Error saving product:', err);
      toast.error(err.message || 'Failed to save product');
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete product');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    reset({
      sku: product.sku,
      name: product.name,
      brand: product.brand || '',
      category: product.category || '',
      hsnCode: product.hsnCode,
      mrp: product.mrp,
      gstRate: product.gstRate,
      unit: product.unit,
      stock: product.stock,
      reorderLevel: product.reorderLevel,
    });
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const handleDownloadFormat = () => {
    downloadCsv(EXCEL_HEADERS, [], 'products_template.csv');
  };

  const handleDownloadExcel = () => {
    downloadCsv(EXCEL_HEADERS, products, 'products_list.csv');
  };

  const sanitizeValue = (val: any) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
      return val
        .replace(/\u0000/g, '')           // remove null bytes
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // remove control characters
        .trim();
    }
    return val;
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
      
      const sanitizedRows = data.map(row => ({
        id: crypto.randomUUID(),
        sku: sanitizeValue(row.sku),
        name: sanitizeValue(row.name),
        brand: sanitizeValue(row.brand),
        category: sanitizeValue(row.category),
        hsn_code: sanitizeValue(row.hsnCode),
        mrp: Number(row.mrp || 0),
        gst_rate: Number(row.gstRate || 0),
        unit: sanitizeValue(row.unit),
        stock: Number(row.stock || 0),
        reorder_level: Number(row.reorderLevel || 0),
        user_id: user.id,
        created_at: new Date().toISOString(),
        data: row
      }));

      const chunkArray = (arr: any[], size: number) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      const chunks = chunkArray(sanitizedRows, 30);

      for (const chunk of chunks) {
        const { error } = await supabase.from('products').insert(chunk);
        if (error) {
          console.error('Error inserting chunk:', error);
          errorCount += chunk.length;
        } else {
          successCount += chunk.length;
        }
        
        setUploadProgress(prev => ({ 
          ...prev, 
          current: Math.min(prev.current + chunk.length, data.length) 
        }));
        
        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
      
      if (errorCount === 0) {
        toast.success(`Successfully imported all ${successCount} products`);
      } else {
        toast.success(`Import complete: ${successCount} success, ${errorCount} failed`);
      }
    } catch (err: any) {
      console.error('Error importing products:', err);
      toast.error(err.message || 'Failed to import products');
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });
      if (e.target) e.target.value = ''; // Reset input
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Products</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage product master and sync to Supabase.</p>
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
              placeholder="Search products"
              className="w-full max-w-sm rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-300">
              <thead>
                <tr className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-3">SKU</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Brand</th>
                  <th className="px-3 py-3">MRP</th>
                  <th className="px-3 py-3">Stock</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">Loading...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">No products found.</td></tr>
                ) : (
                  filteredProducts.map((product: Product) => (
                    <tr key={product.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">{product.sku}</td>
                      <td className="px-3 py-3">{product.name}</td>
                      <td className="px-3 py-3">{product.brand || 'N/A'}</td>
                      <td className="px-3 py-3">₹{product.mrp.toFixed(2)}</td>
                      <td className="px-3 py-3">
                        <span className={product.stock <= (product.reorderLevel ?? 0) ? 'font-bold text-rose-600' : ''}>
                          {product.stock} {product.unit}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(product)} className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200">Edit</button>
                          <button onClick={() => handleDelete(product.id)} className="text-rose-600 hover:text-rose-900">Delete</button>
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
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{editingProduct ? 'Edit Product' : 'Add Product'}</h3>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>SKU / Part No</span>
                <input type="text" {...register('sku')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                {errors.sku && <p className="text-sm text-rose-600">{errors.sku.message}</p>}
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>Product Name</span>
                <input type="text" {...register('name')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                {errors.name && <p className="text-sm text-rose-600">{errors.name.message}</p>}
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>Brand</span>
                <input type="text" {...register('brand')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                {errors.brand && <p className="text-sm text-rose-600">{errors.brand.message}</p>}
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>Category</span>
                <input type="text" {...register('category')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                {errors.category && <p className="text-sm text-rose-600">{errors.category.message}</p>}
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>HSN Code</span>
                <input type="text" {...register('hsnCode')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                {errors.hsnCode && <p className="text-sm text-rose-600">{errors.hsnCode.message}</p>}
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>Unit (e.g. Pcs, Box)</span>
                <input type="text" {...register('unit')} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                {errors.unit && <p className="text-sm text-rose-600">{errors.unit.message}</p>}
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>MRP (Incl. GST)</span>
                <input type="number" step="0.01" {...register('mrp', { valueAsNumber: true })} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>GST Rate (%)</span>
                <input type="number" step="0.01" {...register('gstRate', { valueAsNumber: true })} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>Opening Stock</span>
                <input type="number" {...register('stock', { valueAsNumber: true })} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
              <label className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <span>Reorder Level</span>
                <input type="number" {...register('reorderLevel', { valueAsNumber: true })} className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </label>
            </div>

            <button type="submit" className="w-full rounded-3xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              {editingProduct ? 'Update Product' : 'Create Product'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
