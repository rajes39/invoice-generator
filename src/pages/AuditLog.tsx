import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

const TABLE_LABELS: Record<string, string> = {
  invoices: "Invoice",
  purchase_invoices: "Purchase",
  customer_payments: "Payment",
  products: "Product",
  customers: "Customer",
  suppliers: "Supplier",
};

export default function AuditLog() {
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [selectedTable, setSelectedTable] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit_logs", selectedAction, selectedTable],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (selectedAction !== "ALL") query = query.eq("action", selectedAction);
      if (selectedTable !== "ALL") query = query.eq("table_name", selectedTable);

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track all create, update, and delete actions across the system.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="ALL">All Actions</option>
            <option value="INSERT">Insert</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Module</label>
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="ALL">All Modules</option>
            <option value="invoices">Invoices</option>
            <option value="purchase_invoices">Purchases</option>
            <option value="customer_payments">Payments</option>
            <option value="products">Products</option>
            <option value="customers">Customers</option>
            <option value="suppliers">Suppliers</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading audit logs...</div>
        ) : !logs || logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No audit records found.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Module</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Record ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <>
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {format(new Date(log.created_at), "dd MMM yyyy, hh:mm a")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-700"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {TABLE_LABELS[log.table_name] || log.table_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                      {log.record_id?.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3">
                      {(log.old_data || log.new_data) && (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                        >
                          {expandedId === log.id ? "Hide" : "View Changes"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr key={`${log.id}-expanded`} className="bg-orange-50">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {log.old_data && (
                            <div>
                              <p className="text-xs font-semibold text-red-600 mb-1">Before</p>
                              <pre className="text-xs bg-white border border-red-100 rounded p-3 overflow-auto max-h-48 text-gray-700">
                                {JSON.stringify(log.old_data, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_data && (
                            <div>
                              <p className="text-xs font-semibold text-green-600 mb-1">After</p>
                              <pre className="text-xs bg-white border border-green-100 rounded p-3 overflow-auto max-h-48 text-gray-700">
                                {JSON.stringify(log.new_data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3">Showing last 200 records.</p>
    </div>
  );
}
