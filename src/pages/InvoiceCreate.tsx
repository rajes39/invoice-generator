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
import { supabase, getItem } from '../lib/supabase';
import { SearchableDropdown } from '../components/SearchableDropdown';
import { 
  calculateBasicRate, 
  calculateGstAmount, 
  createInvoice, 
  numberToWords,
  getFinancialYear 
} from '../services/invoiceService';
import type { Product, Customer, InvoiceItem, Invoice, PricingRule, CompanySettings } from '../types';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
}

export default function InvoiceCreate() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  // -- Form State --
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qtyInput, setQtyInput] = useState<number | ''>(1);
  const [discPercentInput, setDiscPercentInput] = useState<number | ''>(0);
  
  const [lines, setLines] = useState<Omit<InvoiceItem, 'id' | 'invoiceId' | 'createdAt'>[]>([]);
  const [status, setStatus] = useState<'Draft' | 'Active'>('Active');
  
  // -- Meta Info --
  const [irnNo, setIrnNo] = useState('');
  const [ackNo, setAckNo] = useState('');
  const [ackDate, setAckDate] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [remark, setRemark] = useState('');
  const [freightCharges, setFreightCharges] = useState<number>(0);
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
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
  const { data: company } = useQuery<CompanySettings>({
    queryKey: ['company_settings'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null as any;
      const { data } = await supabase.from('company_settings').select('*').eq('user_id', session.user.id).maybeSingle();
      return data;
    },
  });

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
    } else {
      setDiscPercentInput(0);
    }
  }, [selectedProduct, selectedCustomerId, qtyInput, rules, schemes]);

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
      (r.target === product.id || r.target === product.partNo || r.target === (product as any).sku)
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

    // 5. Category Discount
    const catDiscRule = customerRules.find(r => 
      r.type === 'CATEGORY_DISCOUNT' && 
      r.target?.toLowerCase().trim() === (product.category || (product as any).data?.category || '')?.toLowerCase().trim()
    );
    if (catDiscRule) {
      const disc = Number(catDiscRule.value);
      const rate = mrp * (1 - disc / 100);
      return { 
        effectivePrice: rate, 
        discPercent: disc, 
        isNet: false, 
        ruleName: `🏷️ Category Disc: ${disc}%`,
        badgeColor: 'bg-purple-50 text-purple-600 border-purple-100'
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
    if (!selectedProduct || !selectedCustomerId || !qtyInput || qtyInput <= 0) {
      if (!selectedCustomerId) toast.error('Select a customer first');
      return;
    }
    
    const qty = Number(qtyInput);
    const pricing = getEffectivePricing(selectedProduct, selectedCustomerId, qty);
    
    // If user manually changed discPercentInput, use that, otherwise use auto-calculated
    const discP = (discPercentInput !== '' && discPercentInput !== 0) ? discPercentInput : pricing.discPercent;
    
    const mrp = Number(selectedProduct.mrp || 0);
    const gstRate = Number(selectedProduct.gstRate || 0);
    
    // -- Calculation Engine --
    // If manual discount is provided, recalculate rate from MRP
    const effectiveRate = (discPercentInput !== '' && discPercentInput !== 0) 
      ? (mrp * (1 - discP / 100)) 
      : pricing.effectivePrice;

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
      ruleName: pricing.ruleName,
      badgeColor: pricing.badgeColor
    };

    setLines([...lines, newLine]);
    setSelectedProductId('');
    setQtyInput(1);
    setDiscPercentInput(0);
    toast.success('Item added to invoice');
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  // -- Computations --
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
      igst: 0,
      roundOff,
      billTotal: finalTotal
    };
  }, [lines, freightCharges]);

  const hsnSummary = useMemo(() => {
    const summary: Record<string, any> = {};
    lines.forEach(l => {
      const hsn = l.hsnCode || 'N/A';
      if (!summary[hsn]) summary[hsn] = { hsn, taxable: 0, qty: 0, cgst: 0, sgst: 0, rate: l.gstRate };
      summary[hsn].taxable += l.basicAmount;
      summary[hsn].qty += l.qty;
      summary[hsn].cgst += l.gstAmount / 2;
      summary[hsn].sgst += l.gstAmount / 2;
    });
    
    // Add Freight to HSN Summary (assuming HSN 9965 for freight)
    if (freightCharges > 0) {
      const fHsn = '9965';
      if (!summary[fHsn]) summary[fHsn] = { hsn: fHsn, taxable: 0, qty: 1, cgst: 0, sgst: 0, rate: 18 };
      summary[fHsn].taxable += Number(freightCharges);
      summary[fHsn].cgst += (Number(freightCharges) * 0.18) / 2;
      summary[fHsn].sgst += (Number(freightCharges) * 0.18) / 2;
    }
    
    return Object.values(summary);
  }, [lines, freightCharges]);

  const taxSummary = useMemo(() => {
    const summary: Record<number, any> = {};
    lines.forEach(l => {
      const rate = l.gstRate || 0;
      if (!summary[rate]) summary[rate] = { rate, taxable: 0, qty: 0, cgst: 0, sgst: 0 };
      summary[rate].taxable += l.basicAmount;
      summary[rate].qty += l.qty;
      summary[rate].cgst += l.gstAmount / 2;
      summary[rate].sgst += l.gstAmount / 2;
    });
    
    if (freightCharges > 0) {
      const rate = 18;
      if (!summary[rate]) summary[rate] = { rate, taxable: 0, qty: 0, cgst: 0, sgst: 0 };
      summary[rate].taxable += Number(freightCharges);
      summary[rate].cgst += (Number(freightCharges) * 0.18) / 2;
      summary[rate].sgst += (Number(freightCharges) * 0.18) / 2;
    }
    
    return Object.values(summary).sort((a, b) => a.rate - b.rate);
  }, [lines, freightCharges]);

  const saveInvoice = async () => {
    if (!selectedCustomer || lines.length === 0 || isSaving) return;
    
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Unauthorized');

      const invoice: Omit<Invoice, 'id' | 'createdAt'> = {
        userId: session.user.id,
        invoiceNumber: 'AUTO',
        irnNo,
        ackNo,
        ackDate,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerGstin: selectedCustomer.gstin || 'URD',
        customerPan: selectedCustomer.pan || '',
        customerAadhar: selectedCustomer.aadhar || '',
        customerPhone: selectedCustomer.mobile || '',
        customerEmail: selectedCustomer.email || '',
        customerAddress: selectedCustomer.address || '',
        customerCity: selectedCustomer.city || '',
        customerState: selectedCustomer.state || '',
        customerStateCode: selectedCustomer.stateCode || '',
        deliveryAddress: deliveryAddress,
        date: invoiceDate,
        dueDate,
        orderNo,
        remark,
        subtotalMrp: totals.totalMrp,
        totalDiscountAmount: totals.totalDiscount,
        subtotalBasic: totals.taxableAmount,
        totalCgst: totals.cgst,
        totalSgst: totals.sgst,
        totalIgst: totals.igst,
        freightCharges: totals.freightCharges,
        freightGst: totals.freightGst,
        roundOff: totals.roundOff,
        grandTotal: totals.billTotal,
        isInterstate: false,
        status,
        items: lines as InvoiceItem[],
      };

      console.log('Final Invoice Object to be saved:', invoice);
      console.log('Invoice Object Columns:', Object.keys(invoice));

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
    <div className="space-y-6 pb-20">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 uppercase tracking-tight">SONALI ERP - Professional Tax Invoice</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Create GST-compliant bills with e-invoice fields and detailed tax summaries.</p>
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
          
          {/* Section 1: Parties & Meta */}
          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                  <Calculator className="w-3 h-3" /> Invoice Dates
                </label>
                <input type="datetime-local" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-bold text-slate-400">DUE BY:</span>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="flex-1 bg-transparent border-none text-[10px] font-bold text-indigo-600 outline-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Buyer Selection
                </label>
                <SearchableDropdown
                  table="customers"
                  searchFields={['name', 'gstin', 'mobile']}
                  displayField="name"
                  helperFields={['gstin', 'mobile']}
                  onSelect={(c) => setSelectedCustomerId(c.id)}
                  placeholder="Search Customer by Name, GSTIN or Mobile..."
                  value={selectedCustomer?.name}
                />
                {selectedCustomer && (
                  <div className="text-[10px] font-bold text-slate-400 truncate px-1">
                    GSTIN: {selectedCustomer.gstin || 'N/A'} | PAN: {selectedCustomer.pan || 'N/A'}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Delivery Logic
                </label>
                <div className="flex items-center gap-3 h-9">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={useSeparateDelivery} onChange={e => setUseSeparateDelivery(e.target.checked)} className="rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900">Ship to different address?</span>
                  </label>
                </div>
                {useSeparateDelivery && (
                  <input placeholder="Type Delivery Address..." value={deliveryAddress.address} onChange={e => setDeliveryAddress({...deliveryAddress, address: e.target.value})} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs outline-none shadow-sm" />
                )}
              </div>
            </div>
          </div>

          {/* Section 2: E-Invoice & Order Details */}
          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
             <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">IRN Number</span>
                  <input value={irnNo} onChange={e => setIrnNo(e.target.value)} placeholder="E-invoice Hash" className="w-full border-b border-slate-200 py-1 text-xs outline-none bg-transparent" />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Ack No & Date</span>
                  <div className="flex gap-1">
                    <input value={ackNo} onChange={e => setAckNo(e.target.value)} placeholder="No" className="w-1/2 border-b border-slate-200 py-1 text-xs outline-none bg-transparent" />
                    <input value={ackDate} onChange={e => setAckDate(e.target.value)} placeholder="Date" className="w-1/2 border-b border-slate-200 py-1 text-xs outline-none bg-transparent" />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Purchase Order No</span>
                  <input value={orderNo} onChange={e => setOrderNo(e.target.value)} placeholder="PO-123" className="w-full border-b border-slate-200 py-1 text-xs outline-none bg-transparent" />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Notes/Remark</span>
                  <input value={remark} onChange={e => setRemark(e.target.value)} placeholder="Transport/Vehicle/Info" className="w-full border-b border-slate-200 py-1 text-xs outline-none bg-transparent" />
                </div>
             </div>
          </div>

          {/* Section 3: Item Table */}
          <div className="glass-card rounded-3xl border border-slate-200 overflow-hidden shadow-sm dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 p-4 dark:border-slate-800">
              <div className="grid gap-3 lg:grid-cols-12 items-end">
                <div className="lg:col-span-4 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Trade Product</label>
                  <SearchableDropdown
                    table="products"
                    searchFields={['name', 'part_no', 'hsn_code']}
                    displayField="name"
                    helperFields={['part_no', 'mrp']}
                    onSelect={(p) => setSelectedProductId(p.id)}
                    placeholder="Search Product by Name, Part No or HSN..."
                    value={selectedProduct?.name}
                  />
                </div>
                <div className="lg:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center block">Quantity</label>
                  <input type="number" min="1" value={qtyInput} onChange={e => setQtyInput(e.target.value === '' ? '' : Number(e.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none text-center shadow-sm" />
                </div>
                <div className="lg:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center block">Disc %</label>
                  <input type="number" step="0.01" value={discPercentInput} onChange={e => setDiscPercentInput(e.target.value === '' ? '' : Number(e.target.value))} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none text-center shadow-sm" />
                </div>
                <div className="lg:col-span-4">
                  <button onClick={addLine} className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 shadow-md flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Add Line Entry
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Sr</th>
                    <th className="px-3 py-3">Description / Part No</th>
                    <th className="px-3 py-3 text-center">HSN</th>
                    <th className="px-3 py-3 text-right">MRP</th>
                    <th className="px-3 py-3 text-right">Rate</th>
                    <th className="px-3 py-3 text-center">Qty</th>
                    <th className="px-3 py-3 text-right">Disc%</th>
                    <th className="px-3 py-3 text-right">Taxable</th>
                    <th className="px-3 py-3 text-center">GST%</th>
                    <th className="px-3 py-3 text-right">GST Tax</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-center">X</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-12 text-center text-slate-400 font-medium italic">
                        Empty Invoice. Please select products above to begin billing.
                      </td>
                    </tr>
                  ) : (
                    lines.map((l, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="px-4 py-3 text-[10px] font-bold text-slate-400">{i + 1}</td>
                        <td className="px-3 py-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{l.productName}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium text-slate-400">{l.partNo}</span>
                            {(l as any).ruleName && (
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${(l as any).badgeColor || 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800'}`}>
                                {(l as any).ruleName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center font-mono text-xs">{l.hsnCode}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs">₹{l.mrpPerUnit.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right font-bold text-slate-900 dark:text-slate-100">₹{l.effectivePrice.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center font-black text-indigo-600">{l.qty}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-rose-500">{l.discountPercent}%</td>
                        <td className="px-3 py-3 text-right font-bold">₹{l.basicAmount.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center font-bold text-slate-400">{l.gstRate}%</td>
                        <td className="px-3 py-3 text-right font-mono text-xs">₹{l.gstAmount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-slate-50">₹{l.lineTotal.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => removeLine(i)} className="text-slate-300 hover:text-rose-600 transition-colors">
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

          {/* Section 4: Compliance Summaries */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
              <h3 className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-indigo-500" /> HSN Summary Record
              </h3>
              <table className="w-full text-[10px]">
                <thead className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="text-left py-2">HSN</th>
                    <th className="text-right py-2">Taxable Value</th>
                    <th className="text-right py-2">CGST</th>
                    <th className="text-right py-2">SGST</th>
                  </tr>
                </thead>
                <tbody>
                  {hsnSummary.map((s: any) => (
                    <tr key={s.hsn} className="border-b border-slate-50 dark:border-slate-800/50">
                      <td className="py-2 font-bold">{s.hsn}</td>
                      <td className="py-2 text-right">₹{s.taxable.toFixed(2)}</td>
                      <td className="py-2 text-right">₹{s.cgst.toFixed(2)}</td>
                      <td className="py-2 text-right">₹{s.sgst.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800">
              <h3 className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-indigo-500" /> Tax Rate Analytics
              </h3>
              <table className="w-full text-[10px]">
                <thead className="text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="text-left py-2">GST Rate</th>
                    <th className="text-right py-2">Taxable Value</th>
                    <th className="text-right py-2">Tax Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {taxSummary.map((s: any) => (
                    <tr key={s.rate} className="border-b border-slate-50 dark:border-slate-800/50">
                      <td className="py-2 font-bold">{s.rate}%</td>
                      <td className="py-2 text-right">₹{s.taxable.toFixed(2)}</td>
                      <td className="py-2 text-right">₹{(s.cgst + s.sgst).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Sidebar: Totals & Summary */}
        <aside className="space-y-6">
          <div className="glass-card rounded-3xl border border-green-100 p-6 shadow-xl dark:border-green-900/30 sticky top-6 bg-[#14532d] text-white">
            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2 border-b border-white/10 pb-4 mb-6">
              <Calculator className="w-5 h-5 text-green-400" /> Billing Totals
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1 mb-4">
                <label className="text-[10px] font-black text-green-300 uppercase tracking-widest">Freight Charges (₹)</label>
                <input 
                  type="number" 
                  value={freightCharges} 
                  onChange={e => setFreightCharges(Number(e.target.value))} 
                  className="w-full rounded-2xl bg-white/10 border border-white/20 px-4 py-2 text-sm font-bold outline-none focus:bg-white/20 transition"
                  placeholder="0.00"
                />
                <p className="text-[9px] text-green-400 font-bold italic">+ 18% GST will be applied automatically</p>
              </div>

              <div className="flex justify-between text-xs font-bold text-green-300 uppercase tracking-widest">
                <span>Total MRP Value</span>
                <span className="font-mono">₹{totals.totalMrp.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-rose-400 uppercase tracking-widest">
                <span>Total Trade Discount</span>
                <span className="font-mono">-₹{totals.totalDiscount.toFixed(2)}</span>
              </div>
              <div className="h-px bg-white/10 my-2" />
              <div className="flex justify-between text-sm font-black text-green-400">
                <span>Taxable Base Amt</span>
                <span className="font-mono font-black">₹{totals.taxableAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>CGST (Input)</span>
                <span className="font-mono">₹{totals.cgst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>SGST (Input)</span>
                <span className="font-mono">₹{totals.sgst.toFixed(2)}</span>
              </div>
              {totals.roundOff !== 0 && (
                <div className="flex justify-between text-[10px] font-bold text-slate-500 italic">
                  <span>Round Off Adjust</span>
                  <span className="font-mono">{totals.roundOff > 0 ? '+' : ''}{totals.roundOff.toFixed(2)}</span>
                </div>
              )}
              
              <div className="pt-6 mt-6 border-t border-white/20">
                <p className="text-[10px] font-black text-green-300 uppercase tracking-widest mb-1">Total Bill Amount Payable</p>
                <div className="text-4xl font-black text-green-400 tracking-tighter">
                  ₹{totals.billTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[9px] font-black text-green-400 uppercase tracking-widest mb-1">Amount in words</p>
                  <p className="text-[10px] font-bold leading-relaxed text-slate-200 italic">{numberToWords(totals.billTotal)}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <label className="block text-[10px] font-black text-green-300 uppercase tracking-widest mb-1">Invoice State Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full rounded-2xl bg-white/10 border border-white/20 px-4 py-3 text-sm font-bold outline-none focus:bg-white/20 transition cursor-pointer">
                <option value="Active" className="bg-green-900">Final (Active)</option>
                <option value="Draft" className="bg-green-900">Draft (Temporary)</option>
              </select>

              <button 
                disabled={isSaving || lines.length === 0}
                onClick={saveInvoice}
                className="w-full rounded-3xl bg-green-500 px-5 py-4 text-sm font-black text-white transition hover:bg-green-400 disabled:opacity-50 shadow-2xl active:scale-95 flex items-center justify-center gap-3 mt-4"
              >
                {isSaving ? <Loader className="w-5 h-5 animate-spin" /> : <span>💳</span>}
                {isSaving ? 'GENERATING...' : 'FINALIZE & SAVE'}
              </button>
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
             <h4 className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 mb-3">
                <Info className="w-3.5 h-3.5 text-indigo-500" /> System Information
             </h4>
             <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
               This invoice follows the GST sequence pattern defined in your settings. 
               The current financial year is <span className="font-bold text-slate-900 dark:text-slate-100">{getFinancialYear(new Date())}</span>. 
               Stock will be automatically deducted from the master ledger upon saving.
             </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
