import { useEffect, useMemo, useState } from 'react';
import { Product } from '../types';
import { Barcode, Download, Printer, PackageSearch, Sparkles } from 'lucide-react';

interface BarcodeGeneratorTabProps {
  products: Product[];
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface GeneratedBarcode {
  id: string;
  productId: string;
  productName: string;
  brand: string;
  mrp: number;
  quantity: number;
  value: string;
}

export function BarcodeGeneratorTab({ products, showToast }: BarcodeGeneratorTabProps) {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [quantity, setQuantity] = useState(5);
  const [mrp, setMrp] = useState(0);
  const [generated, setGenerated] = useState<GeneratedBarcode[]>([]);

  const selectedProduct = useMemo(() => {
    return products.find((product) => product.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  useEffect(() => {
    if (!selectedProduct) {
      setMrp(0);
      return;
    }

    setMrp(selectedProduct.sellingPrice);
  }, [selectedProduct]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return products.slice(0, 20);

    return products.filter((product) => {
      return [
        product.name,
        product.partNumber,
        product.brand,
        product.hsnCode,
      ].some((field) => field.toLowerCase().includes(query));
    }).slice(0, 20);
  }, [products, searchQuery]);

  useEffect(() => {
    if (!generated.length) return;

    const barcodeInstance = (window as Window & { JsBarcode?: any }).JsBarcode;
    if (!barcodeInstance) return;

    generated.forEach((entry) => {
      const previewNode = document.querySelector(`#barcode-${entry.id}`);
      const printNode = document.querySelector(`#print-barcode-${entry.id}`);

      if (previewNode) {
        previewNode.innerHTML = '';
        try {
          barcodeInstance(`#barcode-${entry.id}`, entry.value, {
            format: 'CODE128',
            displayValue: true,
            fontSize: 11,
            width: 2,
            height: 50,
            margin: 10,
            background: '#ffffff',
            lineColor: '#111827',
            textMargin: 6,
          });
        } catch (err) {
          console.error('JsBarcode preview render failed', err);
        }
      }

      if (printNode) {
        printNode.innerHTML = '';
        try {
          barcodeInstance(`#print-barcode-${entry.id}`, entry.value, {
            format: 'CODE128',
            displayValue: true,
            fontSize: 11,
            width: 2,
            height: 50,
            margin: 10,
            background: '#ffffff',
            lineColor: '#111827',
            textMargin: 6,
          });
        } catch (err) {
          console.error('JsBarcode print render failed', err);
        }
      }
    });
  }, [generated]);

  const handleGenerate = () => {
    if (!selectedProduct) {
      showToast('Select a product before generating barcodes', 'error');
      return;
    }

    const safeQty = Math.max(1, Math.min(200, Number(quantity) || 1));
    const safeMrp = Math.max(0, Number(mrp) || selectedProduct.sellingPrice);

    const newCodes = Array.from({ length: safeQty }, (_, index) => {
      const entryValue = `${selectedProduct.id}|${selectedProduct.brand}|${safeMrp.toFixed(2)}|${index + 1}`;
      return {
        id: `barcode-${selectedProduct.id}-${Date.now()}-${index}`,
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        brand: selectedProduct.brand,
        mrp: safeMrp,
        quantity: index + 1,
        value: entryValue,
      };
    });

    setGenerated(newCodes);
    showToast(`Generated ${safeQty} barcodes for ${selectedProduct.name}`, 'success');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    showToast('Print dialog opened. Choose Save as PDF to download the barcode sheet.', 'info');
    window.print();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Barcode Generator
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Create printable product barcodes with product metadata encoded in Code 128 format.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-5 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            <Barcode className="w-4 h-4 text-indigo-500" />
            Generate Sticker Codes
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Search Product
              </label>
              <div className="relative">
                <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by product name, part number or brand"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950">
              {filteredProducts.length === 0 ? (
                <div className="p-3 text-xs text-slate-500">No matching products found.</div>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedProductId(product.id)}
                    className={`w-full text-left p-3 transition-colors ${selectedProductId === product.id ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{product.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Part No: {product.partNumber} | Brand: {product.brand} | HSN: {product.hsnCode}</div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        ₹{product.sellingPrice}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Quantity to Print
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                MRP / Selling Price
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={mrp}
                  onChange={(e) => setMrp(Number(e.target.value))}
                  className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors cursor-pointer"
              >
                Generate Barcodes
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 inline-block mr-1" />
                Print Barcodes
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 inline-block mr-1" />
                Download as PDF
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Preview Sheet</h2>
              <p className="text-xs text-slate-500 mt-0.5">Barcodes render as SVG and are printable on A4 sticker layout.</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">
              {generated.length} generated
            </span>
          </div>

          {generated.length === 0 ? (
            <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Select a product and generate a set of barcode labels to preview them here.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:grid-cols-2">
              {generated.map((entry) => (
                <article
                  key={entry.id}
                  className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-white dark:bg-slate-950 print:break-inside-avoid"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{entry.productName}</div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">Brand: {entry.brand} | MRP: ₹{entry.mrp.toFixed(2)}</div>
                  <div className="mt-2 flex justify-center bg-white rounded-lg p-2">
                    <svg id={`barcode-${entry.id}`} className="barcode-svg" aria-label={`Barcode ${entry.value}`}></svg>
                  </div>
                  <div className="mt-2 text-[9px] font-mono text-slate-700 dark:text-slate-200 text-center break-all">
                    {entry.value}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; inset: 0; }
        }
      `}</style>

      <div className="print-area hidden print:block">
        <div className="p-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {generated.map((entry) => (
            <div key={`print-${entry.id}`} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', marginBottom: '4px' }}>{entry.productName}</div>
              <svg id={`print-barcode-${entry.id}`} className="barcode-svg" aria-label={`Barcode ${entry.value}`}></svg>
              <div style={{ fontSize: '9px', marginTop: '4px', fontFamily: 'monospace' }}>{entry.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
