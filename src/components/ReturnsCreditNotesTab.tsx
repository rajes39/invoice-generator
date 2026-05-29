import { useState, useMemo, Dispatch, SetStateAction, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  RotateCcw, 
  Search, 
  Trash2, 
  Printer, 
  Eye, 
  X, 
  FileSpreadsheet, 
  CornerDownLeft, 
  CheckCircle2, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Invoice, Product, CreditNote, CreditNoteItem, BusinessProfile } from '../types';

interface ReturnsCreditNotesTabProps {
  invoices: Invoice[];
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  creditNotes: CreditNote[];
  setCreditNotes: Dispatch<SetStateAction<CreditNote[]>>;
  businessProfile: BusinessProfile;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function ReturnsCreditNotesTab({
  invoices,
  products,
  setProducts,
  creditNotes,
  setCreditNotes,
  businessProfile,
  showToast
}: ReturnsCreditNotesTabProps) {
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [returnQuantities, setReturnQuantities] = useState<{[key: string]: number}>({}); // itemId -> qty
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNote | null>(null);
  const [cnToDelete, setCnToDelete] = useState<CreditNote | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Core Selection and calculations helper
  const selectedInvoice = useMemo(() => {
    return invoices.find(inv => inv.id === selectedInvoiceId) || null;
  }, [selectedInvoiceId, invoices]);

  // Compute what has already been returned for the current active invoice items to prevent over-returning
  const alreadyReturnedForInvoice = useMemo(() => {
    const counts: {[productId: string]: number} = {};
    if (!selectedInvoiceId) return counts;
    
    creditNotes
      .filter(cn => cn.invoiceId === selectedInvoiceId)
      .forEach(cn => {
        cn.items.forEach(it => {
          counts[it.productId] = (counts[it.productId] || 0) + it.quantity;
        });
      });
    return counts;
  }, [selectedInvoiceId, creditNotes]);

  // Handle invoice change: reset quantities
  const handleInvoiceChange = (invId: string) => {
    setSelectedInvoiceId(invId);
    setReturnQuantities({});
  };

  // Adjust returned quantity safely
  const handleQtyChange = (itemId: string, maxVal: number, inputVal: number) => {
    const safeVal = Math.max(0, Math.min(maxVal, inputVal));
    setReturnQuantities(prev => ({ ...prev, [itemId]: safeVal }));
  };

  // 2. Continuous numbering series generation: CN/2025-26/0001
  const generateNextCreditNoteNumber = () => {
    const nextNum = creditNotes.length + 1;
    const padded = String(nextNum).padStart(4, '0');
    return `CN/2025-26/${padded}`;
  };

  // 3. Save Return Credit Note
  const handleSaveCreditNote = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) {
      showToast("Please choose a valid invoice reference", "error");
      return;
    }

    const cnItems: CreditNoteItem[] = [];
    let subtotal = 0;
    let taxAmount = 0;

    selectedInvoice.items.forEach(item => {
      const returnQty = returnQuantities[item.id] || 0;
      if (returnQty <= 0) return;

      const rate = item.sellingPrice;
      const rowSubtotal = rate * returnQty;
      const rowTax = rowSubtotal * (item.gstRate / 100);
      const rowTotal = rowSubtotal + rowTax;

      cnItems.push({
        id: `cni-${Date.now()}-${item.productId}`,
        productId: item.productId,
        productName: item.productName,
        partNumber: item.partNumber,
        hsnCode: item.hsnCode,
        sellingPrice: rate,
        gstRate: item.gstRate,
        quantity: returnQty,
        subtotal: rowSubtotal,
        taxAmount: rowTax,
        totalAmount: rowTotal
      });

      subtotal += rowSubtotal;
      taxAmount += rowTax;
    });

    if (cnItems.length === 0) {
      showToast("Please specify returned quantities (at least 1 SKU) before submitting return form", "error");
      return;
    }

    const isSameState = selectedInvoice.isSameState;
    const cgstAmount = isSameState ? taxAmount / 2 : 0;
    const sgstAmount = isSameState ? taxAmount / 2 : 0;
    const igstAmount = isSameState ? 0 : taxAmount;
    const totalAmount = subtotal + taxAmount;

    const creditNoteNum = generateNextCreditNoteNumber();

    const newCreditNote: CreditNote = {
      id: `cn-${Date.now()}`,
      creditNoteNumber: creditNoteNum,
      invoiceId: selectedInvoice.id,
      invoiceNumber: selectedInvoice.invoiceNumber,
      customerId: selectedInvoice.customerId,
      customerName: selectedInvoice.customerName,
      customerMobile: selectedInvoice.customerMobile,
      customerGstin: selectedInvoice.customerGstin,
      customerAddress: selectedInvoice.customerAddress,
      customerState: selectedInvoice.customerState,
      date: new Date().toISOString().split('T')[0],
      items: cnItems,
      subtotal,
      taxAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount,
      isSameState
    };

    // Increment original warehouse Catalog Stocks
    setProducts(prevProducts => {
      const updated = prevProducts.map(p => {
        const returnedUnit = cnItems.find(cnItem => cnItem.productId === p.id);
        if (returnedUnit) {
          return {
            ...p,
            currentStock: p.currentStock + returnedUnit.quantity
          };
        }
        return p;
      });
      localStorage.setItem('invoice_products', JSON.stringify(updated));
      return updated;
    });

    // Save credit notes lists
    const updatedNotes = [newCreditNote, ...creditNotes];
    setCreditNotes(updatedNotes);
    localStorage.setItem('invoice_credit_notes', JSON.stringify(updatedNotes));

    showToast(`Credit Note '${creditNoteNum}' registered successfully, stock levels incremented!`, "success");
    
    // Clear states and close
    setSelectedInvoiceId('');
    setReturnQuantities({});
    setIsCreatorOpen(false);
  };

  // 4. Delete / Void Return Credit Note
  const handleDeleteCreditNote = () => {
    if (!cnToDelete) return;

    // Revert inventory levels: subtract stock increments that were returned
    setProducts(prevProducts => {
      const updated = prevProducts.map(p => {
        const matchingNoteItem = cnToDelete.items.find(it => it.productId === p.id);
        if (matchingNoteItem) {
          return {
            ...p,
            currentStock: Math.max(0, p.currentStock - matchingNoteItem.quantity)
          };
        }
        return p;
      });
      localStorage.setItem('invoice_products', JSON.stringify(updated));
      return updated;
    });

    const refreshedNotes = creditNotes.filter(cn => cn.id !== cnToDelete.id);
    setCreditNotes(refreshedNotes);
    localStorage.setItem('invoice_credit_notes', JSON.stringify(refreshedNotes));

    showToast(`Void completed: Credit Note ${cnToDelete.creditNoteNumber} was purged. Stocks adjusted back.`, "info");
    setCnToDelete(null);
  };

  // Search filter
  const filteredNotes = creditNotes.filter(cn => 
    cn.creditNoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cn.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cn.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 font-sans text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Returns & Credit Notes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Log item returns against registered invoices to issue GST-compliant credit balance accounts.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedInvoiceId('');
            setReturnQuantities({});
            setIsCreatorOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-555 text-white transition-colors cursor-pointer text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Create Credit Note Return
        </button>
      </div>

      {/* Credit notes list or empty display */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 flex items-center gap-2.5 shadow-xs">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Filter notes by reference #, customer title, or invoice key..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs bg-transparent border-none focus:outline-none dark:text-slate-150"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="text-slate-405 hover:text-slate-650 text-xs font-semibold px-2 py-0.5"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-lg overflow-hidden shadow-xs">
        {filteredNotes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-55 dark:bg-slate-950/40 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100 dark:border-slate-800 text-slate-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Returns Registered</h3>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              Create a Credit Note return sheet to reverse catalog warehouse inventory and credit customer dues.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-955 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider">Credit Note #</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider">Customer Name</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider">Invoice Ref</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider">Return Date</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider text-right">Value (GST Incl)</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {filteredNotes.map((cn) => (
                  <tr key={cn.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-955/20 transition-colors text-xs whitespace-nowrap">
                    <td className="px-4 py-3 font-semibold font-mono text-indigo-600 dark:text-indigo-400">
                      {cn.creditNoteNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                      {cn.customerName}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {cn.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">
                      {cn.date}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold font-mono text-slate-900 dark:text-slate-105">
                      ₹{cn.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedCreditNote(cn)}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                          title="View / Print Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setCnToDelete(cn)}
                          className="p-1 rounded bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          title="Void credit note"
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

      {/* CREATE DIALOG MODAL */}
      <AnimatePresence>
        {isCreatorOpen && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <span className="text-sm font-black text-slate-850 dark:text-slate-50 uppercase tracking-wider flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-indigo-600" />
                  New Credit Note Return Workflow
                </span>
                <button
                  onClick={() => setIsCreatorOpen(false)}
                  className="p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <form onSubmit={handleSaveCreditNote} className="space-y-4 overflow-y-auto pr-1 flex-1 text-left">
                {/* Select Invoice */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Select Reference Invoice *
                  </label>
                  <select
                    required
                    value={selectedInvoiceId}
                    onChange={(e) => handleInvoiceChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-200 cursor-pointer"
                  >
                    <option value="">-- Choose Invoice to Return From --</option>
                    {invoices.map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} | {inv.customerName} ({inv.date}) - ₹{inv.totalAmount.toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedInvoice ? (
                  <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-150 dark:border-slate-800/60 text-xs text-slate-600 dark:text-slate-350 space-y-1.5">
                      <div className="font-bold text-slate-805 dark:text-slate-105 uppercase tracking-wider text-[10px]">Reference Details</div>
                      <div>Customer Profile: <span className="font-semibold text-slate-900 dark:text-slate-50">{selectedInvoice.customerName}</span></div>
                      <div>GST Code / Place: <span className="font-mono">{selectedInvoice.customerGstin || "URD"}</span> ({selectedInvoice.customerState})</div>
                      <div>Orig Billing Date: <span className="font-mono">{selectedInvoice.date}</span></div>
                    </div>

                    {/* Return list setup */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Select Items & Quantities to return</div>
                      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-lg">
                        <table className="w-full text-left font-sans text-[11px]">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-955 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-450">
                              <th className="p-2.5">Item Info</th>
                              <th className="p-2.5 text-center">Original Qty</th>
                              <th className="p-2.5 text-center">Already Ret.</th>
                              <th className="p-2.5 text-center w-28">Return Qty</th>
                              <th className="p-2.5 text-right">Net Value Per Item</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                            {selectedInvoice.items.map((it) => {
                              const alreadyRet = alreadyReturnedForInvoice[it.productId] || 0;
                              const allowableMax = it.quantity - alreadyRet;
                              const currentVal = returnQuantities[it.id] || 0;

                              return (
                                <tr key={it.id} className="align-middle">
                                  <td className="p-2.5">
                                    <div className="font-bold text-slate-800 dark:text-slate-200">{it.productName}</div>
                                    <div className="text-[9px] text-slate-400 font-mono">PN: {it.partNumber} | HSN: {it.hsnCode}</div>
                                  </td>
                                  <td className="p-2.5 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                                    {it.quantity} Units
                                  </td>
                                  <td className="p-2.5 text-center font-mono text-amber-600">
                                    {alreadyRet > 0 ? `${alreadyRet} Units` : '-'}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    {allowableMax <= 0 ? (
                                      <span className="text-[9px] font-black text-rose-500 bg-rose-50 dark:bg-rose-950/20 px-1.5 py-0.5 rounded uppercase border border-rose-100 dark:border-rose-900/30">Fully Returned</span>
                                    ) : (
                                      <div className="flex items-center justify-center gap-1">
                                        <input
                                          type="number"
                                          min={0}
                                          max={allowableMax}
                                          value={currentVal || ''}
                                          onChange={(e) => handleQtyChange(it.id, allowableMax, Number(e.target.value))}
                                          className="w-16 px-1.5 py-1 text-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded font-mono text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:text-slate-200"
                                          placeholder="0"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleQtyChange(it.id, allowableMax, allowableMax)}
                                          className="text-[9px] px-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded text-slate-500 font-bold"
                                          title="Return all outstanding"
                                        >
                                          ALL
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-right font-mono text-slate-600 dark:text-slate-350">
                                    {currentVal > 0 ? (
                                      <span className="font-semibold text-slate-900 dark:text-slate-50">
                                        ₹{((it.sellingPrice * currentVal) * (1 + it.gstRate/100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </span>
                                    ) : (
                                      "₹0.00"
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-10 border border-dashed border-slate-205 dark:border-slate-800 rounded-2xl text-center text-xs text-slate-400">
                    <AlertCircle className="w-5 h-5 mx-auto text-slate-300 mb-1.5" />
                    Select an invoice from above to continue catalog item recovery workflows.
                  </div>
                )}

                <div className="flex gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4 pb-1 sticky bottom-0 bg-white dark:bg-slate-900 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsCreatorOpen(false)}
                    className="flex-1 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-55 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedInvoice}
                    className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-555 text-white rounded-lg text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Record Return & Generate Slip
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL RECORD VIEWER / PRINT MODAL */}
      <AnimatePresence>
        {selectedCreditNote && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-3xl w-full shadow-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-600 dark:text-slate-400"
            >
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-150 dark:border-slate-800 shrink-0">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-50 uppercase tracking-widest">
                    Credit Note Statement
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold font-mono">{selectedCreditNote.creditNoteNumber}</p>
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => window.print()}
                    className="p-1 px-3 bg-blue-600 hover:bg-blue-550 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Statement
                  </button>
                  <button
                    onClick={() => setSelectedCreditNote(null)}
                    className="p-1 rounded hover:bg-slate-55 dark:hover:bg-slate-850 text-slate-400"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              {/* Printable Area Wrapper */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-850 mt-4 text-left">
                <div id="print-area" className="bg-white text-slate-800 border p-6 rounded-lg shadow-sm border-slate-200 space-y-4 max-w-3xl mx-auto printing-card">
                  
                  {/* Embedded print logic styles override */}
                  <style>{`
                    @media print {
                      @page {
                        size: auto;
                        margin: 10mm;
                      }
                      body * {
                        visibility: hidden;
                      }
                      #print-area, #print-area * {
                        visibility: visible;
                      }
                      #print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        border: none !important;
                        box-shadow: none !important;
                        background: white !important;
                        color: black !important;
                        font-family: sans-serif;
                      }
                      .printing-card {
                        border: none !important;
                        padding: 0 !important;
                      }
                    }
                  `}</style>

                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-150">
                    <div className="text-left space-y-1">
                      <div className="p-1.5 inline-block bg-indigo-600 text-white rounded font-black text-sm pr-3 leading-none tracking-widest uppercase mb-1">
                        {businessProfile.logo || "⚡"} {businessProfile.name}
                      </div>
                      <div className="text-xs font-black text-slate-900 uppercase">Registered Business Office</div>
                      <div className="text-[10px] text-slate-500 leading-relaxed font-semibold max-w-xs">{businessProfile.address}</div>
                      <div className="text-[10px] text-slate-500 font-mono font-bold">GSTIN/Code: {businessProfile.gstin} | PH: {businessProfile.phone}</div>
                    </div>

                    <div className="text-right space-y-1 sm:text-right shrink-0">
                      <div className="text-[10px] font-black tracking-widest bg-amber-100 text-amber-800 border border-amber-200 rounded px-2.5 py-0.5 uppercase">GST CREDIT NOTE SLIP</div>
                      <h1 className="text-base font-extrabold tracking-mono text-slate-850">{selectedCreditNote.creditNoteNumber}</h1>
                      <div className="text-[11px] font-medium text-slate-500">CN Date: <span className="font-mono text-slate-900 font-bold">{selectedCreditNote.date}</span></div>
                      <div className="text-[11px] font-medium text-slate-500">Invoice Ref: <span className="font-mono text-slate-900 font-bold">{selectedCreditNote.invoiceNumber}</span></div>
                    </div>
                  </div>

                  {/* Customer Information Block */}
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-left grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                    <div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Credit Issued To Client</div>
                      <div className="font-extrabold text-slate-900 text-xs">{selectedCreditNote.customerName}</div>
                      {selectedCreditNote.customerAddress && <div className="text-slate-500 mt-1 leading-relaxed">{selectedCreditNote.customerAddress}</div>}
                      <div className="text-slate-400 font-bold font-mono mt-1">Mobile: {selectedCreditNote.customerMobile || "N/A"}</div>
                    </div>
                    <div className="md:border-l md:border-slate-200/80 md:pl-4">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tax Details</div>
                      <div className="text-slate-600">Client GSTIN: <span className="font-mono font-bold text-slate-900">{selectedCreditNote.customerGstin || "URD / CONSUMER"}</span></div>
                      <div className="text-slate-600 mt-1">State Jurisdictions: <span className="font-semibold text-slate-900">{selectedCreditNote.customerState}</span></div>
                      <div className="text-slate-600 mt-1">Transaction type: <span className="font-bold text-slate-850">{selectedCreditNote.isSameState ? "Intrastate (Local Account Credit)" : "Interstate (IGST Tax Account Credit)"}</span></div>
                    </div>
                  </div>

                  {/* Return item rows */}
                  <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white mt-4">
                    <table className="w-full text-left font-sans text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-150">
                          <th className="py-2.5 px-3">Returned Product Item Info</th>
                          <th className="py-2.5 px-2">HSN Code</th>
                          <th className="py-2.5 px-2 text-right">Selling Rate</th>
                          <th className="py-2.5 px-2 text-center">Qty Returned</th>
                          <th className="py-2.5 px-2 text-center">GST Rate</th>
                          <th className="py-2.5 px-3 text-right">Row Net Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedCreditNote.items.map((it, idx) => (
                          <tr key={it.id || idx} className="align-middle">
                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                              <div>{it.productName}</div>
                              <div className="text-[9px] font-mono font-normal text-slate-400 mt-0.5">Part No: {it.partNumber}</div>
                            </td>
                            <td className="py-2.5 px-2 font-mono text-slate-500">{it.hsnCode}</td>
                            <td className="py-2.5 px-2 text-right font-mono">₹{it.sellingPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold">{it.quantity}</td>
                            <td className="py-2.5 px-2 text-center font-mono">{it.gstRate}%</td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">₹{it.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Credit Math summary block */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-xs">
                    <div className="border border-slate-100 p-3 rounded-lg text-left">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Return Rules Declaration</span>
                      <p className="text-[9.5px] text-slate-500 leading-normal">
                        Certified that the returns listed above constitute returned physical goods verified under stock conditions. Tax adjustments has been made in dynamic accordance with section 34 of the CGST Act, 2017.
                      </p>
                    </div>

                    <div className="border border-slate-155 p-3 rounded-lg space-y-1.5 font-medium bg-slate-50">
                      <div className="flex justify-between">
                        <span>Items Subtotal:</span>
                        <span className="font-mono text-slate-900">₹{selectedCreditNote.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {selectedCreditNote.isSameState ? (
                        <>
                          <div className="flex justify-between text-slate-500 text-[10px]">
                            <span>CGST Tax (Local Credit):</span>
                            <span className="font-mono">₹{selectedCreditNote.cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[10px]">
                            <span>SGST Tax (Local Credit):</span>
                            <span className="font-mono">₹{selectedCreditNote.sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-slate-500 text-[10px]">
                          <span>IGST Tax (Interstate Credit):</span>
                          <span className="font-mono">₹{selectedCreditNote.igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-200/80 pt-1.5 text-xs text-indigo-600 font-extrabold uppercase">
                        <span>Net Value Credited:</span>
                        <span className="font-mono text-slate-900">₹{selectedCreditNote.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footers */}
                  <div className="flex justify-between items-end pt-10 border-t border-slate-100 text-[11px]">
                    <div className="text-left font-mono text-slate-400 text-[10px]">
                      CN ID: {selectedCreditNote.id}
                    </div>
                    <div className="text-center w-40 border-t border-slate-200 pt-1.5 font-semibold text-slate-500 text-[9px] uppercase tracking-wider">
                      Authorised Signature
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE VOID AND ADJUST LIST */}
      <AnimatePresence>
        {cnToDelete && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-805 rounded-xl p-5 max-w-sm w-full shadow-lg text-center space-y-4 text-slate-700 dark:text-slate-300"
            >
              <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/20 rounded-full flex items-center justify-center mx-auto text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 uppercase tracking-widest">
                  Purge & Void Return Credit?
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 lines-relaxed">
                  Removing <strong>{cnToDelete.creditNoteNumber}</strong> will VOID this credit balance. Warehouse stock level increments registered during return will be deducted automatically.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setCnToDelete(null)}
                  className="flex-1 py-1.5 border border-slate-250 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCreditNote}
                  className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Void Return
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
