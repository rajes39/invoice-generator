import { useMemo, useState, useRef, Dispatch, SetStateAction, FormEvent, ChangeEvent } from 'react';
import { BusinessProfile, Product, Purchase, Supplier } from '../types';
import { Search, Calendar, Plus, Edit2, Trash2, Download, ShoppingCart, ArrowRight, Package, X, Eye, FileSpreadsheet } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface PurchasesTabProps {
  purchases: Purchase[];
  setPurchases: Dispatch<SetStateAction<Purchase[]>>;
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  suppliers: Supplier[];
  businessProfile: BusinessProfile;
  purchaseCounters: { lastNumber: number; financialYear: string };
  setPurchaseCounters: Dispatch<SetStateAction<{ lastNumber: number; financialYear: string }>>;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function PurchasesTab({
  purchases,
  setPurchases,
  products,
  setProducts,
  suppliers,
  businessProfile,
  purchaseCounters,
  setPurchaseCounters,
  showToast,
}: PurchasesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('All');

  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [rowDiscountPercent, setRowDiscountPercent] = useState<number | ''>(0);
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedSupplier, setSelectedSupplier] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);
  const [purchaseToView, setPurchaseToView] = useState<Purchase | null>(null);

  const availableSuppliers = suppliers;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const productOptions = useMemo(() => {
    return products.filter(product => {
      const term = productSearchQuery.toLowerCase();
      return (
        product.name.toLowerCase().includes(term) ||
        product.partNumber.toLowerCase().includes(term) ||
        product.brand.toLowerCase().includes(term)
      );
    }).slice(0, 12);
  }, [productSearchQuery, products]);

  const selectedProduct = products.find(product => product.id === selectedProductId) || null;

  const openAddForm = () => {
    setEditingPurchase(null);
    setSelectedSupplier('');
    setSelectedSupplierId('All');
    setSelectedProductId('');
    setProductSearchQuery('');
    setQuantity(1);
    setPurchasePrice('');
    setRowDiscountPercent(0);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setIsFormOpen(true);
  };

  const openEditForm = (purchase: Purchase) => {
    const firstItem = purchase.items[0];
    setEditingPurchase(purchase);
    setSelectedSupplier(purchase.supplierId);
    setSelectedProductId(firstItem.productId);
    setProductSearchQuery(firstItem.productName);
    setQuantity(firstItem.quantity);
    setPurchasePrice(firstItem.purchasePrice);
    setRowDiscountPercent(firstItem.rowDiscountPercent);
    setPurchaseDate(purchase.date);
    setIsFormOpen(true);
  };

  const filteredPurchases = purchases.filter(purchase => {
    const query = searchQuery.toLowerCase();
    const matchesQuery = purchase.purchaseNumber.toLowerCase().includes(query) || purchase.supplierName.toLowerCase().includes(query);
    const matchesSupplier = selectedSupplierId === 'All' || purchase.supplierId === selectedSupplierId;
    const matchesDate = purchase.date >= fromDate && purchase.date <= toDate;
    return matchesQuery && matchesSupplier && matchesDate;
  });

  const updateProductStock = (productId: string, delta: number) => {
    setProducts(prev => prev.map(product => (
      product.id === productId
        ? { ...product, currentStock: Math.max(0, product.currentStock + delta) }
        : product
    )));
  };

  const generatePurchaseNumber = () => {
    const fyStart = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const financialYear = `${fyStart}-${String(fyStart + 1).slice(-2)}`;
    const currentCounter = typeof purchaseCounters.lastNumber === 'number' ? purchaseCounters.lastNumber : 0;
    const nextNumber = currentCounter + 1;
    setPurchaseCounters({ lastNumber: nextNumber, financialYear });
    return `PUR/${financialYear}/${String(nextNumber).padStart(4, '0')}`;
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();

    if (!selectedSupplier) {
      showToast('Please select a supplier', 'error');
      return;
    }

    if (!selectedProductId || !selectedProduct) {
      showToast('Please select a product', 'error');
      return;
    }

    const qty = Number(quantity);
    const price = Number(purchasePrice);
    const discount = Number(rowDiscountPercent);

    if (!qty || qty <= 0 || Number.isNaN(qty)) {
      showToast('Quantity must be greater than zero', 'error');
      return;
    }

    if (!price || price < 0 || Number.isNaN(price)) {
      showToast('Enter a valid purchase price', 'error');
      return;
    }

    if (discount < 0 || discount > 100) {
      showToast('Row discount must be between 0 and 100', 'error');
      return;
    }

    const supplier = suppliers.find(item => item.id === selectedSupplier);
    if (!supplier) {
      showToast('Selected supplier is not available', 'error');
      return;
    }

    const subtotal = Number((price * qty).toFixed(2));
    const discountAmount = Number((subtotal * (discount / 100)).toFixed(2));
    const taxable = Number((subtotal - discountAmount).toFixed(2));
    const taxAmount = Number((taxable * (selectedProduct.gstRate / 100)).toFixed(2));
    const totalAmount = Number((taxable + taxAmount).toFixed(2));

    const isSameState = supplier.state === businessProfile.state;
    const cgstAmount = isSameState ? Number((taxAmount / 2).toFixed(2)) : 0;
    const sgstAmount = isSameState ? Number((taxAmount / 2).toFixed(2)) : 0;
    const igstAmount = isSameState ? 0 : Number(taxAmount.toFixed(2));

    const newItem = {
      id: `pur-itm-${Date.now()}`,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      partNumber: selectedProduct.partNumber,
      brand: selectedProduct.brand,
      hsnCode: selectedProduct.hsnCode,
      quantity: qty,
      purchasePrice: price,
      rowDiscountPercent: discount,
      gstRate: selectedProduct.gstRate,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
    };

    if (editingPurchase) {
      const oldItem = editingPurchase.items[0];
      if (oldItem) {
        updateProductStock(oldItem.productId, -oldItem.quantity);
      }

      const updatedPurchase: Purchase = {
        ...editingPurchase,
        date: purchaseDate,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierMobile: supplier.mobile,
        supplierGstin: supplier.gstin,
        supplierState: supplier.state,
        items: [newItem],
        subtotal,
        discountAmount,
        taxAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        grandTotal: totalAmount,
        isSameState,
      };

      setPurchases(prev => prev.map(item => item.id === editingPurchase.id ? updatedPurchase : item));
      updateProductStock(selectedProduct.id, qty);
      showToast('Purchase updated successfully', 'success');
    } else {
      const purchaseNumber = generatePurchaseNumber();
      const newPurchase: Purchase = {
        id: `purchase-${Date.now()}`,
        purchaseNumber,
        date: purchaseDate,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierMobile: supplier.mobile,
        supplierGstin: supplier.gstin,
        supplierState: supplier.state,
        items: [newItem],
        subtotal,
        discountAmount,
        taxAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        grandTotal: totalAmount,
        isSameState,
      };

      setPurchases(prev => [newPurchase, ...prev]);
      updateProductStock(selectedProduct.id, qty);
      showToast(`Purchase ${purchaseNumber} saved`, 'success');
    }

    setIsFormOpen(false);
    setEditingPurchase(null);
  };

  const handleDelete = () => {
    if (purchaseToDelete) {
      const [firstItem] = purchaseToDelete.items;
      if (firstItem) {
        updateProductStock(firstItem.productId, -firstItem.quantity);
      }
      setPurchases(prev => prev.filter(item => item.id !== purchaseToDelete.id));
      showToast('Purchase deleted and stock restored', 'info');
      setPurchaseToDelete(null);
    }
  };

  const handleExport = () => {
    const XLSX = (window as Window & { XLSX?: any }).XLSX;
    if (!XLSX) {
      showToast('SheetJS library not loaded', 'error');
      return;
    }

    const rows = filteredPurchases.map((purchase, index) => ({
      'S.No': index + 1,
      'Purchase No': purchase.purchaseNumber,
      'Date': purchase.date,
      'Supplier': purchase.supplierName,
      'Supplier GSTIN': purchase.supplierGstin,
      'Subtotal': purchase.subtotal,
      'Discount': purchase.discountAmount,
      'Tax': purchase.taxAmount,
      'Grand Total': purchase.grandTotal,
      'State': purchase.supplierState,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchases');
    XLSX.writeFile(workbook, `Purchase_Report_${fromDate}_to_${toDate}.xlsx`);
    showToast('Purchase list exported to Excel', 'success');
  };

  const downloadPurchaseTemplate = () => {
    try {
      const XLSX = (window as Window & { XLSX?: any }).XLSX;
      if (!XLSX) {
        showToast('SheetJS library not loaded', 'error');
        return;
      }

      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Supplier Name', 'Supplier Mobile', 'Purchase Date', 'Product Name', 'Product Part Number', 'Quantity', 'Purchase Price (₹)', 'Discount %', 'GST Rate (%)'],
        ['ABC Traders', '9876543210', new Date().toISOString().split('T')[0], 'Brake Pad', 'BP-101', 10, 1000, 5, 18],
        ['XYZ Suppliers', '9123456789', new Date().toISOString().split('T')[0], 'Engine Oil', 'EO-202', 5, 450, 0, 12],
      ]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Template');
      XLSX.writeFile(workbook, 'Purchase_Import_Template.xlsx');
      showToast('Downloaded Purchase import template (.xlsx)', 'success');
    } catch (err: any) {
      showToast('Failed to generate purchase template: ' + err.message, 'error');
    }
  };

  const parseNumeric = (value: unknown) => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const numeric = Number(String(value).toString().replace(/,/g, '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(numeric) ? numeric : null;
  };

  const parseDate = (value: unknown, defaultDate = new Date()) => {
    if (value === null || value === undefined || String(value).trim() === '') {
      return defaultDate;
    }

    if (typeof value === 'number') {
      try {
        const parsed = (window as Window & { XLSX?: any }).XLSX?.SSF?.parse_date_code(value);
        if (parsed) {
          return new Date(parsed.y, parsed.m - 1, parsed.d);
        }
      } catch (err) {
        // ignore and fall through
      }
    }

    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const handleBulkUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const XLSX = (window as Window & { XLSX?: any }).XLSX;
        if (!XLSX) {
          showToast('SheetJS library not loaded. Please try again.', 'error');
          return;
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (rows.length < 2) {
          showToast('The imported file is empty or missing headers.', 'error');
          return;
        }

        const headers = rows[0].map((header) => String(header).trim().toLowerCase());
        const supplierNameIdx = headers.findIndex((header) => header === 'supplier name' || header.includes('supplier') && header.includes('name'));
        const supplierMobileIdx = headers.findIndex((header) => header === 'supplier mobile' || header.includes('mobile') || header.includes('phone'));
        const purchaseDateIdx = headers.findIndex((header) => header === 'purchase date' || header === 'date');
        const productNameIdx = headers.findIndex((header) => header === 'product name' || header === 'product');
        const productPartNumberIdx = headers.findIndex((header) => header.includes('part number') || header.includes('partno') || header.includes('part_number'));
        const quantityIdx = headers.findIndex((header) => header === 'quantity' || header === 'qty');
        const purchasePriceIdx = headers.findIndex((header) => header.includes('purchase price') || header === 'price' || header.includes('unit price') || header.includes('rate'));
        const discountIdx = headers.findIndex((header) => header.includes('discount'));
        const gstRateIdx = headers.findIndex((header) => header.includes('gst rate') || header.includes('gst%') || header.includes('tax rate'));

        if (supplierNameIdx === -1 || productNameIdx === -1 || quantityIdx === -1 || purchasePriceIdx === -1 || purchaseDateIdx === -1 || gstRateIdx === -1) {
          showToast('Required columns are missing. Please use the purchase template.', 'error');
          return;
        }

        let nextCounter = purchaseCounters.lastNumber;
        const financialYear = purchaseCounters.financialYear;
        const updatedProducts = [...products];
        const newPurchases: Purchase[] = [];
        const errors: string[] = [];

        for (let index = 1; index < rows.length; index++) {
          const row = rows[index];
          if (!row || row.length === 0 || row.every((cell) => cell === null || cell === undefined || String(cell).trim() === '')) {
            continue;
          }

          const rowNumber = index + 1;

          const supplierName = String(row[supplierNameIdx] ?? '').trim();
          const productName = String(row[productNameIdx] ?? '').trim();
          const productPartNumber = productPartNumberIdx !== -1 ? String(row[productPartNumberIdx] ?? '').trim().toUpperCase() : '';

          if (!supplierName) {
            errors.push(`Row ${rowNumber}: Supplier Name is required.`);
            continue;
          }

          const supplier = suppliers.find((item) => item.name.toLowerCase() === supplierName.toLowerCase());
          if (!supplier) {
            errors.push(`Row ${rowNumber}: Supplier "${supplierName}" not found.`);
            continue;
          }

          const productMatch = updatedProducts.find((item) => item.name.toLowerCase() === productName.toLowerCase() || (productPartNumber && (item.partNumber || '').toUpperCase() === productPartNumber));
          if (!productMatch) {
            errors.push(`Row ${rowNumber}: Product "${productName}" not found.`);
            continue;
          }

          const quantity = parseNumeric(row[quantityIdx]);
          const purchasePrice = parseNumeric(row[purchasePriceIdx]);
          const discountPercent = parseNumeric(row[discountIdx]) ?? 0;
          const gstRate = parseNumeric(row[gstRateIdx]);

          if (quantity === null || quantity <= 0) {
            errors.push(`Row ${rowNumber}: Quantity must be a positive number.`);
            continue;
          }

          if (purchasePrice === null || purchasePrice <= 0) {
            errors.push(`Row ${rowNumber}: Purchase Price must be greater than 0.`);
            continue;
          }

          if (discountPercent === null || discountPercent < 0 || discountPercent > 100) {
            errors.push(`Row ${rowNumber}: Discount % must be between 0 and 100.`);
            continue;
          }

          if (gstRate === null || ![0,5,12,18,28].includes(gstRate)) {
            errors.push(`Row ${rowNumber}: GST Rate must be one of 0, 5, 12, 18, or 28.`);
            continue;
          }

          const parsedPurchaseDate = parseDate(row[purchaseDateIdx], new Date());
          if (!parsedPurchaseDate) {
            errors.push(`Row ${rowNumber}: Purchase Date is invalid.`);
            continue;
          }

          const dateValue = parsedPurchaseDate.toISOString().split('T')[0];
          const subtotal = Number((purchasePrice * quantity).toFixed(2));
          const discountAmount = Number((subtotal * (discountPercent / 100)).toFixed(2));
          const taxableValue = Number((subtotal - discountAmount).toFixed(2));
          const taxAmount = Number((taxableValue * (gstRate / 100)).toFixed(2));
          const grandTotal = Number((taxableValue + taxAmount).toFixed(2));

          const isSameState = supplier.state === businessProfile.state;
          const cgstAmount = isSameState ? Number((taxAmount / 2).toFixed(2)) : 0;
          const sgstAmount = isSameState ? Number((taxAmount / 2).toFixed(2)) : 0;
          const igstAmount = isSameState ? 0 : Number(taxAmount.toFixed(2));

          nextCounter += 1;
          const purchaseNumber = `PUR/${financialYear}/${String(nextCounter).padStart(4, '0')}`;

          const item = {
            id: `pur-itm-${Date.now()}-${index}`,
            productId: productMatch.id,
            productName: productMatch.name,
            partNumber: productMatch.partNumber,
            brand: productMatch.brand,
            hsnCode: productMatch.hsnCode,
            quantity,
            purchasePrice,
            rowDiscountPercent: discountPercent,
            gstRate,
            subtotal,
            discountAmount,
            taxAmount,
            totalAmount: grandTotal,
          };

          const newPurchase: Purchase = {
            id: `purchase-${Date.now()}-${index}`,
            purchaseNumber,
            date: dateValue,
            supplierId: supplier.id,
            supplierName: supplier.name,
            supplierMobile: supplier.mobile,
            supplierGstin: supplier.gstin,
            supplierState: supplier.state,
            items: [item],
            subtotal,
            discountAmount,
            taxAmount,
            cgstAmount,
            sgstAmount,
            igstAmount,
            grandTotal,
            isSameState,
          };

          const productIndex = updatedProducts.findIndex((itemProduct) => itemProduct.id === productMatch.id);
          if (productIndex !== -1) {
            updatedProducts[productIndex] = {
              ...updatedProducts[productIndex],
              currentStock: Number((updatedProducts[productIndex].currentStock + quantity).toFixed(2)),
            };
          }

          newPurchases.push(newPurchase);
        }

        if (newPurchases.length > 0) {
          setPurchases((prev) => [ ...newPurchases, ...prev ]);
          setProducts(updatedProducts);
          setPurchaseCounters({ lastNumber: nextCounter, financialYear });
        }

        if (errors.length > 0) {
          errors.forEach((message) => showToast(message, 'error'));
        }

        showToast(`${newPurchases.length} purchases added successfully, ${errors.length} errors`, newPurchases.length > 0 ? 'success' : 'error');
      } catch (err: any) {
        showToast('Error importing purchase file: ' + err.message, 'error');
      } finally {
        e.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">Purchases</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Track supplier purchases, stock additions, and purchase ledger exports.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadPurchaseTemplate}
            className="bg-amber-600 hover:bg-amber-550 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Download Purchase Template
          </button>

          <label className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Upload Purchase Excel
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleBulkUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setIsFormOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            New Purchase
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-xs">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Search</p>
          <div className="mt-2 flex items-center gap-2 bg-slate-50 dark:bg-slate-950 rounded-lg px-2 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Purchase No / Supplier"
              className="bg-transparent text-xs w-full outline-none dark:text-slate-50"
            />
          </div>
        </div>

        <label className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-xs text-left">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">From Date</p>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-2 w-full bg-slate-50 dark:bg-slate-950 rounded-md px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-800" />
        </label>

        <label className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-xs text-left">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">To Date</p>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-2 w-full bg-slate-50 dark:bg-slate-950 rounded-md px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-800" />
        </label>

        <label className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 shadow-xs text-left">
          <p className="text-[10px] uppercase tracking-widest text-slate-400">Supplier</p>
          <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} className="mt-2 w-full bg-slate-50 dark:bg-slate-950 rounded-md px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-800">
            <option value="All">All Suppliers</option>
            {availableSuppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex items-center justify-between shadow-xs">
        <div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Purchase Summary</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{filteredPurchases.length} purchase transactions match current filters.</p>
        </div>
        <button onClick={handleExport} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer">
          <Download className="w-3.5 h-3.5" />
          Export to Excel
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-300 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2">Purchase No</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPurchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/30">
                  <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-slate-50">{purchase.purchaseNumber}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{purchase.date}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{purchase.supplierName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">GSTIN: {purchase.supplierGstin}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-50">₹{purchase.grandTotal.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => setPurchaseToView(purchase)} className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer" title="View">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openEditForm(purchase)} className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70 cursor-pointer" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setPurchaseToDelete(purchase)} className="p-1.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/70 cursor-pointer" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isFormOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">{editingPurchase ? 'Edit Purchase' : 'New Purchase'}</h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Create supplier purchases with stock updates and GST calculations.</p>
                </div>
                <button onClick={() => setIsFormOpen(false)} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Supplier
                    <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" required>
                      <option value="">Select supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name} ({supplier.gstin})</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Purchase Date
                    <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" required />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Product Search
                    <div className="relative">
                      <input
                        type="text"
                        value={productSearchQuery}
                        onChange={(e) => {
                          setProductSearchQuery(e.target.value);
                          setSelectedProductId('');
                        }}
                        placeholder="Search by name, part number, or brand"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                      />
                      {productSearchQuery && (
                        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {productOptions.map((product) => (
                            <button
                              type="button"
                              key={product.id}
                              onClick={() => {
                                setSelectedProductId(product.id);
                                setProductSearchQuery(product.name);
                                setPurchasePrice(product.sellingPrice);
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0"
                            >
                              <div className="font-bold text-slate-900 dark:text-slate-50">{product.name}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">{product.partNumber} • {product.brand} • Stock: {product.currentStock}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Selected Product
                    {selectedProduct ? (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm">
                        <div className="font-bold text-slate-900 dark:text-slate-50">{selectedProduct.name}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Part: {selectedProduct.partNumber} • Brand: {selectedProduct.brand} • Current Stock: {selectedProduct.currentStock}</div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-500">No product selected</div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Quantity
                    <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" required />
                  </label>

                  <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Purchase Price
                    <input type="number" min="0" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" required />
                  </label>

                  <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Row Discount %
                    <input type="number" min="0" max="100" step="0.01" value={rowDiscountPercent} onChange={(e) => setRowDiscountPercent(Number(e.target.value))} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
                  </label>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-950/80 p-3 border border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Subtotal</p>
                      <p className="font-bold text-slate-900 dark:text-slate-50">₹{(Number(purchasePrice || 0) * Number(quantity || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Discount</p>
                      <p className="font-bold text-rose-600 dark:text-rose-300">₹{((Number(purchasePrice || 0) * Number(quantity || 0)) * (Number(rowDiscountPercent || 0) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Tax</p>
                      <p className="font-bold text-blue-600 dark:text-blue-300">₹{((Number(purchasePrice || 0) * Number(quantity || 0)) - ((Number(purchasePrice || 0) * Number(quantity || 0)) * (Number(rowDiscountPercent || 0) / 100))) * (selectedProduct?.gstRate || 0) / 100}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Grand Total</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-300">₹{((((Number(purchasePrice || 0) * Number(quantity || 0)) - ((Number(purchasePrice || 0) * Number(quantity || 0)) * (Number(rowDiscountPercent || 0) / 100))) * (selectedProduct?.gstRate || 0) / 100) + ((Number(purchasePrice || 0) * Number(quantity || 0)) - ((Number(purchasePrice || 0) * Number(quantity || 0)) * (Number(rowDiscountPercent || 0) / 100)))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsFormOpen(false)} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">Cancel</button>
                  <button type="submit" className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer">{editingPurchase ? 'Update Purchase' : 'Save Purchase'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {purchaseToView && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">{purchaseToView.purchaseNumber}</h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{purchaseToView.supplierName} • {purchaseToView.date}</p>
                </div>
                <button onClick={() => setPurchaseToView(null)} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">Supplier</p>
                    <p className="font-bold text-slate-900 dark:text-slate-50">{purchaseToView.supplierName}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{purchaseToView.supplierMobile} • {purchaseToView.supplierGstin}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-3">
                    <p className="text-[10px] uppercase tracking-widest text-slate-400">Totals</p>
                    <p className="font-bold text-slate-900 dark:text-slate-50">₹{purchaseToView.grandTotal.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Tax ₹{purchaseToView.taxAmount.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {purchaseToView.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-50">{item.productName}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.partNumber} • {item.brand}</p>
                      </div>
                      <span className="px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 text-[10px] font-bold">{item.quantity} units</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <div>Purchase Price: ₹{item.purchasePrice.toLocaleString('en-IN')}</div>
                      <div>Discount: {item.rowDiscountPercent}%</div>
                      <div>GST: {item.gstRate}%</div>
                      <div>Total: ₹{item.totalAmount.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {purchaseToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Delete Purchase</h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">This restores the purchased stock count.</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">Delete <span className="font-bold">{purchaseToDelete.purchaseNumber}</span> for {purchaseToDelete.supplierName}?</p>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setPurchaseToDelete(null)} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">Cancel</button>
                <button onClick={handleDelete} className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
