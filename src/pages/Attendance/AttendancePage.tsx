import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // ✅ Added i18n
import toast from 'react-hot-toast';
import {
  useGetAttendanceDashboardQuery,
  useClockInMutation,
  useClockOutMutation,
  useStartBreakMutation,
  useEndBreakMutation,
  useGetAttendanceHistoryQuery,
  useGetLeaveRequestsQuery,
  useSubmitLeaveRequestMutation,
  useCancelLeaveRequestMutation,
  useUpdateEmergencyContactMutation,
} from '../../redux/api/attendanceApi';
import { useGetProfileQuery } from '@/redux/api/settingsApi';
import Loader from '@/components/Loader';

// --- Icons ---
const ClockIcon = ({ className = 'w-8 h-8' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg>
);
const CalendarIcon = ({ className = 'w-5 h-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);
const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
);
const MailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
);
const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);
const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
);
const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
);
const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
);

const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';

const PAGE_SIZE = 8; // rows per page

// ============================================================
// ✅ Reusable Pagination Component (client-side)
// ============================================================
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}) => {
  const { t } = useTranslation(); // ✅ Added i18n

  if (totalPages <= 1) return null;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Compact page list: 1 … 4 [5] 6 … 20
  const pages: (number | '...')[] = [];
  const siblings = 1;
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - siblings && i <= currentPage + siblings)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-gray-100">
      <p className="text-[12px] text-gray-500 order-2 sm:order-1">
        {t('Showing')} <span className="font-semibold text-gray-700">{startItem}</span>–
        <span className="font-semibold text-gray-700">{endItem}</span> {t('of')}{' '}
        <span className="font-semibold text-gray-700">{totalItems}</span>
      </p>

      <div className="flex items-center gap-1 order-1 sm:order-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          aria-label={t('Previous page')}
        >
          <ChevronLeftIcon />
        </button>

        {pages.map((p, idx) =>
          p === '...' ? (
            <span key={`ell-${idx}`} className="px-1.5 text-gray-400 text-xs select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`min-w-[32px] h-8 px-2 text-[12px] rounded-lg font-medium transition-all active:scale-95 ${p === currentPage
                ? 'bg-gradient-to-r from-[#4c1530] to-[#cc246d] text-white shadow-sm'
                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          aria-label={t('Next page')}
        >
          <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
};

// ============================================================
// MAIN PAGE
// ============================================================
const AttendancePage = () => {
  const { t } = useTranslation(); // ✅ Added i18n

  const [tab, setTab] = useState<'history' | 'leave'>('leave');

  // Modal States
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isBreakModalOpen, setIsBreakModalOpen] = useState(false);
  const [isEditContactOpen, setIsEditContactOpen] = useState(false);

  // ✅ Client-side pagination state
  const [historyPage, setHistoryPage] = useState(1);
  const [leavePage, setLeavePage] = useState(1);

  // Form States
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'Sick Leave',
    start_date: '',
    end_date: '',
    reason: '',
    leave_time: 'full_day' as 'full_day' | 'half_day',
    attachment_url: '',
  });

  const [breakForm, setBreakForm] = useState({ break_type: '', note: '' });

  const {
    data: profileResponse,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useGetProfileQuery();

  const [contactForm, setContactForm] = useState({
    name: '',
    phone: '',
    email: '',
    enabled: true,
  });
const [cancellingId, setCancellingId] = useState<number | null>(null);
  // File upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Queries ---
  const { data: dash, isLoading, isError, refetch: refetchDash } =
    useGetAttendanceDashboardQuery();

  const { data: history, refetch: refetchHistory } = useGetAttendanceHistoryQuery({
    limit: 1000,
  } as any);

  const { data: leaves, refetch: refetchLeaves } = useGetLeaveRequestsQuery();

  // --- Mutations ---
  const [clockIn, { isLoading: clockingIn }] = useClockInMutation();
  const [clockOut, { isLoading: clockingOut }] = useClockOutMutation();
  const [startBreak] = useStartBreakMutation();
  const [endBreak] = useEndBreakMutation();
  const [submitLeave, { isLoading: submittingLeave }] = useSubmitLeaveRequestMutation();
  const [cancelLeave] = useCancelLeaveRequestMutation();
  const [updateEmergencyContact, { isLoading: savingContact }] =
    useUpdateEmergencyContactMutation();

  // --- Derived ---
  const employee = profileResponse?.data;
  const current = dash?.data.current_attendance;

  const onBreak = useMemo(
    () => current?.breaks?.some((b: any) => b.start_at && !b.end_at),
    [current]
  );

  const isClockedIn = !!current && !current.clock_out;

  // ✅ Client-side pagination
  const allHistory = history?.data ?? [];
  const allLeaves = leaves?.data ?? [];

  const historyTotal = allHistory.length;
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / PAGE_SIZE));
  const pagedHistory = useMemo(() => {
    const start = (historyPage - 1) * PAGE_SIZE;
    return allHistory.slice(start, start + PAGE_SIZE);
  }, [allHistory, historyPage]);

  const leaveTotal = allLeaves.length;
  const leaveTotalPages = Math.max(1, Math.ceil(leaveTotal / PAGE_SIZE));
  const pagedLeaves = useMemo(() => {
    const start = (leavePage - 1) * PAGE_SIZE;
    return allLeaves.slice(start, start + PAGE_SIZE);
  }, [allLeaves, leavePage]);

  // Snap back if current page no longer exists
  useEffect(() => {
    if (historyPage > historyTotalPages) setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  useEffect(() => {
    if (leavePage > leaveTotalPages) setLeavePage(leaveTotalPages);
  }, [leavePage, leaveTotalPages]);

  // --- Handlers ---
  const handlePrimaryAction = async () => {
    if (!isClockedIn) {
      const toastId = toast.loading(t('Clocking in...'));
      try {
        await clockIn().unwrap();
        await refetchDash();
        await refetchHistory();
        toast.success(t('Successfully clocked in!'), { id: toastId });
      } catch (error: any) {
        toast.error(error?.data?.message || t('Failed to clock in'), { id: toastId });
      }
      return;
    }

    const toastId = toast.loading(onBreak ? t('Ending break & clocking out...') : t('Clocking out...'));
    try {
      if (onBreak) await endBreak().unwrap();
      await clockOut().unwrap();
      await refetchDash();
      await refetchHistory();
      toast.success(t('Successfully clocked out!'), { id: toastId });
    } catch (error: any) {
      toast.error(error?.data?.message || t('Failed to update attendance'), { id: toastId });
    }
  };

  const handleStartBreakSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakForm.break_type) {
      toast.error(t('Please select a break type'));
      return;
    }
    const toastId = toast.loading(t('Starting break...'));
    try {
      await startBreak({ break_type: breakForm.break_type, note: breakForm.note }).unwrap();
      await refetchDash();
      toast.success(t('Break started'), { id: toastId });
      setIsBreakModalOpen(false);
      setBreakForm({ break_type: '', note: '' });
    } catch (error: any) {
      toast.error(error?.data?.message || t('Failed to start break'), { id: toastId });
    }
  };

  const handleEndBreakClick = async () => {
    const toastId = toast.loading(t('Ending break...'));
    try {
      await endBreak().unwrap();
      await refetchDash();
      toast.success(t('Break ended'), { id: toastId });
    } catch (error: any) {
      toast.error(error?.data?.message || t('Failed to end break'), { id: toastId });
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.start_date || !leaveForm.end_date) {
      toast.error(t('Please select start and end dates'));
      return;
    }
    const toastId = toast.loading(t('Submitting leave request...'));
    try {
      await submitLeave({
        ...leaveForm,
        attachment_url: leaveForm.attachment_url || undefined,
      }).unwrap();

      setLeavePage(1);
      await refetchDash();
      await refetchLeaves();

      toast.success(t('Leave request submitted successfully!'), { id: toastId });
      setIsLeaveModalOpen(false);
      setLeaveForm({
        leave_type: 'Sick Leave',
        start_date: '',
        end_date: '',
        reason: '',
        leave_time: 'full_day',
        attachment_url: '',
      });
    } catch (error: any) {
      toast.error(error?.data?.message || t('Failed to submit leave request'), { id: toastId });
    }
  };



 const handleCancelLeave = async (leaveRequestId: number) => {
  if (!window.confirm(t('Are you sure you want to cancel this leave request?'))) return;

  setCancellingId(leaveRequestId);
  const toastId = toast.loading(t('Cancelling request...'));
  try {
    await cancelLeave(leaveRequestId).unwrap();
    await refetchDash();
    await refetchLeaves();
    toast.success(t('Leave request cancelled'), { id: toastId });
  } catch (error: any) {
    toast.error(error?.data?.message || t('Failed to cancel leave'), { id: toastId });
  } finally {
    setCancellingId(null);
  }
};

  const handleToggleEmergencyContact = async () => {
    if (!employee) return;
    const newStatus = !employee.emergency_contact.enabled;
    const toastId = toast.loading(
      newStatus ? t('Enabling emergency contact...') : t('Disabling emergency contact...')
    );
    try {
      await updateEmergencyContact({
        enabled: newStatus,
        name: employee.emergency_contact.name ?? undefined,
        phone: employee.emergency_contact.phone ?? undefined,
        email: employee.emergency_contact.email ?? undefined,
      }).unwrap();
      await refetchDash();
      toast.success(
        t('Emergency contact') + ` ${newStatus ? t('enabled') : t('disabled')}`,
        { id: toastId }
      );
    } catch (error: any) {
      toast.error(error?.data?.message || t('Failed to update emergency contact'), { id: toastId });
    }
  };

  const openEditContact = () => {
    setContactForm({
      name: employee?.emergency_contact.name ?? '',
      phone: employee?.emergency_contact.phone ?? '',
      email: employee?.emergency_contact.email ?? '',
      enabled: employee?.emergency_contact.enabled ?? true,
    });
    setIsEditContactOpen(true);
  };

  const handleEditContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading(t('Saving contact...'));
    try {
      await updateEmergencyContact({
        enabled: contactForm.enabled,
        name: contactForm.name || undefined,
        phone: contactForm.phone || undefined,
        email: contactForm.email || undefined,
      }).unwrap();
      await refetchDash();
      toast.success(t('Emergency contact updated'), { id: toastId });
      setIsEditContactOpen(false);
    } catch (error: any) {
      toast.error(error?.data?.message || t('Failed to update contact'), { id: toastId });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('File size exceeds the 5MB limit.'));
      return;
    }
    setSelectedFile(file);
  };

  const handleSendFile = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    const toastId = toast.loading(t('Uploading attachment...'));
    setTimeout(() => {
      toast.success(t('Attachment sent successfully!'), { id: toastId });
      setIsUploading(false);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 1500);
  };

  if (isLoading || isProfileLoading) {
    return (
      <div className="flex items-center justify-center w-full min-h-[60vh]">
        <Loader />
      </div>
    );
  }

  if (isError || isProfileError || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600 font-medium">
        {t('Failed to load attendance data. Please try again.')}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-8 font-sans text-gray-800 max-w-[1200px] relative">
      <h1 className="text-2xl font-bold mb-6">{t('Employee Attendance & Leave')}</h1>

      {/* --- TOP SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 border border-gray-200 rounded-3xl p-6 flex flex-col justify-between shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div className="flex items-center gap-4">
              <img
                src={employee.profile_image || 'https://via.placeholder.com/150'}
                alt={employee.full_name}
                className="w-14 h-14 rounded-full object-cover"
              />
              <div>
                <h2 className="font-semibold text-[15px]">{employee.full_name}</h2>
                <p className="text-gray-400 text-xs mt-0.5">{employee.role}</p>
              </div>
            </div>
            <div className="mt-4 md:mt-0 text-left md:text-right">
              <div className="flex items-center md:justify-end gap-2 mb-1">
                <span className="font-medium text-xs text-gray-700">{t('Current Shift')}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium ${isClockedIn ? 'bg-[#E8F8ED] text-[#1EA35B]' : 'bg-gray-100 text-gray-600'
                    }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isClockedIn ? 'bg-[#1EA35B]' : 'bg-gray-400'}`}></span>
                  {isClockedIn ? t('On Shift') : t('Off Shift')}
                </span>
              </div>
              <p className="text-[11px] text-gray-500">{t('Shift')} {employee.shift_timings}</p>
            </div>
          </div>

          <div className="border-t border-gray-100 mb-5"></div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="border border-red-200 rounded-xl p-3 text-center flex flex-col justify-center">
              <p className="font-semibold text-sm text-gray-900">{fmtTime(current?.clock_in)}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{t('Clock in')}</p>
            </div>
            <div className="border border-red-200 rounded-xl p-3 text-center flex flex-col justify-center">
              <p className="font-semibold text-sm text-gray-900">{current?.total_hours ?? '0h 0m'}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{t('Worked today')}</p>
            </div>
            {onBreak ? (
              <button
                onClick={handleEndBreakClick}
                className="bg-gradient-to-r from-[#8b2252] to-[#cc246d] text-white rounded-xl p-3 text-center flex flex-col justify-center hover:opacity-90 transition-opacity shadow-sm"
              >
                <p className="font-semibold text-sm">{t('End')}</p>
                <p className="text-[11px] opacity-90">{t('Break')}</p>
              </button>
            ) : (
              <button
                onClick={() => setIsBreakModalOpen(true)}
                disabled={!isClockedIn}
                className="bg-[#9DF89D] border border-[#86E386] text-gray-900 rounded-xl p-3 text-center flex flex-col justify-center hover:bg-[#8cf08c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <p className="font-semibold text-sm">{t('Start')}</p>
                <p className="text-[11px] mt-0.5">{t('Break')}</p>
              </button>
            )}
            <div className="border border-red-200 rounded-xl p-3 text-center flex flex-col justify-center">
              <p className="font-semibold text-sm text-gray-900">{dash?.data.leave_balance ?? 0}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{t('Leaves Left')}</p>
            </div>
          </div>
        </div>

        <div className="border-2 border-[#f0c3d0] rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#fdf1f5] flex items-center justify-center mb-4 text-[#4a1526]">
            <ClockIcon />
          </div>
          <p className="text-gray-600 text-xs font-medium">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <p className="text-lg font-bold text-gray-900 mb-6 mt-0.5">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <button
            onClick={handlePrimaryAction}
            disabled={clockingIn || clockingOut}
            className="w-full py-2.5 rounded-lg bg-[linear-gradient(180deg,#6A1B9A_0%,#D32F2F_100%)] text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {isClockedIn ? (onBreak ? t('End Break & Clock Out') : t('Clock Out')) : t('Clock In')}
          </button>
        </div>
      </div>

      {/* --- BOTTOM SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex bg-[#f4f4f4] rounded-full p-1">
              <button
                onClick={() => setTab('history')}
                className={`px-5 py-2 rounded-full text-[13px] font-medium transition-colors ${tab === 'history' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t('Attendance History')}
              </button>
              <button
                onClick={() => setTab('leave')}
                className={`px-5 py-2 rounded-full text-[13px] font-medium transition-colors ${tab === 'leave' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t('Leave status')}
              </button>
            </div>
            <button
              onClick={() => setIsLeaveModalOpen(true)}
              className="ml-auto bg-[#40DE53] text-white rounded-full px-6 py-2 text-[13px] font-medium hover:bg-[#36c746] transition-colors"
            >
              {t('Apply Leave')}
            </button>
          </div>

          {/* ============================================================
              TAB: History
             ============================================================ */}
          {tab === 'history' && (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-[#fdf1f5] grid grid-cols-5 p-4 text-xs font-semibold text-gray-800">
                <div>{t('Date')}</div>
                <div className="text-center">{t('Check-in')}</div>
                <div className="text-center">{t('Check-Out')}</div>
                <div className="text-center">{t('Over Time')}</div>
                <div className="text-right">{t('Total Login')}</div>
              </div>

              {pagedHistory.length > 0 ? (
                pagedHistory.map((row: any) => (
                  <div
                    key={row._id}
                    className="grid grid-cols-5 p-4 text-[13px] text-gray-800 border-b border-gray-100 items-center hover:bg-gray-50"
                  >
                    <div>{fmtDate(row.date ?? row.clock_in)}</div>
                    <div className="text-center">{fmtTime(row.clock_in)}</div>
                    <div className="text-center">{fmtTime(row.clock_out)}</div>
                    <div className="text-center font-medium">
                      {row.overtime ? (
                        <span className={row.overtime.includes('-') ? 'text-red-500' : 'text-green-600'}>
                          {row.overtime}
                        </span>
                      ) : (
                        '-'
                      )}
                    </div>
                    <div className="text-right font-medium">{row.total_hours ?? '-'}</div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 text-sm">{t('No attendance history found.')}</div>
              )}

              <Pagination
                currentPage={historyPage}
                totalPages={historyTotalPages}
                totalItems={historyTotal}
                pageSize={PAGE_SIZE}
                onPageChange={setHistoryPage}
              />
            </div>
          )}

          {/* ============================================================
              TAB: Leave
             ============================================================ */}
          {tab === 'leave' && (
            <div className="space-y-6">
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-[#fdf1f5] grid grid-cols-6 p-4 text-xs font-semibold text-gray-800">
                  <div>{t('Date')}</div>
                  <div>{t('Type')}</div>
                  <div className="text-center">{t('Days')}</div>
                  <div className="text-center">{t('Leave Time')}</div>
                  <div className="text-center">{t('Status')}</div>
                  <div className="text-right">{t('Action')}</div>
                </div>

                {pagedLeaves.length > 0 ? (
                  pagedLeaves.map((l) => (
                    <div
                      key={l._id}
                      className="grid grid-cols-6 p-4 text-[13px] text-gray-800 border-b border-gray-100 items-center hover:bg-gray-50"
                    >
                      <div>{fmtDate(l.start_date)} - {fmtDate(l.end_date)}</div>
                      <div>{l.leave_type}</div>
                      <div className="text-center">
                        {Math.ceil(
                          (new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) /
                          (1000 * 3600 * 24)
                        ) + 1}
                      </div>
                      <div className="text-center capitalize">{l.leave_time.replace('_', ' ')}</div>
                      <div className="flex justify-center">
                        <span
                          className={`border px-3 py-1 rounded-full text-[11px] font-medium flex items-center gap-1.5 capitalize ${l.status === 'approved'
                            ? 'border-green-400 text-green-600'
                            : l.status === 'rejected'
                              ? 'border-red-400 text-red-600'
                              : l.status === 'cancelled'
                                ? 'border-gray-400 text-gray-600'
                                : 'border-[#a78bfa] text-[#a78bfa]'
                            }`}
                        >
                          {t(l.status)} {l.status === 'pending' && <ClockIcon className="w-3 h-3" />}
                        </span>
                      </div>
                      <div className="text-right">
                        {l.status === 'pending' && (
                          <div className="text-right">
                           {l.status === 'pending' && (
  <button
    onClick={() => handleCancelLeave(l.leave_request_id)}   // ✅ numeric 9, 8, 7…
    disabled={cancellingId === l.leave_request_id}
    className="text-gray-600 hover:text-black text-[13px] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {cancellingId === l.leave_request_id ? t('Cancelling...') : t('Cancel')}
  </button>
)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500 text-sm">{t('No leave requests found.')}</div>
                )}

                <Pagination
                  currentPage={leavePage}
                  totalPages={leaveTotalPages}
                  totalItems={leaveTotal}
                  pageSize={PAGE_SIZE}
                  onPageChange={setLeavePage}
                />
              </div>

              {/* Attachments + Manager */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col">
                  <h3 className="font-semibold text-[15px] mb-1">{t('Attachment')}</h3>
                  <p className="text-[11px] text-gray-500 mb-4">{t('Upload supporting documents')}</p>

                  <div
                    className={`border-2 border-dashed rounded-xl p-6 text-center mb-4 flex-1 flex flex-col justify-center transition-colors ${selectedFile ? 'border-[#40DE53] bg-green-50/30' : 'border-gray-200 bg-white'
                      }`}
                  >
                    {selectedFile ? (
                      <div className="flex flex-col items-center">
                        <div className="text-[#40DE53] mb-2"><FileIcon /></div>
                        <p className="text-sm font-medium text-gray-800 break-all px-2">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-xs text-red-500 hover:underline mt-3"
                        >
                          {t('Remove File')}
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-700 mb-1">{t('Drag and drop file here')}</p>
                        <p className="text-xs text-gray-400 mb-3">{t('Or')}</p>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="border border-[#4c1530] text-[#4c1530] text-xs font-semibold px-6 py-1.5 rounded-md hover:bg-gray-50 mb-3 transition-colors"
                        >
                          {t('Browse File')}
                        </button>
                        <p className="text-[10px] text-gray-400">{t('PDF, JPG, PNG (Max. 5MB)')}</p>
                      </>
                    )}
                  </div>

                  <button
                    onClick={handleSendFile}
                    disabled={!selectedFile || isUploading}
                    className="w-full bg-[linear-gradient(180deg,#6A1B9A_0%,#D32F2F_100%)] text-white py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {isUploading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        {t('Sending...')}
                      </span>
                    ) : (
                      t('Send')
                    )}
                  </button>
                </div>

                <div className="border border-gray-200 rounded-xl p-5 flex flex-col shadow-sm">
                  <h3 className="font-semibold text-[15px] mb-1">{t('Manager Approval')}</h3>
                  <p className="text-[11px] text-gray-500 mb-4">{t("Needs the manager's approval")}</p>
                  <div className="flex items-center gap-3 border border-gray-200 rounded-xl p-3 mb-4">
                    <img
                      src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                      alt="Manager"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-[13px] font-semibold">Michael Brown</p>
                      <p className="text-[11px] text-gray-500">{t('Restaurant Manager')}</p>
                    </div>
                  </div>
                  <div className="bg-[#EBFAEB] border border-[#D1F2D1] rounded-xl p-4 flex-1 flex flex-col justify-center">
                    <p className="text-[13px] font-semibold text-gray-800 mb-1">{t('Pending Approval')}</p>
                    <p className="text-[11px] text-gray-600">
                      {t('Requests are reviewed within 24–48 hours.')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="border-2 border-[#f0c3d0] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-[#fdf1f5] p-2 rounded-lg text-[#cc246d]">
                <CalendarIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-800">{t('Leave Balance')}</p>
                <p className="text-[11px] text-gray-500">{t('Annual Leave Remaining')}</p>
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2 mt-4">{dash?.data.leave_balance ?? 0} {t('days')}</h2>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-[#8b2252] to-[#cc246d] h-2 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    ((dash?.data.leave_balance ?? 0) / (employee.total_leave_days || 1)) * 100
                  )}%`,
                }}
              ></div>
            </div>
          </div>

          <div className="border-2 border-[#f0c3d0] rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-[#fdf1f5] p-2 rounded-lg text-[#cc246d]">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <p className="text-[13px] font-semibold text-gray-800">{t('Emergency Contact')}</p>
              </div>
              <button
                onClick={handleToggleEmergencyContact}
                disabled={savingContact}
                className={`w-9 h-5 rounded-full relative transition-colors disabled:opacity-60 ${employee.emergency_contact.enabled ? 'bg-[#d9467b]' : 'bg-gray-300'
                  }`}
                aria-label={t('Toggle emergency contact')}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${employee.emergency_contact.enabled ? 'right-0.5' : 'left-0.5'
                    }`}
                ></div>
              </button>
            </div>
            <div className="space-y-4 text-sm mt-6">
              <div className="flex items-center gap-4">
                <PhoneIcon />
                <span className="text-[13px] font-medium text-gray-800">
                  {employee.emergency_contact.phone ?? t('No phone saved')}
                </span>
              </div>
              <div className="pl-8 text-gray-500 text-[11px] -mt-3">
                {employee.emergency_contact.name ?? t('No name saved')}
              </div>
              <div className="flex items-center gap-4">
                <MailIcon />
                <span className="text-[13px] font-medium text-gray-800 break-all">
                  {employee.emergency_contact.email ?? t('No email saved')}
                </span>
              </div>
              <div className="pl-8 text-gray-500 text-[11px] -mt-3">{t('Email')}</div>
            </div>
            <button
              onClick={openEditContact}
              className="w-full mt-6 border border-[#4c1530] text-[#4c1530] py-2.5 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
            >
              {t('Edit Contact')}
            </button>
          </div>
        </div>
      </div>

      {/* --- START BREAK MODAL --- */}
      {isBreakModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-[500px] p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{t('Start Break')}</h2>
              <button onClick={() => setIsBreakModalOpen(false)} className="text-gray-500 hover:text-gray-800">
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleStartBreakSubmit}>
              <div className="mb-5">
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t('Break Type')}</label>
                <select
                  value={breakForm.break_type}
                  onChange={(e) => setBreakForm({ ...breakForm, break_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-600 outline-none focus:border-[#d9467b]"
                >
                  <option value="" disabled>{t('Select Break Type')}</option>
                  <option value="Lunch Break">{t('Lunch Break')}</option>
                  <option value="Tea Break">{t('Tea Break')}</option>
                  <option value="Personal Break">{t('Personal Break')}</option>
                </select>
              </div>
              <div className="mb-8">
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t('Note (optional)')}</label>
                <textarea
                  value={breakForm.note}
                  onChange={(e) => setBreakForm({ ...breakForm, note: e.target.value })}
                  placeholder="..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm text-gray-600 outline-none focus:border-[#d9467b] resize-none"
                ></textarea>
              </div>
              <div className="flex justify-center">
                <button type="submit" className="bg-gradient-to-r from-[#4c1530] to-[#cc246d] text-white px-12 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity">
                  {t('Start Break')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- APPLY LEAVE MODAL --- */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-[550px] p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">{t('Requesting Time Off')}</h2>
              <button onClick={() => setIsLeaveModalOpen(false)} className="text-gray-500 hover:text-gray-800">
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleLeaveSubmit} className="space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t('Type')}</label>
                <select
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-600 outline-none focus:border-[#d9467b]"
                >
                  <option value="Sick Leave">{t('Sick Leave')}</option>
                  <option value="Annual Leave">{t('Annual Leave')}</option>
                  <option value="Casual Leave">{t('Casual Leave')}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t('Start Date')}</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.start_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-600 outline-none focus:border-[#d9467b]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t('End Date')}</label>
                  <input
                    type="date"
                    required
                    value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-600 outline-none focus:border-[#d9467b]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t('Reason')}</label>
                <input
                  type="text"
                  required
                  placeholder="..."
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm text-gray-600 outline-none focus:border-[#d9467b]"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-3">{t('Leave Time')}</label>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-[120px] bg-white border border-gray-200 rounded-full py-2 text-center text-[13px] font-medium text-gray-700 shadow-sm">
                    {t('Selected Dates')}
                  </div>
                  <div className="w-[1px] h-6 bg-gray-300"></div>
                  <button
                    type="button"
                    onClick={() => setLeaveForm({ ...leaveForm, leave_time: 'half_day' })}
                    className={`flex-1 rounded-full py-2 text-[13px] font-medium transition-colors ${leaveForm.leave_time === 'half_day'
                      ? 'bg-[#40DE53] text-white'
                      : 'bg-white border border-gray-200 text-gray-600'
                      }`}
                  >
                    {t('Half Day')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveForm({ ...leaveForm, leave_time: 'full_day' })}
                    className={`flex-1 rounded-full py-2 text-[13px] font-medium transition-colors ${leaveForm.leave_time === 'full_day'
                      ? 'bg-[#40DE53] text-white'
                      : 'bg-white border border-gray-200 text-gray-600'
                      }`}
                  >
                    {t('Full Day')}
                  </button>
                </div>
              </div>
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="w-full md:w-auto mx-auto block bg-gradient-to-r from-[#4c1530] to-[#cc246d] text-white px-10 py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submittingLeave ? t('Applying...') : t('Apply Leave')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT CONTACT MODAL --- */}
      {isEditContactOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-[480px] p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">{t('Edit Emergency Contact')}</h2>
              <button onClick={() => setIsEditContactOpen(false)} className="text-gray-500 hover:text-gray-800">
                <CloseIcon />
              </button>
            </div>
            <form onSubmit={handleEditContactSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t('Full Name')}</label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#d9467b]"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t('Phone')}</label>
                <input
                  type="tel"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#d9467b]"
                  placeholder="+1 987 654 3210"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1.5">{t('Email')}</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-[#d9467b]"
                  placeholder="john.doe@example.com"
                />
              </div>
              <div className="flex items-center justify-between border border-gray-200 rounded-lg p-3">
                <span className="text-[13px] font-medium text-gray-700">{t('Enable emergency contact')}</span>
                <button
                  type="button"
                  onClick={() => setContactForm({ ...contactForm, enabled: !contactForm.enabled })}
                  className={`w-9 h-5 rounded-full relative transition-colors ${contactForm.enabled ? 'bg-[#d9467b]' : 'bg-gray-300'
                    }`}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${contactForm.enabled ? 'right-0.5' : 'left-0.5'
                      }`}
                  ></div>
                </button>
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingContact}
                  className="w-full bg-gradient-to-r from-[#4c1530] to-[#cc246d] text-white py-2.5 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {savingContact ? t('Saving...') : t('Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;