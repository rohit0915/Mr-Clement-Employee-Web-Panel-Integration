import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  useLoginEmployeeMutation,
  useVerifyEmployeeOtpMutation,
  useResendEmployeeOtpMutation,
} from '@/api/apiSlice';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import LeftPanel from '@/components/common/LeftPanel';

import TriaxxLogoImg from '@/assets/LOGOPlande.svg';
import EyeIconImg from '@/assets/eye_icon.svg';
import EyeSlashIconImg from '@/assets/eye-password-hide.svg';
import FacebookIconImg from '@/assets/auth/facebook.svg';
import GoogleIconImg from '@/assets/auth/google.svg';
import AppleIconImg from '@/assets/auth/apple.svg';

type Tab = 'Restaurant' | 'Employee' | 'Admin';
type Step = 'credentials' | 'otp';

export interface Language {
  code: 'en' | 'fr';
  label: string;
  emoji: string;
}

const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', emoji: '🇺🇸' },
  { code: 'fr', label: 'French', emoji: '🇫🇷' },
];

const OTP_LENGTH = 8;

const extractErrorMessage = (err: any, fallback: string): string => {
  const data = err?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.non_field_errors) && data.non_field_errors[0]) {
    return data.non_field_errors[0];
  }
  if (Array.isArray(data?.errors) && data.errors[0]?.msg) {
    return data.errors[0].msg;
  }
  for (const key of Object.keys(data)) {
    const val = (data as any)[key];
    if (Array.isArray(val) && val[0]) return `${key}: ${val[0]}`;
    if (typeof val === 'string') return `${key}: ${val}`;
  }
  return fallback;
};

const extractToken = (result: any): string | null => {
  const candidates = [
    result?.data?.access_token,
    result?.data?.access,
    result?.data?.token,
    result?.data?.tokens?.access,
    result?.data?.tokens?.access_token,
    result?.access_token,
    result?.access,
    result?.token,
    result?.tokens?.access,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return null;
};

const extractRefreshToken = (result: any): string | null => {
  const candidates = [
    result?.data?.refresh_token,
    result?.data?.refresh,
    result?.data?.tokens?.refresh,
    result?.refresh_token,
    result?.refresh,
    result?.tokens?.refresh,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return null;
};

function useClickOutside<T extends HTMLElement>(
  onClose: () => void,
  isOpen: boolean,
): React.RefObject<T | null> {
  const ref = useRef<T>(null);
  const cbRef = useRef(onClose);

  useEffect(() => {
    cbRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        cbRef.current();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cbRef.current();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  return ref;
}

const LoginPage: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [activeTab, setActiveTab] = useState<Tab>('Employee');
  const [step, setStep] = useState<Step>('credentials');

  // Credentials
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [employeeLoginCode, setEmployeeLoginCode] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const [loginEmployee] = useLoginEmployeeMutation();
  const [verifyEmployeeOtp] = useVerifyEmployeeOtpMutation();
  const [resendEmployeeOtp] = useResendEmployeeOtpMutation();

  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---------------- Language Dropdown State ---------------- */
  const [langOpen, setLangOpen] = useState(false);
  const closeLang = useCallback(() => setLangOpen(false), []);
  const langRef = useClickOutside<HTMLDivElement>(closeLang, langOpen);

  const currentLanguageCode = i18n.resolvedLanguage || 'en';
  const currentLanguage =
    LANGUAGES.find((l) => l.code === currentLanguageCode) || LANGUAGES[0];

  const handleSelectLanguage = useCallback(
    (lang: Language) => {
      i18n.changeLanguage(lang.code);
      setLangOpen(false);
      toast.success(`${t('Language')}: ${t(lang.label)}`, {
        duration: 2000,
        position: 'top-right',
      });
    },
    [i18n, t],
  );

  // OTP countdown
  useEffect(() => {
    if (step !== 'otp') return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [step]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const result = await loginEmployee({
        employee_login_code: employeeId,
        password,
      }).unwrap();

      if (result.data?.requires_otp) {
        setChallengeId(result.data.challenge_id);
        setMaskedEmail(result.data.email);
        setEmployeeLoginCode(result.data.employee_login_code);
        setExpiresIn(result.data.expires_in_seconds);
        setOtp('');
        setStep('otp');

        toast.success(result.message || 'OTP sent to your email', {
          duration: 4000,
        });
      } else {
        toast.error('Unexpected response from server.', { duration: 4000 });
      }
    } catch (err: any) {
      console.error('Login error:', err?.status, err?.data, err);
      toast.error(extractErrorMessage(err, 'Login failed. Please try again.'), {
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (otp.length !== OTP_LENGTH) {
      toast.error(`Please enter the ${OTP_LENGTH}-digit OTP.`, {
        duration: 4000,
      });
      return;
    }

    setIsLoading(true);
    let succeeded = false;

    try {
      const result = await verifyEmployeeOtp({
        challenge_id: challengeId,
        otp,
      }).unwrap();

      const token = extractToken(result);
      const refreshToken = extractRefreshToken(result);

      if (token) {
        const storage = rememberMe ? localStorage : sessionStorage;

        if (rememberMe) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('refresh_token');
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
        }

        storage.setItem('token', token);
        if (refreshToken) storage.setItem('refresh_token', refreshToken);
        storage.setItem('rememberMe', String(rememberMe));
      } else {
        console.warn('No token found in OTP verify response:', result);
        toast.error('Login succeeded but no token was returned.', {
          duration: 5000,
        });
        return;
      }

      succeeded = true;
    } catch (err: any) {
      console.error('OTP verify error:', err?.status, err?.data, err);
      toast.error(
        extractErrorMessage(err, 'Invalid or expired OTP. Please try again.'),
        { duration: 5000 },
      );
    } finally {
      setIsLoading(false);
    }

    if (succeeded) {
      toast.success('Login successful!', { duration: 4000 });
      navigate('/');
    }
  };

  const handleResendOtp = async () => {
    if (resendLoading || expiresIn > 0) return;
    if (!challengeId) {
      toast.error('Session expired. Please log in again.', { duration: 4000 });
      backToCredentials();
      return;
    }

    setResendLoading(true);
    try {
      const result = await resendEmployeeOtp({
        challenge_id: challengeId,
      }).unwrap();

      if (result.data?.challenge_id) setChallengeId(result.data.challenge_id);
      if (result.data?.email) setMaskedEmail(result.data.email);
      if (result.data?.employee_login_code) {
        setEmployeeLoginCode(result.data.employee_login_code);
      }
      if (typeof result.data?.expires_in_seconds === 'number') {
        setExpiresIn(result.data.expires_in_seconds);
      }
      setOtp('');

      toast.success(result.message || 'OTP resent successfully!', {
        duration: 4000,
      });
    } catch (err: any) {
      console.error('Resend OTP error:', err?.status, err?.data, err);
      toast.error(extractErrorMessage(err, 'Failed to resend OTP.'), {
        duration: 5000,
      });
    } finally {
      setResendLoading(false);
    }
  };

  const handleSocialLogin = async (
    provider: 'facebook' | 'google' | 'apple',
  ) => {
    setIsLoading(true);
    try {
      toast.success(`${provider} login successful!`, { duration: 4000 });
    } catch {
      toast.error(`An error occurred during ${provider} login.`, {
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const backToCredentials = () => {
    setStep('credentials');
    setOtp('');
    setChallengeId('');
    setMaskedEmail('');
    setEmployeeLoginCode('');
    setExpiresIn(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div
      className={`flex min-h-screen items-center justify-center ${
        isMobile ? 'gradient-background-mobile' : 'gradient-background'
      } p-4 lg:p-0`}
    >
      <div className="relative flex w-full max-w-sm flex-col rounded-3xl bg-white p-6 shadow-2xl overflow-visible lg:h-screen lg:max-w-none lg:flex-row lg:p-0 lg:shadow-none lg:rounded-none">
        
        {/* Pass language logic to LeftPanel */}
        <LeftPanel 
          langRef={langRef}
          langOpen={langOpen}
          setLangOpen={setLangOpen}
          currentLanguage={currentLanguage}
          currentLanguageCode={currentLanguageCode}
          languages={LANGUAGES}
          onSelectLanguage={handleSelectLanguage}
        />

        {/* Right column */}
        <div className="relative z-10 w-full lg:w-2/5 lg:p-10 xl:px-20 flex flex-col justify-center">
          
          {/* Top bar with Logo */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 className="text-xl lg:text-2xl font-bold whitespace-nowrap">
              {t('Sign in')}
            </h2>

            <img
              src={TriaxxLogoImg}
              alt="TRIAXX Logo"
              className="h-24 shrink-0"
            />
          </div>

          <div className="text-center mb-2">
            <h3 className="text-2xl lg:text-[32px] font-bold">
              {step === 'otp' ? t('Verify OTP') : t('Welcome back!')}
            </h3>
            <p className="text-sm text-[#000000CC] mt-1 font-normal">
              {step === 'otp'
                ? t('Enter the {{length}}-digit code sent to {{email}}', {
                    length: OTP_LENGTH,
                    email: maskedEmail,
                  })
                : t('Sign in to your Triaxx account.')}
            </p>
          </div>

          {step === 'credentials' && (
            <div className="flex justify-center space-x-2 sm:space-x-6 my-6 lg:my-8 border-b border-gray-200">
              {(['Restaurant', 'Employee', 'Admin'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-1 sm:px-2 text-base font-bold focus:outline-none
                    ${
                      activeTab === tab
                        ? 'bg-clip-text text-transparent text-primary-gradient border-b-2 border-red-600'
                        : 'text-[#00000099] hover:text-gray-800'
                    }`}
                >
                  {t(tab)}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'Employee' && step === 'credentials' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="employeeId"
                  className="block text-sm font-medium mb-1"
                >
                  {t('Employee ID')}
                </label>
                <input
                  id="employeeId"
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder={t('Enter your employee ID')}
                  className="w-full px-4 py-3 bg-[linear-gradient(180deg,rgba(106,27,154,0.1)_0%,rgba(211,47,47,0.1)_100%)] border-transparent rounded-lg focus:ring-1 focus:ring-purple-600 focus:border-purple-600 focus:bg-white text-sm placeholder-gray-400"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium"
                  >
                    {t('Password')}
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-[#00000099] hover:cursor-pointer"
                  >
                    {t('Forgot password?')}
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('Enter your password')}
                    className="w-full px-4 py-3 bg-[linear-gradient(180deg,rgba(106,27,154,0.1)_0%,rgba(211,47,47,0.1)_100%)] border-transparent rounded-lg focus:ring-1 focus:ring-purple-600 focus:border-purple-600 focus:bg-white text-sm placeholder-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500"
                  >
                    <img
                      src={showPassword ? EyeSlashIconImg : EyeIconImg}
                      alt={t('Toggle password visibility')}
                      className="w-5 h-5"
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <label
                  htmlFor="rememberMe"
                  className="ml-2 block text-sm text-gray-700"
                >
                  {t('Remember me')}
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-primary text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-70"
              >
                {isLoading ? t('Submitting...') : t('Submit')}
              </button>
            </form>
          )}

          {activeTab === 'Employee' && step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 mt-6">
              {employeeLoginCode && (
                <div className="text-center text-xs text-gray-500">
                  {t('Employee Code')}: <strong>{employeeLoginCode}</strong>
                </div>
              )}

              <div>
                <label
                  htmlFor="otp"
                  className="block text-sm font-medium mb-1"
                >
                  {t('Enter OTP')}
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={OTP_LENGTH}
                  value={otp}
                  onChange={(e) =>
                    setOtp(
                      e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH),
                    )
                  }
                  placeholder={'-'.repeat(OTP_LENGTH)}
                  className="w-full px-4 py-3 text-center tracking-[0.5em] text-lg bg-[linear-gradient(180deg,rgba(106,27,154,0.1)_0%,rgba(211,47,47,0.1)_100%)] border-transparent rounded-lg focus:ring-1 focus:ring-purple-600 focus:border-purple-600 focus:bg-white placeholder-gray-400"
                  required
                />
                <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                  <span>
                    {t('Expires in')}:{' '}
                    <strong className={expiresIn < 60 ? 'text-red-500' : ''}>
                      {formatTime(expiresIn)}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={expiresIn > 0 || resendLoading}
                    className="text-purple-600 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                  >
                    {resendLoading ? t('Sending...') : t('Resend OTP')}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || otp.length !== OTP_LENGTH}
                className="w-full bg-primary text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-70"
              >
                {isLoading ? t('Verifying...') : t('Verify OTP')}
              </button>

              <button
                type="button"
                onClick={backToCredentials}
                className="w-full text-sm text-gray-600 hover:underline"
              >
                ← {t('Back to login')}
              </button>
            </form>
          )}

          {activeTab !== 'Employee' && step === 'credentials' && (
            <div className="text-center py-12 text-gray-500">
              {t('{{tab}} sign-in is not available yet.', { tab: t(activeTab) })}
            </div>
          )}

          {activeTab === 'Employee' && step === 'credentials' && (
            <>
              <p className="mt-6 text-sm text-center text-gray-700">
                {t("Don't have an account?")}{' '}
                <a
                  href="#"
                  className="font-medium text-[#FF8682] hover:cursor-pointer"
                >
                  {t('Sign up')}
                </a>
              </p>

              <div className="mt-6 flex items-center">
                <hr className="w-full border-gray-300" />
                <span className="px-2 text-xs text-gray-500 whitespace-nowrap">
                  {t('Or sign in with')}
                </span>
                <hr className="w-full border-gray-300" />
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleSocialLogin('facebook')}
                  className="w-full flex items-center justify-center py-4 border border-[#515DEF] rounded-lg shadow-sm bg-white hover:bg-gray-50"
                >
                  <img
                    src={FacebookIconImg}
                    alt="Facebook"
                    className="w-5 h-5"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  className="w-full flex items-center justify-center py-4 border border-[#515DEF] rounded-lg shadow-sm bg-white hover:bg-gray-50"
                >
                  <img src={GoogleIconImg} alt="Google" className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('apple')}
                  className="w-full flex items-center justify-center py-4 border border-[#515DEF] rounded-lg shadow-sm bg-white hover:bg-gray-50"
                >
                  <img src={AppleIconImg} alt="Apple" className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;