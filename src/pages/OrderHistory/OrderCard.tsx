// src/pages/OrderHistory/OrderCard.tsx
import { useEffect, useState } from 'react';
import { MdRestaurantMenu } from 'react-icons/md';
import { FiClock, FiCheck } from 'react-icons/fi';
import { 
  useCancelOrderMutation,
  // ✅ 1. Import the Lazy PDF Hook
  useLazyGetOrderPdfUrlQuery 
} from "@/redux/api/quickOrderSlice";
import { formatOrderMoney, getOrderHistoryBreakdown } from './orderBreakdown';

const getMinutesAgo = (isoString: string | undefined) => {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  return Math.max(1, Math.round(diffMs / 60000));
};

const StatusBadge = ({ order }: { order: any }) => {
  const minutes = getMinutesAgo(order.CreateAt);
  const status = order.order_status || order.Order_Status;

  if (status === 'Preparing' || status === 'In_Kitchen' || status === 'Cooking') {
    return (
      <div className="bg-[#FFF3E0] text-[#FF9800] px-2 py-1 rounded-[6px] text-[10px] font-bold flex flex-col items-center min-w-[75px] leading-tight border border-[#FFE0B2]">
        <div className="flex items-center gap-1">
          <span>{status === 'In_Kitchen' ? 'In Kitchen' : status}</span>
          <FiClock className="w-2.5 h-2.5" />
        </div>
        <span className="text-[#FF9800] text-[8px] font-semibold">
          Started {minutes} min ago
        </span>
      </div>
    );
  }

  if (status === 'Served' || status === 'Ready' || status === 'Completed') {
    return (
      <div className="bg-[#E8F5E9] text-[#4CAF50] px-2 py-1.5 rounded-[6px] text-[10px] font-bold flex items-center gap-1 min-w-[75px] justify-center">
        <span>{status === 'Completed' ? 'Served' : status}</span>
        <FiCheck className="w-3 h-3" strokeWidth={3} />
      </div>
    );
  }

  if (status === 'Cancelled') {
    return (
      <div className="bg-[#FFEBEE] text-[#F44336] px-2 py-1 rounded-[6px] text-[10px] font-bold flex flex-col items-center min-w-[75px] leading-tight border border-[#FFCDD2]">
        <span>Cancelled</span>
        <span className="text-[#F44336] text-[8px] font-semibold">
          Started {minutes} min ago
        </span>
      </div>
    );
  }

  return (
    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-[10px] font-bold">
      {status}
    </span>
  );
};

/* ============================================================
   ✅ Inline Cancel Modal (self-contained, no alerts)
   ============================================================ */
interface CancelModalProps {
  open: boolean;
  orderLabel?: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const CancelOrderInlineModal: React.FC<CancelModalProps> = ({
  open,
  orderLabel,
  loading,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  // Reset the form when the modal opens/closes
  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('Please provide a reason for cancellation.');
      return;
    }
    setError('');
    onConfirm(reason.trim());
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose} // backdrop click closes
    >
      <div
        className="bg-white rounded-3xl w-[420px] max-w-full shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()} // don't close when clicking inside
      >
        <h2 className="text-xl font-bold text-gray-900 mb-2">Cancel Order?</h2>
        <p className="text-sm text-gray-500 mb-4">
          {orderLabel ? (
            <>
              This will cancel order <span className="font-semibold">#{orderLabel}</span>. Please
              tell us why.
            </>
          ) : (
            'This will cancel the order. Please tell us why.'
          )}
        </p>

        <label className="block text-xs font-semibold text-gray-600 mb-1">
          Reason <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError('');
          }}
          rows={3}
          placeholder="e.g. Guest changed their mind"
          className={`w-full rounded-xl border p-3 text-sm outline-none resize-none transition-colors ${
            error ? 'border-red-400' : 'border-gray-200 focus:border-[#8E24AA]'
          }`}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-3 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60 transition-colors"
          >
            Keep Order
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Cancelling...' : 'Cancel Order'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================
   OrderCard
   ============================================================ */
interface OrderCardProps {
  order: any;
  onClick?: () => void;
  onCancelled?: (order: any) => void;
}

const OrderCard = ({ order, onClick, onCancelled }: OrderCardProps) => {
  const breakdown = getOrderHistoryBreakdown(order);
  const tableType = order.Dining_Option || 'Dine-in';
  const taxPercentage =
    breakdown.subtotal > 0
      ? ((breakdown.tax / breakdown.subtotal) * 100).toFixed(0)
      : 0;

  // ✅ Cancel mutation + modal state
  const [cancelOrder, { isLoading: isCancelling }] = useCancelOrderMutation();
  const [showCancelModal, setShowCancelModal] = useState(false);

  // ✅ 2. Initialize the PDF Lazy Query
  const [triggerGetPdf, { isFetching: isFetchingPdf }] = useLazyGetOrderPdfUrlQuery();

  // ✅ Self-contained toast (still not an alert — it's a floating banner)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ✅ Cancel eligibility
  const status = order.order_status || order.Order_Status;
  const isCancelled = status === 'Cancelled';
  const isPaid =
    status === 'Completed' ||
    status === 'Served' ||
    order.payment_status === 'Success' ||
    order.paymentStatus === 'Success';
  const canCancel = !isCancelled && !isPaid && !isCancelling;

  const openCancelModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canCancel) return;
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async (reason: string) => {
    try {
      await cancelOrder({ id: order.POS_Order_id, reason }).unwrap();
      setShowCancelModal(false);
      showToast('Order cancelled successfully', 'success');
      onCancelled?.(order);
    } catch (err: any) {
      console.error('Cancel failed:', err);
      showToast(
        err?.data?.message || err?.message || 'Failed to cancel order',
        'error'
      );
    }
  };

  // ✅ 3. Handle Print & Download
  const handlePrint = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await triggerGetPdf(order.POS_Order_id).unwrap();
      
      let url = '';
      if (typeof response === "string") {
        url = response;
      } else if (response instanceof Blob) {
        url = URL.createObjectURL(response);
      } else if ((response as any)?.url) {
        url = (response as any).url;
      }

      if (url) {
        // Force download with a specific filename
        const a = document.createElement('a');
        a.href = url;
        a.download = `Order-${order.POS_Order_id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Cleanup memory if it was a Blob
        if (response instanceof Blob) {
          URL.revokeObjectURL(url);
        }
        showToast('PDF downloaded successfully', 'success');
      }
    } catch (err) {
      console.error('Failed to fetch PDF:', err);
      showToast('Failed to download PDF', 'error');
    }
  };

  return (
    <>
      <div
        onClick={onClick}
        className="relative bg-white flex flex-col rounded-[16px] border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden w-full"
      >
        {/* ✅ Local toast banner */}
        {toast && (
          <div
            className={`absolute top-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-lg text-[11px] font-bold shadow-md ${
              toast.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* ===== Header Section ===== */}
        <div className="flex items-start justify-between px-4 pt-4 pb-2 bg-gradient-to-b from-[#F8F0F5] to-white">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <MdRestaurantMenu className="w-4 h-4 text-[#3B82F6]" />
              <span className="font-bold text-[15px] text-black">
                # {order.POS_Order_id}
              </span>
            </div>
            <div className="text-[13px] font-bold text-black mt-0.5">
              {order.Table
                ? `Table - ${order.Table.table_name.replace('Table ', '')}`
                : 'Takeaway'}
            </div>
            <div className="text-[11px] text-gray-500 font-medium">
              {breakdown.items.length} items
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <StatusBadge order={order} />
            <div className="bg-white px-2 py-0.5 rounded-[4px] text-[9px] text-gray-600 font-bold border border-gray-200 shadow-sm flex items-center gap-1 mt-1">
              {tableType}
            </div>
          </div>
        </div>

        {/* ===== Items List ===== */}
        <div className="px-4 py-3 flex-grow space-y-3">
          {breakdown.items.map((item, index) => (
            <div
              key={`${item.itemId}-${index}`}
              className="text-[12px]"
            >
              <div className="flex justify-between gap-2">
                <span className="text-gray-800 font-medium">
                  {item.quantity} x {item.name}
                </span>
                <span className="font-bold text-black">{formatOrderMoney(item.lineTotal)}</span>
              </div>
              <div className="pl-2 text-[10px] text-gray-500">
                Item {formatOrderMoney(item.price)} each
                {item.variant && (
                  <div>+ {item.variant.name}: {formatOrderMoney(item.variant.price)} each</div>
                )}
                {item.addOns.map((addon) => (
                  <div key={addon.id}>+ {addon.name}: {formatOrderMoney(addon.price)} each</div>
                ))}
                {item.note && <div>Note: {item.note}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* ===== Dotted Separator ===== */}
        <div className="px-4">
          <div className="border-t border-dotted border-gray-400"></div>
        </div>

        {/* ===== Summary ===== */}
        <div className="px-4 pt-3 pb-3 bg-[#FAFAFA]">
          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
            <span>Tax {taxPercentage}%</span>
            <span>{formatOrderMoney(breakdown.tax)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-gray-600 mb-1">
            <span>Persisted subtotal</span>
            <span>{formatOrderMoney(breakdown.subtotal)}</span>
          </div>
          {breakdown.discount !== 0 && (
            <div className="flex justify-between text-[11px] text-gray-600 mb-1">
              <span>Discount</span>
              <span>-{formatOrderMoney(breakdown.discount)}</span>
            </div>
          )}
          {breakdown.serviceCharge !== 0 && (
            <div className="flex justify-between text-[11px] text-gray-600 mb-1">
              <span>Service charge</span>
              <span>{formatOrderMoney(breakdown.serviceCharge)}</span>
            </div>
          )}
          {breakdown.fees !== 0 && (
            <div className="flex justify-between text-[11px] text-gray-600 mb-1">
              <span>Fees</span>
              <span>{formatOrderMoney(breakdown.fees)}</span>
            </div>
          )}
          {Math.abs(breakdown.subtotalAdjustment) >= 0.01 && (
            <div className="flex justify-between text-[10px] text-amber-700 mb-1">
              <span>Unitemized subtotal difference</span>
              <span>{formatOrderMoney(breakdown.subtotalAdjustment)}</span>
            </div>
          )}
          {Math.abs(breakdown.totalAdjustment) >= 0.01 && (
            <div className="flex justify-between text-[10px] text-amber-700 mb-1">
              <span>Unitemized total adjustment</span>
              <span>{formatOrderMoney(breakdown.totalAdjustment)}</span>
            </div>
          )}
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[13px] font-extrabold text-gray-900">Total</span>
            </div>
            <span className="text-[13px] font-extrabold text-gray-900">
              {formatOrderMoney(breakdown.total)}
            </span>
          </div>
        </div>

        {/* ===== Footer Action Buttons ===== */}
        <div className="px-3 pb-3 pt-1 flex justify-between gap-2 bg-[#FAFAFA]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
            className="flex-1 bg-[#C8E6C9] text-[#1B5E20] text-[10px] font-bold py-1.5 rounded-md hover:bg-[#A5D6A7] transition-colors"
          >
            View
          </button>

          <button
            onClick={openCancelModal}
            disabled={!canCancel}
            title={
              isCancelled
                ? 'Order already cancelled'
                : isPaid
                  ? 'Paid orders cannot be cancelled'
                  : 'Cancel this order'
            }
            className={`flex-1 text-[10px] font-bold py-1.5 rounded-md transition-colors ${
              canCancel
                ? 'bg-[#F8BBC4] text-[#0D47A1] hover:bg-[#90CAF9]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isCancelling ? '...' : isCancelled ? 'Cancelled' : 'Cancel'}
          </button>

          {/* ✅ 4. Connected Print Button to the PDF logic */}
          <button
            onClick={handlePrint}
            disabled={isFetchingPdf}
            className="flex-1 bg-[#F8BBD0] text-[#880E4F] text-[10px] font-bold py-1.5 rounded-md hover:bg-[#F48FB1] transition-colors disabled:opacity-50"
          >
            {isFetchingPdf ? 'Wait...' : 'Print'}
          </button>
        </div>
      </div>

      {/* ✅ Modal rendered outside the card so it isn't clipped */}
      <CancelOrderInlineModal
        open={showCancelModal}
        orderLabel={order.POS_Order_id}
        loading={isCancelling}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleConfirmCancel}
      />
    </>
  );
};

export default OrderCard;