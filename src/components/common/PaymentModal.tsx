/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useGetMyPaymentOptionsQuery } from "@/redux/api/quickOrderSlice";

export type PaymentSelection =
  | { method: "Stripe"; option: "Stripe"; paymentOptionId?: never }
  | { method: "Cash"; option: string; paymentOptionId: number };

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (result: PaymentSelection) => void | Promise<void>;
  total: number;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ open, onClose, onConfirm, total }) => {
  const { data, isLoading, isError } = useGetMyPaymentOptionsQuery(undefined, { skip: !open });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<"Stripe" | "Cash">("Stripe");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ STEP 1: Only keep methods where the category is "Cash"
  const cashMethods = data?.methods?.filter(
    (m: any) => m.payment_category === "Cash" || m.option.toLowerCase().includes("cash")
  ) || [];

  useEffect(() => {
    if (open) {
      setSelectedMethod("Stripe");
      setSelectedId(null);
      setSelectedLabel("");
      setIsSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = selectedMethod === "Stripe" || selectedId !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="order-summary-modal bg-white rounded-2xl w-[420px] max-w-full shadow-xl overflow-hidden relative z-10 flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div className="text-2xl font-bold text-left">Payment Options</div>
          <button className="text-2xl font-bold text-gray-500" onClick={onClose}>&times;</button>
        </div>
        
        <div className="flex flex-col gap-2 px-6 pt-2 pb-4 flex-1 max-h-[60vh] overflow-y-auto">
          <label
            className={`flex items-center justify-between py-3 px-4 rounded-xl cursor-pointer border transition-all ${
              selectedMethod === "Stripe" ? "border-[#8E24AA] bg-purple-50" : "border-gray-200 hover:bg-gray-50"
            }`}
          >
            <div className="flex flex-col">
              <span className="font-semibold text-gray-800">Stripe</span>
              <span className="text-xs text-gray-500">Secure hosted checkout</span>
            </div>
            <input
              type="radio"
              name="payment"
              value="Stripe"
              checked={selectedMethod === "Stripe"}
              onChange={() => setSelectedMethod("Stripe")}
              className="accent-[#8E24AA] w-5 h-5"
            />
          </label>
          <p className="text-xs font-semibold text-gray-500 pt-2">Cash</p>
          {isLoading ? (
            <div className="text-center py-4 text-gray-500">Loading options...</div>
          ) : isError ? (
            <div className="text-center py-4 text-red-600" role="alert">Could not load cash payment options.</div>
          ) : cashMethods.length === 0 ? (
            <div className="text-center py-4 text-gray-500">No Cash payment methods configured.</div>
          ) : (
            cashMethods.map((opt: any, idx: number) => (
              <label 
                key={`${opt.Payment_Options_id}-${idx}`} 
                className={`flex items-center justify-between py-3 px-4 rounded-xl cursor-pointer border transition-all ${
                  selectedId === opt.Payment_Options_id ? "border-[#8E24AA] bg-purple-50" : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800">{opt.option}</span>
                  {opt.Details && <span className="text-xs text-gray-500">({opt.Details})</span>}
                </div>
                <input 
                  type="radio" 
                  name="payment" 
                  value={opt.Payment_Options_id} 
                  checked={selectedId === opt.Payment_Options_id} 
                  onChange={() => {
                    setSelectedId(opt.Payment_Options_id);
                    setSelectedLabel(opt.option);
                    setSelectedMethod("Cash");
                  }} 
                  className="accent-[#8E24AA] w-5 h-5" 
                />
              </label>
            ))
          )}
        </div>
        
        <div className="flex flex-col gap-3 px-6 pb-6 pt-2 border-t">
          <button
            className="choose-payment-btn w-full py-3 rounded-xl text-lg font-semibold text-white bg-gradient-to-r from-[#8E24AA] to-[#D32F2F] shadow-md hover:opacity-90 transition-all disabled:opacity-50"
            disabled={!canSubmit || isSubmitting}
            onClick={async () => {
              if (!canSubmit || isSubmitting) return;
              setIsSubmitting(true);
              try {
                if (selectedMethod === "Stripe") {
                  await onConfirm({ method: "Stripe", option: "Stripe" });
                } else if (selectedId !== null) {
                  await onConfirm({
                    method: "Cash",
                    option: selectedLabel,
                    paymentOptionId: selectedId,
                  });
                }
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {isSubmitting ? "Starting payment..." : `Pay ${total.toLocaleString()} XOF`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;