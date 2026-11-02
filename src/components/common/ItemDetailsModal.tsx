import React, { useEffect, useState } from "react";
import type { OrderItem } from "@/types/order";
import backIcon from "@/assets/back.svg";

interface ItemDetailsModalProps {
  open: boolean;
  item: OrderItem | null;
  variants?: { id?: number; name: string }[];
  onClose: () => void;
  onSelect: (variant: { size: string; variantId?: number }) => void;
}

const sizes = ["S", "M", "L"];

const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({
  open,
  item,
  variants = [],
  onClose,
  onSelect,
}) => {
  const [selectedSize, setSelectedSize] = useState("S");
  const [showFullDesc, setShowFullDesc] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedSize("S");
      setShowFullDesc(false);
    }
  }, [open, item?.itemId]);

  if (!open || !item) return null;

  // Truncate description for preview
  const descPreview = item.description && item.description.length > 80 && !showFullDesc
    ? item.description.slice(0, 80) + "..."
    : item.description;

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
      <div className="bg-white rounded-2xl w-[370px] max-w-full shadow-xl overflow-hidden relative z-10 flex flex-col" style={{ minHeight: 600 }}>
        {/* Header */}
        <div className="flex items-center justify-center relative px-0 pt-6 pb-2">
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 p-1"
            onClick={onClose}
            aria-label="Back"
          >
            <img src={backIcon} alt="Back" className="w-5 h-5" />
          </button>
          <div className="text-xl font-bold text-center w-full">Item Details</div>
        </div>
        {/* Image */}
        <div className="px-6">
          <img
            src={item.image || "https://via.placeholder.com/120x120?text=Item"}
            alt={item.name}
            className="w-full h-[160px] object-cover rounded-xl mb-4"
          />
        </div>
        {/* Content */}
        <div className="flex-1 flex flex-col px-6">
          {/* Title & Subtitle */}
          <div className="font-semibold text-lg mb-0.5 text-left">{item.name}</div>
          <div className="text-[#00000099] text-sm mb-4 text-left">{item.itemType}</div>
          {/* Description */}
          <div className="font-semibold text-xl mb-1 text-left">{item.name}</div>
          <div className="text-[#00000099] text-sm mb-4 text-left font-normal">
            {descPreview}
            {item.description && item.description.length > 80 && !showFullDesc && (
              <span
                className="text-primary-gradient cursor-pointer ml-1 text-sm font-normal"
                onClick={() => setShowFullDesc(true)}
              >
                Read More
              </span>
            )}
          </div>
          {/* Size */}
          <div className="w-full mb-6">
            <div className="font-semibold mb-2 text-left">Size</div>
            <div className="flex gap-3 justify-start">
              {sizes.map((size) => (
                <button
                  key={size}
                  className={`w-14 h-10 rounded-xl border font-semibold text-base transition-all flex items-center justify-center  ${
                    selectedSize === size
                      ? "bg-gradient-to-r from-[#6A1B9A] to-[#D32F2F] text-white border-transparent shadow"
                      : "bg-white text-[#00000099] border-[#D0B6E6] border-2"
                  }`}
                  style={{ minWidth: 56 }}
                  onClick={() => setSelectedSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="w-full flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white sticky bottom-0 z-20">
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold mb-0.5">Price</span>
            <span className="text-xl font-bold text-primary-gradient">{item.price} XOF</span>
          </div>
          <button
            className="px-10 py-2 rounded-xl text-white font-semibold bg-gradient-to-r from-[#6A1B9A] to-[#D32F2F] shadow hover:opacity-90 transition-all text-lg"
            onClick={() => {
              const selectedVariant = variants.find(
                (variant) => variant.name.toUpperCase() === selectedSize,
              );
              onSelect({
                size: selectedSize,
                ...(selectedVariant?.id != null ? { variantId: selectedVariant.id } : {}),
              });
              onClose();
            }}
          >
            Add Item
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemDetailsModal;
