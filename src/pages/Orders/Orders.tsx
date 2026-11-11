/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOrderFlowStore, useWalkthroughUIStore } from "@/store/zustandStores";
import type { OrderItem } from "@/types/order";

import {
  useGetAllItemsQuery,
  useGetAllItemTypesQuery,
  useGetAllItemVariantsQuery,
  useGetAllFloorsQuery,
  useCreateOrderMutation,
  useSendToKitchenMutation,
  useUpdateOrderStatusMutation,
  useCreatePaymentMutation,
  useCreatePosOrderPaymentLinkMutation,
  useCancelPosOrderPaymentMutation,
  useCancelOrderMutation,
  useLazyGetOrderPdfUrlQuery,
} from "@/redux/api/quickOrderSlice";

import PaymentModal, { type PaymentSelection } from "@/components/common/PaymentModal";
import ItemDetailsModal from "@/components/common/ItemDetailsModal";
import AddonsModal from "@/components/common/AddonsModal";
import BarTabScreen from "./BarTabScreen";
import { KitchenSuccessModal } from "@/components/common/CustomSuccessModals";
import CancelOrderModal from "@/components/common/CancelOrderModal";

// ✅ React Icons
import { FiMinus, FiPlus } from "react-icons/fi";
import { LuTrash2 } from "react-icons/lu";

// ✅ ADDED IMPORTS FOR READY TO PAY MODAL
import Loader from "@/components/Loader";
import GradientButton from "@/components/common/GradientButton";
import { useWalkthroughStore } from "@/store/walkthroughStore";

import successIcon from "@/assets/order/success_icon_large.svg";
import {
  clearPendingStripePayment,
  getOrCreatePendingStripePayment,
  getPendingStripePayment,
  getStripeActionFailure,
  getStripeCheckoutUrl,
} from "@/utils/stripePayment";

// ✅ 1st Modal: Payment Received Success (Green Buttons)
const PaymentReceivedModal = ({
  open,
  onClose,
  onPrint,
  total,
  orderId,
}: {
  open: boolean;
  onClose: () => void;
  onPrint: () => void;
  total: number;
  orderId?: string;
}) => {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="payment-done-modal fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="relative bg-white rounded-3xl w-[460px] shadow-2xl flex flex-col items-center p-8 animate-in fade-in zoom-in-95 duration-200">
        
        <button 
          onClick={onClose} 
          className="absolute top-5 right-5 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="relative mb-6 mt-2">
          <div className="w-20 h-20 rounded-full bg-[#E8F5E9] flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-[#00C853] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        </div>

        <h2 className="text-[22px] font-bold text-[#00C853] mb-3">{t("Payment Received Successful !")}</h2>

        <p className="text-[13px] text-gray-600 text-center leading-relaxed mb-6 px-4">
          {t("Payment was recorded successfully for order {{reference}}.", {
            reference: orderId ? `#${orderId}` : t("this order"),
          })}
        </p>

        <div className="flex flex-col items-center gap-2 mb-8">
          <p className="text-[15px] font-semibold text-gray-800">
            {t("Amount")}: {total.toLocaleString()} XOF
          </p>
          <p className="text-[15px] font-semibold text-gray-800">{t("Method")}: Mobile Money</p>
          <p className="text-[15px] font-semibold text-gray-800">
            {t("Reference")}: MOMO-{orderId?.slice(-6) || "889322"}
          </p>
        </div>

        <div className="flex gap-4 w-full">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl text-white font-bold bg-[#00C853] hover:bg-[#00A844] transition-all shadow-md"
          >
            {t("Start new Order")}
          </button>
          <button
            onClick={onPrint}
            className="flex-1 py-3.5 rounded-xl font-bold text-[#00C853] bg-white border-2 border-[#00C853] hover:bg-[#E8F5E9] transition-all"
          >
            {t("Print Receipt")}
          </button>
        </div>
      </div>
    </div>
  );
};

// ✅ 2nd Modal: Order Summary / Receipt
const ReceiptModal = ({
  open,
  onClose,
  total,
  orderId,
  items,
  onPrint,
}: {
  open: boolean;
  onClose: () => void;
  total: number;
  orderId?: string;
  items: OrderItem[];
  onPrint: () => void;
}) => {
  const { t } = useTranslation();
  // ✅ FIXED: Using the Lazy query hook correctly
  const [triggerPdf, { isFetching }] = useLazyGetOrderPdfUrlQuery();

  if (!open) return null;

  const currentDate = new Date()
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", " ");

  const handlePrintClick = async () => {
    if (orderId) {
      try {
        const response = await triggerPdf(orderId).unwrap();
        
        // Handle both standard URL strings and Blob responses
        if (typeof response === "string") {
          window.open(response, '_blank');
        } else if (response instanceof Blob) {
          const blobUrl = URL.createObjectURL(response);
          window.open(blobUrl, '_blank');
        } else {
          // Fallback if API returns an object with a specific property
          const url = (response as any)?.url || (response as any)?.data;
          if (url) window.open(url, '_blank');
        }
        return;
      } catch (err) {
        console.error("Failed to fetch PDF:", err);
      }
    }
    onPrint(); // Fallback
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-[420px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 flex justify-between items-center border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{t("Order Summary")}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 flex flex-col items-center bg-[#FAFAFA]">
          <div className="w-full bg-white rounded-2xl shadow-sm relative mb-6">
            <div className="p-6 flex flex-col items-center pb-8">
              <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center mb-4">
                <div className="w-10 h-10 rounded-full bg-[#00C853] flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-1">{t("Payment Success!")}</h3>
              <p className="text-xs text-gray-500 mb-6 text-center">
                {t("Your payment has been successfully done.")}
              </p>

              <div className="text-center mb-6">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  {t("Total Payment")}
                </p>
                <p className="text-2xl font-bold text-gray-900">{total.toLocaleString()} XOF</p>
              </div>

              <div className="w-full border-t border-gray-100 pt-4 mb-4">
                {items.map((item, index) => (
                  <div
                    key={item.lineId ?? `${item.itemId}-${index}`}
                    className="flex justify-between gap-3 text-xs text-gray-700 py-1"
                  >
                    <span>{item.quantity} x {item.name} ({item.size || "M"})</span>
                    <span>{(item.price * item.quantity).toLocaleString()} XOF</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 w-full px-2">
                <div className="bg-white border border-gray-100 rounded-lg p-2.5 shadow-sm">
                  <p className="text-[10px] text-gray-400 mb-0.5">{t("Order Number")}</p>
                  <p className="text-xs font-bold text-gray-800">
                    {orderId || "000085752257"}
                  </p>
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-2.5 shadow-sm">
                  <p className="text-[10px] text-gray-400 mb-0.5">{t("Date & Time")}</p>
                  <p className="text-xs font-bold text-gray-800">{currentDate}</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handlePrintClick}
            disabled={isFetching}
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 mb-6 transition-colors disabled:opacity-50"
          >
            {isFetching ? (
              <span className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
            )}
            {t("Print Receipt")}
          </button>

          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl text-white font-bold bg-gradient-to-r from-[#8E24AA] to-[#E53935] hover:opacity-90 transition-all shadow-md"
          >
            {t("Start New Order")}
          </button>
        </div>
      </div>
    </div>
  );
};

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const trainingPreviewSelector = useWalkthroughStore((state) =>
    state.isActive && state.activeTraining === "order"
      ? state.steps[state.currentStep]?.selector
      : undefined,
  );

  const [activeMode, setActiveMode] = useState<"Food" | "Bar">("Food");
  const [showBarTabScreen, setShowBarTabScreen] = useState(false);

  const {
    currentOrder,
    pendingCustomizedItem,
    clearPendingCustomizedItem,
    addItemToOrder,
    resetOrder,
    startOrder,
    updateOrderItem,
    setCurrentOrderId,
    removeOrderItem,
    setPersons: setPersonsGlobal,
    setServerTotals,
    floor: globalFloor,
  } = useOrderFlowStore();

  const selectedCategory = useWalkthroughUIStore((s) => s.selectedCategory);
  const setSelectedCategory = useWalkthroughUIStore((s) => s.setSelectedCategory);

  const [persons, setPersons] = useState(1);
  const [selectedFloor, setSelectedFloor] = useState(globalFloor || "F-01");
  const [panelMode, setPanelMode] = useState<"idle" | "floor" | "order">("idle");

  const [showItemModal, setShowItemModal] = useState(false);
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReadyToPayModal, setShowReadyToPayModal] = useState(false);

  const [showPaymentReceivedModal, setShowPaymentReceivedModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const [showKitchenSuccess, setShowKitchenSuccess] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [modalItem, setModalItem] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<{ size: string; variantId?: number }>({
    size: "S",
  });

  const [isSendingKitchen, setIsSendingKitchen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const { data: itemTypesData, isFetching: isFetchingTypes } = useGetAllItemTypesQuery({ type: activeMode });
  const { data: itemsData, isLoading: isLoadingItems, isFetching: isFetchingItems } = useGetAllItemsQuery({ type: activeMode });
  const { data: variantsData } = useGetAllItemVariantsQuery();
  const { data: floorsData } = useGetAllFloorsQuery();

  const [createOrder] = useCreateOrderMutation();
  const [sendToKitchen] = useSendToKitchenMutation();
  const [updateOrderStatus] = useUpdateOrderStatusMutation();
  const [createPayment] = useCreatePaymentMutation();
  const [createPosOrderPaymentLink] = useCreatePosOrderPaymentLinkMutation();
  const [cancelPosOrderPayment] = useCancelPosOrderPaymentMutation();
  const [cancelOrder] = useCancelOrderMutation();
  
  // ✅ FIXED: Used the Lazy trigger correctly
  const [triggerGetPdf] = useLazyGetOrderPdfUrlQuery();

  const floorsWithIds = useMemo(() => {
    return (floorsData?.data || []).map((f: any) => ({ id: f.Floor_id, name: f.Floor_Name }));
  }, [floorsData]);

  const categories = useMemo(() => {
    const apiCats =
      itemTypesData?.data?.map((t_item: any, index: number) => {
        const name = String(t_item.Name ?? "").toLowerCase();
        const walkthroughCategory = name.includes("burger") || name.includes("main course")
          ? "burger"
          : name.includes("nugget")
            ? "nugget"
            : name.includes("beverage") || name.includes("drink")
              ? "beverage"
              : index === 0
                ? "burger"
                : index === 1
                  ? "beverage"
                  : "";

        return {
          label: t(t_item.Name),
          value: t_item.Items_types_id.toString(),
          icon: t_item.emozi,
          walkthroughCategory,
          walkthroughClass:
            walkthroughCategory === "burger"
              ? "burgers-tab"
              : walkthroughCategory === "nugget"
                ? "nuggets-tab"
                : walkthroughCategory === "beverage"
                  ? "beverages-tab"
                  : "",
        };
      }) || [];
    return [{
      label: t("All Items"),
      value: "all",
      icon: null,
      walkthroughCategory: "all",
      walkthroughClass: "all-items-tab",
    }, ...apiCats];
  }, [itemTypesData, t]);

  useEffect(() => {
    if (isFetchingTypes || isFetchingItems) return;

    const availableValues = categories.map(c => c.value);
    
    if (selectedCategory === "all") return;

    if (!availableValues.includes(selectedCategory)) {
      setSelectedCategory(categories.length > 1 ? categories[1].value : "all");
    }
  }, [activeMode, categories, selectedCategory, setSelectedCategory, isFetchingTypes, isFetchingItems]);

  const menuItems = useMemo(() => {
    return (itemsData?.data || []).map((item: any) => ({
      itemId: item.Items_id?.toString(),
      name: item["item-name"],
      price: item["item-price"],
      image: item.image_url || item.image,
      itemType: item.Category?.Items_types_id?.toString(),
      itemTypeName: item.Category?.Name || "General",
    }));
  }, [itemsData]);

  const sizeVariants = useMemo(() => {
    const normalizeSize = (value: unknown): string | undefined => {
      if (typeof value !== "string") return undefined;
      const normalized = value.trim().toUpperCase();
      if (["S", "SMALL"].includes(normalized)) return "S";
      if (["M", "MEDIUM"].includes(normalized)) return "M";
      if (["L", "LARGE"].includes(normalized)) return "L";
      return undefined;
    };

    const variants = Array.isArray(variantsData?.data) ? variantsData.data : [];
    const options = variants.flatMap((variant: any) => {
      const name = normalizeSize(
        variant.Variants ?? variant.variant_name ?? variant.name ?? variant.size ?? variant.Size,
      );
      if (!name) return [];
      const idValue =
        variant.item_Variants_id ??
        variant.Item_Variants_id ??
        variant.Variants_id ??
        variant.variant_id ??
        variant.id;
      const id = Number(idValue);
      return [{
        name,
        ...(Number.isInteger(id) && id > 0 ? { id } : {}),
      }];
    });

    return ["S", "M", "L"].map((size) =>
      options.find((variant: { name: string }) => variant.name === size),
    ).filter((variant): variant is { name: string; id?: number } => variant !== undefined);
  }, [variantsData]);

  const searchQuery = new URLSearchParams(location.search).get("search")?.trim() ?? "";
  const normalizedSearchQuery = searchQuery.toLocaleLowerCase();
  const filteredItems = useMemo(() => {
    return menuItems.filter((item: any) => {
      const matchesSearch =
        !normalizedSearchQuery ||
        `${item.name ?? ""} ${item.itemTypeName ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedSearchQuery);
      const matchesCategory =
        normalizedSearchQuery || selectedCategory === "all" || item.itemType === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [selectedCategory, menuItems, normalizedSearchQuery]);

  const isOrderTrainingPreview = [
    ".order-item-first",
    ".order-item-second",
    ".order-item-third",
    ".order-summary-panel",
    ".select-payment-btn",
    ".order-summary-modal",
    ".choose-payment-btn",
    ".ready-to-pay-modal",
    ".payment-done-modal",
    ".order-sent-panel",
  ].includes(trainingPreviewSelector ?? "");
  const showTrainingSampleItems =
    trainingPreviewSelector !== ".order-item-first" &&
    isOrderTrainingPreview;
  const trainingItems = useMemo(
    () =>
      menuItems.slice(0, showTrainingSampleItems ? 3 : 0).map(
        (item: any) => ({
          itemId: item.itemId,
          name: item.name,
          price: Number(item.price) || 0,
          quantity: 1,
          size: "M",
          itemType: item.itemTypeName,
          categoryName: item.itemTypeName,
          image: item.image,
        }),
      ),
    [menuItems, showTrainingSampleItems],
  );
  const items = isOrderTrainingPreview
    ? trainingItems
    : currentOrder?.items || [];
  const subTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subTotal * 0.06);
  const total = currentOrder?.serverTotal ?? subTotal + tax;

  const isOrderPaid =
    !isOrderTrainingPreview &&
    (currentOrder?.orderStatus === "Completed" ||
      currentOrder?.paymentStatus === "Success");
  const isOrderSentToKitchen =
    !isOrderTrainingPreview &&
    (currentOrder?.orderStatus === "In_Kitchen" ||
      currentOrder?.orderStatus === "Cooking" ||
      currentOrder?.orderStatus === "Ready");

  const isOrderLocked = isOrderSentToKitchen || isOrderPaid;
  const canCancel = !isOrderTrainingPreview && !!currentOrder && items.length > 0 && !isOrderPaid && !isCancelling;
  const canSendToKitchen =
    !isOrderTrainingPreview && !!currentOrder && items.length > 0 && !isOrderLocked && !isSendingKitchen;
  const canPay = !isOrderTrainingPreview && !!currentOrder && items.length > 0 && !isOrderPaid && !isProcessingPayment;

  const showSuccessPanel =
    isOrderPaid || trainingPreviewSelector === ".order-sent-panel";
  const showOrderSummary =
    !isOrderPaid &&
    (isOrderTrainingPreview || (panelMode === "order" && currentOrder)) &&
    items.length > 0;

  const groupedItems = useMemo(() => {
    const groups: Record<string, OrderItem[]> = {};
    items.forEach((item: any) => { 
      const cat = item.itemTypeName || "General";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [items]);

  useEffect(() => {
    if (pendingCustomizedItem && currentOrder) {
      addItemToOrder(pendingCustomizedItem);
      clearPendingCustomizedItem();
      showToast(`${t("Added")} ${pendingCustomizedItem.name} ${t("to order!")}`, "success");
    }
  }, [pendingCustomizedItem, currentOrder, addItemToOrder, clearPendingCustomizedItem, t]);

  useEffect(() => {
    setShowPaymentModal(
      trainingPreviewSelector === ".order-summary-modal" ||
        trainingPreviewSelector === ".choose-payment-btn",
    );
    setShowReadyToPayModal(trainingPreviewSelector === ".ready-to-pay-modal");
    setShowPaymentReceivedModal(
      trainingPreviewSelector === ".payment-done-modal",
    );
  }, [trainingPreviewSelector]);

  useEffect(() => {
    const navState = location.state as { tableId?: number; floor?: string; persons?: number };
    if (navState?.tableId) {
      if (currentOrder?.tableId !== String(navState.tableId)) {
        startOrder({
          tableId: String(navState.tableId),
          floor: navState.floor || selectedFloor,
          persons: navState.persons || persons,
        });
      }
      setPanelMode("order");
      window.history.replaceState({}, document.title);
    } else if (currentOrder) {
      setPanelMode("order");
    } else {
      setPanelMode("idle");
    }
  }, [location.state]);

  const handleAddToCart = (item: any) => {
    if (isOrderTrainingPreview) return;
    if (isOrderLocked) {
      showToast(
        isOrderPaid
          ? t("Order is paid — start a new order.")
          : t("Order already sent to kitchen — start a new order to add items."),
        "info"
      );
      return;
    }
    if (panelMode !== "order") {
      setPanelMode("floor");
      return;
    }
    setModalItem(item);
    setShowItemModal(true);
  };

  const handleAddonsSave = ({
    addons,
    note,
    size,
    variantId,
  }: {
    addons: string[];
    note: string;
    size: string;
    variantId?: number;
  }) => {
    if (!modalItem) return;
    const addonPrice = 20;
    const totalAddonPrice = addons.length * addonPrice;

    const customizedItem = {
      ...modalItem,
      price: modalItem.price + totalAddonPrice,
      size,
      ...(variantId != null ? { variantId } : {}),
      addOns: addons.map((name, index) => ({
        id: String(index),
        name,
        price: addonPrice,
      })),
      notes: note,
    };
    
    addItemToOrder(customizedItem);
    setShowAddonModal(false);
    showToast(`${modalItem.name} ${t("added to order!")}`, "success");
  };

  const handleBack = () => {
    if (isOrderLocked) {
      resetOrder();
      setPanelMode("idle");
      showToast(t("Order cleared from screen."), "info");
      return;
    }
    if (items.length === 0) {
      resetOrder();
      setPanelMode("idle");
      return;
    }
    setShowCancelModal(true);
  };

  const confirmCancelOrder = async (reason: string) => {
    if (!currentOrder) {
      setShowCancelModal(false);
      return;
    }
    setIsCancelling(true);
    try {
      if (currentOrder.orderId) {
        await cancelOrder({ id: currentOrder.orderId, reason }).unwrap();
      }
      resetOrder();
      setShowKitchenSuccess(false);
      setShowPaymentReceivedModal(false);
      setShowReceiptModal(false);
      setShowCancelModal(false);
      setPanelMode("idle");
      setPersons(1);
      showToast(t("Order cancelled successfully"), "info");
    } catch (err: any) {
      showToast(err?.data?.message || err?.message || t("Failed to cancel order."), "error");
    } finally {
      setIsCancelling(false);
    }
  };

  const saveOrderToServer = async (): Promise<string | null> => {
    if (currentOrder?.orderId) return currentOrder.orderId;

    try {
      const tableIdNum = Number(String(currentOrder?.tableId).replace(/\D/g, "")) || 2;
      const payload = {
        items: items.map((i: OrderItem) => ({
          item_id: Number(i.itemId),
          item_Quentry: i.quantity,
          item_size: i.size || "M",
          ...(i.variantId != null ? { item_Variants_id: i.variantId } : {}),
          item_note: i.notes || "",
          item_status: "Preparing",
        })),
        Tax: tax,
        Customer_id: 25,
        Dining_Option: "Dine in",
        Table_id: tableIdNum,
        Kitchen_id: 1,
        Order_Status: "Preparing",
        payment_status: "Pending",
        Status: true,
      };

      const res = await createOrder(payload).unwrap();
      const orderId = String(res.data?.POS_Order_id || "");
      setCurrentOrderId(orderId, res.data?._id);
      if (res.data) {
        setServerTotals({
          subTotal: res.data.SubTotal,
          tax: res.data.Tax,
          total: res.data.Total,
        });
      }
      showToast(t("Order created successfully!"), "success");
      return orderId;
    } catch (err: any) {
      showToast(err?.data?.message || err?.message || t("Failed to create order on server."), "error");
      return null;
    }
  };

  const handleSendToKitchen = async () => {
    if (isOrderTrainingPreview) return;
    if (isOrderPaid) return showToast(t("This order is already paid."), "error");
    if (isOrderSentToKitchen) return showToast(t("This order has already been sent."), "info");
    if (items.length === 0) return showToast(t("Add items before sending."), "error");
    if (isSendingKitchen) return;

    setIsSendingKitchen(true);
    try {
      const orderId = await saveOrderToServer();
      if (!orderId) return;

      await sendToKitchen({
        id: orderId,
        items: items.map((i: OrderItem) => ({
          item_id: Number(i.itemId),
          ...(i.variantId != null ? { item_Variants_id: i.variantId } : {}),
          item_size: i.size || "M",
          item_note: i.notes || "",
        })),
      }).unwrap();

      await updateOrderStatus({ id: orderId, Order_Status: "In_Kitchen" }).unwrap();

      useOrderFlowStore.getState().setServerTotals({
        subTotal: currentOrder?.serverSubTotal || subTotal,
        tax: currentOrder?.serverTax || tax,
        total: currentOrder?.serverTotal || total,
        orderStatus: "In_Kitchen",
      });

      setShowKitchenSuccess(true);
      showToast(t("Order sent to kitchen successfully!"), "success");
    } catch (err: any) {
      showToast(err?.data?.message || err?.message || t("Failed to send order."), "error");
    } finally {
      setIsSendingKitchen(false);
    }
  };

  const handlePaymentInitiation = async () => {
    if (isOrderTrainingPreview) return;
    if (isOrderPaid) return showToast(t("This order is already paid."), "info");
    if (items.length === 0) return showToast(t("Add items before paying."), "error");
    if (isProcessingPayment) return;

    setIsProcessingPayment(true);
    try {
      const id = await saveOrderToServer();
      if (!id) return;
      setShowPaymentModal(true);
    } catch {
      showToast(t("Failed to open payment options"), "error");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handlePaymentConfirm = async (result: PaymentSelection) => {
    if (isOrderTrainingPreview) return;
    if (result.method === "Stripe") {
      const orderId = useOrderFlowStore.getState().currentOrder?.orderId;
      if (!orderId) {
        showToast(t("Could not find the order for Stripe checkout."), "error");
        return;
      }

      setIsProcessingPayment(true);
      try {
        const pending = getOrCreatePendingStripePayment({ kind: "order", id: String(orderId) });
        const response = await createPosOrderPaymentLink({
          orderId,
          idempotency_key: pending.idempotencyKey,
        }).unwrap();
        const checkoutUrl = getStripeCheckoutUrl(response);
        if (!checkoutUrl) {
          throw new Error(t("Stripe did not return a checkout URL. Retry to recover the same payment link."));
        }
        window.location.assign(checkoutUrl);
      } catch (err: any) {
        showToast(
          err?.data?.message || err?.message || t("Could not start Stripe checkout. Retry to recover the payment link."),
          "error",
        );
      } finally {
        setIsProcessingPayment(false);
      }
      return;
    }

    const orderId = useOrderFlowStore.getState().currentOrder?.orderId;
    if (!orderId) {
      showToast(t("Could not find the order for payment."), "error");
      return;
    }

    const pendingStripe = getPendingStripePayment();
    if (pendingStripe?.kind === "order" && pendingStripe.id === String(orderId)) {
      setIsProcessingPayment(true);
      try {
        const response = await cancelPosOrderPayment(orderId).unwrap();
        const failure = getStripeActionFailure(response);
        if (failure) throw new Error(failure);
        clearPendingStripePayment();
      } catch (err: any) {
        showToast(
          err?.data?.message || err?.message || t("Could not cancel the pending Stripe checkout."),
          "error",
        );
        return;
      } finally {
        setIsProcessingPayment(false);
      }
    }

    setShowPaymentModal(false);
    setShowReadyToPayModal(true);

    setTimeout(async () => {
      try {
        await createPayment({
          Payment_Options_id: result.paymentOptionId,
          Order_id: orderId,
          payment_method: result.option,
          paymentStatus: "Success",
        }).unwrap();

        useOrderFlowStore.getState().setServerTotals({
          subTotal: currentOrder?.serverSubTotal || subTotal,
          tax: currentOrder?.serverTax || tax,
          total: currentOrder?.serverTotal || total,
          orderStatus: "Completed",
          paymentStatus: "Success",
        });

        await updateOrderStatus({ id: orderId, Order_Status: "Completed" }).unwrap();

        setShowReadyToPayModal(false);
        setShowPaymentReceivedModal(true);
      } catch (err: any) {
        setShowReadyToPayModal(false);
        showToast(err?.data?.message || err?.message || t("Payment update failed."), "error");
      }
    }, 2000);
  };

  const handlePrintClick = () => {
    setShowPaymentReceivedModal(false);
    setShowReceiptModal(true);
    showToast(t("Generating receipt..."), "info");
  };

  // ✅ UPDATED: Uses the Redux Lazy Query to get the PDF URL
  const handleActualPrint = async () => {
    const orderId = currentOrder?.orderId;
    if (orderId) {
      try {
        showToast(t("Fetching PDF receipt..."), "info");
        const response = await triggerGetPdf(orderId).unwrap();
        
        // Handle both standard URL strings and Blob responses
        if (typeof response === "string") {
          window.open(response, '_blank');
        } else if (response instanceof Blob) {
          const blobUrl = URL.createObjectURL(response);
          window.open(blobUrl, '_blank');
        } else {
          const url = (response as any)?.url || (response as any)?.data;
          if (url) window.open(url, '_blank');
        }
        
        showToast(t("PDF opened successfully!"), "success");
        return;
      } catch (err) {
        console.error("Failed to fetch PDF:", err);
        showToast(t("Failed to open PDF. Trying standard print."), "error");
      }
    }
    
    // Fallback
    showToast(t("Sending receipt to printer..."), "info");
    setTimeout(() => showToast(t("Receipt printed successfully!"), "success"), 1500);
  };

  // ✅ FIXED: Only hide the modal. Keeps the Success Panel (Image 2) visible in the background.
  const handleNextOrder = () => {
    if (isOrderTrainingPreview) return;
    setShowKitchenSuccess(false);
    setShowPaymentReceivedModal(false);
    setShowReceiptModal(false);
    
    // We DO NOT call resetOrder() here so the Success Panel stays visible.
    // If the order is not paid (e.g. closed from Kitchen Modal), then we reset.
    if (!currentOrder || currentOrder.orderStatus !== "Completed") {
      resetOrder();
      setPanelMode("idle");
      setPersons(1);
    }
  };

  // ✅ NEW: Triggered ONLY when clicking "Next Order" on the background Success Panel
  const handleBackgroundNextOrder = () => {
    if (isOrderTrainingPreview) return;
    resetOrder();
    setShowKitchenSuccess(false);
    setShowPaymentReceivedModal(false);
    setShowReceiptModal(false);
    setPanelMode("idle");
    setPersons(1);
  };

  if (activeMode === "Bar" && showBarTabScreen) {
    return <BarTabScreen onBack={() => setShowBarTabScreen(false)} />;
  }

  return (
    <div className="flex flex-col min-h-screen p-6 bg-[#F8F8F8]">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          {activeMode === "Food" ? t("Quick Orders") : t("Bar Management")}
        </h1>
        <div className="flex items-center gap-4">
          {activeMode === "Bar" && (
            <button
              onClick={() => setShowBarTabScreen(true)}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-[#8E24AA] to-[#E53935] text-white font-semibold text-sm shadow-md hover:opacity-90 transition-all"
            >
              <span className="text-lg leading-none">+</span> {t("Open Bar Tab")}
            </button>
          )}
          <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border-[#D32F2F] border">
            <button
              onClick={() => setActiveMode("Food")}
              className={`px-6 py-2 rounded-md font-semibold  text-sm transition-all ${
                activeMode === "Food"
                  ? "bg-[linear-gradient(180deg,#6A1B9A_0%,#D32F2F_100%)] text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {t("Food")}
            </button>
            <button
              onClick={() => setActiveMode("Bar")}
              className={`px-6 py-2 rounded-md font-semibold text-sm transition-all ${
                activeMode === "Bar"
                  ? "bg-gradient-to-r from-[#8E24AA] to-[#E53935] text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {t("Bar")}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6 h-[calc(100vh-140px)]">
        {/* LEFT PANEL */}
        <div className="flex-1 bg-white shadow-[0px_0px_15px_8.5px_#0000001A] rounded-[32px] p-6 flex flex-col overflow-hidden">
          
          {/* Categories */}
          <div className="bg-[#F1F1F1] rounded-full px-2 py-1.5 flex items-center gap-1 mb-6 overflow-x-auto no-scrollbar w-fit max-w-full">
            {categories.map((c) => {
              const isActive = selectedCategory === c.value;
              return (
                <button
                  key={c.value}
                  onClick={() => setSelectedCategory(c.value)}
                  data-walkthrough-category={c.walkthroughCategory}
                  data-category-value={c.value}
                  className={`flex items-center gap-2 px-5 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-white text-gray-900 shadow-sm border border-gray-100/50"
                      : "text-gray-500 hover:bg-gray-200/50"
                  } ${c.walkthroughClass}`}
                >
                  {c.icon && <span className="text-base leading-none">{c.icon}</span>}
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>

          {searchQuery && (
            <div
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-100 bg-gradient-to-r from-fuchsia-50/80 to-rose-50/70 px-4 py-3"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-slate-500">Search results for</span>
                <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-800 shadow-sm">
                  “{searchQuery}”
                </span>
                <span className="text-slate-500">
                  {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate("/orders", { replace: true })}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-fuchsia-800 transition hover:bg-white/80"
              >
                Clear search
              </button>
            </div>
          )}

          {/* Items Grid Area */}
          <div className="flex-1 overflow-y-auto">
            {/* ✅ Loading state ONLY for the grid */}
            {isLoadingItems || isFetchingItems || isFetchingTypes ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="bg-white shadow-[0px_0px_10px_2px_#0000001A] rounded-2xl p-3 flex flex-col items-center animate-pulse">
                    <div className="w-20 h-20 bg-gray-200 rounded-full mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-fuchsia-50 text-2xl text-fuchsia-700">
                  <span aria-hidden="true">⌕</span>
                </div>
                <h2 className="text-lg font-semibold text-slate-900">No matching menu items</h2>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Try a different item name or check your spelling.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/orders", { replace: true })}
                  className="mt-4 rounded-xl bg-gradient-to-r from-[#6a1b9a] to-[#c02670] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
                >
                  Browse all items
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredItems.map((item: any, index: number) => (
                  <div
                    key={item.itemId}
                    onClick={() => handleAddToCart(item)}
                    className={`bg-white shadow-lg rounded-2xl p-3 flex flex-col items-center cursor-pointer hover:shadow-md transition-shadow ${
                      isOrderLocked ? "opacity-60 cursor-not-allowed" : ""
                    } ${
                      isOrderTrainingPreview && index === 0
                        ? "order-item-first"
                        : isOrderTrainingPreview && index === 1
                          ? "order-item-second"
                          : isOrderTrainingPreview && index === 2
                            ? "order-item-third"
                            : ""
                    }`}
                  >
                    <img src={item.image} alt={item.name} className="w-20 h-20 rounded-[12px] object-contain mb-2" />
                    <div className="text-sm font-bold text-center line-clamp-1">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.price} XOF</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="w-[340px]  bg-white rounded-[28px] shadow-sm overflow-hidden relative flex flex-col">
          {/* SUCCESS PANEL */}
          {showSuccessPanel && (
            <div className="order-sent-panel w-full h-full flex flex-col justify-between bg-white rounded-[28px]">
              <div className="bg-[#F5F5F5] rounded-t-[28px] p-6 w-full text-left">
                <div className="text-2xl font-bold text-gray-800"># {currentOrder?.orderId || "108"}</div>
                <div className="flex justify-between mt-1">
                  <div className="text-xs font-medium text-gray-500">{t("Order Created")}</div>
                  <div className="text-xs font-medium text-gray-500 text-right">
                    {t("Table")} - {currentOrder?.tableId?.replace("t-", "") || "04"}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center flex-1 py-8">
                <div className="rounded-full p-6 mb-6">
                  <img src={successIcon} alt="success" className="w-24 h-24" />
                </div>
              </div>
              <button
                className="w-full py-4 text-lg font-semibold text-white bg-gradient-to-r from-[#8E24AA] to-[#E53935] hover:opacity-90 transition-all rounded-b-[28px]"
                onClick={handleBackgroundNextOrder} // ✅ Updated this line
              >
                {t("Next Order")}
              </button>
            </div>
          )}

          {/* FLOOR MAP */}
          {!showSuccessPanel && panelMode === "floor" && (
            <div className="w-full h-full flex  flex-col bg-white rounded-[28px] overflow-hidden">
              <div className="bg-gradient-to-b from-[#8E24AA]/20 to-[#E53935]/20 p-6 flex-shrink-0">
                <div className="text-xl font-bold">{t("Floor Map")}</div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-8 text-center">
                  <div className="font-semibold mb-3 text-left">{t("Select Persons:")}</div>
                  <div className="flex justify-center items-center gap-4">
                    <button onClick={() => { setPersons(p => Math.max(1, p - 1)); setPersonsGlobal(persons - 1); }} className="w-10 h-10 bg-gradient-to-r from-[#8E24AA] to-[#E53935] text-white rounded-lg text-xl">-</button>
                    <div className="w-16 h-10 border rounded-lg flex items-center justify-center font-bold">{persons}</div>
                    <button onClick={() => { setPersons(p => p + 1); setPersonsGlobal(persons + 1); }} className="w-10 h-10 bg-gradient-to-r from-[#8E24AA] to-[#E53935] text-white rounded-lg text-xl">+</button>
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-semibold mb-3">{t("Select Floor:")}</div>
                  <div className="grid grid-cols-3 gap-2">
                    {floorsWithIds.map(f => (
                      <button key={f.id} onClick={() => setSelectedFloor(f.name)} className={`py-2 rounded-lg text-sm font-medium transition-colors ${selectedFloor === f.name ? 'bg-gradient-to-r from-[#8E24AA] to-[#E53935] text-white' : 'bg-gray-50 hover:bg-gray-100'}`}>
                        {f.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
                <button onClick={() => navigate("/table", { state: { persons, floor: selectedFloor, floorId: floorsWithIds.find(f => f.name === selectedFloor)?.id } })} className="flex-1 py-4 text-white font-bold bg-gradient-to-r from-[#8E24AA] to-[#E53935] rounded-bl-[28px] hover:opacity-90 transition-opacity">
                  {t("Select Table")}
                </button>
                <button onClick={() => { startOrder({ tableId: "Quick-Table", floor: selectedFloor, persons }); setPanelMode("order"); }} className="flex-1 py-4 text-[#8E24AA] font-bold bg-white border-l hover:bg-gray-50 transition-colors rounded-br-[28px]">
                  {t("Quick Order")}
                </button>
              </div>
            </div>
          )}

          {/* EXACT ORDER SUMMARY MATCHING THE IMAGE */}
          {showOrderSummary && (
            <div className="order-summary-panel w-full h-full flex flex-col bg-white rounded-[28px] overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#D8B4E2] to-[#F4A2A2] p-5 flex justify-between items-center flex-shrink-0">
                <div>
                  <div className="text-xl font-bold text-gray-900">{t("Order Summary")}</div>
                  <div className="text-xs font-semibold text-gray-700">
                    {t("Table")} - {currentOrder?.tableId?.replace("t-", "") || (isOrderTrainingPreview ? "04" : "")}
                  </div>
                </div>
                <button
                  onClick={handleBack}
                  className="text-xs font-bold text-gray-700 bg-white/50 hover:bg-white px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  {isOrderLocked ? t("Close") : t("Back")}
                </button>
              </div>

              {/* Column Headers */}
              <div className="flex justify-between items-center px-4 py-2 border-b border-gray-200 text-[11px] font-bold text-gray-800 flex-shrink-0">
                <div className="w-8 text-left">{t("Qty")}</div>
                <div className="flex-1 text-left pl-2">{t("Item")}</div>
                <div className="w-10 text-center">{t("Size")}</div>
                <div className="w-16 text-right pr-2">{t("Total")}</div>
              </div>

              {/* Items List */}
              <div className={`flex-1 overflow-y-auto px-4 py-2 bg-white ${isOrderLocked ? "pointer-events-none opacity-60" : ""}`}>
                {Object.entries(groupedItems).map(([category, catItems]) => (
                  <div key={category} className="mb-4">
                    {/* Category Badge */}
                    <div className="flex items-center gap-2 mb-3 mt-1">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                        category.toLowerCase().includes('start') ? 'bg-[#FFC107]' : 'bg-[#3B82F6]'
                      }`}>
                        {catItems.length}
                      </div>
                      <span className={`text-[13px] font-bold ${
                        category.toLowerCase().includes('start') ? 'text-[#FFC107]' : 'text-[#3B82F6]'
                      }`}>{category}</span>
                    </div>

                    {/* Items in category */}
                    {catItems.map((item: OrderItem, idx: number) => {
                      const addonUnitTotal = (item.addOns ?? []).reduce(
                        (sum, addon) => sum + (Number(addon.price) || 0),
                        0,
                      );
                      const baseUnitPrice = Math.max(0, item.price - addonUnitTotal);
                      return (
                      <div key={item.lineId ?? `${item.itemId}-${idx}`} className="flex flex-col mb-4">
                        <div className="flex justify-between items-start">
                          <div className="w-8 text-[13px] font-semibold text-gray-800">{item.quantity} x</div>
                          <div className="flex-1 pl-2 pr-2">
                            <div className="text-[13px] font-bold text-gray-900 leading-tight">{item.name}</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {t("Item")}: {baseUnitPrice.toLocaleString()} XOF {t("each")}
                            </div>
                            {item.addOns?.map((addon) => (
                              <div key={addon.id} className="text-[10px] text-gray-500">
                                + {addon.name}: {Number(addon.price || 0).toLocaleString()} XOF {t("each")}
                              </div>
                            ))}
                            {item.variantId != null && item.size && (
                              <div className="text-[10px] text-gray-500">
                                {t("Size")}: {item.size}
                              </div>
                            )}
                            
                            {/* Notes (e.g., No onions) */}
                            {item.notes && (
                              <div className="text-[10px] text-gray-500">
                                {item.notes}
                              </div>
                            )}
                          </div>
                          <div className="w-10 text-center text-[12px] font-medium text-gray-700">{item.size || 'M'}</div>
                          <div className="w-16 text-right text-[12px] font-bold text-gray-900">
                            {(item.price * item.quantity).toLocaleString()} XOF
                          </div>
                        </div>

                        {/* Quantity Controls & Trash */}
                        <div className="flex justify-end items-center gap-2 mt-2">
                          
                          {/* "Allergy" Tag placeholder for visual match */}
                          <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 flex-1 max-w-fit">{t("Allergy")}</span>

                          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden bg-white shadow-sm h-7">
                            <button
                              disabled={isOrderLocked}
                              onClick={() => updateOrderItem(item.lineId ?? item.itemId, { quantity: Math.max(1, item.quantity - 1) })}
                              className="w-7 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 disabled:opacity-50 transition-colors"
                            >
                              <FiMinus size={12} />
                            </button>
                            <span className="w-8 text-center text-xs font-semibold">{item.quantity}</span>
                            <button
                              disabled={isOrderLocked}
                              onClick={() => updateOrderItem(item.lineId ?? item.itemId, { quantity: item.quantity + 1 })}
                              className="w-7 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 disabled:opacity-50 transition-colors"
                            >
                              <FiPlus size={12} />
                            </button>
                          </div>
                          <button
                            disabled={isOrderLocked}
                            onClick={() => removeOrderItem(item.lineId ?? item.itemId)}
                            className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-md bg-white hover:bg-red-50 hover:text-red-500 text-gray-500 disabled:opacity-50 transition-colors shadow-sm"
                          >
                            <LuTrash2 size={14} />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Footer Summary */}
              <div className="bg-[#FDF8FA] border-t border-dashed border-gray-300 px-4 py-3 flex-shrink-0">
                <div className="flex justify-between text-[12px] text-gray-500 mb-1">
                  <span>{t("Items subtotal")}</span>
                  <span>{subTotal.toLocaleString()} XOF</span>
                </div>
                <div className="flex justify-between text-[12px] text-gray-500 mb-1">
                  <span>{t("Tax")} 6%</span>
                  <span>{tax.toLocaleString()} XOF</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-[14px] font-bold text-gray-900">
                    {t("Total")}
                  </div>
                  <div className="text-[14px] font-bold text-gray-900">
                    {total.toLocaleString()} XOF
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col flex-shrink-0">
                {canCancel && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    disabled={isCancelling}
                    className="w-full py-2.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-60 transition-colors border-t border-red-100"
                  >
                    {t("Cancel Order")}
                  </button>
                )}

                <button
                  onClick={handleSendToKitchen}
                  disabled={!canSendToKitchen}
                  className="w-full py-3.5 text-[14px] text-white font-bold bg-[#00C853] hover:bg-[#00A844] disabled:opacity-50 transition-colors"
                >
                  {isSendingKitchen ? t("Sending...") : isOrderSentToKitchen ? t("Sent to Kitchen") : t("Send to Kitchen")}
                </button>

                <button
                  onClick={handlePaymentInitiation}
                  disabled={!canPay}
                  className="select-payment-btn w-full py-3.5 text-[14px] text-white font-bold bg-gradient-to-r from-[#8E24AA] to-[#E53935] disabled:opacity-50 transition-opacity"
                >
                  {isProcessingPayment ? t("Processing...") : isOrderPaid ? t("Paid") : t("Select Payment Option")}
                </button>
              </div>
            </div>
          )}

          {/* EMPTY ORDER */}
          {!showSuccessPanel && panelMode === "order" && currentOrder && items.length === 0 && (
            <div className="w-full h-full shadow-[0px_0px_15px_8.5px_#0000001A] flex flex-col justify-between bg-white rounded-[28px]">
              <div className="bg-gradient-to-b from-[#8E24AA]/20 to-[#E53935]/20 p-6">
                <div className="text-xl font-bold text-gray-800">{t("Start Order")}</div>
                <div className="text-sm text-gray-600">{t("Table")} - {currentOrder.tableId?.replace("t-", "")}</div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <p className="text-lg">{t("Tap items on the left to add them.")}</p>
              </div>
              <button
                onClick={handleBack}
                className="w-full py-3 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border-t border-red-100"
              >
                {t("Cancel Order")}
              </button>
            </div>
          )}

          {/* IDLE */}
          {!showSuccessPanel && panelMode === "idle" && !isOrderTrainingPreview && (
            <div
              onClick={() => setPanelMode("floor")}
              className="select-table-prompt absolute inset-0 w-full h-full flex flex-col shadow-[0px_0px_15px_8.5px_#0000001A] items-center justify-center cursor-pointer bg-white z-50 hover:bg-gray-50 transition-colors rounded-[28px]"
            >
              <div className="text-2xl font-bold text-gray-400 text-center leading-relaxed pointer-events-none">
                {t("Tap to Select Table")}
                <br />&<br />
                {t("Start Order")}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      <ItemDetailsModal
        open={showItemModal}
        item={modalItem}
        variants={sizeVariants}
        onClose={() => setShowItemModal(false)}
        onSelect={(variant) => {
          setSelectedVariant(variant);
          setShowItemModal(false);
          setShowAddonModal(true);
        }}
      />
      <AddonsModal
        open={showAddonModal}
        item={modalItem}
        selectedSize={selectedVariant.size}
        selectedVariantId={selectedVariant.variantId}
        tableId={currentOrder?.tableId || undefined}
        onClose={() => setShowAddonModal(false)}
        onSave={handleAddonsSave}
      />
      <PaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        total={total}
        onConfirm={handlePaymentConfirm}
      />

      {/* ✅ UPDATED READY TO PAY MODAL WITH LOADER AND GRADIENT BUTTON */}
      {showReadyToPayModal && (
        <div className="ready-to-pay-modal fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-3xl p-8 w-[400px] text-center shadow-2xl flex flex-col items-center">
            <h2 className="text-xl font-bold mb-2">{t("Ready to Pay")}</h2>
            <p className="text-sm text-gray-500 mb-8">{t("Place the card at the payment terminal")}</p>
            
            {/* Custom Loader */}
            <div className="mb-8">
              <Loader size={64} thickness={8} />
            </div>

            {/* Gradient Button replacing the gray cancel button */}
            <GradientButton onClick={() => setShowReadyToPayModal(false)}>
              {t("Cancel")}
            </GradientButton>
          </div>
        </div>
      )}
      {/* ------------------------------------------------------- */}

      <PaymentReceivedModal
        open={showPaymentReceivedModal}
        onClose={handleNextOrder}
        onPrint={handlePrintClick}
        total={total}
        orderId={currentOrder?.orderId}
      />

      <ReceiptModal
        open={showReceiptModal}
        onClose={handleNextOrder}
        onPrint={handleActualPrint}
        total={total}
        orderId={currentOrder?.orderId}
        items={items}
      />

      <KitchenSuccessModal
        open={showKitchenSuccess}
        onClose={() => setShowKitchenSuccess(false)}
        itemCount={items.length}
        orderId={currentOrder?.orderId}
        tableLabel={
          currentOrder?.tableId
            ? currentOrder.tableId === "Quick-Table"
              ? t("Quick order")
              : t("Table {{table}}", {
                  table: currentOrder.tableId.replace(/^t-/i, ""),
                })
            : undefined
        }
      />

      <CancelOrderModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={confirmCancelOrder}
        loading={isCancelling}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top-4 fade-in duration-300">
          <div
            className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border ${
              toast.type === "error" ? "bg-red-50 border-red-200 text-red-800" : toast.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <span className="font-semibold text-sm">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;