import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { 
  Search, 
  Printer, 
  Download, 
  Loader, 
  Plus, 
  Minus,
  CheckSquare,
  Square,
  Settings2,
  Tags
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import type { Product, CompanySettings } from '../types';

interface LabelConfig {
  size: 'Small' | 'Medium' | 'Large';
  copies: number;
}

export default function ProductLabels() {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [config, setConfig] = useState<LabelConfig>({
    size: 'Medium',
    copies: 1
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products_labels'],
    queryFn: async () => {
      const { data } = await supabase.from('products').select('*').order('name');
      return data ?? [];
    },
  });

  const { data: company } = useQuery<CompanySettings>({
    queryKey: ['company_settings_global'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('company_settings').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
  });

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      (p.part_no || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => p.id));
    }
  };

  const selectedProducts = products.filter(p => selectedIds.includes(p.id));

  const handlePrint = () => {
    if (selectedProducts.length === 0) {
      toast.error('Select at least one product');
      return;
    }
    window.print();
  };

  const downloadPDF = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Select at least one product');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('Generating Label PDF...');

    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const margin = 10;
      let x = margin;
      let y = margin;
      
      const sizes = {
        Small: { w: 40, h: 40, cols: 4 },
        Medium: { w: 60, h: 60, cols: 3 },
        Large: { w: 90, h: 90, cols: 2 }
      };
      
      const { w, h, cols } = sizes[config.size];
      const gap = 5;

      const compName = company?.company_name || 'SONALI ERP';

      for (const product of selectedProducts) {
        for (let i = 0; i < config.copies; i++) {
          if (y + h > 280) {
            doc.addPage();
            y = margin;
            x = margin;
          }

          // Draw Label Border
          doc.setDrawColor(200);
          doc.rect(x, y, w, h);

          // Content
          doc.setFontSize(config.size === 'Small' ? 8 : 10);
          doc.setFont('helvetica', 'bold');
          doc.text(compName.toUpperCase(), x + w / 2, y + 5, { align: 'center' });
          
          doc.setLineWidth(0.1);
          doc.line(x + 2, y + 7, x + w - 2, y + 7);

          doc.setFontSize(config.size === 'Small' ? 7 : 9);
          doc.text(product.name.substring(0, 30), x + 2, y + 12);
          
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(config.size === 'Small' ? 6 : 8);
          doc.text(`Part No: ${product.part_no || product.sku || 'N/A'}`, x + 2, y + 17);
          doc.text(`HSN: ${product.hsn_code || 'N/A'}`, x + 2, y + 21);
          
          doc.setFont('helvetica', 'bold');
          doc.text(`MRP: ₹${(product.mrp || 0).toFixed(2)}`, x + 2, y + 26);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(config.size === 'Small' ? 5 : 6);
          doc.text(`(Incl. of all taxes)`, x + 2, y + 29);

          // QR Code
          const qrData = product.part_no || product.sku || product.id;
          const qrDataUrl = await QRCode.toDataURL(qrData, { margin: 1, width: 100 });
          const qrSize = config.size === 'Small' ? 12 : 20;
          doc.addImage(qrDataUrl, 'PNG', x + (w - qrSize) / 2, y + h - qrSize - 8, qrSize, qrSize);
          
          doc.setFontSize(5);
          doc.text(qrData, x + w / 2, y + h - 4, { align: 'center' });

          // Next position
          x += w + gap;
          if (x + w > 200) {
            x = margin;
            y += h + gap;
          }
        }
      }

      doc.save('Product_Labels.pdf');
      toast.success('Labels Downloaded', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF', { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #labels-print-area, #labels-print-area * { visibility: visible; }
          #labels-print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            padding: 0;
            margin: 0;
          }
          .no-print { display: none !important; }
          .label-grid {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(var(--label-w), 1fr)) !important;
            gap: 10px !important;
          }
        }
      `}</style>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between no-print">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
            <Tags className="w-8 h-8 text-indigo-600" />
            Product Label Generator
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Generate professional QR-coded labels for your inventory.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={downloadPDF}
            disabled={isGenerating || selectedIds.length === 0}
            className="rounded-3xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {isGenerating ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-rose-600" />}
            Download PDF
          </button>
          <button 
            onClick={handlePrint}
            disabled={selectedIds.length === 0}
            className="rounded-3xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 flex items-center gap-2 shadow-lg disabled:opacity-50"
          >
            <Printer className="w-4 h-4" /> Print Labels
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* Config Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-indigo-500" />
              Configuration
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Label Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Small', 'Medium', 'Large'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setConfig({ ...config, size: s })}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${config.size === s ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Copies Per Product</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setConfig({ ...config, copies: Math.max(1, config.copies - 1) })} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200"><Minus className="w-4 h-4" /></button>
                  <span className="text-lg font-black">{config.copies}</span>
                  <button onClick={() => setConfig({ ...config, copies: config.copies + 1 })} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-slate-200 p-6 shadow-sm dark:border-slate-800 bg-white dark:bg-slate-900">
             <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 mb-4">Summary</h3>
             <div className="space-y-2">
               <div className="flex justify-between text-xs font-medium">
                 <span className="text-slate-500">Selected Products:</span>
                 <span className="font-bold">{selectedIds.length}</span>
               </div>
               <div className="flex justify-between text-xs font-medium">
                 <span className="text-slate-500">Total Labels:</span>
                 <span className="font-bold">{selectedIds.length * config.copies}</span>
               </div>
             </div>
          </div>
        </div>

        {/* Product Selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name, part no, or SKU..."
                className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <button 
              onClick={toggleSelectAll}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              {selectedIds.length === filteredProducts.length ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
              Select All
            </button>
          </div>

          <div className="glass-card rounded-3xl border border-slate-200 shadow-sm dark:border-slate-800 overflow-hidden max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 sticky top-0">
                <tr>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-4 py-3">Product Name</th>
                  <th className="px-4 py-3 text-center">Part No</th>
                  <th className="px-4 py-3 text-right">MRP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={4} className="p-10 text-center"><Loader className="w-6 h-6 animate-spin mx-auto text-indigo-600" /></td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan={4} className="p-10 text-center text-slate-400 italic">No products found</td></tr>
                ) : (
                  filteredProducts.map(p => (
                    <tr 
                      key={p.id} 
                      onClick={() => toggleSelect(p.id)}
                      className={`cursor-pointer hover:bg-indigo-50/30 transition-colors ${selectedIds.includes(p.id) ? 'bg-indigo-50/50' : ''}`}
                    >
                      <td className="px-4 py-4">
                        {selectedIds.includes(p.id) ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-700">{p.name}</td>
                      <td className="px-4 py-4 text-center font-mono text-xs">{p.part_no || p.sku || '-'}</td>
                      <td className="px-4 py-4 text-right font-black">₹{(p.mrp || 0).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Print Area */}
      <div id="labels-print-area" className="hidden print:block">
        <div 
          className="label-grid"
          style={{ 
            '--label-w': config.size === 'Small' ? '40mm' : config.size === 'Medium' ? '60mm' : '90mm' 
          } as any}
        >
          {selectedProducts.map(product => 
            Array.from({ length: config.copies }).map((_, i) => (
              <LabelItem 
                key={`${product.id}-${i}`} 
                product={product} 
                companyName={company?.company_name || 'SONALI ERP'} 
                size={config.size}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LabelItem({ product, companyName, size }: { product: Product; companyName: string; size: 'Small' | 'Medium' | 'Large' }) {
  const [qr, setQr] = useState('');
  const qrData = product.part_no || product.sku || product.id;

  useMemo(async () => {
    const data = await QRCode.toDataURL(qrData, { 
      margin: 1, 
      width: size === 'Small' ? 80 : size === 'Medium' ? 120 : 200,
      color: { dark: '#000000', light: '#ffffff' }
    });
    setQr(data);
  }, [qrData, size]);

  const sizes = {
    Small: 'w-[40mm] h-[40mm] p-2',
    Medium: 'w-[60mm] h-[60mm] p-4',
    Large: 'w-[90mm] h-[90mm] p-6'
  };

  return (
    <div className={`border border-black bg-white flex flex-col items-center justify-between overflow-hidden text-black ${sizes[size]}`}>
      <div className="w-full text-center">
        <h1 className="font-black uppercase truncate text-[10pt] leading-none mb-1">{companyName}</h1>
        <hr className="border-black mb-2" />
      </div>
      
      <div className="w-full space-y-1 text-left">
        <p className="font-black text-[9pt] leading-tight line-clamp-2 uppercase">{product.name}</p>
        <p className="text-[7pt] font-bold">Part No: <span className="font-black">{product.part_no || product.sku}</span></p>
        <p className="text-[7pt] font-bold">HSN: {product.hsn_code}</p>
        <div className="pt-1">
          <p className="text-[9pt] font-black">MRP: ₹{(product.mrp || 0).toFixed(2)}</p>
          <p className="text-[6pt] font-medium leading-none">(Incl. of all taxes)</p>
        </div>
      </div>

      <div className="flex flex-col items-center">
        {qr && <img src={qr} alt="QR" className={size === 'Small' ? 'h-14 w-14' : size === 'Medium' ? 'h-20 w-20' : 'h-32 w-32'} />}
        <p className="text-[6pt] font-black mt-1 uppercase tracking-widest">{qrData}</p>
      </div>
    </div>
  );
}
