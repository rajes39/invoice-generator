import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  CreditCard, 
  Landmark, 
  Upload, 
  Save,
  Loader
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CompanySettings } from '../types';

export default function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<CompanySettings>>({
    company_name: '',
    address: '',
    city: '',
    pincode: '',
    state: '',
    state_code: '',
    phone: '',
    email: '',
    gstin: '',
    pan: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    branch: '',
    logo_url: '',
  });
  const [isUploading, setIsUploading] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['company_settings'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) console.error('Fetch error:', error);
      return data;
    }
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        company_name: settings.company_name || '',
        address: settings.address || '',
        city: settings.city || '',
        pincode: settings.pincode || '',
        state: settings.state || '',
        state_code: settings.state_code || '',
        phone: settings.phone || '',
        email: settings.email || '',
        gstin: settings.gstin || '',
        pan: settings.pan || '',
        bank_name: settings.bank_name || '',
        account_number: settings.account_number || '',
        ifsc_code: settings.ifsc_code || '',
        branch: settings.branch || '',
        logo_url: settings.logo_url || '',
      });
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: async (data: Partial<CompanySettings>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Not authenticated');

      const payload = {
        user_id: session.user.id,
        company_name: data.company_name || '',
        address: data.address || '',
        city: data.city || '',
        pincode: data.pincode || '',
        state: data.state || '',
        state_code: data.state_code || '',
        phone: data.phone || '',
        email: data.email || '',
        gstin: data.gstin || '',
        pan: data.pan || '',
        bank_name: data.bank_name || '',
        account_number: data.account_number || '',
        ifsc_code: data.ifsc_code || '',
        branch: data.branch || '',
        logo_url: data.logo_url || '',
      };

      console.log('Saving company settings:', payload);

      const { error } = await supabase
        .from('company_settings')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        console.error('Save error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_settings'] });
      toast.success('Company settings saved successfully');
    },
    onError: (error: any) => {
      console.error('Mutation error:', error);
      toast.error(error.message || 'Failed to save settings');
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo size should be less than 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');

      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${session.user.id}.${fileExt}`;
      const filePath = `company-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('assets')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, logo_url: publicUrl }));
      toast.success('Logo uploaded successfully');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to upload logo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  if (isLoading) return <div className="p-8 text-center"><Loader className="animate-spin mx-auto w-8 h-8 text-indigo-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <header>
        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">Company Profile</h2>
        <p className="text-sm text-slate-500 font-medium">Manage your business details for invoices and reports.</p>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-6">
        {/* Basic Details */}
        <div className="glass-card rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Basic Information
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2 flex items-center gap-8 mb-4">
              <div className="relative group">
                <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden">
                  {formData.logo_url ? (
                    <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Building2 className="w-8 h-8 text-slate-300" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 flex items-center justify-center">
                      <Loader className="w-6 h-6 animate-spin text-indigo-600" />
                    </div>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 text-white rounded-xl shadow-lg cursor-pointer hover:bg-indigo-500 transition-colors">
                  <Upload className="w-4 h-4" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </label>
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Company Name *</label>
                <input 
                  required
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">GSTIN</label>
              <input 
                name="gstin"
                value={formData.gstin}
                onChange={handleChange}
                placeholder="27AAAAA0000A1Z5"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">PAN</label>
              <input 
                name="pan"
                value={formData.pan}
                onChange={handleChange}
                placeholder="ABCDE1234F"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Contact & Address */}
        <div className="glass-card rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Contact & Address
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Address *</label>
              <textarea 
                required
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">City *</label>
              <input 
                required
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">PIN Code *</label>
              <input 
                required
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">State</label>
              <input 
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="West Bengal"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">State Code</label>
              <input 
                name="state_code"
                value={formData.state_code}
                onChange={handleChange}
                placeholder="19"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Phone *</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  required
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Email *</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  required
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="glass-card rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Landmark className="w-4 h-4" /> Bank Information
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bank Name</label>
              <input 
                name="bank_name"
                value={formData.bank_name}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Account Number</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  name="account_number"
                  value={formData.account_number}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">IFSC Code</label>
              <input 
                name="ifsc_code"
                value={formData.ifsc_code}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Branch</label>
              <input 
                name="branch"
                value={formData.branch}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-3xl bg-slate-900 px-8 py-4 text-sm font-black text-white transition hover:bg-slate-800 shadow-xl active:scale-95 disabled:opacity-50 flex items-center gap-3"
          >
            {mutation.isPending ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {mutation.isPending ? 'SAVING...' : 'SAVE PROFILE'}
          </button>
        </div>
      </form>
    </div>
  );
}
