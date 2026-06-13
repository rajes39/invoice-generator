import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Calculator, 
  CreditCard, 
  Info, 
  Loader, 
  Plus, 
  Trash2,
  Barcode,
  Search,
  Minus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { 
  calculateBasicRate, 
  createInvoice, 
  numberToWords,
  getFinancialYear 
} from '../services/invoiceService';
import type { Product, Customer, InvoiceItem, Invoice, PricingRule, CompanySettings } from '../types';

export default function ScannerInvoice() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  
  // -- Form State --
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lines, setLines] = useState<Omit<InvoiceItem, 'id' | 'invoiceId' | 'createdAt'>[]>([]);
  const [status, setStatus] = useState<'Draft' | 'Active'>('Active');
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);
  
  // -- Meta Info --
  const [remark, setRemark] = useState('');
  const [freightCharges, setFreightCharges] = useState<number>(0);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 16));
  const [isSaving, setIsSaving] = useState(false);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);

  // -- Data Fetching --
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*').order('name');
      return data ?? [];
    },
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  useEffect(() => {
    const loadRulesAndSchemes = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const [schemesRes] = await Promise.all([
        supabase.from('product_schemes').select('*').eq('user_id', session.user.id).eq('is_active', true)
      ]);
      setSchemes(schemesRes.data || []);

      if (!selectedCustomerId) {
        setRules([]);
        return;
      }

      try {
        const [discountsRes, netRatesRes, categoryDiscountsRes] = await Promise.all([
          supabase.from('customer_discounts').select('*').eq('customer_id', selectedCustomerId),
          supabase.from('customer_net_rates').select('*').eq('customer_id', selectedCustomerId),
          supabase.from('customer_category_discounts').select('*').eq('customer_id', selectedCustomerId)
        ]);

        const mappedRules: PricingRule[] = [
          ...(discountsRes.data || []).map(d => ({
            id: d.id,
            customerId: d.customer_id,
            type: (d.type === 'BRAND' ? 'BRAND_DISCOUNT' : 'PRODUCT_DISCOUNT') as any,
            target: d.target,
            value: Number(d.discount_percent)
          })),
          ...(netRatesRes.data || []).map(n => ({
            id: n.id,
            customerId: n.customer_id,
            type: 'PRODUCT_NET_RATE' as const,
            target: n.product_id,
            value: Number(n.net_rate)
          })),
          ...(categoryDiscountsRes.data || []).map(c => ({
            id: c.id,
            customerId: c.customer_id,
            type: 'CATEGORY_DISCOUNT' as const,
            target: c.category,
            value: Number(c.discount_percent)
          }))
        ];

        setRules(mappedRules);
      } catch (err) {
        console.error('Failed to load pricing rules:', err);
      }
    };
    loadRulesAndSchemes();
  }, [selectedCustomerId]);

  // Flash Effect
  useEffect(() => {
    if (flash) {
      const timer = setTimeout(() => setFlash(null), 500);
      return () => clearTimeout(timer);
    }
  }, [flash]);

  // Auto-focus barcode field
  useEffect(() => {
    const focusTimer = setInterval(() => {
      if (barcodeInputRef.current && document.activeElement !== barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }, 1000);
    return () => clearInterval(focusTimer);
  }, []);

  const playBeep = (type: 'success' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'success') {
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } else {
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      }
    } catch (err) {
      console.warn('Audio beep failed', err);
    }
  };

  const getEffectivePricing = (product: Product, customerId: string, qty: number) => {
    const customerRules = rules.filter(r => r.customerId === customerId);
    const mrp = Number(product.mrp || 0);
    
    // 1. Scheme Priority
    const productSchemes = schemes.filter(s => s.product_id === product.id && qty >= s.min_qty);
    if (productSchemes.length > 0) {
      const bestScheme = productSchemes.reduce((prev, curr) => (Number(curr.min_qty) > Number(prev.min_qty) ? curr : prev));
      const rate = Number(bestScheme.scheme_price);
      const discPercent = mrp > 0 ? ((mrp - rate) / mrp * 100) : 0;
      return { 
        effectivePrice: rate, 
        discPercent: Number(discPercent.toFixed(2)), 
        isNet: true, 
        ruleName: `🎁 Scheme: ₹${rate}`,
        badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-100'
      };
    }

    // 2. Net Rate Priority
    const netRateRule = customerRules.find(r => r.type === 'PRODUCT_NET_RATE' && r.target === product.id);
    if (netRateRule) {
      const rate = Number(netRateRule.value);
      const discPercent = mrp > 0 ? ((mrp - rate) / mrp * 100) : 0;
      return { 
        effectivePrice: rate, 
        discPercent: Number(discPercent.toFixed(2)), 
        isNet: true, 
        ruleName: '💰 Net Rate Applied',
        badgeColor: 'bg-blue-50 text-blue-600 border-blue-100'
      };
    }

    // 3. Product Discount
    const prodDiscRule = customerRules.find(r => 
      r.type === 'PRODUCT_DISCOUNT' && 
      (r.target === product.id || r.target === (product as any).partNo || r.target === product.sku)
    );
    if (prodDiscRule) {
      const disc = Number(prodDiscRule.value);
      const rate = mrp * (1 - disc / 100);
      return { 
        effectivePrice: rate, 
        discPercent: disc, 
        isNet: false, 
        ruleName: `🏷️ Product Disc: ${disc}%`,
        badgeColor: 'bg-indigo-50 text-indigo-600 border-indigo-100'
      };
    }

    // 4. Brand Discount
    const brandDiscRule = customerRules.find(r => 
      r.type === 'BRAND_DISCOUNT' && 
      r.target?.toLowerCase().trim() === (product.brand || (product as any).data?.brand || '')?.toLowerCase().trim()
    );
    if (brandDiscRule) {
      const disc = Number(brandDiscRule.value);
      const rate = mrp * (1 - disc / 100);
      return { 
        effectivePrice: rate, 
        discPercent: disc, 
        isNet: false, 
        ruleName: `🏷️ Brand Disc: ${disc}%`,
        badgeColor: 'bg-amber-50 text-amber-600 border-amber-100'
      };
    }

    return { 
      effectivePrice: mrp, 
      discPercent: 0, 
      isNet: false, 
      ruleName: '',
      badgeColor: ''
    };
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      toast.error('Select a customer first!');
      setFlash('error');
      playBeep('error');
      setBarcodeInput('');
      return;
    }

    const code = barcodeInput.trim();
    if (!code) return;

    try {
      // Search product by barcode_no, sku, or part_no
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .or(`barcode_no.eq."${code}",sku.eq."${code}",part_no.eq."${code}"`)
        .maybeSingle();

      if (!product) {
        toast.error(`Product not found: ${code}`);
        setFlash('error');
        playBeep('error');
        setBarcodeInput('');
        return;
      }

      // Add to lines or increment qty
      const existingIdx = lines.findIndex(l => l.productId === product.id);
      if (existingIdx >= 0) {
        const updatedLines = [...lines];
        const line = updatedLines[existingIdx];
        const newQty = line.qty + 1;
        
        // Recalculate with new qty (schemes might change)
        const pricing = getEffectivePricing(product as any, selectedCustomerId, newQty);
        const mrp = Number(product.mrp || 0);
        const gstRate = Number(product.gst_rate || 0);
        const taxableAmt = (pricing.effectivePrice * newQty);
        const gstTax = (taxableAmt * gstRate / 100);
        const basicRate = calculateBasicRate(pricing.effectivePrice, gstRate);

        updatedLines[existingIdx] = {
          ...line,
          qty: newQty,
          effectivePrice: pricing.effectivePrice,
          discountPercent: pricing.discPercent,
          discountAmount: (mrp * newQty - taxableAmt),
          isNetRate: pricing.isNet,
          basicRatePerUnit: basicRate,
          basicAmount: taxableAmt,
          gstAmount: gstTax,
          lineTotal: (taxableAmt + gstTax),
          ruleName: pricing.ruleName,
          badgeColor: pricing.badgeColor
        };
        setLines(updatedLines);
      } else {
        const pricing = getEffectivePricing(product as any, selectedCustomerId, 1);
        const mrp = Number(product.mrp || 0);
        const gstRate = Number(product.gst_rate || 0);
        const taxableAmt = (pricing.effectivePrice * 1);
        const gstTax = (taxableAmt * gstRate / 100);
        const basicRate = calculateBasicRate(pricing.effectivePrice, gstRate);

        const newLine = {
          productId: product.id,
          productName: product.name,
          partNo: product.part_no || '',
          hsnCode: product.hsn_code || '',
          qty: 1,
          mrpPerUnit: mrp,
          effectivePrice: pricing.effectivePrice,
          discountPercent: pricing.discPercent,
          discountAmount: (mrp - pricing.effectivePrice),
          isNetRate: pricing.isNet,
          gstRate,
          basicRatePerUnit: basicRate,
          basicAmount: taxableAmt,
          gstAmount: gstTax,
          lineTotal: (taxableAmt + gstTax),
          ruleName: pricing.ruleName,
          badgeColor: pricing.badgeColor
        };
        setLines([...lines, newLine]);
      }

      setFlash('success');
      playBeep('success');
      setBarcodeInput('');
    } catch (err) {
      console.error(err);
      toast.error('Scanning error occurred');
      setFlash('error');
      playBeep('error');
    }
  };

  const updateQty = (idx: number, delta: number) => {
    const updatedLines = [...lines];
    const line = updatedLines[idx];
    const newQty = Math.max(1, line.qty + delta);
    
    // We need the product object for recalculation
    // Since we don't have it in lines, we could either store it or fetch it.
    // Let's just update the line simply for now, but real logic should re-apply pricing rules.
    // For robust logic, we'd fetch the product again or store minimal product info.
    
    // Mocking recalculation by fetching minimal product info
    supabase.from('products').select('*').eq('id', line.productId).single().then(({ data: product }) => {
      if (!product) return;
      const pricing = getEffectivePricing(product as any, selectedCustomerId, newQty);
      const mrp = Number(product.mrp || 0);
      const gstRate = Number(product.gst_rate || 0);
      const taxableAmt = (pricing.effectivePrice * newQty);
      const gstTax = (taxableAmt * gstRate / 100);
      const basicRate = calculateBasicRate(pricing.effectivePrice, gstRate);

      updatedLines[idx] = {
        ...line,
        qty: newQty,
        effectivePrice: pricing.effectivePrice,
        discountPercent: pricing.discPercent,
        discountAmount: (mrp * newQty - taxableAmt),
        isNetRate: pricing.isNet,
        basicRatePerUnit: basicRate,
        basicAmount: taxableAmt,
        gstAmount: gstTax,
        lineTotal: (taxableAmt + gstTax),
        ruleName: pricing.ruleName,
        badgeColor: pricing.badgeColor
      };
      setLines([...updatedLines]);
    });
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const totals = useMemo(() => {
    const totalMrp = lines.reduce((sum, l) => sum + (l.mrpPerUnit * l.qty), 0);
    const totalDisc = lines.reduce((sum, l) => sum + (l.discountAmount || 0), 0);
    const taxable = lines.reduce((sum, l) => sum + (l.basicAmount || 0), 0);
    const goodsGst = lines.reduce((sum, l) => sum + (l.gstAmount || 0), 0);
    
    const fCharges = Number(freightCharges || 0);
    const fGst = (fCharges * 0.18);
    
    const rawTotal = taxable + goodsGst + fCharges + fGst;
    const finalTotal = Math.round(rawTotal);
    const roundOff = (finalTotal - rawTotal);

    return {
      totalMrp,
      totalDiscount: totalDisc,
      taxableAmount: taxable,
      goodsGst,
      freightCharges: fCharges,
      freightGst: fGst,
      cgst: (goodsGst + fGst) / 2,
      sgst: (goodsGst + fGst) / 2,
      roundOff,
      billTotal: finalTotal
    };
  }, [lines, freightCharges]);

  const saveInvoice = async () => {
    if (!selectedCustomer || lines.length === 0 || isSaving) return;
    
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');

      const invoice: any = {
        userId: session.user.id,
        invoiceNumber: 'AUTO',
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerGstin: selectedCustomer.gstin || 'URD',
        customerPhone: selectedCustomer.mobile || '',
        customerAddress: selectedCustomer.address || '',
        customerCity: selectedCustomer.city || '',
        customerState: selectedCustomer.state || '',
        customerStateCode: selectedCustomer.stateCode || '',
        deliveryAddress: {
          address: selectedCustomer.address || '',
          city: selectedCustomer.city || '',
          state: selectedCustomer.state || '',
          stateCode: selectedCustomer.stateCode || '',
          pincode: (selectedCustomer as any).pincode || ''
        },
        date: invoiceDate,
        dueDate: invoiceDate.split('T')[0],
        remark,
        subtotalMrp: totals.totalMrp,
        totalDiscountAmount: totals.totalDiscount,
        subtotalBasic: totals.taxableAmount,
        totalCgst: totals.cgst,
        totalSgst: totals.sgst,
        totalIgst: 0,
        freightCharges: totals.freightCharges,
        freightGst: totals.freightGst,
        roundOff: totals.roundOff,
        grandTotal: totals.billTotal,
        isInterstate: false,
        status,
        items: lines as InvoiceItem[],
      };

      const id = await createInvoice(invoice);
      
      // Update stock Ledger
      for (const item of lines) {
        await supabase.from('stock_ledger').insert([{
          user_id: session.user.id,
          product_id: item.productId,
          quantity: -item.qty,
          transaction_type: 'Out',
          reference_id: id,
          reference_type: 'Invoice',
          date: invoiceDate.split('T')[0],
          data: item
        }]);
      }

      toast.success('Invoice generated successfully!');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate('/sales/invoices');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save invoice');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 relative">
      <div className={`fixed inset-0 pointer-events-none transition-opacity duration-300 z-50 ${flash === 'success' ? 'bg-green-500/20 opacity-100' : flash === 'error' ? 'bg-red-500/20 opacity-100' : 'opacity-0'}`} />

      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight flex items-center gap-2">
            <Barcode className="w-8 h-8 text-green-600" />
            SONALI ERP - Scanner Invoice
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Fast barcode-based billing with automatic pricing application.</p>
        </div>
        <div className="flex gap-2">
          <button 
            disabled={isSaving || lines.length === 0}
            onClick={saveInvoice}
            className="inline-flex items-center gap-2 rounded-3xl bg-[#16a34a] px-8 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50 shadow-lg active:scale-95"
          >
            {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {isSaving ? 'Processing...' : 'Save & Finalize Invoice'}
          </button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          
          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">1. Buyer Selection</label>
                <SearchableDropdown
                  table="customers"
                  searchFields={['name', 'gstin', 'mobile']}
                  displayField="name"
                  helperFields={['gstin', 'mobile']}
                  onSelect={(c) => setSelectedCustomerId(c.id)}
                  placeholder="Select Customer first..."
                  value={selectedCustomer?.name}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">2. Barcode Scanning</label>
                <form onSubmit={handleScan} className="relative group">
                  <input
                    ref={barcodeInputRef}
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="🔍 Ready to scan... point scanner here"
                    className={`w-full rounded-2xl border-2 px-12 py-4 text-lg font-bold outline-none transition-all ${
                      selectedCustomerId 
                        ? 'border-green-500 bg-green-50 focus:ring-4 focus:ring-green-500/20' 
                        : 'border-slate-200 bg-slate-100 cursor-not-allowed'
                    }`}
                    disabled={!selectedCustomerId}
                  />
                  <Barcode className={`absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 ${selectedCustomerId ? 'text-green-600' : 'text-slate-400'}`} />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Press Enter to Scan</span>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-slate-200 overflow-hidden shadow-sm dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Sr</th>
                    <th className="px-3 py-3">Description</th>
                    <th className="px-3 py-3 text-center">HSN</th>
                    <th className="px-3 py-3 text-right">MRP</th>
                    <th className="px-3 py-3 text-right">Rate</th>
                    <th className="px-3 py-3 text-center">Qty</th>
                    <th className="px-3 py-3 text-right">Disc%</th>
                    <th className="px-3 py-3 text-right">Taxable</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-30">
                          <Barcode className="w-16 h-16" />
                          <p className="text-xl font-black uppercase tracking-tighter">Scan Items to Begin</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    lines.map((l, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-4 text-[10px] font-bold text-slate-400">{i + 1}</td>
                        <td className="px-3 py-4">
                          <div className="font-bold text-slate-900">{l.productName}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">{l.partNo}</span>
                            {l.ruleName && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${l.badgeColor}`}>
                                {l.ruleName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-center font-mono text-xs">{l.hsnCode}</td>
                        <td className="px-3 py-4 text-right font-mono text-xs text-slate-400">₹{l.mrpPerUnit.toFixed(2)}</td>
                        <td className="px-3 py-4 text-right font-black">₹{l.effectivePrice.toFixed(2)}</td>
                        <td className="px-3 py-4">
                          <div className="flex items-center justify-center gap-3">
                            <button onClick={() => updateQty(i, -1)} className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-black text-green-600 w-6 text-center">{l.qty}</span>
                            <button onClick={() => updateQty(i, 1)} className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-right text-rose-500 font-bold">{l.discountPercent}%</td>
                        <td className="px-3 py-4 text-right font-medium text-slate-500">₹{l.basicAmount.toFixed(2)}</td>
                        <td className="px-4 py-4 text-right font-black text-slate-900">₹{l.lineTotal.toFixed(2)}</td>
                        <td className="px-4 py-4 text-center">
                          <button onClick={() => removeLine(i)} className="text-slate-300 hover:text-rose-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="glass-card rounded-3xl border border-green-100 p-6 shadow-xl bg-[#14532d] text-white">
            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2 border-b border-white/10 pb-4 mb-6">
              <Calculator className="w-5 h-5 text-green-400" /> Billing Summary
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold text-green-300 uppercase tracking-widest">
                <span>Taxable Amount</span>
                <span className="font-mono">₹{totals.taxableAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Total GST Tax</span>
                <span className="font-mono">₹{totals.goodsGst.toFixed(2)}</span>
              </div>
              {totals.roundOff !== 0 && (
                <div className="flex justify-between text-[10px] font-bold text-slate-500 italic">
                  <span>Round Off Adjust</span>
                  <span className="font-mono">{totals.roundOff > 0 ? '+' : ''}{totals.roundOff.toFixed(2)}</span>
                </div>
              )}
              
              <div className="pt-6 mt-6 border-t border-white/20">
                <p className="text-[10px] font-black text-green-300 uppercase tracking-widest mb-1 text-center">Net Total Payable</p>
                <div className="text-5xl font-black text-green-400 tracking-tighter text-center">
                  ₹{totals.billTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-bold leading-relaxed text-slate-300 italic text-center">
                    {numberToWords(totals.billTotal)}
                  </p>
                </div>
              </div>
            </div>

            <button 
              disabled={isSaving || lines.length === 0}
              onClick={saveInvoice}
              className="w-full rounded-3xl bg-green-500 px-5 py-5 text-lg font-black text-white transition hover:bg-green-400 disabled:opacity-50 shadow-2xl active:scale-95 flex items-center justify-center gap-3 mt-8"
            >
              {isSaving ? <Loader className="w-6 h-6 animate-spin" /> : <CreditCard className="w-6 h-6" />}
              {isSaving ? 'GENERATING...' : 'FINALIZE & SAVE'}
            </button>
          </div>

          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm bg-slate-50">
             <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-3">
                <Info className="w-3.5 h-3.5 text-indigo-500" /> Scanning Pro-Tips
             </h4>
             <ul className="text-[10px] leading-relaxed text-slate-500 font-medium space-y-2 list-disc pl-4">
               <li>Select customer first to enable barcode scanner.</li>
               <li>Point scanner at Product SKU or Part Number.</li>
               <li>The input field auto-refocuses after every successful scan.</li>
               <li>A <span className="text-green-600 font-bold underline">BEEP</span> means success; a <span className="text-rose-600 font-bold underline">LOW BUZZ</span> means not found.</li>
             </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
