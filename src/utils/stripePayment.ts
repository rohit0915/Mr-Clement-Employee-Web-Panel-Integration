export type StripePaymentResource =
  | { kind: 'order'; id: string }
  | { kind: 'bar-tab'; id: string };

export type PendingStripePayment = StripePaymentResource & {
  idempotencyKey: string;
};

const pendingPaymentStorageKey = 'pendingStripePosPayment';

export const getStripeActionFailure = (response: unknown): string | null => {
  if (!response || typeof response !== 'object') return null;
  const body = response as Record<string, unknown>;
  if (body.success !== false) return null;
  return typeof body.message === 'string'
    ? body.message
    : 'The server did not confirm the requested payment action.';
};

export const getStripeCheckoutUrl = (response: unknown): string | null => {
  if (!response || typeof response !== 'object') return null;

  const root = response as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object'
    ? root.data as Record<string, unknown>
    : root;
  const payments = Array.isArray(data.payments) ? data.payments : [];
  const firstPayment = payments[0];
  const url =
    data.checkout_url ??
    data.url ??
    (firstPayment && typeof firstPayment === 'object'
      ? (firstPayment as Record<string, unknown>).url
      : undefined);

  return typeof url === 'string' && /^https:\/\/\S+$/i.test(url) ? url : null;
};

const createIdempotencyKey = (resource: StripePaymentResource): string => {
  const uniqueId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `pos-${resource.kind}-${resource.id}-${uniqueId}`;
};

export const getOrCreatePendingStripePayment = (
  resource: StripePaymentResource,
): PendingStripePayment => {
  const existing = getPendingStripePayment();
  if (existing?.kind === resource.kind && existing.id === resource.id) {
    return existing;
  }

  const pending = { ...resource, idempotencyKey: createIdempotencyKey(resource) };
  localStorage.setItem(pendingPaymentStorageKey, JSON.stringify(pending));
  return pending;
};

export const getPendingStripePayment = (): PendingStripePayment | null => {
  const stored = localStorage.getItem(pendingPaymentStorageKey);
  if (!stored) return null;

  try {
    const pending = JSON.parse(stored) as Partial<PendingStripePayment>;
    if (
      (pending.kind === 'order' || pending.kind === 'bar-tab') &&
      typeof pending.id === 'string' &&
      typeof pending.idempotencyKey === 'string'
    ) {
      return pending as PendingStripePayment;
    }
  } catch {
    localStorage.removeItem(pendingPaymentStorageKey);
  }

  return null;
};

export const clearPendingStripePayment = (): void => {
  localStorage.removeItem(pendingPaymentStorageKey);
};
