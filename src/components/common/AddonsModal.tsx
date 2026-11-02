import React, { useState, useEffect } from "react";
import type { OrderItem } from "@/types/order";

interface AddonsModalProps {
  open: boolean;
  item: OrderItem | null;
  selectedSize?: string; // Made optional to resolve TS errors
  selectedVariantId?: number;
  tableId?: string;
  onClose: () => void;
  onSave: (data: {
    addons: string[];
    note: string;
    size: string;
    variantId?: number;
  }) => void;
}

const dummyAddons = [
  { label: "No Ice", price: 0 },
  { label: "Less Sugar", price: 0 },
  { label: "No Sugar", price: 0 },
  { label: "Extra Cream", price: 20 },
  { label: "Extra Toppings", price: 20 },
  { label: "Extra Thick", price: 20 },
];

const AddonsModal: React.FC<AddonsModalProps> = ({
  open,
  item,
  selectedSize = "S",
  selectedVariantId,
  tableId,
  onClose,
  onSave,
}) => {
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedAddons([]);
      setNote("");
    }
  }, [open, item]);

  const noPriceAddons = dummyAddons.filter((a) => a.price === 0);
  const withPriceAddons = dummyAddons.filter((a) => a.price > 0);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ease-in-out ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className="absolute inset-0 bg-[rgba(0,0,0,0.15)] backdrop-blur-sm"
        onClick={onClose}
      />
      {open && item && (
        <div className="bg-white rounded-2xl w-[400px] max-w-full shadow-xl overflow-hidden relative z-10">
          <div
            className="rounded-t-2xl py-4 px-6  text-black text-left"
            style={{
              background:
                "linear-gradient(180deg, rgba(106, 27, 154, 0.5) 0%, rgba(211, 47, 47, 0.5) 100%)",
            }}
          >
            <div className="text-2xl font-bold">Addons</div>
            <div className="flex justify-between">
              <div className="text-sm font-semibold">Draft</div>
              <div className="text-sm font-semibold text-[#3A3A3C]">
                Table - {tableId || "--"} · Size {selectedSize}
              </div>
            </div>
          </div>
          <div className="p-8 pt-6 pb-0">
            <div className="font-bold text-lg text-left mb-6">Addons</div>
            <div className="flex flex-row gap-6 mb-4">
              {noPriceAddons.map((addon) => (
                <label
                  key={addon.label}
                  className="flex items-center gap-2 cursor-pointer text-base font-normal"
                >
                  <input
                    type="checkbox"
                    checked={selectedAddons.includes(addon.label)}
                    onChange={() =>
                      setSelectedAddons((prev) =>
                        prev.includes(addon.label)
                          ? prev.filter((a) => a !== addon.label)
                          : [...prev, addon.label]
                      )
                    }
                    className="accent-[#6A1B9A] w-4 h-4"
                  />
                  <span>{addon.label}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-col gap-2 mb-8">
              {withPriceAddons.map((addon) => (
                <label
                  key={addon.label}
                  className="flex items-center gap-2 cursor-pointer text-base font-normal"
                >
                  <input
                    type="checkbox"
                    checked={selectedAddons.includes(addon.label)}
                    onChange={() =>
                      setSelectedAddons((prev) =>
                        prev.includes(addon.label)
                          ? prev.filter((a) => a !== addon.label)
                          : [...prev, addon.label]
                      )
                    }
                    className="accent-[#6A1B9A] w-4 h-4"
                  />
                  <span>{addon.label}</span>
                  <span className="text-xs text-[#8E8E93] font-normal">(Extra {addon.price} XOF)</span>
                </label>
              ))}
            </div>
            <div className="mb-8">
              <div className="font-bold mb-2 text-left">Note</div>
              <textarea
                className="w-full rounded-xl p-4 text-base font-normal focus:outline-none resize-none min-h-[56px] bg-[linear-gradient(180deg,rgba(106,27,154,0.1)_0%,rgba(211,47,47,0.1)_100%)] placeholder:text-[#00000099]"
                rows={2}
                placeholder="Enter Notes here....."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="pb-6" />
          </div>
          <div className="px-8 pb-8 pt-2 bg-white">
            <button
              className="w-full py-3 rounded-xl text-lg font-semibold text-white bg-gradient-to-b from-[#6A1B9A] to-[#D32F2F] shadow-md hover:opacity-90 transition-all"
              onClick={() => {
                onSave({
                  addons: selectedAddons,
                  note,
                  size: selectedSize,
                  ...(selectedVariantId != null ? { variantId: selectedVariantId } : {}),
                });
                onClose();
              }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddonsModal;