import { useState, useEffect, useCallback } from "react";
import { useOrderStore } from "@/store/zustandStores";
import printIcon from "@/assets/order/Print.svg";
import type { Order } from "@/types/order";
import {
  formatOrderMoney,
  getOrderFulfillmentType,
  getOrderHistoryBreakdown,
  getOrderTableContext,
} from "./orderBreakdown";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://pos-backend-7xuw.onrender.com/';

/** Map a raw QR-order record from the API into your `Order` type. */
function mapQrOrder(raw: any): Order {
  return {
    // Use POS_Order_id if available, otherwise fallback to qr_order_id or id
    orderId: raw.POS_Order_id ?? raw.qr_order_id ?? raw.id, 
    created_at: raw.CreateAt ?? raw.UpdatedAt,
    orderType: getOrderFulfillmentType(raw),
    pricingSummary: {
      totalAmount: raw.Total ?? raw.SubTotal ?? 0,
      currency: raw.currency ?? "XOF",
    },
    ...(raw as Partial<Order>),
  } as unknown as Order;
}

// ==========================================
// INNER COMPONENT: Print Bill Modal
// ==========================================
const PrintBillModal = ({ open, onClose, order }: { open: boolean; onClose: () => void; order: Order | null }) => {
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !order?.orderId) return;

    const fetchOrderDetails = async () => {
      setLoading(true);
      setError(null);
      setOrderDetails(null);

      const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
      if (!token) {
        setError("Authentication token missing. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/restaurant/pos_order/getbyid/${order.orderId}`, {
          headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch details. Status: ${response.status}`);
        }

        const json = await response.json();
        
        if (json.success && json.data) {
          setOrderDetails(json.data);
        } else {
          throw new Error(json.message || "Invalid response format.");
        }
      } catch (err: any) {
        setError(err.message || "An error occurred while fetching order details.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [open, order]);

  if (!open) return null;
  const breakdown = orderDetails ? getOrderHistoryBreakdown(orderDetails) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">Invoice Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors text-2xl font-bold px-2">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto">
          {loading && <div className="text-center py-10 text-gray-500">Loading order details...</div>}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm mb-4">{error}</div>}

          {!loading && orderDetails && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="flex justify-between items-start text-sm text-gray-600 border-b border-dashed border-gray-300 pb-4">
                <div>
                  <p className="font-bold text-gray-900 text-lg mb-1">Order #{orderDetails.POS_Order_id}</p>
                  <p>Date: {new Date(orderDetails.CreateAt).toLocaleString()}</p>
                  <p>Type: {getOrderFulfillmentType(orderDetails)}</p>
                  {getOrderTableContext(orderDetails) && (
                    <p>Table: {getOrderTableContext(orderDetails)}</p>
                  )}
                  <p>Status: {orderDetails.order_status_label}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900 mb-1">Customer</p>
                  <p>{orderDetails.Customer?.Name || "Walk-in"}</p>
                  <p>{orderDetails.Customer?.phone || ""}</p>
                </div>
              </div>

              {/* Items List */}
              <div>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-200">
                      <th className="pb-2 font-semibold">Item</th>
                      <th className="pb-2 text-center font-semibold">Qty</th>
                      <th className="pb-2 text-right font-semibold">Price</th>
                      <th className="pb-2 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800">
                    {breakdown?.items.map((item, index) => {
                      const unitTotal = item.lineTotal / item.quantity;
                      return (
                        <tr key={`${item.itemId}-${index}`} className="border-b border-gray-100 last:border-0">
                          <td className="py-3">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-xs text-gray-500">Item: {formatOrderMoney(item.price)} each</p>
                            {item.variant && (
                              <p className="text-xs text-gray-500">
                                + {item.variant.name}: {formatOrderMoney(item.variant.price)} each
                              </p>
                            )}
                            {item.addOns.map((addon) => (
                              <p className="text-xs text-gray-500" key={addon.id}>
                                + {addon.name}: {formatOrderMoney(addon.price)} each
                              </p>
                            ))}
                            {item.note && <p className="text-xs text-gray-400 italic mt-1">Note: {item.note}</p>}
                          </td>
                          <td className="py-3 text-center">{item.quantity}</td>
                          <td className="py-3 text-right">{formatOrderMoney(unitTotal)}</td>
                          <td className="py-3 text-right font-medium">{formatOrderMoney(item.lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="border-t border-dashed border-gray-300 pt-4 flex justify-end">
                <div className="w-full max-w-xs space-y-2 text-sm text-gray-700">
                  <div className="flex justify-between"><span>Persisted subtotal:</span><span>{formatOrderMoney(breakdown?.subtotal ?? 0)}</span></div>
                  <div className="flex justify-between"><span>Tax:</span><span>{formatOrderMoney(breakdown?.tax ?? 0)}</span></div>
                  {breakdown?.discount !== 0 && (
                    <div className="flex justify-between"><span>Discount:</span><span>-{formatOrderMoney(breakdown?.discount ?? 0)}</span></div>
                  )}
                  {breakdown?.serviceCharge !== 0 && (
                    <div className="flex justify-between"><span>Service charge:</span><span>{formatOrderMoney(breakdown?.serviceCharge ?? 0)}</span></div>
                  )}
                  {breakdown?.fees !== 0 && (
                    <div className="flex justify-between"><span>Fees:</span><span>{formatOrderMoney(breakdown?.fees ?? 0)}</span></div>
                  )}
                  {breakdown && Math.abs(breakdown.subtotalAdjustment) >= 0.01 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Unitemized subtotal difference:</span>
                      <span>{formatOrderMoney(breakdown.subtotalAdjustment)}</span>
                    </div>
                  )}
                  {breakdown && Math.abs(breakdown.totalAdjustment) >= 0.01 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Unitemized total adjustment:</span>
                      <span>{formatOrderMoney(breakdown.totalAdjustment)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-900 text-lg pt-2 border-t border-gray-200">
                    <span>Persisted total:</span><span>{formatOrderMoney(breakdown?.total ?? 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50">Close</button>
          <button onClick={() => window.print()} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#6A1B9A] hover:bg-[#58177d]">Print Bill</button>
        </div>
      </div>
    </div>
  );
};


// ==========================================
// MAIN COMPONENT: Invoice List
// ==========================================
const Invoice = ({ onBack }: { onBack?: () => void }) => {
  const { orders, fetchOrders } = useOrderStore();
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [dateFilter, setDateFilter] = useState("Today");
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  const [qrOrders, setQrOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQrOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem("token") || localStorage.getItem("accessToken");
    if (!token) {
      setError("No token found. Please log in again.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/restaurant/qr-orders/getall?status=Pending&limit=50`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });

      if (res.status === 401) throw new Error("Unauthorized — Token is invalid or expired.");
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

      const json = await res.json();
      if (!json?.success || !Array.isArray(json.data)) throw new Error(json?.message || "Unexpected response shape.");

      setQrOrders(json.data.map(mapQrOrder));
    } catch (err: any) {
      setError(err.message || "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQrOrders();
  }, [loadQrOrders]);

  const rows = qrOrders.length ? qrOrders : orders;

  return (
    <div className="p-8 min-h-screen bg-[#F8F9FB] font-sans">
      <div className="flex items-center justify-between gap-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-700 whitespace-nowrap">
          <span className="cursor-pointer" onClick={onBack}>Order History's </span>
          <span className="font-bold text-black">&gt; Invoices</span>
        </h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <div
              className="bg-white border border-gray-200 rounded-full px-4 py-1.5 flex items-center gap-2 cursor-pointer min-w-[100px] justify-between shadow-sm"
              onClick={() => setShowDateDropdown((v) => !v)}
            >
              <span className="text-[12px] font-semibold text-gray-700">{dateFilter}</span>
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {showDateDropdown && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg z-10 p-1 border border-gray-100">
                {["Today", "Yesterday", "This week", "This Month"].map((option) => (
                  <button
                    key={option}
                    className="block w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 rounded text-gray-700 font-medium"
                    onClick={() => {
                      setDateFilter(option);
                      setShowDateDropdown(false);
                      fetchOrders({ dateRange: option });
                      loadQrOrders();
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-[13px]">{error}</div>}

      <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ background: "#ffffff", borderColor: "#E5E7EB" }}>
        <table className="min-w-full text-left border-collapse">
          <thead>
            <tr className="text-[#6B7280] text-[12px] uppercase tracking-wider bg-[#F9FAFB]">
              <th className="py-4 px-6 font-semibold">S no</th>
              <th className="py-4 px-6 font-semibold">Invoice id</th>
              <th className="py-4 px-6 font-semibold">Date</th>
              <th className="py-4 px-6 font-semibold">Order Type</th>
              <th className="py-4 px-6 font-semibold">Total amount</th>
              {/* <th className="py-4 px-6 font-semibold">Action</th> */}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={6} className="py-8 px-6 text-center text-[13px] text-gray-500">Loading invoices…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="py-8 px-6 text-center text-[13px] text-gray-500">No invoices found.</td></tr>
            )}
            {rows.map((order: any, idx) => (
              <tr key={order.orderId || idx} className="bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-4 px-6 text-[13px] font-medium text-gray-900">{String(idx + 1).padStart(2, "0")}</td>
                <td className="py-4 px-6 text-[13px] font-bold text-gray-900">{order.orderId}</td>
                <td className="py-4 px-6 text-[13px] font-medium text-gray-600">
                  {order?.created_at || order?.createdAt
                    ? new Date(order.created_at || order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : ""}
                </td>
                <td className="py-4 px-6 text-[13px] font-medium text-gray-600">
                  {getOrderFulfillmentType({
                    Dining_Option: order.Dining_Option,
                    orderType: order.orderType,
                  })}
                </td>
                <td className="py-4 px-6 text-[13px] font-bold text-gray-900">
                  {order.pricingSummary?.totalAmount?.toLocaleString() || ""} XOF
                </td>
                {/* <td className="py-4 px-6 text-[13px] font-medium">
                  <button
                    className="flex items-center gap-2 text-gray-600 hover:text-[#6A1B9A] font-semibold transition-colors"
                    onClick={() => setPrintOrder(order)}
                  >
                    <img src={printIcon} alt="print" className="w-4 h-4 opacity-70" /> Print
                  </button>
                </td> */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PrintBillModal open={!!printOrder} onClose={() => setPrintOrder(null)} order={printOrder} />
    </div>
  );
};

export default Invoice;