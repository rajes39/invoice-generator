import { useState } from 'react';
import { ExternalLink, Truck } from 'lucide-react';

interface EWayBillProps {
  invoice: {
    invoiceNumber: string;
    invoiceDate: string;
    customerName: string;
    customerGstin: string;
    grandTotal: number;
    deliveryAddress?: {
      state?: string;
      pincode?: string;
    };
  };
  companyGstin?: string;
}

export default function EWayBillButton({ invoice, companyGstin }: EWayBillProps) {
  const [showInfo, setShowInfo] = useState(false);

  const openEWayBillPortal = () => {
    // Open E-Way Bill portal
    window.open('https://ewaybillgst.gov.in', '_blank');
  };

  const copyDetails = () => {
    const details = `
E-Way Bill Details:
-------------------
Invoice No: ${invoice.invoiceNumber}
Invoice Date: ${invoice.invoiceDate}
Supplier GSTIN: ${companyGstin || 'N/A'}
Recipient GSTIN: ${invoice.customerGstin}
Recipient Name: ${invoice.customerName}
Invoice Value: ₹${invoice.grandTotal}
Delivery State: ${invoice.deliveryAddress?.state || 'N/A'}
Delivery Pincode: ${invoice.deliveryAddress?.pincode || 'N/A'}
    `.trim();

    navigator.clipboard.writeText(details);
    alert('Details copied! Paste in E-Way Bill portal.');
  };

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowInfo(!showInfo)}
        className="w-full rounded-3xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 shadow-lg active:scale-95 flex items-center justify-center gap-2"
      >
        <Truck className="w-4 h-4" />
        Generate E-Way Bill
      </button>

      {showInfo && (
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4 space-y-3">
          <p className="text-xs font-bold text-blue-800">E-Way Bill Details:</p>
          
          <div className="space-y-1 text-xs text-blue-700">
            <div className="flex justify-between">
              <span className="font-medium">Invoice No:</span>
              <span className="font-bold">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Supplier GSTIN:</span>
              <span className="font-bold">{companyGstin || 'Set in Company Profile'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Recipient GSTIN:</span>
              <span className="font-bold">{invoice.customerGstin}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Invoice Value:</span>
              <span className="font-bold">₹{invoice.grandTotal}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Delivery State:</span>
              <span className="font-bold">{invoice.deliveryAddress?.state || 'N/A'}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={copyDetails}
              className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              Copy Details
            </button>
            <button
              onClick={openEWayBillPortal}
              className="flex-1 rounded-xl bg-green-600 py-2 text-xs font-bold text-white hover:bg-green-700 flex items-center justify-center gap-1"
            >
              Open Portal <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <p className="text-[10px] text-blue-500 italic">
            * Details copy করুন → E-Way Bill portal এ login করুন → paste করে submit করুন
          </p>
        </div>
      )}
    </div>
  );
}
