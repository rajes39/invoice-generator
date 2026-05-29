import { useState, Dispatch, SetStateAction, FormEvent, ChangeEvent } from 'react';
import { Supplier } from '../types';
import { Plus, Search, Edit2, Trash2, FileSpreadsheet, Download, Building2, Phone, MapPin, ShieldCheck, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface SuppliersTabProps {
  suppliers: Supplier[];
  setSuppliers: Dispatch<SetStateAction<Supplier[]>>;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function SuppliersTab({ suppliers, setSuppliers, showToast }: SuppliersTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [state, setState] = useState('West Bengal');

  const openAddModal = () => {
    setEditingSupplier(null);
    setName('');
    setMobile('');
    setGstin('');
    setAddress('');
    setState('West Bengal');
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setMobile(supplier.mobile);
    setGstin(supplier.gstin);
    setAddress(supplier.address);
    setState(supplier.state);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast('Supplier name is required', 'error');
      return;
    }
    if (!mobile.trim()) {
      showToast('Mobile number is required', 'error');
      return;
    }
    if (!gstin.trim()) {
      showToast('GSTIN is required', 'error');
      return;
    }

    const normalizedSupplier: Supplier = {
      id: editingSupplier?.id || `sup-${Date.now()}`,
      name: name.trim(),
      mobile: mobile.trim(),
      gstin: gstin.trim().toUpperCase(),
      address: address.trim(),
      state: state.trim() || 'West Bengal',
    };

    if (editingSupplier) {
      setSuppliers(prev => prev.map(item => item.id === editingSupplier.id ? normalizedSupplier : item));
      showToast('Supplier updated successfully', 'success');
    } else {
      const duplicate = suppliers.some(item => item.gstin.toUpperCase() === normalizedSupplier.gstin || item.mobile === normalizedSupplier.mobile);
      if (duplicate) {
        showToast('A supplier with the same GSTIN or mobile already exists', 'error');
        return;
      }
      setSuppliers(prev => [normalizedSupplier, ...prev]);
      showToast('Supplier added successfully', 'success');
    }

    setIsModalOpen(false);
  };

  const handleDelete = () => {
    if (supplierToDelete) {
      setSuppliers(prev => prev.filter(item => item.id !== supplierToDelete.id));
      showToast('Supplier deleted', 'info');
      setSupplierToDelete(null);
    }
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    const term = searchQuery.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(term) ||
      supplier.mobile.includes(term) ||
      supplier.gstin.toLowerCase().includes(term) ||
      supplier.address.toLowerCase().includes(term)
    );
  });

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const XLSX = (window as Window & { XLSX?: any }).XLSX;
        if (!XLSX) {
          showToast('SheetJS library not loaded', 'error');
          return;
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (rows.length < 2) {
          showToast('The file is empty or malformed', 'error');
          return;
        }

        const headers = rows[0].map((h: any) => String(h).trim().toLowerCase());
        const map = {
          name: headers.findIndex((h) => h.includes('name') || h === 'supplier'),
          mobile: headers.findIndex((h) => h.includes('mobile') || h.includes('phone')),
          gstin: headers.findIndex((h) => h.includes('gstin') || h.includes('gst')),
          address: headers.findIndex((h) => h.includes('address')),
          state: headers.findIndex((h) => h.includes('state')),
        };

        if (map.name === -1 || map.mobile === -1 || map.gstin === -1) {
          showToast('Required columns not found in imported file', 'error');
          return;
        }

        const nextSuppliers = [...suppliers];
        let imported = 0;
        let updated = 0;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const incoming: Supplier = {
            id: `sup-${Date.now()}-${i}`,
            name: String(row[map.name] ?? '').trim(),
            mobile: String(row[map.mobile] ?? '').trim(),
            gstin: String(row[map.gstin] ?? '').trim().toUpperCase(),
            address: map.address !== -1 ? String(row[map.address] ?? '').trim() : '',
            state: map.state !== -1 ? String(row[map.state] ?? '').trim() : 'West Bengal',
          };

          if (!incoming.name || !incoming.mobile || !incoming.gstin) continue;

          const existingIndex = nextSuppliers.findIndex(item => item.gstin.toUpperCase() === incoming.gstin || item.mobile === incoming.mobile);
          if (existingIndex !== -1) {
            nextSuppliers[existingIndex] = {
              ...nextSuppliers[existingIndex],
              name: incoming.name || nextSuppliers[existingIndex].name,
              mobile: incoming.mobile || nextSuppliers[existingIndex].mobile,
              address: incoming.address || nextSuppliers[existingIndex].address,
              state: incoming.state || nextSuppliers[existingIndex].state,
            };
            updated += 1;
          } else {
            nextSuppliers.push(incoming);
            imported += 1;
          }
        }

        setSuppliers(nextSuppliers);
        showToast(`Suppliers imported: ${imported} added, ${updated} updated`, 'success');
      } catch (error: any) {
        showToast('Error reading file: ' + error.message, 'error');
      }
    };

    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const exportSuppliers = () => {
    const XLSX = (window as Window & { XLSX?: any }).XLSX;
    if (!XLSX) {
      showToast('SheetJS library not loaded', 'error');
      return;
    }

    const rows = suppliers.map((supplier, index) => ({
      'S.No': index + 1,
      'Supplier Name': supplier.name,
      'Mobile': supplier.mobile,
      'GSTIN': supplier.gstin,
      'Address': supplier.address,
      'State': supplier.state,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers');
    XLSX.writeFile(workbook, 'Suppliers.xlsx');
    showToast('Suppliers exported to Excel', 'success');
  };

  const downloadTemplate = () => {
    const XLSX = (window as Window & { XLSX?: any }).XLSX;
    if (!XLSX) {
      showToast('SheetJS library not loaded', 'error');
      return;
    }

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Supplier Name', 'Mobile', 'GSTIN', 'Address', 'State'],
      ['ABC Traders', '9876543210', '27AAACA1234A1Z', 'Kolkata', 'West Bengal'],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Suppliers Template');
    XLSX.writeFile(workbook, 'Supplier_Import_Template.xlsx');
    showToast('Downloaded supplier import template', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">Suppliers</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Manage vendor masters, contact details, and easy Excel import/export.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={downloadTemplate}
            className="bg-amber-600 hover:bg-amber-550 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Sample Excel
          </button>

          <label className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Import Excel
            <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImport} />
          </label>

          <button
            onClick={exportSuppliers}
            className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>

          <button
            onClick={openAddModal}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Supplier
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 flex items-center gap-2.5 shadow-xs">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search suppliers by name, mobile, GSTIN, or address"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs bg-transparent border-none focus:outline-none dark:text-slate-100"
        />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-300 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">GSTIN</th>
                <th className="px-3 py-2">Address</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/30">
                  <td className="px-3 py-2">
                    <div className="font-bold text-slate-900 dark:text-slate-50">{supplier.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">State: {supplier.state}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-700 dark:text-slate-200">{supplier.mobile}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{supplier.address}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200">{supplier.gstin}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{supplier.address}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(supplier)}
                        className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/70 cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setSupplierToDelete(supplier)}
                        className="p-1.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/70 cursor-pointer"
                        title="Delete"
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
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Store supplier master details for purchase and ledger tracking.</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Supplier Name
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" placeholder="ABC Traders" required />
                </label>
                <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Mobile
                  <input value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" placeholder="9876543210" required />
                </label>
                <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300 md:col-span-2">
                  GSTIN
                  <input value={gstin} onChange={(e) => setGstin(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" placeholder="27AAACA1234A1Z" required />
                </label>
                <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300 md:col-span-2">
                  Address
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" rows={3} placeholder="Kolkata" />
                </label>
                <label className="space-y-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  State
                  <input value={state} onChange={(e) => setState(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" placeholder="West Bengal" />
                </label>
                <div className="md:col-span-2 flex justify-end gap-2 mt-1">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">Cancel</button>
                  <button type="submit" className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer">{editingSupplier ? 'Update Supplier' : 'Save Supplier'}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {supplierToDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4">
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">Delete Supplier</h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">This will remove the supplier from local storage and purchase lookups.</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">Are you sure you want to delete <span className="font-bold">{supplierToDelete.name}</span>?</p>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setSupplierToDelete(null)} className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">Cancel</button>
                <button onClick={handleDelete} className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
