type OrderRecord = {
  CreateAt?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
  Dining_Option?: unknown;
  orderType?: unknown;
  order_type?: unknown;
  fulfillment_type?: unknown;
  Table_id?: unknown;
  Table?: {
    table_name?: unknown;
    name?: unknown;
  } | null;
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

export const getOrderCreatedAt = (
  order: Pick<OrderRecord, 'CreateAt' | 'created_at' | 'createdAt'>,
): Date | null => {
  const timestamp = order.CreateAt ?? order.created_at ?? order.createdAt;
  if (typeof timestamp !== 'string' && !(timestamp instanceof Date)) return null;
  const createdAt = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return Number.isFinite(createdAt.getTime()) ? createdAt : null;
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
  item_size?: unknown;
  size?: unknown;
  item_Variants_id?: unknown;
  variant_name?: unknown;
  variant_price?: unknown;
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
  const variant = mapModifier(
    item.Variant ?? (
      typeof (item.item_size ?? item.size ?? item.variant_name) === 'string'
        ? {
            id: item.item_Variants_id,
            name: item.variant_name ?? item.item_size ?? item.size,
            price: item.variant_price,
          }
        : undefined
    ),
    item.item_Variants_id ?? itemId,
    'Variant',
  );
  const quantity = Math.max(1, readAmount(item.item_Quentry, item.quantity) ?? 1);
  const price = readAmount(
    item.unit_price,
    item.item_price,
    item.price,
    item.prices,
    item.Item?.prices,
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

export const getOrderFulfillmentType = (order: {
  Dining_Option?: unknown;
  orderType?: unknown;
  order_type?: unknown;
  fulfillment_type?: unknown;
}): string => {
  const value =
    order.Dining_Option ??
    order.fulfillment_type ??
    order.order_type ??
    order.orderType;
  if (typeof value !== 'string' || !value.trim()) return 'Fulfillment not specified';

  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized === 'dine in') return 'Dine in';
  if (normalized === 'takeaway' || normalized === 'take away') return 'Takeaway';
  if (normalized === 'delivery') return 'Delivery';
  return value.trim();
};

export const getOrderTableContext = (order: {
  Dining_Option?: unknown;
  orderType?: unknown;
  order_type?: unknown;
  fulfillment_type?: unknown;
  Table_id?: unknown;
  Table?: { table_name?: unknown; name?: unknown } | null;
}): string | undefined => {
  if (getOrderFulfillmentType(order) !== 'Dine in') return undefined;
  const tableName = order.Table?.table_name ?? order.Table?.name;
  if (typeof tableName === 'string' && tableName.trim()) return tableName.trim();
  const tableId = order.Table_id;
  if (typeof tableId === 'number' || (typeof tableId === 'string' && tableId.trim())) {
    return `Table ${tableId}`;
  }
  return undefined;
};
