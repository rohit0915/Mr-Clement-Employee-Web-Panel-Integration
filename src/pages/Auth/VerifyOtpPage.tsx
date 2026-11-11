import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import LeftPanel from '@/components/common/LeftPanel';

import TriaxxLogoImg from '@/assets/LOGOPlande.svg';
import EyeIconImg from '@/assets/eye_icon.svg';
import EyeSlashIconImg from '@/assets/eye-password-hide.svg';

// ============================================================================
// LOCAL API HELPER (Bypasses RTK Query entirely to avoid middleware crashes)
// ============================================================================

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

interface VerifyOtpArgs {
  email: string;
  otp: string;
  newPassword: string;
}

const verifyOtpApi = async (args: VerifyOtpArgs) => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://pos-backend-7xuw.onrender.com';
  const response = await fetch(`${baseUrl}/api/v1/user/forget-password/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(extractErrorMessage({ data }, 'Invalid or expired OTP.'));
  }

  return data;
};

// ============================================================================
// COMPONENT
// ============================================================================

const OTP_LENGTH = 8;

const VerifyOtpPage: React.FC = () => {
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  const email: string = location.state?.email || '';

  // Guard: If user refreshes the page, state is lost. Send them back.
  useEffect(() => {
    if (!email) {
      toast.error('Session expired. Please request a new OTP.');
      navigate('/forgot-password', { replace: true });
    }
  }, [email, navigate]);

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    // 1. Client-side Validation
    if (!email) {
      setError('Session expired. Please restart the flow.');
      return;
    }
    if (otp.length !== OTP_LENGTH) {
      setError(`Please enter the ${OTP_LENGTH}-digit OTP.`);
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please check both fields.');
      return;
    }

    setIsLoading(true);
    let succeeded = false;

    // 2. API Call
    try {
      await verifyOtpApi({ email, otp, newPassword });
      succeeded = true;
    } catch (err: any) {
      console.error('verify-otp failed:', err);
      const msg = err.message || 'Invalid or expired OTP.';
      setError(msg);
      toast.error(msg, { duration: 5000 });
    } finally {
      setIsLoading(false);
    }

    // 3. Navigation and Success Toast
    if (succeeded) {
      toast.success('Password reset successfully!', { duration: 4000 });
      navigate('/password-updated', { replace: true });
    }
  };

  // UI Helper for real-time password matching
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

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
            <h3 className="text-2xl lg:text-[32px] font-bold">
              Verify OTP &amp; Set Password
            </h3>
            <p className="text-sm text-[#000000CC] mt-2 font-normal">
              Enter the code sent to your email and choose a new password
            </p>
            {email && (
              <p className="font-bold text-sm text-black mt-1">{email}</p>
            )}
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium mb-1">
                Enter OTP
              </label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={OTP_LENGTH}
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))
                }
                placeholder="Enter OTP here"
                className="w-full px-4 py-3 bg-[linear-gradient(180deg,rgba(106,27,154,0.1)_0%,rgba(211,47,47,0.1)_100%)] border-transparent rounded-lg focus:ring-1 focus:ring-purple-600 text-sm placeholder-gray-400"
                required
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className={`w-full px-4 py-3 bg-[linear-gradient(180deg,rgba(106,27,154,0.1)_0%,rgba(211,47,47,0.1)_100%)] border-transparent rounded-lg focus:ring-1 focus:ring-purple-600 focus:bg-white text-sm placeholder-gray-400 ${
                    passwordsMismatch ? 'border-red-500 ring-1 ring-red-500' : ''
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500"
                >
                  <img
                    src={showNew ? EyeSlashIconImg : EyeIconImg}
                    alt="Toggle password visibility"
                    className="w-5 h-5"
                  />
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className={`w-full px-4 py-3 bg-[linear-gradient(180deg,rgba(106,27,154,0.1)_0%,rgba(211,47,47,0.1)_100%)] border-transparent rounded-lg focus:ring-1 focus:ring-purple-600 focus:bg-white text-sm placeholder-gray-400 ${
                    passwordsMismatch ? 'border-red-500 ring-1 ring-red-500' : ''
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500"
                >
                  <img
                    src={showConfirm ? EyeSlashIconImg : EyeIconImg}
                    alt="Toggle password visibility"
                    className="w-5 h-5"
                  />
                </button>
              </div>
              {passwordsMismatch && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            {error && <p className="text-sm text-red-600 text-center font-medium">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || otp.length !== OTP_LENGTH || passwordsMismatch}
              className="w-full bg-primary text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:opacity-90 disabled:opacity-70 mt-2"
            >
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <Link
            to="/forgot-password"
            className="mt-4 w-full text-center border border-[#6A1B9A] text-transparent bg-clip-text bg-gradient-to-r from-[#6A1B9A] to-[#D32F2F] font-semibold py-3 px-4 rounded-lg hover:opacity-90"
          >
            Back
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyOtpPage;