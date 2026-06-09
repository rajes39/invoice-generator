import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Customer, Product, Invoice } from '../types';
import { Trash2, FileSpreadsheet, Plus, ChevronDown, Camera, CameraOff } from 'lucide-react';

interface ScanAndInvoiceTabProps {
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  onInvoiceCreate: (invoice: Invoice) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

interface ScannedLineItem {
  id: string;
  productId: string;
  productName: string;
  sellingPrice: number;
  gstRate: number;
  quantity: number;
}

export function ScanAndInvoiceTab({ products, customers, invoices, onInvoiceCreate, showToast }: ScanAndInvoiceTabProps) {
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [barcode, setBarcode] = useState('');
  const [scannedItems, setScannedItems] = useState<ScannedLineItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [hasCameraSupport, setHasCameraSupport] = useState(false);

  // Check for BarcodeDetector support
  useEffect(() => {
    setHasCameraSupport('BarcodeDetector' in window);
  }, []);

  // Auto-focus barcode input on mount and whenever it changes
  useEffect(() => {
    if (!isCameraActive) {
      barcodeInputRef.current?.focus();
    }
  }, [isCameraActive]);

  // Keep barcode input always focused
  useEffect(() => {
    const handleBlur = () => {
      if (!isCameraActive) {
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
      }
    };
    barcodeInputRef.current?.addEventListener('blur', handleBlur);
    return () => barcodeInputRef.current?.removeEventListener('blur', handleBlur);
  }, [isCameraActive]);

  // Camera Scanning Logic
  useEffect(() => {
    let stream: MediaStream | null = null;
    let intervalId: any = null;

    if (isCameraActive && videoRef.current) {
      const startCamera = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
          });
          videoRef.current!.srcObject = stream;
          
          // Start detection loop
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['code_128', 'ean_13', 'qr_code']
          });

          intervalId = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const detectedValue = barcodes[0].rawValue;
                  processBarcode(detectedValue);
                  // Brief pause to prevent multiple scans
                  setIsCameraActive(false);
                  setTimeout(() => setIsCameraActive(true), 1500);
                }
              } catch (e) {
                console.error('Barcode detection failed:', e);
              }
            }
          }, 500);
        } catch (err) {
          console.error('Error accessing camera:', err);
          showToast('Could not access camera', 'error');
          setIsCameraActive(false);
        }
      };

      startCamera();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (intervalId) clearInterval(intervalId);
    };
  }, [isCameraActive]);

  const processBarcode = (barcodeValue: string) => {
    if (!selectedCustomerId) {
      showToast('Please select a customer first', 'error');
      return;
    }

    const parsed = parseBarcode(barcodeValue);
    if (!parsed) {
      showToast('Invalid barcode format', 'error');
      return;
    }

    const matchedProduct = products.find((p) => 
      p.id === parsed.productId || (p as any).barcode === parsed.productId
    );

    if (!matchedProduct) {
      showToast(`Product ${parsed.productId} not found`, 'error');
      return;
    }

    setScannedItems((prev) => {
      const existing = prev.find((item) => item.productId === matchedProduct.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === matchedProduct.id
            ? { ...item, quantity: item.quantity + parsed.quantity }
            : item
        );
      } else {
        return [
          ...prev,
          {
            id: `scan-${matchedProduct.id}-${Date.now()}`,
            productId: matchedProduct.id,
            productName: matchedProduct.name,
            sellingPrice: matchedProduct.sellingPrice,
            gstRate: matchedProduct.gstRate,
            quantity: parsed.quantity,
          },
        ];
      }
    });

    showToast(`✓ ${matchedProduct.name} added`, 'success');
  };

  const handleBarcodeSubmit = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    processBarcode(barcode);
    setBarcode('');
  };

  const updateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setScannedItems((prev) => prev.filter((item) => item.productId !== productId));
      return;
    }
    setScannedItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity: newQty } : item
      )
    );
  };

  const removeItem = (productId: string) => {
    setScannedItems((prev) => prev.filter((item) => item.productId !== productId));
    barcodeInputRef.current?.focus();
  };

  const clearAll = () => {
    setScannedItems([]);
    setBarcode('');
    barcodeInputRef.current?.focus();
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let taxAmount = 0;

    scannedItems.forEach((item) => {
      const itemSubtotal = item.sellingPrice * item.quantity;
      const itemTax = itemSubtotal * (item.gstRate / 100);
      subtotal += itemSubtotal;
      taxAmount += itemTax;
    });

    return { subtotal, taxAmount, total: subtotal + taxAmount };
  };

  const generateInvoice = async () => {
    if (!selectedCustomerId) {
      showToast('Please select a customer', 'error');
      return;
    }

    if (scannedItems.length === 0) {
      showToast('Add items before generating invoice', 'error');
      return;
    }

    setIsGenerating(true);

    try {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      if (!customer) {
        showToast('Customer not found', 'error');
        return;
      }

      // Get last invoice number
      const lastInvoiceNum = invoices.length > 0
        ? Math.max(...invoices.map((inv) => parseInt(inv.invoiceNumber.split('/').pop() || '0', 10)))
        : 0;
      const nextInvoiceNum = String(lastInvoiceNum + 1).padStart(4, '0');
      const currentFY = new Date().getFullYear();
      const fy =
        new Date().getMonth() >= 3
          ? `${currentFY}-${String(currentFY + 1).slice(-2)}`
          : `${currentFY - 1}-${String(currentFY).slice(-2)}`;
      const invoiceNumber = `INV/${fy}/${nextInvoiceNum}`;

      // Build invoice items
      const items = scannedItems.map((item, idx) => {
        const subtotal = item.sellingPrice * item.quantity;
        const taxAmount = subtotal * (item.gstRate / 100);
        const totalAmount = subtotal + taxAmount;

        return {
          id: `item-${idx + 1}`,
          productId: item.productId,
          productName: item.productName,
          partNumber: products.find((p) => p.id === item.productId)?.partNumber || '',
          hsnCode: products.find((p) => p.id === item.productId)?.hsnCode || '',
          sellingPrice: item.sellingPrice,
          gstRate: item.gstRate,
          quantity: item.quantity,
          subtotal,
          taxAmount,
          totalAmount,
        };
      });

      const totals = calculateTotals();

      // Determine IGST vs CGST/SGST (simplified: all same state = CGST/SGST)
      const isSameState = true; // In real app, check customer.state
      const cgstAmount = isSameState ? totals.taxAmount / 2 : 0;
      const sgstAmount = isSameState ? totals.taxAmount / 2 : 0;
      const igstAmount = !isSameState ? totals.taxAmount : 0;

      const newInvoice: Invoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber,
        date: new Date().toISOString().split('T')[0],
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: '',
        customerMobile: customer.mobile,
        customerGstin: customer.gstin,
        customerAddress: customer.address,
        customerState: customer.state,
        items,
        discountPercent: 0,
        discountAmount: 0,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalAmount: totals.total,
        isSameState,
        status: 'Draft',
      };

      onInvoiceCreate(newInvoice);
      showToast(`Invoice ${invoiceNumber} created! Open Invoices tab to view.`, 'success');

      // Reset
      setScannedItems([]);
      setBarcode('');
      setSelectedCustomerId('');
      barcodeInputRef.current?.focus();
    } catch (error) {
      showToast('Error generating invoice', 'error');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const totals = calculateTotals();
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Scan & Invoice
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Mobile Camera • Bluetooth Scanner • Auto billing
          </p>
        </div>
        {hasCameraSupport && (
          <button
            onClick={() => setIsCameraActive(!isCameraActive)}
            className={`p-3 rounded-xl transition-all ${isCameraActive ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}
          >
            {isCameraActive ? <CameraOff className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
          </button>
        )}
      </div>

      {isCameraActive && (
        <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border-4 border-indigo-500 shadow-xl">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <div className="absolute inset-0 border-2 border-indigo-500/30 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-48 border-2 border-indigo-500 rounded-lg"></div>
          </div>
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
              Live Camera Scanning
            </span>
          </div>
        </div>
      )}

      {/* TOP SECTION: Customer & Scanner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer Selection */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            1. Select Customer
          </label>
          <div className="relative">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-3 py-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm appearance-none cursor-pointer focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Choose customer...</option>
              {customers.map((cust) => (
                <option key={cust.id} value={cust.id}>
                  {cust.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          {selectedCustomer && (
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              ✓ {selectedCustomer.name}
            </div>
          )}
        </div>

        {/* Barcode Scanner Input - Always Focused & Ready */}
        <div className="md:col-span-2 bg-white dark:bg-slate-900 border-2 border-indigo-300 dark:border-indigo-700 rounded-xl p-4 space-y-2 shadow-md">
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
            2. Scanner Input
          </label>
          <div className="relative">
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={handleBarcodeSubmit}
              placeholder={selectedCustomerId ? "🔍 Scanner Ready • Point at barcode" : "Select customer first"}
              disabled={!selectedCustomerId}
              className="w-full px-4 py-4 rounded-lg border-2 border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-slate-900 dark:text-slate-100 text-lg font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-800"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {/* MAIN SECTION: Items Queue & Invoice */}
        <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              3. Scanned Items Queue
            </h2>
            <span className="px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
              {scannedItems.length}
            </span>
          </div>

          {scannedItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
              <div className="text-center">
                <div className="text-slate-400 text-3xl mb-2">📦</div>
                <div className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                  Scan items to add to cart
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
                {scannedItems.map((item) => {
                  const itemTotal = item.sellingPrice * item.quantity;
                  const itemTax = itemTotal * (item.gstRate / 100);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-750 rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex-1 min-w-0 text-left">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                          {item.productName}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          ₹{item.sellingPrice.toFixed(0)} × {item.quantity} = ₹{itemTotal.toFixed(0)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-8 h-8 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-8 h-8 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="p-1.5 rounded text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Totals Summary */}
              <div className="space-y-3 border-t-2 border-slate-200 dark:border-slate-700 pt-4">
                <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border-2 border-emerald-200 dark:border-emerald-800">
                  <span className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Total Amount:</span>
                  <span className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{totals.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

      {/* FOOTER SECTION: Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={clearAll}
          disabled={scannedItems.length === 0}
          className="px-6 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-bold disabled:opacity-40"
        >
          🗑 Clear
        </button>
        <button
          onClick={generateInvoice}
          disabled={scannedItems.length === 0 || !selectedCustomerId || isGenerating}
          className="flex-1 px-6 py-3 rounded-lg bg-indigo-600 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isGenerating ? 'Generating...' : <><FileSpreadsheet className="w-5 h-5" /> Generate Invoice</>}
        </button>
      </div>
    </div>
  );
}

function parseBarcode(value: string): { productId: string; quantity: number } | null {
  const parts = value.trim().split('|').map((p) => p.trim());
  if (parts.length === 0 || !parts[0]) return null;

  const productId = parts[0];
  const quantity = parts.length > 1 ? parseInt(parts[1], 10) : 1;

  if (Number.isNaN(quantity) || quantity < 1) return null;

  return { productId, quantity };
}
