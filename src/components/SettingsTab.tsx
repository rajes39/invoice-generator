import { useState, Dispatch, SetStateAction, FormEvent } from 'react';
import { BusinessProfile } from '../types';
import { Landmark, Phone, Mail, MapPin, Sparkles, Building2, ShieldCheck, RefreshCw } from 'lucide-react';
import { INDIAN_STATES } from './CustomersTab';
import { motion } from 'motion/react';

interface SettingsTabProps {
  businessProfile: BusinessProfile;
  setBusinessProfile: Dispatch<SetStateAction<BusinessProfile>>;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const SUPPORTED_EMOJIS = ["⚡", "🏢", "💻", "📊", "🛠️", "💡", "🏷️", "🌟", "🛡️", "🔥", "🚀", "📦"];

export function SettingsTab({ businessProfile, setBusinessProfile, showToast }: SettingsTabProps) {
  const [name, setName] = useState(businessProfile.name);
  const [gstin, setGstin] = useState(businessProfile.gstin);
  const [address, setAddress] = useState(businessProfile.address);
  const [phone, setPhone] = useState(businessProfile.phone);
  const [email, setEmail] = useState(businessProfile.email);
  const [state, setState] = useState(businessProfile.state);
  const [logo, setLogo] = useState(businessProfile.logo);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast("Company name cannot be blank", "error");
      return;
    }

    if (gstin.trim() && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(gstin.trim().toUpperCase())) {
      showToast("GSTIN format is incorrect (e.g., 19AAACS2312M1Z5)", "info");
    }

    setBusinessProfile({
      name: name.trim(),
      gstin: gstin.trim().toUpperCase(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      state,
      logo
    });

    showToast("Business profile updated successfully!", "success");
  };

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Business Ledger Settings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Configure your standard corporate identity, banking parameters, custom rates, and GST state codes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card Summary */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white rounded-3xl p-6 self-start space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="text-4xl bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center border border-white/10">
              {logo}
            </span>
            <div>
              <h3 className="font-extrabold tracking-tight text-base leading-none">
                {name || "Unnamed Business"}
              </h3>
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block mt-1.5">
                Primary Seller Account
              </span>
            </div>
          </div>

          <div className="border-t border-slate-800 my-4" />

          <div className="space-y-3 text-xs text-slate-400">
            <div className="flex gap-2 items-start">
              <Landmark className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">GSTIN Register</span>
                <span className="font-mono text-slate-200">{gstin || "URD / Unregistered"}</span>
              </div>
            </div>

            <div className="flex gap-2 items-start">
              <Phone className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Helpline Phone</span>
                <span className="text-slate-200">{phone || "Not Configured"}</span>
              </div>
            </div>

            <div className="flex gap-2 items-start">
              <Mail className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Corporate Email</span>
                <span className="text-slate-205">{email || "Not Configured"}</span>
              </div>
            </div>

            <div className="flex gap-2 items-start">
              <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Headquarters state</span>
                <span className="text-indigo-400 font-semibold">{state}</span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-950/40 border border-indigo-900/50 rounded-2xl p-4 flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
            <p className="text-[10px] text-indigo-305 leading-relaxed font-semibold">
              GST routing calculations dynamically apply intrastate vs interstate models on invoices based on {state} parameters.
            </p>
          </div>
        </div>

        {/* Configuration Core editor Form */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 md:col-span-2 space-y-6">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest pb-3 border-b border-slate-50 dark:border-slate-850">
            Corporate Profile Form
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Logo Emojis Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Company Brand Emblem / Emoji
              </label>
              <div className="flex flex-wrap gap-2.5">
                {SUPPORTED_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setLogo(em)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all border cursor-pointer ${
                      logo === em 
                        ? 'bg-indigo-600 border-indigo-600 text-white scale-110 shadow-md shadow-indigo-600/10' 
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-850 text-slate-800 dark:text-slate-250'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Corporate Brand Name *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Superior Distribution"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-505 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Business GSTIN (15 AlphaNumeric)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Landmark className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="E.g., 19AAACS2312M1Z5"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Corporate Phone Mobile
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-mono">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9988776655"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Corporate Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="accounts@superior.in"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Seller Point state Origin
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-slate-100 font-semibold"
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Headquarters Billing Physical Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                placeholder="HQ Block street details..."
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-slate-100"
              />
            </div>

            <button
              type="submit"
              className="py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/10 cursor-pointer block text-center"
            >
              Update Primary Profiles
            </button>

          </form>
        </div>

      </div>

    </div>
  );
}
