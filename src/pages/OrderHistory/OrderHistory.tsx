import { useState, useEffect, useRef } from 'react';
import { useGetAllOrderHistoryQuery, useGetOrderHistoryByDateRangeQuery, useGetOrderHistoryByStatusQuery } from '@/redux/api/orderHistoryApi';
import PaymentModal, { type PaymentSelection } from '@/components/common/PaymentModal';
import { SuccessModal } from '@/components/common/SuccessModal';
import Invoice from './Invoice';
import type { OrderItem, ServerPosOrder } from '@/types/order';
import { useWalkthroughStore } from '@/store/walkthroughStore';
import { useNavigate } from 'react-router-dom';
import { teamChatTrainingSteps } from '@/walkthrough/steps';
import * as orderApi from '@/api/orderApi';
import Loader from '@/components/Loader';
import {
  getOrderCreatedAt,
  getOrderFulfillmentType,
  getOrderHistoryBreakdown,
  getOrderTableContext,
} from './orderBreakdown';
import {
  useCreatePosOrderPaymentLinkMutation,
  useLazyGetOrderByIdQuery,
} from '@/redux/api/quickOrderSlice';
import { getOrCreatePendingStripePayment, getStripeCheckoutUrl } from '@/utils/stripePayment';
import toast from 'react-hot-toast';

// Import the separated components
import OrderCard from './OrderCard';
import OrderSummaryModal from './OrderSummaryModal';

// ============================================================
// Helper Functions
// ============================================================

const getDateRange = (filter: string) => {
  const today = new Date();
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (filter === 'Today') {
    const td = formatDate(today);
    return { start_date: td, end_date: td };
  } else if (filter === 'Last Week') {
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    return { start_date: formatDate(start), end_date: formatDate(today) };
  } else if (filter === 'Last Month') {
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    return { start_date: formatDate(start), end_date: formatDate(today) };
  }
  return null;
};

// ============================================================
// Main OrderHistory Component
// ============================================================

const OrderHistory = () => {
  type OrderHistoryRecord = ServerPosOrder & {
    order_status?: string;
    Table?: { table_name?: string } | null;
  };
  // 'orders' corresponds to the PURPLE toggle, 'dining' corresponds to the ORANGE toggle
  const [activeTab, setActiveTab] = useState<'orders' | 'dining'>('orders');

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState('');
  const orderDetailRequestId = useRef(0);
  const [fetchOrderDetails] = useLazyGetOrderByIdQuery();
  const [createPosOrderPaymentLink] = useCreatePosOrderPaymentLinkMutation();

  // Filter and tab logic
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [dateFilter, setDateFilter] = useState('Today');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  const {
    completed,
    activeTraining,
    completedTrainings,
    startTraining,
    isActive: isWalkthroughActive,
    steps: walkthroughSteps,
    currentStep: walkthroughStep,
  } = useWalkthroughStore();
  const showTrainingDateDropdown =
    isWalkthroughActive &&
    activeTraining === 'order' &&
    walkthroughSteps[walkthroughStep]?.selector === '.order-history-date-dropdown';

  const dateRange = getDateRange(dateFilter);
  const page = 1;
  const limit = 100;

  const skipDate = !dateRange;
  const skipStatus = statusFilter === '' || !!dateRange;
  const skipAll = !!dateRange || statusFilter !== '';

  // ============================================================
  // API Hooks
  // ============================================================
  const {
    data: rangeData,
    isLoading: rangeLoading,
    isError: rangeError,
    refetch: rangeRefetch,
  } = useGetOrderHistoryByDateRangeQuery(
    { start_date: dateRange?.start_date, end_date: dateRange?.end_date, page, limit },
    { skip: skipDate }
  );

  const {
    data: statusData,
    isLoading: statusLoading,
    isError: statusError,
    refetch: statusRefetch,
  } = useGetOrderHistoryByStatusQuery(
    { status: statusFilter, page, limit },
    { skip: skipStatus }
  );

  const {
    data: allData,
    isLoading: allLoading,
    isError: allError,
    refetch: allRefetch,
  } = useGetAllOrderHistoryQuery(
    {
      page,
      limit,
      search: '',
      order_status: '',
      client_mobile_no: '',
      table_id: '',
      floor_id: '',
    },
    { skip: skipAll }
  );

  // Determine active data source
  let data;
  let isLoading;
  let isError;
  let activeRefetch;

  isLoading = allLoading || rangeLoading || statusLoading;
  if (!skipDate) {
    data = rangeData;
    isLoading = rangeLoading;
    isError = rangeError;
    activeRefetch = rangeRefetch;
  } else if (!skipStatus) {
    data = statusData;
    isLoading = statusLoading;
    isError = statusError;
    activeRefetch = statusRefetch;
  } else {
    data = allData;
    isLoading = allLoading;
    isError = allError;
    activeRefetch = allRefetch;
  }

  // Chain to teamchat training after orderHistory training completes
  useEffect(() => {
    if (
      completed &&
      activeTraining === 'orderHistory' &&
      !completedTrainings.teamchat
    ) {
      startTraining('teamchat', teamChatTrainingSteps);
      navigate('/');
    }
  }, [completed, activeTraining, completedTrainings, startTraining, navigate]);

  // The new API returns an array directly in `data.data`
  let orders = Array.isArray(data?.data) ? data.data : (data?.data?.orders || []);
  let timePeriod = dateFilter ? dateFilter.toLowerCase() : 'all time';

  if (dateRange) {
    orders = orders.filter((order: OrderHistoryRecord) => {
      const createdAt = getOrderCreatedAt(order);
      if (!createdAt) return false;
      const localDate = [
        createdAt.getFullYear(),
        String(createdAt.getMonth() + 1).padStart(2, '0'),
        String(createdAt.getDate()).padStart(2, '0'),
      ].join('-');
      return localDate >= dateRange.start_date && localDate <= dateRange.end_date;
    });
  }

  // Client-side fallback filtering
  if (statusFilter) {
    orders = orders.filter((o: any) => o.order_status === statusFilter || o.Order_Status === statusFilter);
  }

  const toSelectedOrder = (order: OrderHistoryRecord) => {
    const breakdown = getOrderHistoryBreakdown(order);
    return {
      ...order,
      orderId: String(order.POS_Order_id),
      status: order.order_status || order.Order_Status,
      fulfillmentType: getOrderFulfillmentType(order),
      tableContext: getOrderTableContext(order),
      items: breakdown.items,
      breakdown,
      pricingSummary: {
        taxPercentage: breakdown.subtotal > 0 ? (breakdown.tax / breakdown.subtotal) * 100 : 0,
        tax: breakdown.tax,
        subtotal: breakdown.subtotal,
        totalAmount: breakdown.total,
      },
      customerInfo: { name: order.Customer?.Name || '' },
      paymentDetails: { method: 'Cash' },
    };
  };

  const handleCardClick = async (order: OrderHistoryRecord) => {
    const requestId = ++orderDetailRequestId.current;
    const orderId = order.POS_Order_id;
    setSelectedOrder(toSelectedOrder(order));
    setOrderDetailLoading(true);
    setOrderDetailError('');
    setShowSummaryModal(true);
    try {
      const response = await fetchOrderDetails(orderId).unwrap();
      if (!response.data) {
        throw new Error('Order details were missing from the server response.');
      }
      if (requestId === orderDetailRequestId.current) {
        setSelectedOrder(toSelectedOrder(response.data));
      }
    } catch (error: any) {
      if (requestId === orderDetailRequestId.current) {
        setOrderDetailError(
          error?.data?.message ||
            error?.message ||
            'Could not load persisted order details. Showing the history-list data.',
        );
      }
    } finally {
      if (requestId === orderDetailRequestId.current) {
        setOrderDetailLoading(false);
      }
    }
  };

  return (
    <div className="p-6 min-h-screen bg-white font-sans">
      {/* ============== Top Header Toolbar ============== */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        {/* Title */}
        <h1 className="text-[28px] font-extrabold text-black tracking-tight">
          Order History
        </h1>

        <div className="flex flex-wrap gap-3 items-center">

          {/* 1. Date Filter Dropdown */}
          <div className="relative">
            <div
              className="order-history-date-filter bg-[#F3F4F6] rounded-full px-5 py-2 flex items-center gap-3 cursor-pointer min-w-[110px] justify-between transition-colors hover:bg-gray-200"
              onClick={() => setShowDateDropdown(!showDateDropdown)}
            >
              <span className="text-[13px] font-medium text-black">
                {dateFilter || 'Today'}
              </span>
              <svg
                className="w-3.5 h-3.5 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
            {(showDateDropdown || showTrainingDateDropdown) && (
              <div className="order-history-date-dropdown absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg z-20 p-1 border border-gray-100">
                {['Today', 'Last Week', 'Last Month', 'Reset'].map((option) => (
                  <button
                    key={option}
                    className="block w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50 rounded text-gray-700 font-medium"
                    onClick={() => {
                      if (option === 'Reset') setDateFilter('');
                      else setDateFilter(option);
                      setShowDateDropdown(false);
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Status Filters Pill */}
          <div className="flex items-center bg-[#F3F4F6] rounded-full p-1">
            {['All Orders', 'Preparing', 'Served', 'Cancelled'].map((option) => {
              const isActive =
                (option === 'All Orders' && statusFilter === '') ||
                (option !== 'All Orders' && statusFilter === option);
              const walkthroughStatusClass =
                option === 'All Orders'
                  ? 'order-history-tab-all'
                  : option === 'Preparing'
                    ? 'order-history-tab-waiting'
                    : option === 'Served'
                      ? 'order-history-tab-served'
                        : 'order-history-tab-cancelled';
              return (
                <button
                  key={option}
                  className={`${walkthroughStatusClass} px-5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-black shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => {
                    if (option === 'All Orders') setStatusFilter('');
                    else setStatusFilter(option);
                  }}
                >
                  {option}
                </button>
              );
            })}
          </div>

 {/* 3. Single Toggle Switch (ORDERS ↔ DINING) */}
<div className="flex items-center gap-3">
  <button
    onClick={() =>
      setActiveTab((prev) => (prev === 'orders' ? 'dining' : 'orders'))
    }
    className={`relative flex items-center w-[110px] h-[30px] rounded-full transition-colors duration-300 focus:outline-none ${
      activeTab === 'orders' ? 'bg-[#6A1B9A]' : 'bg-[#FF9800]'
    }`}
    aria-label="Toggle Orders / Dining"
  >
    {/* Label — opposite side of the knob */}
    <span
      className={`absolute top-1/2 -translate-y-1/2 text-[9px] font-bold tracking-wider text-white transition-all duration-300 ${
        activeTab === 'orders' ? 'right-2.5' : 'left-2.5'
      }`}
    >
      {activeTab === 'orders' ? 'ORDERS' : 'DINING'}
    </span>

    {/* Knob */}
    <div
      className={`absolute top-[3px] w-[24px] h-[24px] bg-white rounded-full shadow-md transition-all duration-300 ${
        activeTab === 'orders' ? 'left-[3px]' : 'left-[83px]'
      }`}
    />
  </button>
</div>

        </div>
      </div>

      {/* ============== Content Area ============== */}
      {activeTab === 'dining' ? (
        <Invoice onBack={() => setActiveTab('orders')} />
      ) : (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center w-full min-h-[60vh]">
                 <Loader />
            </div>
           
          ) : isError || orders.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-400 mb-1">
                  No orders found
                </div>
                <div className="text-sm text-gray-500">
                  {statusFilter
                    ? `No ${statusFilter.toLowerCase()} orders for ${timePeriod}`
                    : 'Try adjusting your filters'}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {orders.map((order: any, idx: number) => (
                <OrderCard
                  key={order._id || idx}
                  order={order}
                  onClick={() => handleCardClick(order)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ============== Modals ============== */}
      {selectedOrder && (
        <OrderSummaryModal
          open={showSummaryModal}
          onClose={() => {
            orderDetailRequestId.current += 1;
            setShowSummaryModal(false);
            setOrderDetailLoading(false);
          }}
          isLoading={orderDetailLoading}
          loadError={orderDetailError}
          order={{
            items: selectedOrder.items,
            subtotal: selectedOrder.pricingSummary?.subtotal || 0,
            tax: selectedOrder.pricingSummary?.tax || 0,
            total: selectedOrder.pricingSummary?.totalAmount || 0,
            breakdown: selectedOrder.breakdown,
            orderId: selectedOrder.orderId,
            fulfillmentType: selectedOrder.fulfillmentType,
            tableContext: selectedOrder.tableContext,
            paymentType: selectedOrder.paymentDetails?.method || 'Cash',
            customerName: selectedOrder.customerInfo?.name || '',
          }}
          onUpdateItemQuantity={async (itemId, newQty) => {
            if (selectedOrder?.orderId) {
              const updatedItems = selectedOrder.items.map((item: OrderItem) =>
                item.itemId === itemId ? { ...item, quantity: newQty } : item
              );

              const subtotal = updatedItems.reduce(
                (sum: number, item: OrderItem) => {
                  const addOnsTotal =
                    (item.addOns?.reduce(
                      (a: number, addon) => a + (addon.price || 0),
                      0
                    ) || 0) * (item.quantity || 1);
                  return sum + item.price * (item.quantity || 1) + addOnsTotal;
                },
                0
              );
              const tax = Math.round(subtotal * 0.06);
              const total = subtotal + tax;

              await orderApi.updateOrder(selectedOrder.orderId, {
                items: updatedItems,
                pricingSummary: {
                  subtotal,
                  tax,
                  total,
                  taxPercentage: 6,
                  discount: 0,
                  serviceCharge: 0,
                  totalAmount: total,
                },
              });

              setSelectedOrder({
                ...selectedOrder,
                items: updatedItems,
                pricingSummary: {
                  ...selectedOrder.pricingSummary,
                  subtotal,
                  tax,
                  totalAmount: total,
                },
              });
            }
          }}
          onChoosePaymentOption={() => {
            setShowSummaryModal(false);
            setShowPaymentModal(true);
          }}
        />
      )}

      <PaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        total={selectedOrder?.pricingSummary?.totalAmount || 0}
        onConfirm={async (method: PaymentSelection) => {
          if (selectedOrder?.orderId) {
            if (method.method === 'Stripe') {
              try {
                const pending = getOrCreatePendingStripePayment({
                  kind: 'order',
                  id: String(selectedOrder.orderId),
                });
                const response = await createPosOrderPaymentLink({
                  orderId: selectedOrder.orderId,
                  idempotency_key: pending.idempotencyKey,
                }).unwrap();
                const checkoutUrl = getStripeCheckoutUrl(response);
                if (!checkoutUrl) {
                  throw new Error('Stripe did not return a checkout URL. Retry to recover the same payment link.');
                }
                window.location.assign(checkoutUrl);
              } catch (error: unknown) {
                const body = error && typeof error === 'object'
                  ? error as Record<string, unknown>
                  : {};
                const data = body.data && typeof body.data === 'object'
                  ? body.data as Record<string, unknown>
                  : {};
                toast.error(
                  typeof data.message === 'string'
                    ? data.message
                    : typeof body.message === 'string'
                      ? body.message
                      : 'Could not start Stripe checkout. Retry to recover the payment link.',
                );
              }
              return;
            }

            try {
              await orderApi.updateOrder(selectedOrder.orderId, {
                paymentDetails: {
                  method: {
                    option: method.option,
                    paymentOptionId: method.paymentOptionId,
                  },
                  status: 'Paid',
                  transactionId: `TXN-${Date.now()}`,
                },
              });
              setShowPaymentModal(false);
              setShowSuccessModal(true);
            } catch {
              toast.error('Could not update the order payment.');
            }
          }
        }}
      />

      <SuccessModal
        open={showSuccessModal}
        title="Payment Received Successfully!"
        subtitle="Your payment has been processed and the order has been updated."
        buttonText="Back to Order History"
        onButtonClick={() => {
          setShowSuccessModal(false);
          setShowSummaryModal(false);
          activeRefetch();
        }}
      />
    </div>
  );
};

export default OrderHistory;