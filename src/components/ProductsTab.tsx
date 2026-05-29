import { useState, Dispatch, SetStateAction, FormEvent, Cancelable, ChangeEvent } from 'react';
import { Product } from '../types';
import { Plus, Search, Edit2, Trash2, Box, Sparkles, Hash, IndianRupee, Eye, AlertTriangle, X, FileSpreadsheet, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProductsTabProps {
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function ProductsTab({ products, setProducts, showToast }: ProductsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [hsnCode, setHSNCode] = useState('');
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');
  const [gstRate, setGstRate] = useState<number>(18);
  const [currentStock, setCurrentStock] = useState<number | ''>('');
  const [isNetProduct, setIsNetProduct] = useState(false);

  // Delete validation
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setPartNumber('');
    setBrand('');
    setCategory('');
    setHSNCode('');
    setSellingPrice('');
    setGstRate(18);
    setCurrentStock('');
    setIsNetProduct(false);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setPartNumber(product.partNumber);
    setBrand(product.brand);
    setCategory(product.category || '');
    setHSNCode(product.hsnCode);
    setSellingPrice(product.sellingPrice);
    setGstRate(product.gstRate);
    setCurrentStock(product.currentStock);
    setIsNetProduct(!!product.isNetProduct);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast("Product name is required", "error");
      return;
    }
    if (sellingPrice === '' || Number(sellingPrice) < 0) {
      showToast("Please enter a valid selling price", "error");
      return;
    }
    if (currentStock === '' || Number(currentStock) < 0) {
      showToast("Please specify stock amount (0 or more)", "error");
      return;
    }

    const priceNum = Number(sellingPrice);
    const stockNum = Math.floor(Number(currentStock));

    if (editingProduct) {
      setProducts(prev => prev.map(p => 
        p.id === editingProduct.id 
          ? { 
              ...p, 
              name: name.trim(), 
              partNumber: partNumber.trim().toUpperCase(), 
              brand: brand.trim(), 
              category: category.trim(), 
              hsnCode: hsnCode.trim(), 
              sellingPrice: priceNum, 
              gstRate, 
              currentStock: stockNum,
              isNetProduct
            }
          : p
      ));
      showToast(`Product updated successfully`, "success");
    } else {
      const newProduct: Product = {
        id: `prod-${Date.now()}`,
        name: name.trim(),
        partNumber: partNumber.trim().toUpperCase(),
        brand: brand.trim(),
        category: category.trim(),
        hsnCode: hsnCode.trim(),
        sellingPrice: priceNum,
        gstRate,
        currentStock: stockNum,
        isNetProduct
      };
      setProducts(prev => [newProduct, ...prev]);
      showToast(`'${name}' cataloged successfully`, "success");
    }

    setIsModalOpen(false);
  };

  const confirmDelete = (product: Product) => {
    setProductToDelete(product);
  };

  const handleDelete = () => {
    if (productToDelete) {
      setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
      showToast(`Product removed from catalog`, "info");
      setProductToDelete(null);
    }
  };

  // Excel Product Import handler
  const handleProductImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const XLSX = (window as any).XLSX;
        if (!XLSX) {
          showToast("SheetJS library not loaded. Please try again.", "error");
          return;
        }
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          showToast("The imported file seems to be empty or has no header.", "error");
          return;
        }

        const headers = jsonData[0].map((h: any) => String(h).trim().toLowerCase());
        const nameIdx = headers.findIndex(h => h.includes('name') || h === 'product' || h === 'title');
        const partNoIdx = headers.findIndex(h => h.includes('partno') || h.includes('part number') || h.includes('part_number') || h.includes('sku') || h.includes('model'));
        const brandIdx = headers.findIndex(h => h.includes('brand') || h.includes('manufacturer'));
        const catIdx = headers.findIndex(h => h.includes('category') || h.includes('class'));
        const hsnIdx = headers.findIndex(h => h.includes('hsn'));
        const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('rate') || h.includes('selling'));
        const gstIdx = headers.findIndex(h => h.includes('gst') || h.includes('tax%') || h.includes('tax rate'));
        const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('qty') || h.includes('count') || h.includes('units'));

        if (nameIdx === -1) {
          showToast("Could not find Product Name column in file.", "error");
          return;
        }

        const updatedList = [...products];
        let addedCount = 0;
        let updatedCount = 0;
        let stockIncreasedTotal = 0;

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row?.length === 0) continue;
          
          const pName = row[nameIdx] ? String(row[nameIdx]).trim() : '';
          const pPartNo = partNoIdx !== -1 && row[partNoIdx] ? String(row[partNoIdx]).trim().toUpperCase() : '';
          
          if (!pName && !pPartNo) continue;

          // Search criteria: match by Part Number or by Name
          let matchIndex = -1;
          if (pPartNo) {
            matchIndex = updatedList.findIndex(p => p.partNumber && p.partNumber.toUpperCase().trim() === pPartNo);
          }
          if (matchIndex === -1 && pName) {
            matchIndex = updatedList.findIndex(p => p.name.toLowerCase().trim() === pName.toLowerCase().trim());
          }

          const pBrand = brandIdx !== -1 && row[brandIdx] ? String(row[brandIdx]).trim() : '';
          const pCategory = catIdx !== -1 && row[catIdx] ? String(row[catIdx]).trim() : '';
          const pHsn = hsnIdx !== -1 && row[hsnIdx] ? String(row[hsnIdx]).trim().replace(/\D/g, '') : '';
          const pPrice = priceIdx !== -1 && row[priceIdx] ? Number(String(row[priceIdx]).replace(/[^\d.-]/g, '')) : 0;
          const pGst = gstIdx !== -1 && row[gstIdx] ? Number(String(row[gstIdx]).replace(/[^\d]/g, '')) : 18;
          const pStock = stockIdx !== -1 && row[stockIdx] ? Math.floor(Number(String(row[stockIdx]).replace(/[^\d.-]/g, ''))) : 0;
          const finalStock = isNaN(pStock) ? 0 : pStock;

          let finalGst = 18;
          const inputGst = isNaN(pGst) ? 18 : pGst;
          if ([5, 12, 18, 28].includes(inputGst)) {
            finalGst = inputGst;
          } else {
            const standardGstRates = [5, 12, 18, 28];
            finalGst = standardGstRates.reduce((prev, curr) => 
               Math.abs(curr - inputGst) < Math.abs(prev - inputGst) ? curr : prev
            );
          }

          if (matchIndex !== -1) {
            // Product exists
            const existingProd = updatedList[matchIndex];
            const oldStock = existingProd.currentStock || 0;
            const updatedStock = oldStock + finalStock;

            updatedList[matchIndex] = {
              ...existingProd,
              name: pName || existingProd.name,
              brand: pBrand || existingProd.brand,
              category: pCategory || existingProd.category,
              hsnCode: pHsn || existingProd.hsnCode,
              sellingPrice: isNaN(pPrice) || pPrice <= 0 ? existingProd.sellingPrice : pPrice,
              gstRate: finalGst,
              currentStock: updatedStock
            };
            updatedCount++;
            stockIncreasedTotal += finalStock;
          } else {
            // New product
            updatedList.push({
              id: `prod-import-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
              name: pName,
              partNumber: pPartNo,
              brand: pBrand,
              category: pCategory,
              hsnCode: pHsn,
              sellingPrice: isNaN(pPrice) || pPrice < 0 ? 0 : pPrice,
              gstRate: finalGst,
              currentStock: finalStock
            });
            addedCount++;
          }
        }

        if (addedCount === 0 && updatedCount === 0) {
          showToast("No valid product records could be read from the file.", "error");
        } else {
          setProducts(updatedList);
          showToast(`Products imported: ${addedCount} added, ${updatedCount} updated (stock increased by ${stockIncreasedTotal})`, "success");
        }
      } catch (err: any) {
        showToast("Error reading file: " + err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset input
  };

  // Formulate unique Brands and Categories for filters
  const uniqueBrands = ['All', ...Array.from(new Set(products.map(p => p.brand).filter(Boolean)))];
  const uniqueCategories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filteredProducts = products.filter(product => {
    const query = searchQuery.toLowerCase();
    const matchesQuery = (
      product.name.toLowerCase().includes(query) ||
      product.partNumber.toLowerCase().includes(query) ||
      product.brand.toLowerCase().includes(query)
    );
    const matchesBrand = selectedBrand === 'All' || product.brand === selectedBrand;
    const matchesCategory = selectedCategory === 'All' || (product.category || '') === selectedCategory;

    return matchesQuery && matchesBrand && matchesCategory;
  });

  const getStockBadge = (stock: number) => {
    if (stock === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          Out Of Stock
        </span>
      );
    } else if (stock >= 1 && stock <= 10) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-450 border border-amber-100 dark:border-amber-900/40">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {stock} Left (Low Stock)
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-450 border border-emerald-100 dark:border-emerald-900/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {stock} In Stock
        </span>
      );
    }
  };

  const downloadSampleTemplate = () => {
    try {
      const XLSX = (window as any).XLSX;
      if (!XLSX) {
        showToast("SheetJS library not loaded. Please try again.", "error");
        return;
      }
      
      const headers = ["Name", "PartNo", "Brand", "Category", "HSN", "Price", "GST%", "Stock"];
      const demoRow = ["Brake Pad", "BP-101", "Bosch", "Brake", "870830", 1250, 18, 50];
      
      const wsData = [headers, demoRow];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Products Template");
      XLSX.writeFile(wb, "Products_Import_Template.xlsx");
      showToast("Downloaded Product import template (.xlsx)", "success");
    } catch (err: any) {
      showToast("Failed to generate template: " + err.message, "error");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Products Catalog & Stock
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Store product listings with HSN codes, custom prices, tax rules, and active counts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadSampleTemplate}
            className="bg-amber-600 hover:bg-amber-550 dark:bg-amber-700 dark:hover:bg-amber-650 text-white cursor-pointer transition-colors text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs"
            title="Download Demo Product sheet format for Import"
          >
            <Download className="w-3.5 h-3.5" />
            Download Sample Excel Format
          </button>

          <label className="bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Import Excel / CSV
            <input 
              type="file" 
              accept=".xlsx,.csv" 
              onChange={handleProductImport} 
              className="hidden" 
            />
          </label>

          <button
            onClick={openAddModal}
            id="add-product-btn"
            className="bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Product
          </button>
        </div>
      </div>

      {/* Search filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg p-2.5 flex items-center gap-2.5 shadow-xs">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search products by title, model brand, or part number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs bg-transparent border-none focus:outline-none dark:text-slate-150"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold px-2 py-0.5"
          >
            Clear
          </button>
        )}
      </div>

      {/* Brand & Category filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-xs">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">Filter by Brand:</span>
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="w-full text-xs text-slate-750 dark:text-slate-200 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
          >
            {uniqueBrands.map(b => (
              <option key={b} value={b} className="dark:bg-slate-900">{b}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 shadow-xs">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">Filter by Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full text-xs text-slate-750 dark:text-slate-200 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
          >
            {uniqueCategories.map(c => (
              <option key={c} value={c} className="dark:bg-slate-900">{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List content */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg overflow-hidden shadow-xs">
        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-55 dark:bg-slate-955 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100 dark:border-slate-800">
              <Box className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Listings Found</h3>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              {searchQuery || selectedBrand !== 'All' || selectedCategory !== 'All' 
                ? "Try adjusting filters or searching another sequence." 
                : "Add a physical stock item to begin logging invoices."}
            </p>
            {!searchQuery && selectedBrand === 'All' && selectedCategory === 'All' && (
              <button
                onClick={openAddModal}
                className="mt-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              >
                Add Your First Product
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-955/55 border-b border-slate-200 dark:border-slate-800/80">
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Product SKU Title</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Brand / Code</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Price (INR)</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">GST Rate</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stock Level</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-955/20 transition-colors text-xs">
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-slate-800 dark:text-slate-150 text-[13px] flex items-center gap-1.5 flex-wrap">
                        {product.name}
                        {product.isNetProduct && (
                          <span className="px-1.5 py-0.2 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-450 font-extrabold text-[8px] rounded border border-amber-200 dark:border-amber-900/40 tracking-wider">
                            NET / NO DISC
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">Part No: {product.partNumber || "N/A"}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      <div className="font-medium text-slate-700 dark:text-slate-200">{product.brand || "Generics"}</div>
                      <div className="text-[10px] text-slate-450 font-mono mt-0.5">
                        HSN: {product.hsnCode || "None"}{product.category ? ` | Cat: ${product.category}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-100 font-semibold font-mono">
                      ₹{product.sellingPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-955/40 text-blue-700 dark:text-blue-400 text-[10px] font-bold border border-blue-100 dark:border-blue-900/30">
                        {product.gstRate}% GST
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {getStockBadge(product.currentStock)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-850 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-205 dark:border-slate-800 transition-colors cursor-pointer"
                          title="Edit Custom Fields"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => confirmDelete(product)}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-850 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-205 dark:border-slate-800 transition-colors cursor-pointer"
                          title="Purge SKU"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-lg w-full shadow-lg space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-50 uppercase tracking-widest">
                  {editingProduct ? 'Edit Product SKU' : 'Add New Product SKU'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3 text-left">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g., Dell Laptop XPS 15"
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      Part No (SKU)
                    </label>
                    <input
                      type="text"
                      value={partNumber}
                      onChange={(e) => setPartNumber(e.target.value)}
                      placeholder="DELL-XPS"
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      Brand
                    </label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="Dell Inc."
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Electronics"
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      HSN Code (8 Digit)
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={hsnCode}
                      onChange={(e) => setHSNCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="E.g., 84713010"
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      GST Rate Selection *
                    </label>
                    <select
                      value={gstRate}
                      onChange={(e) => setGstRate(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 cursor-pointer"
                    >
                      <option value={5}>5% (Basic Tech / Items)</option>
                      <option value={12}>12% (Standard Consumables)</option>
                      <option value={18}>18% (Standard Electronics / Most SKU)</option>
                      <option value={28}>28% (Luxury Electronics)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      Selling Price (Excl. Tax) *
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 font-bold text-xs pointer-events-none">
                        ₹
                      </span>
                      <input
                        type="number"
                        min={0}
                        required
                        value={sellingPrice}
                        onChange={(e) => setSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Price in INR"
                        className="w-full pl-6 pr-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                      Starting Avail Stock *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={currentStock}
                      onChange={(e) => setCurrentStock(e.target.value === '' ? '' : Math.floor(Number(e.target.value)))}
                      placeholder="Units"
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 py-1.5 px-1">
                  <input
                    type="checkbox"
                    id="isNetProduct"
                    checked={isNetProduct}
                    onChange={(e) => setIsNetProduct(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="isNetProduct" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    Net Product (No discount or rules allowed for this SKU)
                  </label>
                </div>

                <div className="flex gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-1.5 border border-slate-200 dark:border-slate-750 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    {editingProduct ? 'Update SKU' : 'Save Catalog Product'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-lg text-center space-y-3"
            >
              <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/40 rounded-full flex items-center justify-center mx-auto text-rose-600">
                <Trash2 className="w-4.5 h-4.5" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-wider">
                  Remove SKU From Catalog?
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to delete <strong>{productToDelete.name}</strong> from catalog? All current stock configurations for this item will be removed.
                </p>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-450 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
