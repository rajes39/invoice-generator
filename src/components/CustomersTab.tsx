import { useState, useEffect, Dispatch, SetStateAction, FormEvent, ChangeEvent } from 'react';
import { Customer, Product } from '../types';
import { Plus, Search, Edit2, Trash2, MapPin, Phone, Landmark, X, ArrowLeft, FileSpreadsheet, Trash, Percent, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CustomersTabProps {
  customers: Customer[];
  setCustomers: Dispatch<SetStateAction<Customer[]>>;
  products: Product[];
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", 
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", 
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", 
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", 
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

export function CustomersTab({ customers, setCustomers, products, showToast }: CustomersTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRootFilter, setSelectedRootFilter] = useState('All Roots');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('West Bengal');
  const [root, setRoot] = useState('');
  const [aadhar, setAadhar] = useState('');
  const [pan, setPan] = useState('');

  // Special discounts lists
  const [specialBrands, setSpecialBrands] = useState<{ brandName: string; discountPercent: number }[]>([]);
  const [specialProducts, setSpecialProducts] = useState<{ productId: string; productName: string; discountPercent: number }[]>([]);
  
  // Temporary creation fields
  const [newSpecialBrand, setNewSpecialBrand] = useState('');
  const [newSpecialBrandPercent, setNewSpecialBrandPercent] = useState<number | ''>('');
  const [newSpecialProduct, setNewSpecialProduct] = useState('');
  const [newSpecialProductSearch, setNewSpecialProductSearch] = useState('');
  const [newSpecialProductPercent, setNewSpecialProductPercent] = useState<number | ''>('');

  // Delete confirmation
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Dedicated customer discount search & setup states
  const [discountModalCustomer, setDiscountModalCustomer] = useState<Customer | null>(null);
  const [discBrandSearch, setDiscBrandSearch] = useState('');
  const [discProductSearch, setDiscProductSearch] = useState('');
  const [discBrands, setDiscBrands] = useState<{ brandName: string; discountPercent: number }[]>([]);
  const [discProducts, setDiscProducts] = useState<{ productId: string; productName: string; discountPercent: number }[]>([]);
  const [netProductSearch, setNetProductSearch] = useState('');
  const [netProductPrice, setNetProductPrice] = useState<number | ''>('');
  const [netProductRules, setNetProductRules] = useState<{ productId: string; productName: string; fixedPrice: number }[]>([]);

  const saveCustomerNetPriceRules = (customerId: string, rules: { productId: string; productName: string; fixedPrice: number }[]) => {
    const stored = localStorage.getItem('customerNetPrices');
    const parsed = stored ? JSON.parse(stored) : {};
    const next = { ...parsed };

    if (rules.length === 0) {
      delete next[customerId];
    } else {
      next[customerId] = rules.reduce((acc, rule) => {
        acc[rule.productId] = Number(rule.fixedPrice);
        return acc;
      }, {} as Record<string, number>);
    }

    localStorage.setItem('customerNetPrices', JSON.stringify(next));
  };

  const openDiscountModal = (customer: Customer) => {
    setDiscountModalCustomer(customer);
    setDiscBrandSearch('');
    setDiscProductSearch('');
    setNetProductSearch('');
    setNetProductPrice('');
    
    try {
      const saved = localStorage.getItem(`customer_discounts_${customer.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setDiscBrands(parsed.brands || []);
        setDiscProducts(parsed.products || []);
      } else {
        setDiscBrands([]);
        setDiscProducts([]);
      }

      const storedNetPrices = localStorage.getItem('customerNetPrices');
      const parsedNetPrices = storedNetPrices ? JSON.parse(storedNetPrices) : {};
      const customerNetPriceMap = parsedNetPrices[customer.id] || {};
      const loadedNetRules = Object.entries(customerNetPriceMap).map(([productId, fixedPrice]) => {
        const product = products.find(p => p.id === productId);
        return {
          productId,
          productName: product?.name || 'Unknown Product',
          fixedPrice: Number(fixedPrice),
        };
      });
      setNetProductRules(loadedNetRules);
    } catch (e) {
      console.error(e);
      setDiscBrands([]);
      setDiscProducts([]);
      setNetProductRules([]);
    }
  };

  const saveModalDiscounts = (brands: any[], productsList: any[]) => {
    if (!discountModalCustomer) return;
    const data = { brands, products: productsList };
    localStorage.setItem(`customer_discounts_${discountModalCustomer.id}`, JSON.stringify(data));
    
    // Also, if the customer currently in edit mode matches, sync that too
    if (editingCustomer && editingCustomer.id === discountModalCustomer.id) {
      setSpecialBrands(brands);
      setSpecialProducts(productsList);
    }
  };

  const handleSelectBrandDisc = (brandName: string) => {
    if (discBrands.some(b => b.brandName.toLowerCase() === brandName.toLowerCase())) {
      showToast(`Discount rule for brand ${brandName} already exists!`, "error");
      return;
    }
    const updated = [...discBrands, { brandName, discountPercent: 10 }];
    setDiscBrands(updated);
    saveModalDiscounts(updated, discProducts);
    setDiscBrandSearch('');
    showToast(`Added brand: ${brandName} (10% default discount)`, "success");
  };

  const handleUpdateBrandPercent = (brandName: string, percent: number) => {
    const updated = discBrands.map(b => b.brandName === brandName ? { ...b, discountPercent: Math.min(100, Math.max(0, percent)) } : b);
    setDiscBrands(updated);
    saveModalDiscounts(updated, discProducts);
  };

  const handleDeleteBrandDisc = (brandName: string) => {
    const updated = discBrands.filter(b => b.brandName !== brandName);
    setDiscBrands(updated);
    saveModalDiscounts(updated, discProducts);
    showToast(`Removed brand: ${brandName}`, "info");
  };

  const handleSelectProductDisc = (prod: Product) => {
    if (prod.isNetProduct) {
      showToast(`Discount not allowed: '${prod.name}' is registered as a Net Product.`, "error");
      return;
    }
    if (discProducts.some(p => p.productId === prod.id)) {
      showToast(`Discount rule for product ${prod.name} already exists!`, "error");
      return;
    }
    const updated = [...discProducts, { productId: prod.id, productName: prod.name, discountPercent: 10 }];
    setDiscProducts(updated);
    saveModalDiscounts(discBrands, updated);
    setDiscProductSearch('');
    showToast(`Added product: ${prod.name} (10% default discount)`, "success");
  };

  const handleUpdateProductPercent = (productId: string, percent: number) => {
    const updated = discProducts.map(p => p.productId === productId ? { ...p, discountPercent: Math.min(100, Math.max(0, percent)) } : p);
    setDiscProducts(updated);
    saveModalDiscounts(discBrands, updated);
  };

  const handleDeleteProductDisc = (productId: string) => {
    const updated = discProducts.filter(p => p.productId !== productId);
    setDiscProducts(updated);
    saveModalDiscounts(discBrands, updated);
    showToast(`Removed product discount`, "info");
  };

  const handleSelectNetProduct = (product: Product) => {
    if (netProductRules.some(rule => rule.productId === product.id)) {
      showToast(`Net price rule for ${product.name} already exists for this customer.`, "error");
      return;
    }

    if (netProductPrice === '' || Number(netProductPrice) <= 0) {
      showToast("Enter a valid fixed selling price above zero.", "error");
      return;
    }

    const fixedPrice = Number(netProductPrice);
    const updatedRules = [
      ...netProductRules,
      {
        productId: product.id,
        productName: product.name,
        fixedPrice,
      }
    ];

    setNetProductRules(updatedRules);
    saveCustomerNetPriceRules(discountModalCustomer!.id, updatedRules);
    setNetProductSearch('');
    setNetProductPrice('');
    showToast(`Added net price ${fixedPrice.toFixed(2)} for ${product.name}`, "success");
  };

  const handleDeleteNetProductRule = (productId: string) => {
    const updatedRules = netProductRules.filter(rule => rule.productId !== productId);
    setNetProductRules(updatedRules);
    saveCustomerNetPriceRules(discountModalCustomer!.id, updatedRules);
    showToast("Removed net price rule", "info");
  };

  // Sync special discounts when editingCustomer changes
  useEffect(() => {
    if (editingCustomer) {
      try {
        const saved = localStorage.getItem(`customer_discounts_${editingCustomer.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setSpecialBrands(parsed.brands || []);
          setSpecialProducts(parsed.products || []);
        } else {
          setSpecialBrands([]);
          setSpecialProducts([]);
        }
      } catch (e) {
        console.error(e);
        setSpecialBrands([]);
        setSpecialProducts([]);
      }
    } else {
      setSpecialBrands([]);
      setSpecialProducts([]);
    }
  }, [editingCustomer]);

  const openAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setMobile('');
    setGstin('');
    setAddress('');
    setState('West Bengal');
    setRoot('');
    setAadhar('');
    setPan('');
    setSpecialBrands([]);
    setSpecialProducts([]);
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setName(customer.name);
    setMobile(customer.mobile);
    setGstin(customer.gstin);
    setAddress(customer.address);
    setState(customer.state);
    setRoot(customer.root || '');
    setAadhar(customer.aadhar || '');
    setPan(customer.pan || '');
    setIsModalOpen(true);
  };

  const handleAddBrandDiscount = () => {
    if (!editingCustomer) return;
    if (!newSpecialBrand) {
      showToast("Please select or type a brand", "error");
      return;
    }
    if (newSpecialBrandPercent === '' || newSpecialBrandPercent < 0 || newSpecialBrandPercent > 100) {
      showToast("Please choose a percentage between 0 and 100", "error");
      return;
    }

    if (specialBrands.some(b => b.brandName.toLowerCase() === newSpecialBrand.toLowerCase())) {
      showToast(`Discount rule for brand ${newSpecialBrand} already exists!`, "error");
      return;
    }

    const updatedBrands = [...specialBrands, { brandName: newSpecialBrand, discountPercent: Number(newSpecialBrandPercent) }];
    setSpecialBrands(updatedBrands);
    
    // Write to localStorage
    const saved = localStorage.getItem(`customer_discounts_${editingCustomer.id}`);
    const data = saved ? JSON.parse(saved) : { brands: [], products: [] };
    data.brands = updatedBrands;
    localStorage.setItem(`customer_discounts_${editingCustomer.id}`, JSON.stringify(data));
    setNewSpecialBrand('');
    setNewSpecialBrandPercent('');
    showToast(`Added brand discount for ${newSpecialBrand}`, "success");
  };

  const handleDeleteBrandDiscount = (brandName: string) => {
    if (!editingCustomer) return;
    const updatedBrands = specialBrands.filter(b => b.brandName.toLowerCase() !== brandName.toLowerCase());
    setSpecialBrands(updatedBrands);

    const saved = localStorage.getItem(`customer_discounts_${editingCustomer.id}`);
    const data = saved ? JSON.parse(saved) : { brands: [], products: [] };
    data.brands = updatedBrands;
    localStorage.setItem(`customer_discounts_${editingCustomer.id}`, JSON.stringify(data));
    showToast(`Removed brand discount for ${brandName}`, "info");
  };

  const handleAddProductDiscount = () => {
    if (!editingCustomer) return;
    if (!newSpecialProduct) {
      showToast("Please choose a product", "error");
      return;
    }
    const selectedProd = products.find(p => p.id === newSpecialProduct);
    if (!selectedProd) return;

    if (selectedProd.isNetProduct) {
      showToast(`Discount not allowed: '${selectedProd.name}' is registered as a Net Product.`, "error");
      return;
    }

    if (newSpecialProductPercent === '' || newSpecialProductPercent < 0 || newSpecialProductPercent > 100) {
      showToast("Please specify a percentage between 0 and 100", "error");
      return;
    }

    if (specialProducts.some(p => p.productId === newSpecialProduct)) {
      showToast(`Discount rule for product ${selectedProd.name} already exists!`, "error");
      return;
    }

    const updatedProducts = [...specialProducts, { 
      productId: selectedProd.id, 
      productName: selectedProd.name, 
      discountPercent: Number(newSpecialProductPercent) 
    }];
    setSpecialProducts(updatedProducts);

    const saved = localStorage.getItem(`customer_discounts_${editingCustomer.id}`);
    const data = saved ? JSON.parse(saved) : { brands: [], products: [] };
    data.products = updatedProducts;
    localStorage.setItem(`customer_discounts_${editingCustomer.id}`, JSON.stringify(data));
    setNewSpecialProduct('');
    setNewSpecialProductSearch('');
    setNewSpecialProductPercent('');
    showToast(`Added product discount for ${selectedProd.name}`, "success");
  };

  const handleDeleteProductDiscount = (productId: string) => {
    if (!editingCustomer) return;
    const updatedProducts = specialProducts.filter(p => p.productId !== productId);
    setSpecialProducts(updatedProducts);

    const saved = localStorage.getItem(`customer_discounts_${editingCustomer.id}`);
    const data = saved ? JSON.parse(saved) : { brands: [], products: [] };
    data.products = updatedProducts;
    localStorage.setItem(`customer_discounts_${editingCustomer.id}`, JSON.stringify(data));
    showToast(`Removed product discount`, "info");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast("Customer name is required", "error");
      return;
    }
    if (mobile.trim() && !/^\d{10}$/.test(mobile.trim())) {
      showToast("Mobile number must be exactly 10 digits", "error");
      return;
    }
    if (gstin.trim() && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/.test(gstin.trim().toUpperCase())) {
      showToast("Invalid GSTIN format. Example: 19AAACS2312M1Z5", "info");
    }
    if (aadhar.trim() && !/^\d{12}$/.test(aadhar.trim())) {
      showToast("Aadhar number must be exactly 12 digits", "error");
      return;
    }
    if (pan.trim() && !/^[A-Z0-9]{10}$/i.test(pan.trim())) {
      showToast("PAN card number must be exactly 10 alphanumeric characters", "error");
      return;
    }

    const trimmedGstin = gstin.trim().toUpperCase();
    const trimmedRoot = root.trim();
    const finalAadhar = aadhar.trim();
    const finalPan = pan.trim().toUpperCase();

    if (editingCustomer) {
      // Edit mode
      setCustomers(prev => prev.map(c => 
        c.id === editingCustomer.id 
          ? { 
              ...c, 
              name: name.trim(), 
              mobile: mobile.trim(), 
              gstin: trimmedGstin, 
              address: address.trim(), 
              state,
              root: trimmedRoot || undefined,
              aadhar: finalAadhar || undefined,
              pan: finalPan || undefined
            }
          : c
      ));
      showToast(`Customer '${name}' updated successfully`, "success");
    } else {
      // Add mode
      const newCustomer: Customer = {
        id: `cust-${Date.now()}`,
        name: name.trim(),
        mobile: mobile.trim(),
        gstin: trimmedGstin,
        address: address.trim(),
        state,
        root: trimmedRoot || undefined,
        aadhar: finalAadhar || undefined,
        pan: finalPan || undefined
      };
      setCustomers(prev => [newCustomer, ...prev]);
      showToast(`Customer '${name}' added successfully`, "success");
    }

    setIsModalOpen(false);
  };

  const confirmDelete = (customer: Customer) => {
    setCustomerToDelete(customer);
  };

  const handleDelete = () => {
    if (customerToDelete) {
      setCustomers(prev => prev.filter(c => c.id !== customerToDelete.id));
      showToast(`Customer '${customerToDelete.name}' deleted`, "info");
      setCustomerToDelete(null);
    }
  };

  const downloadCustomerTemplate = () => {
    try {
      const XLSX = (window as any).XLSX;
      if (!XLSX) {
        showToast("SheetJS library not loaded. Please try again.", "error");
        return;
      }

      const headers = ["Name", "Mobile", "GSTIN", "State", "Address", "Root/Branch", "Aadhar", "PAN"];
      const demoRow = ["Acma Corp", "9876543210", "19AAACS2312M1Z5", "West Bengal", "24 Park Street, Kolkata", "Kolkata Branch", "123456789012", "ABCDE1234F"];

      const ws = XLSX.utils.aoa_to_sheet([headers, demoRow]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Customers Template");
      XLSX.writeFile(wb, "Customer_Import_Template.xlsx");
      showToast("Downloaded customer import template (.xlsx)", "success");
    } catch (err: any) {
      showToast("Failed to generate template: " + err.message, "error");
    }
  };

  // Excel Customer Import handler
  const handleCustomerImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const XLSX = (window as any).XLSX;
        if (!XLSX) {
          showToast("SheetJS library not loaded. Please wait and try again.", "error");
          return;
        }
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 2) {
          showToast("Imported file is empty or missing headers.", "error");
          return;
        }

        const headers = jsonData[0].map((h: any) => String(h).trim().toLowerCase());
        
        const nameIdx = headers.findIndex(h => h === 'name' || h.includes('name') || h === 'customer' || h === 'client' || h === 'customer name');
        const mobileIdx = headers.findIndex(h => h === 'mobile' || h.includes('mobile') || h.includes('phone') || h.includes('contact') || h.includes('mobile number'));
        const gstIdx = headers.findIndex(h => h === 'gst' || h.includes('gst') || h.includes('gstin') || h.includes('tax'));
        const addressIdx = headers.findIndex(h => h === 'address' || h.includes('address') || h.includes('addr') || h.includes('loc') || h === 'billing address');
        const stateIdx = headers.findIndex(h => h === 'state' || h.includes('state') || h.includes('region') || h === 'billing state');
        const rootIdx = headers.findIndex(h => h === 'root' || h.includes('root') || h.includes('branch'));
        const aadharIdx = headers.findIndex(h => h === 'aadhar' || h.includes('aadhar') || h.includes('uidai'));
        const panIdx = headers.findIndex(h => h === 'pan' || h.includes('pan'));

        if (nameIdx === -1) {
          showToast("Could not find Customer Name column in file.", "error");
          return;
        }

        const updatedList = [...customers];
        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row?.length === 0) continue;
          
          const cName = row[nameIdx] ? String(row[nameIdx]).trim() : '';
          if (!cName) {
            skippedCount++;
            continue;
          }

          const cMobileStr = mobileIdx !== -1 && mobileIdx < row.length && row[mobileIdx] 
            ? String(row[mobileIdx]).trim().replace(/\D/g, '') 
            : '';
          const cMobile = cMobileStr.length === 10 ? cMobileStr : '';

          const cGst = gstIdx !== -1 && gstIdx < row.length && row[gstIdx] ? String(row[gstIdx]).trim().toUpperCase() : '';
          const cAddress = addressIdx !== -1 && addressIdx < row.length && row[addressIdx] ? String(row[addressIdx]).trim() : '';
          const cRoot = rootIdx !== -1 && rootIdx < row.length && row[rootIdx] ? String(row[rootIdx]).trim() : '';
          
          let cStateSelected = 'West Bengal';
          if (stateIdx !== -1 && stateIdx < row.length && row[stateIdx]) {
            const rawState = String(row[stateIdx]).trim().toLowerCase();
            const foundState = INDIAN_STATES.find(s => s.toLowerCase() === rawState || s.toLowerCase().includes(rawState));
            if (foundState) {
              cStateSelected = foundState;
            }
          }

          const cAadhar = aadharIdx !== -1 && aadharIdx < row.length && row[aadharIdx] ? String(row[aadharIdx]).trim().replace(/\D/g, '') : '';
          const cPan = panIdx !== -1 && panIdx < row.length && row[panIdx] ? String(row[panIdx]).trim().toUpperCase() : '';

          const existingCustomerIndex = cMobile
            ? updatedList.findIndex(c => c.mobile && c.mobile.trim() === cMobile)
            : -1;

          if (existingCustomerIndex !== -1) {
            updatedList[existingCustomerIndex] = {
              ...updatedList[existingCustomerIndex],
              name: cName,
              mobile: cMobile,
              gstin: cGst,
              address: cAddress,
              state: cStateSelected,
              root: cRoot || undefined,
              aadhar: cAadhar || undefined,
              pan: cPan || undefined
            };
            updatedCount++;
          } else {
            updatedList.push({
              id: `cust-import-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
              name: cName,
              mobile: cMobile,
              gstin: cGst,
              address: cAddress,
              state: cStateSelected,
              root: cRoot || undefined,
              aadhar: cAadhar || undefined,
              pan: cPan || undefined
            });
            addedCount++;
          }
        }

        setCustomers(updatedList);

        if (addedCount === 0 && updatedCount === 0) {
          if (skippedCount > 0) {
            showToast(`Skipped ${skippedCount} blank or invalid rows during import.`, "info");
          } else {
            showToast("No valid customer records could be read.", "error");
          }
        } else {
          const summary = [
            addedCount > 0 ? `${addedCount} added` : null,
            updatedCount > 0 ? `${updatedCount} updated` : null,
            skippedCount > 0 ? `${skippedCount} skipped` : null,
          ].filter(Boolean).join(', ');
          showToast(`Customer import complete: ${summary}!`, "success");
        }
      } catch (err: any) {
        showToast("Error importing file: " + err.message, "error");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset uploader
  };

  const uniqueRoots = Array.from(new Set(customers.map(customer => customer.root?.trim()).filter(Boolean))).sort();

  const filteredCustomers = customers.filter(customer => {
    const query = searchQuery.toLowerCase();
    const matchesRoot = selectedRootFilter === 'All Roots' || customer.root === selectedRootFilter;
    return matchesRoot && (
      customer.name.toLowerCase().includes(query) ||
      customer.mobile.includes(query) ||
      customer.gstin.toLowerCase().includes(query) ||
      (customer.root || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Customers Directory
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Manage your client profiles, addresses, and GST credentials.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadCustomerTemplate}
            className="bg-amber-600 hover:bg-amber-550 dark:bg-amber-700 dark:hover:bg-amber-650 text-white cursor-pointer transition-colors text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs"
            title="Download Customer Import template"
          >
            <Download className="w-3.5 h-3.5" />
            Download Customer Format
          </button>

          <label className="bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer transition-colors text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Import Excel / CSV
            <input 
              type="file" 
              accept=".xlsx,.csv" 
              onChange={handleCustomerImport} 
              className="hidden" 
            />
          </label>

          <button
            onClick={openAddModal}
            id="add-customer-btn"
            className="bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Search and Root Filter */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,220px] gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg p-2.5 flex items-center gap-2.5 shadow-xs">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search customers by name, phone, GSTIN, or root..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-transparent border-none focus:outline-none dark:text-slate-150"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold px-2 py-0.5 rounded"
            >
              Clear
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg px-3 py-2.5 shadow-xs flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">Root / Branch</span>
          <select
            value={selectedRootFilter}
            onChange={(e) => setSelectedRootFilter(e.target.value)}
            className="w-full text-xs bg-transparent border-none outline-none focus:ring-0 cursor-pointer dark:text-slate-150"
          >
            <option value="All Roots">All Roots</option>
            {uniqueRoots.map((rootName) => (
              <option key={rootName} value={rootName}>{rootName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg overflow-hidden shadow-xs">
        {filteredCustomers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-55 dark:bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100 dark:border-slate-800">
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Customers Found</h3>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              {searchQuery ? "Try refining your search keyword or GST criteria." : "Get started by logging your first client profile."}
            </p>
            {!searchQuery && (
              <button
                onClick={openAddModal}
                className="mt-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              >
                Add Your First Customer
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-955/50 border-b border-slate-200 dark:border-slate-800/80">
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Client Name</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">GSTIN & state</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Root / Branch</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">billing Address</th>
                  <th className="px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-955/20 transition-colors text-xs">
                    <td className="px-4 py-2.5">
                      <div className="font-bold text-slate-800 dark:text-slate-150 text-[13px]">{customer.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {customer.id}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 font-mono">
                      <div className="flex items-center gap-1.5 font-medium font-sans">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {customer.mobile || <span className="text-slate-400 dark:text-slate-600 font-normal italic">No Phone</span>}
                      </div>
                      {(customer.aadhar || customer.pan) && (
                        <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {customer.aadhar && <span>Aadhar: {customer.aadhar}</span>}
                          {customer.pan && <span>PAN: {customer.pan}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono text-[11px] font-semibold">{customer.gstin || "URD (Unregistered)"}</span>
                      </div>
                      <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">{customer.state}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      <div className="font-semibold text-[11px] text-slate-700 dark:text-slate-200">{customer.root || <span className="text-slate-400 dark:text-slate-600 italic">Unassigned</span>}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                      <div className="flex items-center gap-1.5 tooltip text-[11px]" title={customer.address}>
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{customer.address || <span className="text-slate-400 dark:text-slate-600 italic">No Address</span>}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openDiscountModal(customer)}
                          className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-405 border border-amber-200/60 dark:border-amber-900/40 transition-colors cursor-pointer flex items-center gap-1 font-bold text-[10px]"
                          title="Setup Brand/Product Volume Discounts"
                        >
                          <Percent className="w-3 h-3" />
                          <span>Discount</span>
                        </button>
                        <button
                          onClick={() => openEditModal(customer)}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-850 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-205 dark:border-slate-800 transition-colors cursor-pointer"
                          title="Edit Customer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => confirmDelete(customer)}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-850 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-205 dark:border-slate-800 transition-colors cursor-pointer"
                          title="Delete Customer"
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

      {/* Setup / Add Dialog Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 ${editingCustomer ? 'max-w-4xl' : 'max-w-md'} w-full shadow-lg space-y-4`}
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-50 uppercase tracking-widest">
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className={editingCustomer ? "grid grid-cols-1 md:grid-cols-2 gap-6 items-start" : "space-y-3"}>
                  {/* Left Column or General Form Section */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Customer Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="E.g., Acma Corp"
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          Mobile Number
                        </label>
                        <input
                          type="text"
                          maxLength={10}
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                          placeholder="E.g., 9876543210"
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          GSTIN (Optional)
                        </label>
                        <input
                          type="text"
                          value={gstin}
                          onChange={(e) => setGstin(e.target.value)}
                          placeholder="e.g. 19AAACS2312M1Z5"
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          Aadhar Number (Optional)
                        </label>
                        <input
                          type="text"
                          maxLength={12}
                          value={aadhar}
                          onChange={(e) => setAadhar(e.target.value.replace(/\D/g, ''))}
                          placeholder="12 digit number"
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                          PAN Card Number (Optional)
                        </label>
                        <input
                          type="text"
                          maxLength={10}
                          value={pan}
                          onChange={(e) => setPan(e.target.value)}
                          placeholder="10 char PAN"
                          className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono uppercase"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Billing State *
                      </label>
                      <select
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                      >
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Root / Branch Name
                      </label>
                      <input
                        type="text"
                        value={root}
                        onChange={(e) => setRoot(e.target.value)}
                        placeholder="e.g. Kolkata Branch"
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Billing Address
                      </label>
                      <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        rows={2}
                        placeholder="Enter complete building street details..."
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Right Column: Special Discount Rules (only in edit customer mode) */}
                  {editingCustomer && (
                    <div className="space-y-3.5 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 md:pl-5 pt-4 md:pt-0">
                      <div className="bg-slate-50/50 dark:bg-slate-955/20 px-3 py-2 rounded-lg border border-slate-150 dark:border-slate-800/85">
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Memory Discount Rules</span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                          Define unique discount percentages that will auto-apply to line items during invoicing. Product discount operates at higher priority.
                        </p>
                      </div>

                      {/* Brand Discount */}
                      <div className="bg-slate-50/30 dark:bg-slate-955/5 p-3 rounded-xl border border-slate-150 dark:border-slate-850 space-y-2">
                        <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Brand-wise Discount %</h4>
                        <div className="flex gap-2">
                          <select
                            value={newSpecialBrand}
                            onChange={(e) => setNewSpecialBrand(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none dark:text-slate-150"
                          >
                            <option value="">Select Brand</option>
                            {Array.from(new Set(products.map(p => p.brand).filter(Boolean))).map(brandOpt => (
                              <option key={brandOpt} value={brandOpt}>{brandOpt}</option>
                            ))}
                          </select>
                          <div className="relative w-20">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              placeholder="0"
                              value={newSpecialBrandPercent}
                              onChange={(e) => setNewSpecialBrandPercent(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full pr-5 pl-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs text-center focus:outline-none dark:text-slate-100 font-mono"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddBrandDiscount}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            Add
                          </button>
                        </div>

                        {specialBrands.length > 0 ? (
                          <div className="max-h-24 overflow-y-auto border border-slate-150 dark:border-slate-800 rounded-lg">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 font-bold sticky top-0">
                                <tr>
                                  <th className="px-2.5 py-1">Brand Name</th>
                                  <th className="px-2.5 py-1 text-center font-bold">Discount %</th>
                                  <th className="px-2 text-right"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                {specialBrands.map(item => (
                                  <tr key={item.brandName} className="hover:bg-slate-105 dark:hover:bg-slate-955/20 text-slate-700 dark:text-slate-300">
                                    <td className="px-2.5 py-1 font-semibold">{item.brandName}</td>
                                    <td className="px-2.5 py-1 text-center font-mono font-bold text-blue-600 dark:text-blue-400">{item.discountPercent}%</td>
                                    <td className="px-2 py-1 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteBrandDiscount(item.brandName)}
                                        className="text-rose-500 hover:text-rose-600 dark:text-rose-400 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                                      >
                                        <Trash className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 italic px-1 pt-1">No Brand boundaries configured.</p>
                        )}
                      </div>

                      {/* Product Discount */}
                      <div className="bg-slate-50/30 dark:bg-slate-955/5 p-3 rounded-xl border border-slate-150 dark:border-slate-850 space-y-2">
                        <h4 className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Product-wise Discount %</h4>
                        <div className="flex gap-2 items-start">
                          <div className="relative flex-1 min-w-0">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                value={newSpecialProductSearch}
                                onChange={(e) => {
                                  const query = e.target.value;
                                  setNewSpecialProductSearch(query);
                                  if (!query.trim()) {
                                    setNewSpecialProduct('');
                                  }
                                }}
                                placeholder="Search product name or part number"
                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-850 rounded-lg text-xs focus:outline-none dark:text-slate-150"
                              />
                            </div>
                            {newSpecialProductSearch.trim() && (
                              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-40 overflow-y-auto z-50 divide-y divide-slate-100 dark:divide-slate-800">
                                {products
                                  .filter(p => p.name.toLowerCase().includes(newSpecialProductSearch.toLowerCase()) || (p.partNumber && p.partNumber.toLowerCase().includes(newSpecialProductSearch.toLowerCase())))
                                  .slice(0, 12)
                                  .map(p => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => {
                                        setNewSpecialProduct(p.id);
                                        setNewSpecialProductSearch(`${p.name}${p.partNumber ? ` (${p.partNumber})` : ''}`);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 focus:outline-none text-slate-700 dark:text-slate-300 flex justify-between items-center"
                                    >
                                      <span className="truncate max-w-[170px]">{p.name}</span>
                                      <span className="text-[9px] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">{p.partNumber || 'No SKU'}</span>
                                    </button>
                                  ))}
                                {products.filter(p => p.name.toLowerCase().includes(newSpecialProductSearch.toLowerCase()) || (p.partNumber && p.partNumber.toLowerCase().includes(newSpecialProductSearch.toLowerCase()))).length === 0 && (
                                  <div className="px-3 py-2 text-xs text-slate-400 italic">No matching products found</div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="relative w-20">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              placeholder="0"
                              value={newSpecialProductPercent}
                              onChange={(e) => setNewSpecialProductPercent(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full pr-5 pl-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-xs text-center focus:outline-none dark:text-slate-100 font-mono"
                            />
                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddProductDiscount}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            Add
                          </button>
                        </div>

                        {specialProducts.length > 0 ? (
                          <div className="max-h-24 overflow-y-auto border border-slate-150 dark:border-slate-800 rounded-lg">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 font-bold sticky top-0">
                                <tr>
                                  <th className="px-2.5 py-1">Product Name</th>
                                  <th className="px-2.5 py-1 text-center font-bold">Discount %</th>
                                  <th className="px-2 text-right"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                                {specialProducts.map(item => (
                                  <tr key={item.productId} className="hover:bg-slate-105 dark:hover:bg-slate-955/20 text-slate-700 dark:text-slate-300">
                                    <td className="px-2.5 py-1 font-semibold truncate max-w-[140px]" title={item.productName}>{item.productName}</td>
                                    <td className="px-2.5 py-1 text-center font-mono font-bold text-blue-600 dark:text-blue-400">{item.discountPercent}%</td>
                                    <td className="px-2 py-1 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteProductDiscount(item.productId)}
                                        className="text-rose-500 hover:text-rose-600 dark:text-rose-400 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                                      >
                                        <Trash className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 italic px-1 pt-1">No SKU/Product boundaries configured.</p>
                        )}
                      </div>
                    </div>
                  )}
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
                    {editingCustomer ? 'Update Profile' : 'Save Customer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {customerToDelete && (
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
                  Delete Customer File?
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to delete <strong>{customerToDelete.name}</strong>? This action will remove the profile completely.
                </p>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  onClick={() => setCustomerToDelete(null)}
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

      {/* Brand & Product Discount setup modal */}
      <AnimatePresence>
        {discountModalCustomer && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-50 uppercase tracking-widest">
                    Manage Customer Discounts
                  </h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-extrabold mt-0.5 uppercase tracking-wide">
                    Client: {discountModalCustomer.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDiscountModalCustomer(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-655 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* SEARCH BOXES CONTAINER */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Brand Search Box */}
                <div className="space-y-2 relative">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Search Brand Name
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-405" />
                    <input
                      type="text"
                      placeholder="Type brand (e.g. Bosch)..."
                      value={discBrandSearch}
                      onChange={(e) => setDiscBrandSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-550 dark:text-slate-100"
                    />
                  </div>
                  {/* Matching Brands dropdown results */}
                  {discBrandSearch.trim() && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-36 overflow-y-auto z-55 divide-y divide-slate-100 dark:divide-slate-850">
                      {Array.from(new Set(products.map(p => p.brand).filter(Boolean)))
                        .filter(brandName => brandName.toLowerCase().includes(discBrandSearch.toLowerCase()))
                        .map(brandName => (
                          <button
                            key={brandName}
                            type="button"
                            onClick={() => handleSelectBrandDisc(brandName)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 focus:outline-none text-slate-700 dark:text-slate-300 font-semibold"
                          >
                            + Add brand "{brandName}"
                          </button>
                        ))
                      }
                      {Array.from(new Set(products.map(p => p.brand).filter(Boolean)))
                        .filter(brandName => brandName.toLowerCase().includes(discBrandSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-xs text-slate-400 italic">No matching brands found</div>
                        )
                      }
                    </div>
                  )}
                </div>

                {/* Product Search Box */}
                <div className="space-y-2 relative">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Search Product / Item Name
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-405" />
                    <input
                      type="text"
                      placeholder="Type name or part number..."
                      value={discProductSearch}
                      onChange={(e) => setDiscProductSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-555 dark:text-slate-100"
                    />
                  </div>
                  {/* Matching Products dropdown results */}
                  {discProductSearch.trim() && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-36 overflow-y-auto z-55 divide-y divide-slate-100 dark:divide-slate-850">
                      {products
                        .filter(p => p.name.toLowerCase().includes(discProductSearch.toLowerCase()) || (p.partNumber && p.partNumber.toLowerCase().includes(discProductSearch.toLowerCase())))
                        .slice(0, 15)
                        .map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectProductDisc(p)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-900 focus:outline-none text-slate-700 dark:text-slate-300 flex justify-between items-center font-semibold"
                          >
                            <span className="truncate max-w-[170px]">{p.name}</span>
                            <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-mono font-bold shrink-0">{p.partNumber || 'No SKU'}</span>
                          </button>
                        ))
                      }
                      {products.filter(p => p.name.toLowerCase().includes(discProductSearch.toLowerCase()) || (p.partNumber && p.partNumber.toLowerCase().includes(discProductSearch.toLowerCase()))).length === 0 && (
                        <div className="px-3 py-2 text-xs text-slate-400 italic">No matching products found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* CURRENT ACTIVE RULES */}
              <div className="space-y-4 pt-1.5">
                {/* Brand rules registry list */}
                <div className="space-y-2 bg-slate-50/50 dark:bg-slate-955/20 p-4 rounded-xl border border-slate-150 dark:border-slate-850/80">
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Brand-wise Discounts</span>
                    <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-indigo-650 dark:text-indigo-400 font-extrabold px-1.5 py-0.5 rounded-full">{discBrands.length} Rules</span>
                  </h4>
                  {discBrands.length === 0 ? (
                    <p className="text-xs text-slate-405 dark:text-slate-500 italic">No brand discounts active for this customer. Type above to add rules.</p>
                  ) : (
                    <div className="border border-slate-150 dark:border-slate-805 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 font-bold sticky top-0 border-b border-slate-150 dark:border-slate-800">
                          <tr>
                            <th className="px-3 py-1.5">Brand Name</th>
                            <th className="px-3 py-1.5 text-center w-32 font-bold">Discount %</th>
                            <th className="px-3 py-1.5 text-right w-16">Remove</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 dark:divide-slate-850 bg-white dark:bg-slate-950">
                          {discBrands.map(b => (
                            <tr key={b.brandName} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                              <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-205">{b.brandName}</td>
                              <td className="px-3 py-2">
                                <div className="relative max-w-[110px] mx-auto">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={b.discountPercent}
                                    onChange={(e) => handleUpdateBrandPercent(b.brandName, Number(e.target.value))}
                                    className="w-full pr-5 pl-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-center text-xs dark:text-slate-100 font-bold font-mono text-indigo-600 dark:text-indigo-400"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBrandDisc(b.brandName)}
                                  className="text-rose-500 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 duration-150 transition-all cursor-pointer"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Product rules registry list */}
                <div className="space-y-2 bg-slate-50/50 dark:bg-slate-955/20 p-4 rounded-xl border border-slate-150 dark:border-slate-850/80">
                  <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Product-wise Discounts</span>
                    <span className="text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-650 dark:text-blue-400 font-extrabold px-1.5 py-0.5 rounded-full">{discProducts.length} Rules</span>
                  </h4>
                  {discProducts.length === 0 ? (
                    <p className="text-xs text-slate-405 dark:text-slate-500 italic">No product discounts active for this customer. Type above to add rules.</p>
                  ) : (
                    <div className="border border-slate-150 dark:border-slate-805 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 font-bold sticky top-0 border-b border-slate-150 dark:border-slate-800">
                          <tr>
                            <th className="px-3 py-1.5">Product Name</th>
                            <th className="px-3 py-1.5 text-center w-32 font-bold">Discount %</th>
                            <th className="px-3 py-1.5 text-right w-16">Remove</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-155 dark:divide-slate-850 bg-white dark:bg-slate-950">
                          {discProducts.map(p => (
                            <tr key={p.productId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40">
                              <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-205 truncate max-w-[200px]" title={p.productName}>{p.productName}</td>
                              <td className="px-3 py-2">
                                <div className="relative max-w-[110px] mx-auto">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={p.discountPercent}
                                    onChange={(e) => handleUpdateProductPercent(p.productId, Number(e.target.value))}
                                    className="w-full pr-5 pl-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-center text-xs dark:text-slate-100 font-bold font-mono text-blue-600 dark:text-blue-400"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProductDisc(p.productId)}
                                  className="text-rose-500 hover:text-rose-650 p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-955/20 duration-155 transition-all cursor-pointer"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="space-y-2 bg-amber-50/70 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200 dark:border-amber-900/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">NET PRODUCT FIXED PRICE</h4>
                      <p className="text-[10px] text-amber-700 dark:text-amber-300/90 mt-1 leading-relaxed">
                        Set a fixed selling price for specific products for this customer. This price overrides MRP and ALL discounts.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1fr,140px,auto] gap-2 items-end">
                    <div className="relative">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Select Product</label>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-405" />
                        <input
                          type="text"
                          placeholder="Search product..."
                          value={netProductSearch}
                          onChange={(e) => setNetProductSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 dark:text-slate-100"
                        />
                      </div>
                      {netProductSearch.trim() && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-40 overflow-y-auto z-55 divide-y divide-slate-100 dark:divide-slate-800">
                          {products
                            .filter(product => product.name.toLowerCase().includes(netProductSearch.toLowerCase()) || (product.partNumber && product.partNumber.toLowerCase().includes(netProductSearch.toLowerCase())))
                            .slice(0, 12)
                            .map(product => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => {
                                  setNetProductSearch(product.name);
                                  handleSelectNetProduct(product);
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 dark:hover:bg-amber-950/30 focus:outline-none text-slate-700 dark:text-slate-300"
                              >
                                <div className="font-semibold">{product.name}</div>
                                <div className="text-[10px] text-slate-400">{product.partNumber || 'No SKU'} • ₹{product.sellingPrice.toFixed(2)}</div>
                              </button>
                            ))}
                          {products.filter(product => product.name.toLowerCase().includes(netProductSearch.toLowerCase()) || (product.partNumber && product.partNumber.toLowerCase().includes(netProductSearch.toLowerCase()))).length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-400 italic">No matching products found</div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Fixed Selling Price (₹)</label>
                      <input
                        type="number"
                        min={0}
                        value={netProductPrice}
                        onChange={(e) => setNetProductPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 dark:text-slate-100 font-mono"
                        placeholder="15"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const selectedProduct = products.find(product => product.name.toLowerCase() === netProductSearch.toLowerCase().trim() || product.partNumber?.toLowerCase() === netProductSearch.toLowerCase().trim());
                        if (!selectedProduct) {
                          showToast("Select a product from the search list first.", "error");
                          return;
                        }
                        handleSelectNetProduct(selectedProduct);
                      }}
                      className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      Add Net Product Rule
                    </button>
                  </div>

                  {netProductRules.length > 0 ? (
                    <div className="border border-amber-200/70 dark:border-amber-800/50 rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 font-bold sticky top-0 border-b border-amber-200 dark:border-amber-800/60">
                          <tr>
                            <th className="px-3 py-1.5">Product Name</th>
                            <th className="px-3 py-1.5 text-center w-32 font-bold">Fixed Price</th>
                            <th className="px-3 py-1.5 text-right w-16">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 dark:divide-amber-900/40 bg-white dark:bg-slate-950">
                          {netProductRules.map(rule => (
                            <tr key={rule.productId} className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20">
                              <td className="px-3 py-2 font-semibold text-slate-800 dark:text-slate-200">{rule.productName}</td>
                              <td className="px-3 py-2 text-center font-mono font-bold text-amber-700 dark:text-amber-400">₹{Number(rule.fixedPrice).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNetProductRule(rule.productId)}
                                  className="text-rose-500 hover:text-rose-600 p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 duration-150 transition-all cursor-pointer"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 italic px-1 pt-1">No fixed-price net product rules configured.</p>
                  )}
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className="flex pt-3 border-t border-slate-100 dark:border-slate-850">
                <button
                  type="button"
                  onClick={() => {
                    setDiscountModalCustomer(null);
                    showToast("Discount rules applied and saved successfully!", "success");
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-550 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer text-center"
                >
                  Save & Close Rules
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
