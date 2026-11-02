type OrderRecord = {
  SubTotal?: unknown;
  subtotal?: unknown;
  Tax?: unknown;
  tax?: unknown;
  Total?: unknown;
  total?: unknown;
  Discount?: unknown;
  discount?: unknown;
  Discount_Amount?: unknown;
  discount_amount?: unknown;
  Service_Charge?: unknown;
  ServiceCharge?: unknown;
  service_charge?: unknown;
  serviceCharge?: unknown;
  Fees?: unknown;
  fees?: unknown;
  items?: OrderLineRecord[];
};

type OrderLineRecord = {
  _id?: unknown;
  item_id?: unknown;
  itemId?: unknown;
  item_Quentry?: unknown;
  quantity?: unknown;
  unit_price?: unknown;
  item_price?: unknown;
  price?: unknown;
  prices?: unknown;
  item_name?: unknown;
  name?: unknown;
  item_note?: unknown;
  notes?: unknown;
  Item?: { item_id?: unknown; item_name?: unknown; prices?: unknown } | null;
  Addon?: OrderModifierRecord | null;
  Variant?: OrderModifierRecord | null;
  addOns?: OrderModifierRecord[];
};

type OrderModifierRecord = {
  item_Addons_id?: unknown;
  item_Variants_id?: unknown;
  id?: unknown;
  Addons?: unknown;
  Variants?: unknown;
  name?: unknown;
  unit_price?: unknown;
  price?: unknown;
  prices?: unknown;
};

export interface OrderHistoryModifier {
  id: string;
  name: string;
  price: number;
}

export interface OrderHistoryLine {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  addOns: OrderHistoryModifier[];
  variant?: OrderHistoryModifier;
  note?: string;
  lineTotal: number;
}

export interface OrderHistoryBreakdown {
  items: OrderHistoryLine[];
  subtotal: number;
  tax: number;
  total: number;
  discount: number;
  serviceCharge: number;
  fees: number;
  subtotalAdjustment: number;
  totalAdjustment: number;
}

const readAmount = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const amount = Number(value);
      if (Number.isFinite(amount)) return amount;
    }
  }
  return undefined;
};

const mapModifier = (
  modifier: OrderModifierRecord | null | undefined,
  fallbackId: unknown,
  fallbackName: string,
): OrderHistoryModifier | undefined => {
  if (!modifier) return undefined;
  const id = modifier.id ?? modifier.item_Addons_id ?? modifier.item_Variants_id ?? fallbackId;
  const name = modifier.name ?? modifier.Addons ?? modifier.Variants;
  return {
    id: String(id ?? fallbackName),
    name: typeof name === 'string' && name.trim() ? name : fallbackName,
    price: readAmount(modifier.unit_price, modifier.price, modifier.prices) ?? 0,
  };
};

const mapLine = (item: OrderLineRecord, index: number): OrderHistoryLine => {
  const itemId = item.item_id ?? item.Item?.item_id ?? item.itemId ?? item._id;
  const name = item.Item?.item_name ?? item.item_name ?? item.name;
  const addOns = [
    ...(item.Addon ? [item.Addon] : []),
    ...(Array.isArray(item.addOns) ? item.addOns : []),
  ].map((addon, addonIndex) =>
    mapModifier(addon, `${itemId ?? index}-addon-${addonIndex}`, 'Add-on'),
  ).filter((addon): addon is OrderHistoryModifier => addon !== undefined);
  const variant = mapModifier(item.Variant, itemId, 'Variant');
  const quantity = Math.max(1, readAmount(item.item_Quentry, item.quantity) ?? 1);
  const price = readAmount(
    item.unit_price,
    item.item_price,
    item.prices,
    item.Item?.prices,
    item.price,
  ) ?? 0;
  const modifierTotal =
    addOns.reduce((sum, addon) => sum + addon.price, 0) + (variant?.price ?? 0);

  return {
    itemId: String(itemId ?? index),
    name:
      typeof name === 'string' && name.trim()
        ? name
        : itemId != null
          ? `Item #${itemId}`
          : `Item ${index + 1}`,
    quantity,
    price,
    addOns,
    ...(variant ? { variant } : {}),
    ...(typeof item.item_note === 'string' && item.item_note
      ? { note: item.item_note }
      : typeof item.notes === 'string' && item.notes
        ? { note: item.notes }
        : {}),
    lineTotal: (price + modifierTotal) * quantity,
  };
};

const roundMoney = (amount: number): number => Math.round((amount + Number.EPSILON) * 100) / 100;

export const getOrderHistoryBreakdown = (order: OrderRecord): OrderHistoryBreakdown => {
  const items = (Array.isArray(order.items) ? order.items : []).map(mapLine);
  const lineTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const subtotal =
    readAmount(order.SubTotal, order.subtotal) ?? lineTotal;
  const tax = readAmount(order.Tax, order.tax) ?? 0;
  const total = readAmount(order.Total, order.total) ?? subtotal + tax;
  const discount =
    readAmount(order.Discount, order.Discount_Amount, order.discount_amount, order.discount) ?? 0;
  const serviceCharge =
    readAmount(
      order.Service_Charge,
      order.ServiceCharge,
      order.service_charge,
      order.serviceCharge,
    ) ?? 0;
  const fees = readAmount(order.Fees, order.fees) ?? 0;

  return {
    items,
    subtotal,
    tax,
    total,
    discount,
    serviceCharge,
    fees,
    subtotalAdjustment: roundMoney(subtotal - lineTotal),
    totalAdjustment: roundMoney(
      total - (subtotal + tax + serviceCharge + fees - discount),
    ),
  };
};

export const formatOrderMoney = (amount: number): string =>
  `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} XOF`;
