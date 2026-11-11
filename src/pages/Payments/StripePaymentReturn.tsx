import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  useCancelBarTabPaymentMutation,
  useCancelPosOrderPaymentMutation,
  useConfirmBarTabPaymentMutation,
  useConfirmPosOrderPaymentMutation,
} from '@/redux/api/quickOrderSlice';
import {
  clearPendingStripePayment,
  getStripeActionFailure,
  getPendingStripePayment,
  type PendingStripePayment,
} from '@/utils/stripePayment';

const getErrorMessage = (error: unknown): string => {
  if (!error || typeof error !== 'object') return 'Please try again.';
  const body = error as Record<string, unknown>;
  const data = body.data;
  if (data && typeof data === 'object') {
    const message = (data as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
  }
  return typeof body.message === 'string' ? body.message : 'Please try again.';
};

const StripePaymentReturn = () => {
  const isCancellation = useLocation().pathname.endsWith('/cancel');
  const [pending, setPending] = useState<PendingStripePayment | null>(() =>
    getPendingStripePayment(),
  );
  const [message, setMessage] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const confirmationStarted = useRef(false);
  const [confirmOrderPayment, { isLoading: confirmingOrder }] =
    useConfirmPosOrderPaymentMutation();
  const [confirmBarTabPayment, { isLoading: confirmingTab }] =
    useConfirmBarTabPaymentMutation();
  const [cancelOrderPayment, { isLoading: cancellingOrder }] =
    useCancelPosOrderPaymentMutation();
  const [cancelBarTabPayment, { isLoading: cancellingTab }] =
    useCancelBarTabPaymentMutation();
  const isLoading = confirmingOrder || confirmingTab || cancellingOrder || cancellingTab;

  const confirmPayment = useCallback(async (payment: PendingStripePayment) => {
    setMessage('');
    try {
      const result = payment.kind === 'order'
        ? await confirmOrderPayment(payment.id).unwrap()
        : await confirmBarTabPayment(payment.id).unwrap();
      if (result.statusCode === 202) {
        setMessage('Stripe has not verified every payment yet. The bill remains unpaid; you can check again shortly.');
        return;
      }
      const failure = getStripeActionFailure(result.body);
      if (failure) {
        setMessage(failure);
        return;
      }
      if (result.statusCode === 200) {
        clearPendingStripePayment();
        setPending(null);
        setIsConfirmed(true);
        setMessage('Stripe verified the payment and the server settled the bill.');
      } else {
        setMessage('The server returned an unexpected confirmation status. The bill has not been marked paid.');
      }
    } catch (error: unknown) {
      setMessage(`Could not verify the payment. ${getErrorMessage(error)}`);
    }
  }, [confirmOrderPayment, confirmBarTabPayment]);

  useEffect(() => {
    if (!isCancellation && pending && !confirmationStarted.current) {
      confirmationStarted.current = true;
      void confirmPayment(pending);
    }
  }, [confirmPayment, isCancellation, pending]);

  const handleCancelCheckout = async () => {
    if (!pending) return;
    setMessage('');
    try {
      const response = pending.kind === 'order'
        ? await cancelOrderPayment(pending.id).unwrap()
        : await cancelBarTabPayment(pending.id).unwrap();
      const failure = getStripeActionFailure(response);
      if (failure) {
        setMessage(failure);
        return;
      }
      clearPendingStripePayment();
      setPending(null);
      setIsCancelled(true);
      setMessage('The unpaid Stripe checkout was cancelled and the bill is unlocked.');
    } catch (error: unknown) {
      setMessage(`Could not cancel the checkout. ${getErrorMessage(error)}`);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <section className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900">
          {isCancellation ? 'Stripe checkout cancelled' : 'Checking your Stripe payment'}
        </h1>
        <p className="mt-3 text-gray-600">
          {isCancellation
            ? 'Returning from Stripe does not cancel the payment session or change the bill status.'
            : 'We verify payment status with the server. A redirect by itself does not mark the bill as paid.'}
        </p>

        {message && (
          <p className="mt-5 rounded-lg bg-purple-50 p-4 text-sm text-gray-800" role="status">
            {message}
          </p>
        )}

        {!pending && !isConfirmed && !isCancelled && (
          <p className="mt-5 text-sm text-amber-700" role="alert">
            No active Stripe payment was found in this browser. Check the bill status in POS before retrying payment.
          </p>
        )}

        {!isCancellation && pending && !isConfirmed && (
          <button
            type="button"
            className="mt-5 rounded-lg border border-[#8E24AA] px-4 py-2 font-semibold text-[#8E24AA] disabled:opacity-50"
            disabled={isLoading}
            onClick={() => {
              confirmationStarted.current = true;
              void confirmPayment(pending);
            }}
          >
            {isLoading ? 'Checking…' : 'Check payment again'}
          </button>
        )}

        {pending && !isConfirmed && !isCancelled && (
          <button
            type="button"
            className="mt-5 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
            disabled={isLoading}
            onClick={handleCancelCheckout}
          >
            {isLoading ? 'Please wait…' : 'Cancel unpaid checkout and unlock bill'}
          </button>
        )}

        <div>
          <Link
            to="/orders"
            className="mt-6 inline-block rounded-lg bg-[#8E24AA] px-4 py-2 font-semibold text-white"
          >
            Return to POS
          </Link>
        </div>
      </section>
    </main>
  );
};

export default StripePaymentReturn;
