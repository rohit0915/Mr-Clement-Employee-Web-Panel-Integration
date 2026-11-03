import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import LeftPanel from '@/components/common/LeftPanel';
import { useForgetPasswordSendOtpMutation } from '@/api/apiSlice';

import TriaxxLogoImg from '@/assets/tiaxx_logo.svg';

const extractErrorMessage = (err: any, fallback: string): string => {
  const data = err?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.detail === 'string') return data.detail;
  for (const key of Object.keys(data)) {
    const val = (data as any)[key];
    if (Array.isArray(val) && val[0]) return `${key}: ${val[0]}`;
    if (typeof val === 'string') return `${key}: ${val}`;
  }
  return fallback;
};

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const [sendOtp] = useForgetPasswordSendOtpMutation();

  const handleResetRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await sendOtp({ email }).unwrap();
      setEmailSubmitted(true);
      toast.success(
        response?.message || 'OTP sent successfully to your email address.',
        { duration: 4000 },
      );
    } catch (err: any) {
      const msg = extractErrorMessage(
        err,
        'Failed to send reset instructions. Please try again.',
      );
      setError(msg);
      toast.error(msg, { duration: 5000 });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    setError(null);

    try {
      const result = await sendOtp({ email }).unwrap();
      toast.success(result?.message || 'OTP resent successfully.', {
        duration: 4000,
      });
    } catch (err: any) {
      const msg = extractErrorMessage(err, 'Failed to resend OTP.');
      setError(msg);
      toast.error(msg, { duration: 5000 });
    } finally {
      setResending(false);
    }
  };

  const handleNavigateToVerify = () => {
    if (!email) {
      toast.error('Session expired. Please request a new OTP.');
      return;
    }
    navigate('/verify-otp', { state: { email } });
  };

  return (
    <div className="flex min-h-screen items-center justify-center gradient-background-mobile p-4 lg:p-0 lg:bg-[#F8F8F8]">
      <div className="flex w-full max-w-sm flex-col rounded-3xl bg-white p-6 shadow-2xl lg:h-screen lg:max-w-none lg:flex-row lg:p-0 lg:shadow-none lg:rounded-none">
        <LeftPanel />

        <div className="w-full lg:w-2/5 lg:p-10 xl:px-20 flex flex-col justify-center">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-xl lg:text-2xl font-bold">Sign in</h2>
            <img src={TriaxxLogoImg} alt="TRIAXX Logo" className="h-6 lg:h-8" />
          </div>

          <div className="text-center mb-8">
            <h3 className="text-2xl lg:text-[32px] font-bold">Forgot password?</h3>
            <p className="text-sm text-[#000000CC] mt-2 font-normal">
              {emailSubmitted
                ? 'An authentication code has been sent to your email'
                : 'We will send you instructions for reset in registered email'}
            </p>
            {emailSubmitted && (
              <p className="font-bold text-sm text-black mt-1">{email}</p>
            )}
          </div>

          {!emailSubmitted ? (
            <form onSubmit={handleResetRequest} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter Email here"
                  className="w-full px-4 py-3 bg-[linear-gradient(180deg,rgba(106,27,154,0.1)_0%,rgba(211,47,47,0.1)_100%)] border-transparent rounded-lg focus:ring-1 focus:ring-purple-600 text-sm placeholder-gray-400"
                  required
                />
              </div>

              {error && <p className="text-sm text-red-600 text-center">{error}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:opacity-90 disabled:opacity-70 mt-4"
              >
                {isLoading ? 'Sending...' : 'Reset Password'}
              </button>
            </form>
          ) : (
            <div className="mt-6 space-y-4">
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}

              <button
                onClick={handleNavigateToVerify}
                disabled={!email}
                className="w-full bg-primary text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:opacity-90 disabled:opacity-70"
              >
                Verify OTP
              </button>

              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full text-sm text-purple-600 font-medium hover:underline disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {resending ? 'Sending...' : "Didn't receive the code? Resend OTP"}
              </button>
            </div>
          )}

          <Link
            to="/login"
            className="mt-4 w-full text-center font-semibold py-3 px-4 gradient-border hover:opacity-90"
          >
            <div className="gradient-border-inner">Back</div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;