import { useEffect, useMemo, useRef, useState } from 'react';
import { Product } from '../types';
import { Camera, CameraOff, QrCode, Save, Trash2, ScanSearch } from 'lucide-react';

interface ScanAndInvoiceTabProps {
  products: Product[];
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  setActiveTab: (tab: string) => void;
}

interface ScannedLineItem {
  id: string;
  rawBarcode: string;
  productId: string;
  productName: string;
  brand: string;
  partNumber: string;
  hsnCode: string;
  sellingPrice: number;
  gstRate: number;
  quantity: number;
  lineTotal: number;
}

export function ScanAndInvoiceTab({ products, showToast, setActiveTab }: ScanAndInvoiceTabProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scannedItems, setScannedItems] = useState<ScannedLineItem[]>([]);

  const parsedBarcode = useMemo(() => {
    if (!manualBarcode.trim()) return null;
    return parseBarcode(manualBarcode.trim());
  }, [manualBarcode]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = () => {
    if (!(window as Window & { Quagga?: any }).Quagga) return;
    try {
      (window as Window & { Quagga?: any }).Quagga?.stop();
    } catch (err) {
      console.error('Unable to stop Quagga', err);
    }
    setIsScanning(false);
  };

  const startScanner = () => {
    if (isScanning) return;

    const QuaggaLib = (window as Window & { Quagga?: any }).Quagga;
    if (!QuaggaLib || !videoRef.current) {
      setScanError('Camera scanner library is not available.');
      showToast('Barcode scanning library unavailable', 'error');
      return;
    }

    setScanError('');
    QuaggaLib.init({
      inputStream: {
        type: 'LiveStream',
        target: videoRef.current,
        constraints: {
          facingMode: 'environment',
        },
      },
      locator: {
        patchSize: 'medium',
        halfSample: true,
      },
      numOfWorkers: 2,
      decoder: {
        readers: ['code_128_reader', 'code_39_reader'],
      },
      locate: true,
    }, (err: unknown) => {
      if (err) {
        setScanError('Camera failed to initialize. Please allow camera permissions.');
        showToast('Camera could not be initialized', 'error');
        return;
      }

      QuaggaLib.start();
      setIsScanning(true);
    });

    QuaggaLib.onDetected((result: { codeResult: { code: string } }) => {
      const code = result.codeResult.code;
      handleBarcode(code);
    });
  };

  const handleBarcode = (barcodeValue: string) => {
    if (!barcodeValue.trim()) return;

    const parsed = parseBarcode(barcodeValue.trim());
    if (!parsed) {
      showToast('Barcode format invalid. Expected Product ID|Brand|MRP|Quantity', 'error');
      return;
    }

    const matchedProduct = products.find((product) => product.id === parsed.productId) || null;
    if (!matchedProduct) {
      showToast(`Product ${parsed.productId} not found in catalog`, 'error');
      return;
    }

    const linePrice = Number(parsed.mrp) || matchedProduct.sellingPrice;
    const quantity = Number(parsed.quantity) || 1;
    const lineAmount = (linePrice * quantity) * (1 + (matchedProduct.gstRate / 100));

    const newItem: ScannedLineItem = {
      id: `scan-${matchedProduct.id}-${Date.now()}`,
      rawBarcode: barcodeValue.trim(),
      productId: matchedProduct.id,
      productName: matchedProduct.name,
      brand: matchedProduct.brand,
      partNumber: matchedProduct.partNumber,
      hsnCode: matchedProduct.hsnCode,
      sellingPrice: linePrice,
      gstRate: matchedProduct.gstRate,
      quantity,
      lineTotal: lineAmount,
    };

    setScannedItems((prev) => [newItem, ...prev]);
    setManualBarcode('');
    showToast(`Scanned ${matchedProduct.name} x${quantity}`, 'success');
  };

  const handleManualEntry = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleBarcode(manualBarcode);
  };

  const addToInvoiceBuilder = () => {
    if (scannedItems.length === 0) {
      showToast('Scan at least one barcode first', 'info');
      return;
    }

    const pendingLines = scannedItems.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      partNumber: item.partNumber,
      hsnCode: item.hsnCode,
      sellingPrice: item.sellingPrice,
      gstRate: item.gstRate,
      quantity: item.quantity,
      discountPercent: 0,
    }));

    localStorage.setItem('invoice_scan_pending_items', JSON.stringify(pendingLines));
    showToast(`Queued ${scannedItems.length} scanned items into the invoice builder`, 'success');
    setActiveTab('New Invoice');
  };

  const clearScans = () => {
    setScannedItems([]);
    stopScanner();
    showToast('Cleared scanned barcode queue', 'info');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Scan & Invoice
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Use camera scanning or paste a barcode value to queue products directly into the invoice builder.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            <ScanSearch className="w-4 h-4 text-indigo-500" />
            Barcode Scanner
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-950">
            <video ref={videoRef} className="w-full h-64 object-cover bg-black" style={{ display: isScanning ? 'block' : 'none' }} />
            {!isScanning && (
              <div className="flex h-64 items-center justify-center bg-slate-950 text-slate-300 text-sm">
                Camera preview will appear here once scanning starts.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startScanner}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer"
            >
              <Camera className="w-4 h-4 inline-block mr-1" />
              Start Camera
            </button>
            <button
              type="button"
              onClick={stopScanner}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold cursor-pointer"
            >
              <CameraOff className="w-4 h-4 inline-block mr-1" />
              Stop Camera
            </button>
          </div>

          <form onSubmit={handleManualEntry} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Type or Paste Barcode Value
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="Product ID|Brand|MRP|Quantity"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold cursor-pointer"
              >
                Add
              </button>
            </div>
          </form>

          {scanError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-3 text-xs text-rose-700 dark:text-rose-300">
              {scanError}
            </div>
          )}

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Expected barcode content</div>
            <div className="font-mono text-[10px] break-all">
              Product ID|Brand|MRP|Quantity
            </div>
            <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
              Example: prod-1|Logitech|8999.00|1
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Scanned Items Queue</h2>
              <p className="text-xs text-slate-500 mt-0.5">Each recognized barcode is staged for the new invoice screen.</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase">
              {scannedItems.length} items
            </span>
          </div>

          {scannedItems.length === 0 ? (
            <div className="border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No scans yet. Start the camera or paste a barcode and it will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950">
                  <tr>
                    <th className="px-3 py-2 text-slate-500 uppercase tracking-wider">Product</th>
                    <th className="px-3 py-2 text-slate-500 uppercase tracking-wider">Qty</th>
                    <th className="px-3 py-2 text-slate-500 uppercase tracking-wider">Price</th>
                    <th className="px-3 py-2 text-slate-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {scannedItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{item.productName}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">{item.rawBarcode}</div>
                      </td>
                      <td className="px-3 py-2 font-mono">{item.quantity}</td>
                      <td className="px-3 py-2 font-mono">₹{item.sellingPrice.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setScannedItems((prev) => prev.filter((entry) => entry.id !== item.id))}
                          className="p-1 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addToInvoiceBuilder}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold cursor-pointer"
            >
              <Save className="w-4 h-4 inline-block mr-1" />
              Add to New Invoice
            </button>
            <button
              type="button"
              onClick={clearScans}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold cursor-pointer"
            >
              Clear
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function parseBarcode(value: string): { productId: string; brand: string; mrp: number; quantity: number } | null {
  const pieces = value.split('|').map((part) => part.trim()).filter(Boolean);
  if (pieces.length < 4) return null;

  const [productId, brand, mrpRaw, quantityRaw] = pieces;
  const mrp = Number(mrpRaw);
  const quantity = Number(quantityRaw);

  if (!productId || Number.isNaN(mrp) || Number.isNaN(quantity)) return null;

  return { productId, brand, mrp, quantity };
}
