import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Calculator, 
  CreditCard, 
  Info, 
  Loader, 
  MapPin, 
  Plus, 
  Trash2 
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { 
  calculateBasicRate, 
  numberToWords,
  getFinancialYear 
} from '../services/invoiceService';
import type { Product, Customer, InvoiceItem, Invoice, PricingRule, CompanySettings } from '../types';

export default function CreditNoteCreate() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // -- Form State --
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [originalInvoiceId, setOriginalInvoiceId] = useState('');
  const [originalInvoices, setOriginalInvoices] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qtyInput, setQtyInput] = useState<number | ''>(1);
  const [discPercentInput, setDiscPercentInput] = useState<number | ''>(0);
  const [isDiscManual, setIsDiscManual] = useState(false);
  
  const [lines, setLines] = useState<Omit<InvoiceItem, 'id' | 'invoiceId' | 'createdAt'>[]>([]);
  const [status, setStatus] = useState<'Draft' | 'Active'>('Active');
  
  // -- Meta Info --
  const [orderNo, setOrderNo] = useState('');
  const [remark, setRemark] = useState('');
  const [freightCharges, setFreightCharges] = useState<number>(0);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 16));
  
  // -- Delivery Address --
  const [useSeparateDelivery, setUseSeparateDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState({
    address: '',
    city: '',
    state: '',
    stateCode: '',
    pincode: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);

  // -- Data Fetching --
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').order('name');
      return (data ?? []).map(p => ({
        ...p,
        hsnCode: p.hsn_code || '',
        gstRate: Number(p.gst_rate || 0),
        mrp: Number(p.mrp || 0),
        partNo: p.part_no || p.sku || '',
        brand: p.brand || p.data?.brand || ''
      }));
    },
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('*').order('name');
      return data ?? [];
    },
  });

  // Fetch this customer's previous invoices
  useEffect(() => {
    const fetchCustomerInvoices = async () => {
      if (!selectedCustomerId) {
        setOriginalInvoices([]);
        return;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data } = await supabase.from('invoices')
        .select('id, invoice_no, date, grand_total, items')
        .eq('customer_id', selectedCustomerId)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      
      setOriginalInvoices(data || []);
    };
    
    fetchCustomerInvoices();
  }, [selectedCustomerId]);

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

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // Reset the picked "original invoice" whenever the buyer changes
  useEffect(() => {
    setOriginalInvoiceId('');
  }, [selectedCustomerId]);

  // When the user picks an Original Invoice, pull its line items and
  // load them as RETURN lines (negative qty / amounts) for this Credit Note.
  const handleSelectOriginalInvoice = (invoiceId: string) => {
    setOriginalInvoiceId(invoiceId);

    if (!invoiceId) return;

    const invoice = originalInvoices.find((inv: any) => inv.id === invoiceId);
    if (!invoice) return;

    const sourceItems: any[] = (invoice as any).items || [];
    const returnLines = sourceItems.map((item) => {
      const qty = Math.abs(Number(item.qty || 0));
      const mrpPerUnit = Number(item.mrpPerUnit ?? item.mrp_per_unit ?? 0);
      const effectivePrice = Number(item.effectivePrice ?? item.effective_price ?? 0);
      const gstRate = Number(item.gstRate ?? item.gst_rate ?? 0);
      const basicAmount = Math.abs(Number(item.basicAmount ?? item.basic_amount ?? 0));
      const gstAmount = Math.abs(Number(item.gstAmount ?? item.gst_amount ?? 0));
      const lineTotal = Math.abs(Number(item.lineTotal ?? item.line_total ?? 0));
      const discountAmount = Math.abs(Number(item.discountAmount ?? item.discount_amount ?? 0));

      return {
        productId: item.productId ?? item.product_id,
        productName: item.productName ?? item.product_name,
        partNo: item.partNo ?? item.part_no ?? '',
        hsnCode: item.hsnCode ?? item.hsn_code ?? '',
        qty: -qty,
        mrpPerUnit,
        effectivePrice,
        discountPercent: Number(item.discountPercent ?? item.discount_percent ?? 0),
        discountAmount: -discountAmount,
        isNetRate: !!(item.isNetRate ?? item.is_net_rate),
        gstRate,
        basicRatePerUnit: Number(item.basicRatePerUnit ?? item.basic_rate_per_unit ?? 0),
        basicAmount: -basicAmount,
        gstAmount: -gstAmount,
        lineTotal: -lineTotal,
        ruleName: '↩️ Return',
        badgeColor: 'bg-rose-50 text-rose-600 border-rose-100'
      };
    });

    setLines(returnLines as any);
    toast.success(`Loaded ${returnLines.length} item(s) from invoice ${invoice.invoice_no} as return`);
  };

  // Sync delivery address if "Same as buyer"
  useEffect(() => {
    if (!useSeparateDelivery && selectedCustomer) {
      setDeliveryAddress({
        address: selectedCustomer.address || '',
        city: selectedCustomer.city || '',
        state: selectedCustomer.state || '',
        stateCode: selectedCustomer.stateCode || '',
        pincode: (selectedCustomer as any).pincode || ''
      });
    }
  }, [selectedCustomer, useSeparateDelivery]);

  // Auto-populate discount when product or customer changes
  useEffect(() => {
    if (selectedProduct && selectedCustomerId) {
      const pricing = getEffectivePricing(selectedProduct, selectedCustomerId, Number(qtyInput || 0));
      setDiscPercentInput(pricing.discPercent);
      setIsDiscManual(false);
    } else {
      setDiscPercentInput(0);
      setIsDiscManual(false);
    }
  }, [selectedProduct, selectedCustomerId, qtyInput, rules, schemes]);

  const getEffectivePricing = (product: Product, customerId: string, qty: number) => {
    const customerRules = rules.filter(r => r.customerId === customerId);
    const mrp = Number(product.mrp || 0);
    
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

    const prodDiscRule = customerRules.find(r => r.type === 'PRODUCT_DISCOUNT' && r.target === product.id);
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

    const brandDiscRule = customerRules.find(r => r.type === 'BRAND_DISCOUNT' && r.target?.toLowerCase() === product.brand?.toLowerCase());
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

  const addLine = () => {
    if (!selectedProduct || !selectedCustomerId || !qtyInput) return;
    
    const qty = Number(qtyInput);
    const pricing = getEffectivePricing(selectedProduct, selectedCustomerId, qty);
    
    const mrp = Number(selectedProduct.mrp || 0);
    const gstRate = Number(selectedProduct.gstRate || 0);
    
    let effectiveRate = isDiscManual ? mrp * (1 - Number(discPercentInput) / 100) : pricing.effectivePrice;
    let discP = isDiscManual ? Number(discPercentInput) : pricing.discPercent;

    const taxableAmt = (effectiveRate * qty);
    const gstTax = (taxableAmt * gstRate / 100);
    const lineTotal = (taxableAmt + gstTax);
    const basicRate = calculateBasicRate(effectiveRate, gstRate);
    const discAmount = (mrp * qty - taxableAmt);

    const newLine = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      partNo: selectedProduct.partNo || '',
      hsnCode: selectedProduct.hsnCode || '',
      qty,
      mrpPerUnit: mrp,
      effectivePrice: effectiveRate,
      discountPercent: discP,
      discountAmount: discAmount,
      isNetRate: pricing.isNet,
      gstRate,
      basicRatePerUnit: basicRate,
      basicAmount: taxableAmt,
      gstAmount: gstTax,
      lineTotal,
      ruleName: isDiscManual ? `✏️ Manual: ${discP}%` : pricing.ruleName,
      badgeColor: isDiscManual ? 'bg-slate-50 text-slate-600 border-slate-200' : pricing.badgeColor
    };

    setLines([...lines, newLine]);
    setSelectedProductId('');
    setQtyInput(1);
    setDiscPercentInput(0);
    setIsDiscManual(false);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const totals = useMemo(() => {
    const taxable = lines.reduce((sum, l) => sum + l.basicAmount, 0);
    const goodsGst = lines.reduce((sum, l) => sum + l.gstAmount, 0);
    const fCharges = Number(freightCharges || 0);
    const fGst = (fCharges * 0.18);
    
    const rawTotal = taxable + goodsGst + fCharges + fGst;
    const finalTotal = Math.round(rawTotal);
    const roundOff = (finalTotal - rawTotal);

    return {
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

  const saveCreditNote = async () => {
    if (!selectedCustomer || lines.length === 0 || isSaving) return;
    
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');

      let { data: settings } = await supabase.from('company_settings').select('*').eq('user_id', session.user.id).maybeSingle();
      
      const prefix = 'CN';
      const rawFY = settings?.financial_year || getFinancialYear(new Date());
      const fy = rawFY.length > 5 ? rawFY.replace(/^\d{2}/, '') : rawFY;
      
      const nextSeq = (Number(settings?.cn_sequence || 0)) + 1;
      const cnNumber = `${prefix}/${fy}/${String(nextSeq).padStart(4, '0')}`;

      const creditNote = {
        user_id: session.user.id,
        credit_note_no: cnNumber,
        original_invoice_id: originalInvoiceId || null,
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        date: invoiceDate.split('T')[0],
        grand_total: totals.billTotal,
        status: status === 'Active' ? 'Applied' : 'Draft',
        items: lines,
        data: {
          ...totals,
          remark,
          orderNo,
          deliveryAddress,
          originalInvoiceId
        }
      };

      const { data: cnData, error: cnError } = await supabase.from('credit_notes').insert([creditNote]).select().single();
      if (cnError) throw cnError;

      await supabase.from('company_settings').update({ cn_sequence: nextSeq }).eq('user_id', session.user.id);
      
      for (const item of lines) {
        await supabase.from('stock_ledger').insert([{
          user_id: session.user.id,
          product_id: item.productId,
          quantity: -item.qty,
          transaction_type: 'In',
          reference_id: cnData.id,
          reference_type: 'CreditNote',
          date: invoiceDate.split('T')[0],
          data: item
        }]);
      }

      toast.success('Credit Note saved successfully!');
      queryClient.invalidateQueries({ queryKey: ['credit_notes'] });
      navigate('/sales/credit-notes');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to save credit note');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">SONALI ERP - Sales Return / Credit Note</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Create Sales Returns and Credit Notes against original invoices.</p>
        </div>
        <div className="flex gap-2">
          <button 
            disabled={isSaving || lines.length === 0}
            onClick={saveCreditNote}
            className="inline-flex items-center gap-2 rounded-3xl bg-[#16a34a] px-8 py-3 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50 shadow-lg active:scale-95"
          >
            {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
            {isSaving ? 'Processing...' : 'Save Credit Note'}
          </button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Return Date</label>
                <input type="datetime-local" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Buyer Selection</label>
                <SearchableDropdown
                  table="customers"
                  searchFields={['name', 'gstin', 'mobile']}
                  displayField="name"
                  helperFields={['gstin', 'mobile']}
                  onSelect={(c) => setSelectedCustomerId(c.id)}
                  placeholder="Search Customer..."
                  value={selectedCustomer?.name}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Against Original Invoice (Return)</label>
                <select
                  value={originalInvoiceId}
                  onChange={e => handleSelectOriginalInvoice(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none"
                >
                  <option value="">-- Select Invoice --</option>
                  {originalInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_no} — {inv.date} — ₹{inv.grand_total}
                    </option>
                  ))}
                </select>
                {originalInvoiceId && (
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800">
                      ↩️ Return against {originalInvoices.find(i => i.id === originalInvoiceId)?.invoice_no}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-slate-200 overflow-hidden shadow-sm dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 p-4">
              <div className="grid gap-3 lg:grid-cols-12 items-end">
                <div className="lg:col-span-4 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Product</label>
                  <SearchableDropdown
                    table="products"
                    searchFields={['name', 'part_no', 'hsn_code']}
                    displayField="name"
                    helperFields={['part_no', 'mrp']}
                    onSelect={(p) => setSelectedProductId(p.id)}
                    placeholder="Search Product..."
                    value={selectedProduct?.name}
                  />
                </div>
                <div className="lg:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center block">Qty</label>
                  <input type="number" value={qtyInput} onChange={e => setQtyInput(e.target.value === '' ? '' : Number(e.target.value))} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none text-center" />
                </div>
                <div className="lg:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center block">Disc %</label>
                  <input type="number" value={discPercentInput} onChange={e => { setDiscPercentInput(e.target.value === '' ? '' : Number(e.target.value)); setIsDiscManual(true); }} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none text-center" />
                </div>
                <div className="lg:col-span-4">
                  <button onClick={addLine} className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800 flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Add Item
                  </button>
                </div>
              </div>
            </div>

            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-3 py-3 text-center">Qty</th>
                  <th className="px-3 py-3 text-right">Rate</th>
                  <th className="px-3 py-3 text-right">Disc%</th>
                  <th className="px-3 py-3 text-right">Taxable</th>
                  <th className="px-3 py-3 text-right">GST</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{l.productName}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">{l.partNo}</span>
                        {(l as any).ruleName && (
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${(l as any).badgeColor}`}>
                            {(l as any).ruleName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center font-black text-indigo-600">{l.qty}</td>
                    <td className="px-3 py-3 text-right">₹{l.effectivePrice.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-rose-500">{l.discountPercent}%</td>
                    <td className="px-3 py-3 text-right font-bold">₹{l.basicAmount.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-xs">₹{l.gstAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-black text-slate-900">₹{l.lineTotal.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => removeLine(i)} className="text-slate-300 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="glass-card rounded-3xl border border-green-100 p-6 shadow-xl bg-[#14532d] text-white">
            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2 border-b border-white/10 pb-4 mb-6">
              <Calculator className="w-5 h-5 text-green-400" /> Return Totals
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold text-green-300 uppercase tracking-widest">
                <span>Taxable Amount</span>
                <span>₹{totals.taxableAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>CGST / SGST</span>
                <span>₹{totals.goodsGst.toFixed(2)}</span>
              </div>
              <div className="pt-6 mt-6 border-t border-white/20">
                <p className="text-[10px] font-black text-green-300 uppercase tracking-widest mb-1">Total Refund Amount</p>
                <div className="text-4xl font-black text-green-400 tracking-tighter">
                  ₹{totals.billTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <button 
                disabled={isSaving || lines.length === 0}
                onClick={saveCreditNote}
                className="w-full rounded-3xl bg-green-500 px-5 py-4 text-sm font-black text-white hover:bg-green-400 mt-4 flex items-center justify-center gap-3"
              >
                {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {isSaving ? 'SAVING...' : 'SAVE CREDIT NOTE'}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
