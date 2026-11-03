import React from "react";
import successIcon from "@/assets/order/success_icon_large.svg";
import { useTranslation } from "react-i18next";

export const KitchenSuccessModal = ({
  open,
  onClose,
  itemCount,
  orderId,
  tableLabel,
}: {
  open: boolean;
  onClose: () => void;
  itemCount: number;
  orderId?: string;
  tableLabel?: string;
}) => {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-3xl w-[400px] p-8 text-center shadow-2xl relative z-10">
        <div className="flex justify-center mb-4">
          <img src={successIcon} alt="success" className="w-20 h-20" />
        </div>
        <h2 className="text-xl font-bold text-[#00C853] mb-2">{t("Order Sent to Kitchen")}</h2>
        {(orderId || tableLabel) && (
          <p className="text-sm font-semibold text-gray-800 mb-2">
            {[orderId ? `#${orderId}` : null, tableLabel].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="text-sm text-gray-600 mb-3">
          {t("{{count}} items are now in the kitchen queue.", { count: itemCount })}
        </p>
        <p className="text-xs text-gray-500 mb-8">
          {t("Continue to view the order, then start another order when ready.")}
        </p>
        <div className="flex">
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-[#00C853] text-white font-semibold">
            {t("Continue")}
          </button>
        </div>
      </div>
    </div>
  );
};

// ✅ NEW: Exact Payment Success Modal from your screenshot
export const PaymentSuccessModal = ({ 
  open, 
  onClose, 
  amount, 
  method, 
  reference 
}: { 
  open: boolean; 
  onClose: () => void; 
  amount: number; 
  method: string; 
  reference: string; 
}) => {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-3xl w-[420px] p-8 text-center shadow-2xl relative z-10">
        <div className="flex justify-center mb-4">
          <img src={successIcon} alt="success" className="w-20 h-20" />
        </div>
        
        <h2 className="text-xl font-bold text-[#00C853] mb-2">Payment Received Successful !</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {t("Payment was recorded successfully for order {{reference}}.", { reference })}
        </p>

        <div className="flex flex-col items-center gap-1 mb-8">
          <div className="text-sm text-gray-800">
            Amount: <span className="font-bold">{amount.toLocaleString()} XOF</span>
          </div>
          <div className="text-sm text-gray-800">
            Method: <span className="font-bold">{method}</span>
          </div>
          <div className="text-sm text-gray-800">
            Reference: <span className="font-bold">{reference}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-[#00C853] text-white font-semibold hover:bg-[#00A844] transition-colors">
            Start new Order
          </button>
          <button onClick={() => window.print()} className="flex-1 py-3 rounded-xl border border-[#00C853] text-[#00C853] font-semibold hover:bg-green-50 transition-colors">
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
};