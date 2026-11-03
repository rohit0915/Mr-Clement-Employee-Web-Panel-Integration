import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next'; // ✅ Added i18n
import {
  FiUsers, FiClock, FiRepeat, FiX, FiChevronDown,
  FiCheckCircle, FiLogOut,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import {
  useGetShiftDashboardQuery,
  useGetCoworkerShiftsQuery,
  useRequestShiftSwapMutation,
  useRespondToShiftSwapMutation,
  useClockOutMutation,
} from '../../redux/api/shiftApiSlice';
import { useGetAttendanceDashboardQuery } from '@/redux/api/attendanceApi';
import Loader from '@/components/Loader';

type ShiftRecord = Record<string, unknown>;

const isShiftRecord = (value: unknown): value is ShiftRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export default function WorkShift() {
  const { t } = useTranslation(); // ✅ Added i18n hook

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [selectedCoworker, setSelectedCoworker] = useState<string>('');
  const [reason, setReason] = useState('');
  const [selectedShiftToSwap, setSelectedShiftToSwap] = useState<any | null>(null);
  const [selectedTargetShiftId, setSelectedTargetShiftId] = useState<string>('');

  // ✅ Per-request responding state
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondingAction, setRespondingAction] = useState<'accepted' | 'rejected' | null>(null);

  const { data: apiResponse, isLoading, isError } = useGetShiftDashboardQuery();
  const {
    data: attendanceResponse,
    isLoading: isAttendanceLoading,
    isError: isAttendanceError,
  } = useGetAttendanceDashboardQuery();
  const [requestSwap, { isLoading: isRequesting }] = useRequestShiftSwapMutation();
  const [respondToSwap] = useRespondToShiftSwapMutation();
  const [clockOut, { isLoading: isClockingOut }] = useClockOutMutation();

  const coworkerIdNum = selectedCoworker ? Number(selectedCoworker) : 0;
  const {
    data: coworkerShiftsRaw,
    isFetching: isFetchingCoworkerShifts,
  } = useGetCoworkerShiftsQuery(coworkerIdNum, { skip: !coworkerIdNum });

  const coworkerShifts: any[] = useMemo(() => {
    if (!coworkerShiftsRaw) return [];
    const arr = Array.isArray(coworkerShiftsRaw)
      ? coworkerShiftsRaw
      : (coworkerShiftsRaw as any).data ?? [];
    return Array.isArray(arr) ? arr : [];
  }, [coworkerShiftsRaw]);

  const dashboardData = apiResponse?.data;

  // ---------- Formatting ----------
  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const calculateWorkedTime = (
    startIso?: string,
    endIso?: string | null,
    breaks?: { start?: string; end?: string }[],
  ) => {
    if (!startIso) return `0 ${t('hr')} 0 ${t('min')}`;
    const start = new Date(startIso).getTime();
    const end = endIso ? new Date(endIso).getTime() : Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return `0 ${t('hr')} 0 ${t('min')}`;
    }

    const breakMinutes = (breaks ?? []).reduce((total, pause) => {
      if (!pause.start) return total;
      const breakStart = new Date(pause.start).getTime();
      const breakEnd = pause.end ? new Date(pause.end).getTime() : end;
      if (!Number.isFinite(breakStart) || !Number.isFinite(breakEnd)) return total;
      return total + Math.max(0, Math.min(end, breakEnd) - Math.max(start, breakStart)) / 60000;
    }, 0);
    const workedMinutes = Math.max(0, Math.floor((end - start) / 60000 - breakMinutes));
    return `${Math.floor(workedMinutes / 60)} ${t('hr')} ${workedMinutes % 60} ${t('min')}`;
  };

  // ✅ Status styling helper for outgoing cards
  const getStatusStyle = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'accepted':
        return { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500', label: t('Accepted') };
      case 'rejected':
        return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', label: t('Rejected') };
      case 'pending':
      default:
        return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', label: t('Pending') };
    }
  };

  // ---------- Handlers ----------
  const handleRequestSwap = async () => {
    if (!selectedCoworker || !reason.trim() || !selectedShiftToSwap) {
      toast.error(t('Please select a coworker, a target shift, and enter a reason.'));
      return;
    }

    const requesterShiftId =
      selectedShiftToSwap.employee_shift_id ??
      selectedShiftToSwap.shift_id ??
      selectedShiftToSwap.id;

    if (requesterShiftId == null) {
      toast.error(t('This shift has no employee_shift_id — cannot request a swap.'));
      return;
    }

    if (!selectedTargetShiftId) {
      toast.error(t('Please select a target shift for your coworker.'));
      return;
    }

    const loadingToast = toast.loading(t('Sending swap request…'));
    try {
      const payload = {
        requester_shift_id: Number(requesterShiftId),
        target_employee_id: Number(selectedCoworker),
        target_shift_id: Number(selectedTargetShiftId),
        reason: reason.trim(),
      };
      console.log('📤 Sending swap request payload:', payload);

      const result = await requestSwap(payload).unwrap();
      console.log('✅ Swap request response:', result);

      const swapId = result?.data?.shift_swap_id ?? result?.shift_swap_id ?? result?.data?.id;
      console.log('🆔 Created swap request ID:', swapId);

      toast.success(t('Swap request sent successfully!'), { id: loadingToast });
      closeModal();
    } catch (error: any) {
      console.error('❌ Error requesting swap:', error);
      toast.error(error?.data?.message || t('Failed to send swap request.'), { id: loadingToast });
    }
  };

  const handleRespondToSwap = async (swapId: string, status: 'accepted' | 'rejected') => {
    if (
      !swapId ||
      swapId === 'undefined' ||
      swapId === 'null' ||
      swapId.trim() === ''
    ) {
      toast.error(t('Invalid swap ID — cannot respond.'));
      return;
    }

    setRespondingId(swapId);
    setRespondingAction(status);

    const loadingToast = toast.loading(status === 'accepted' ? t('Accepting swap…') : t('Rejecting swap…'));
    try {
      console.log(`📤 Responding to swap ${swapId} with status: ${status}`);
      await respondToSwap({ swapId, status }).unwrap();
      toast.success(`${t('Swap')} ${t(status)} ${t('successfully!')}`, { id: loadingToast });
    } catch (error: any) {
      console.error('❌ Error responding to swap:', error);
      toast.error(error?.data?.message || `${t('Failed to')} ${t(status)} ${t('swap.')}`, { id: loadingToast });
    } finally {
      setRespondingId(null);
      setRespondingAction(null);
    }
  };

  const handleClockOut = async () => {
    const loadingToast = toast.loading(t('Clocking out…'));
    try {
      await clockOut().unwrap();
      toast.success(t('Clocked out successfully!'), { id: loadingToast });
    } catch (error: any) {
      console.error('Error clocking out:', error);
      toast.error(error?.data?.message || t('Failed to clock out.'), { id: loadingToast });
    }
  };

  const openSwapModal = (shift: any) => {
    setSelectedShiftToSwap(shift);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedCoworker('');
    setReason('');
    setSelectedTargetShiftId('');
    setSelectedShiftToSwap(null);
  };

  // ---------- Loading / Error ----------
  if (isLoading || isAttendanceLoading) return <div className="p-8 text-center text-gray-600"> <div className="flex items-center justify-center w-full min-h-[60vh]">
    <Loader />
  </div></div>;
  if (isError) return <div className="p-8 text-center text-red-500">{t('Failed to load shift data. Please try again.')}</div>;
  if (isAttendanceError || !attendanceResponse?.data) {
    return <div className="p-8 text-center text-red-500">{t('Could not load attendance status. Please try again.')}</div>;
  }

  const currentShift = dashboardData?.current_shift ?? null;
  const currentAttendance = attendanceResponse.data.current_attendance;
  const upcomingShifts = dashboardData?.upcoming_shifts ?? [];
  const teamSchedule = Array.isArray(dashboardData?.team_schedule) ? dashboardData.team_schedule : [];
  const swapRequests = dashboardData?.incoming_swap_requests ?? [];
  const outgoingSwapRequests = dashboardData?.outgoing_swap_requests ?? [];

  const coworkers = (dashboardData?.coworkers ?? []).filter(
    (c: any, i: number, arr: any[]) =>
      c.employee_id != null && arr.findIndex((x) => x.employee_id === c.employee_id) === i,
  );

  const getEmployeeInfo = (employeeId: number) => {
    return coworkers.find((c: any) => c.employee_id === employeeId) || {
      full_name: `${t('Employee')} #${employeeId}`,
      profile_image: '',
    };
  };

  const getMeaningfulText = (...values: unknown[]): string | null => {
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const text = value.trim();
      if (!text || /^(name|time|role|n\/?a|unknown|undefined|null|[-—])$/i.test(text)) continue;
      return text;
    }
    return null;
  };

  const getRecordName = (record: unknown): string | null => {
    if (!isShiftRecord(record)) return null;
    const firstAndLastName = [record.first_name, record.last_name]
      .filter((name: unknown) => typeof name === 'string' && name.trim())
      .join(' ');
    return getMeaningfulText(record.full_name, record.employee_name, record.name, firstAndLastName);
  };

  const getScheduleTime = (member: unknown): string => {
    if (!isShiftRecord(member)) return t('Time unavailable');
    const shift = isShiftRecord(member.shift)
      ? member.shift
      : isShiftRecord(member.schedule)
        ? member.schedule
        : {};
    const formatScheduleValue = (value: unknown): string | null => {
      const text = getMeaningfulText(typeof value === 'string' ? value : '');
      if (!text) return null;
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
        const [hours, minutes] = text.split(':').map(Number);
        return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
      }
      const parsedDate = new Date(text);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      }
      return text;
    };

    const start = formatScheduleValue(
      member.start_at ?? member.start_time ?? shift.start_at ?? shift.start_time,
    );
    const end = formatScheduleValue(
      member.end_at ?? member.end_time ?? shift.end_at ?? shift.end_time,
    );
    if (start && end) return `${start} - ${end}`;

    return (
      formatScheduleValue(member.time ?? shift.time) ??
      t('Time unavailable')
    );
  };

  return (
    <>
      <style>{`
        .custom-vertical-scroll::-webkit-scrollbar { width: 3px; }
        .custom-vertical-scroll::-webkit-scrollbar-track { background-color: #ffe5e5; border-radius: 10px; margin: 10px 0; }
        .custom-vertical-scroll::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 10px; transition: background-color 0.2s ease; }
        .custom-vertical-scroll:hover::-webkit-scrollbar-thumb, .custom-vertical-scroll:active::-webkit-scrollbar-thumb { background-color: #ff3b30; }
        @keyframes softPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .status-pulse { animation: softPulse 1.6s ease-in-out infinite; }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      <div className="min-h-screen bg-[#FAFAFA] p-8 font-sans text-gray-800 relative">
        <h1 className="text-3xl font-bold mb-6">{t('Shift Management')}</h1>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Column */}
          <div className="flex-1 flex flex-col gap-6 w-full min-w-0">

            {/* Today Card */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="text-xl font-extrabold text-black mb-4">{t('Today')}</h2>

              <div className="border-[3px] border-[#f8e1e6] rounded-xl p-5 relative bg-white shadow-[0_4px_15px_-3px_rgba(0,0,0,0.05)]">
                {currentAttendance?.clock_in && !currentAttendance.clock_out ? (
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="inline-flex items-center gap-1.5 bg-[#2ecc71] text-white px-3 py-1.5 rounded-full text-sm font-medium mb-3">
                        <FiCheckCircle /> {t('On Shift')}
                      </span>
                      <p className="text-[#555555] mb-1 text-[15px]">
                        {t('Clocked in:')} <span className="text-black font-bold">{formatTime(currentAttendance.clock_in)}</span>
                      </p>
                      <p className="text-[#555555] text-[15px]">
                        {t('Actual worked time:')}{' '}
                        <span className="text-black font-bold">
                          {calculateWorkedTime(
                            currentAttendance.clock_in,
                            null,
                            currentAttendance.breaks,
                          )}
                        </span>
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="font-bold text-[#333333] text-[13px] mb-1">{formatDate(currentAttendance.clock_in)}</p>
                      <p className="text-lg font-extrabold text-black mb-3">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <button
                        onClick={handleClockOut}
                        disabled={isClockingOut}
                        className="flex items-center gap-2 bg-gradient-to-r from-[#b12a68] to-[#7a1c7d] text-white font-medium py-2 px-6 rounded-lg shadow-md hover:opacity-90 transition disabled:opacity-50"
                      >
                        {isClockingOut ? t('Clocking...') : (<><FiLogOut /> {t('Clock Out')}</>)}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-2">
                    <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-sm font-medium mb-3">
                      {t('Off Shift')}
                    </span>
                    {currentAttendance?.clock_in && currentAttendance.clock_out && (
                      <p className="text-[#555555] text-[15px]">
                        {t('Actual worked time:')}{' '}
                        <span className="text-black font-bold">
                          {calculateWorkedTime(
                            currentAttendance.clock_in,
                            currentAttendance.clock_out,
                            currentAttendance.breaks,
                          )}
                        </span>
                      </p>
                    )}
                  </div>
                )}
                {currentShift && (
                  <div className="mt-4 border-t border-gray-100 pt-3 text-sm text-gray-600">
                    <span className="font-semibold">{t('Scheduled hours:')}</span>{' '}
                    {formatTime(currentShift.start_at)} - {formatTime(currentShift.end_at)}
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Shift */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h2 className="text-xl font-extrabold text-black mb-4">{t('Up Coming Shift')}</h2>

              <div className="flex overflow-x-auto gap-4 pb-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {upcomingShifts.length > 0 ? (
                  upcomingShifts.map((shift: any, index: number) => {
                    const isScheduled = (shift.status ?? 'scheduled') === 'scheduled';
                    const shiftEmpId = shift.employee_shift_id ?? shift.shift_id ?? shift.id;
                    return (
                      <div
                        key={shiftEmpId ?? shift._id ?? index}
                        className="flex-1 min-w-[30%] shrink-0 snap-start border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col gap-3"
                      >
                        <h3 className="font-bold text-gray-800">
                          {new Date(shift.start_at).toLocaleDateString('en-US', { weekday: 'long' })}
                        </h3>
                        <span className="bg-[#fdf2f4] text-[#c9516b] px-3 py-1 rounded-full text-xs font-medium w-fit">
                          {shift.role || t('Shift')}
                        </span>
                        <p className="text-sm text-gray-500">
                          {formatTime(shift.start_at)} - {formatTime(shift.end_at)}
                        </p>
                        <p className="text-xs text-gray-400">ID: {shiftEmpId ?? '—'}</p>
                        <button
                          onClick={() => openSwapModal(shift)}
                          disabled={!isScheduled || shiftEmpId == null}
                          className="mt-1 w-full border border-[#f8b4c4] text-[#c9516b] font-medium py-1.5 rounded-lg text-sm hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {t('Request Swap')}
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-gray-500 py-2 font-medium">{t('No upcoming shifts scheduled.')}</div>
                )}
              </div>
            </div>

            {/* Incoming Shift Swap Requests */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mt-2">
              <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
                <FiRepeat className="w-5 h-5 text-gray-800" />
                <h2 className="text-lg font-bold">{t('Shift Swap Requests (Incoming)')}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {swapRequests.length > 0 ? (
                  swapRequests.map((req: any, index: number) => {
                    const requester = getEmployeeInfo(req.requester_employee_id);

                    const rawSwapId =
                      req.shift_swap_id ??
                      req.swap_id ??
                      req.swapId ??
                      req.id ??
                      req._id;

                    const isValidId =
                      rawSwapId !== undefined &&
                      rawSwapId !== null &&
                      rawSwapId !== '' &&
                      String(rawSwapId) !== 'undefined' &&
                      String(rawSwapId) !== 'null';

                    const swapIdToSend = isValidId ? String(rawSwapId) : null;

                    const cardKey = swapIdToSend ?? `req-${index}-${req.requester_employee_id ?? 'x'}`;

                    const isThisCardResponding =
                      swapIdToSend !== null && respondingId === swapIdToSend;
                    const isAccepting = isThisCardResponding && respondingAction === 'accepted';
                    const isRejecting = isThisCardResponding && respondingAction === 'rejected';
                    const anyOtherCardResponding =
                      respondingId !== null && respondingId !== swapIdToSend;

                    return (
                      <div key={cardKey} className="border border-gray-100 rounded-xl p-5 shadow-sm bg-white">
                        <div className="flex items-center gap-3 mb-3">
                          <img
                            src={requester.profile_image || 'https://i.pravatar.cc/150?img=1'}
                            alt="avatar"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <span className="font-semibold text-gray-700">{requester.full_name}</span>
                        </div>

                        <div className="flex items-center gap-4 mb-4">
                          <span className="text-xs text-gray-500 flex items-center gap-1.5">
                            <FiClock className="w-3.5 h-3.5" /> {t('Shift')} #{req.requester_shift_id ?? '—'}
                          </span>
                          {req.target_shift_id && (
                            <span className="text-xs text-gray-500 flex items-center gap-1.5">
                              <FiRepeat className="w-3.5 h-3.5" /> → #{req.target_shift_id}
                            </span>
                          )}
                          <span className="bg-[#fdf2f4] text-[#c9516b] px-4 py-1 rounded-full text-xs font-medium">
                            {requester.role || t('Role')}
                          </span>
                        </div>

                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                          {req.reason || t('No reason provided.')}
                        </p>

                        {!isValidId && (
                          <p className="text-xs text-red-500 mb-3 font-medium">
                            ⚠️ {t('This request has no valid swap ID — cannot respond.')}
                          </p>
                        )}

                        <div className="flex gap-4">
                          <button
                            onClick={() => swapIdToSend && handleRespondToSwap(swapIdToSend, 'rejected')}
                            disabled={!isValidId || isThisCardResponding || anyOtherCardResponding}
                            className="flex-1 border border-[#f8b4c4] text-[#c9516b] font-medium py-2 rounded-lg text-sm hover:bg-red-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isRejecting ? t('Rejecting…') : t('Reject')}
                          </button>
                          <button
                            onClick={() => swapIdToSend && handleRespondToSwap(swapIdToSend, 'accepted')}
                            disabled={!isValidId || isThisCardResponding || anyOtherCardResponding}
                            className="flex-1 bg-[#2ecc71] text-white font-medium py-2 rounded-lg text-sm hover:bg-green-600 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isAccepting ? t('Accepting…') : t('Accept')}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-gray-500 font-medium">{t('No pending swap requests.')}</div>
                )}
              </div>
            </div>

            {/* Outgoing Swap Requests */}
            {outgoingSwapRequests.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mt-2 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#b12a68] to-[#7a1c7d] flex items-center justify-center shadow-sm">
                      <FiRepeat className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 leading-tight">
                        {t('Outgoing Swap Requests')}
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t("Requests you've sent to coworkers")}
                      </p>
                    </div>
                  </div>
                  <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                    {outgoingSwapRequests.length} {t('total')}
                  </span>
                </div>

                <div className="p-5 flex flex-col gap-3">
                  {outgoingSwapRequests.map((req: any, i: number) => {
                    const swapId = req.shift_swap_id ?? req.id ?? req._id;
                    const statusStyle = getStatusStyle(req.status);
                    const target = getEmployeeInfo(req.target_employee_id);
                    const isPending = (req.status || 'pending').toLowerCase() === 'pending';

                    return (
                      <div
                        key={swapId ?? i}
                        className="group relative border border-gray-100 rounded-xl p-4 hover:border-gray-200 hover:shadow-md transition-all bg-white"
                      >
                        <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${statusStyle.dot}`} />

                        <div className="flex items-start justify-between gap-4 pl-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <img
                              src={target.profile_image || `https://i.pravatar.cc/100?u=${req.target_employee_id}`}
                              alt="avatar"
                              className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm shrink-0"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-gray-900 text-sm truncate">
                                  {target.full_name}
                                </p>
                                <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot} ${isPending ? 'status-pulse' : ''}`} />
                                  {statusStyle.label}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 mt-2 text-xs text-gray-600 flex-wrap">
                                <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-1 rounded-md font-medium">
                                  <FiClock className="w-3 h-3 text-gray-400" />
                                  {t('Shift')} #{req.requester_shift_id ?? '—'}
                                </span>
                                <FiRepeat className="w-3.5 h-3.5 text-[#c9516b]" />
                                <span className="inline-flex items-center gap-1 bg-[#fdf2f4] border border-[#f8e1e6] px-2 py-1 rounded-md font-medium text-[#c9516b]">
                                  <FiClock className="w-3 h-3" />
                                  {t('Shift')} #{req.target_shift_id ?? '—'}
                                </span>
                              </div>

                              {req.reason && (
                                <p className="text-xs text-gray-500 mt-2 line-clamp-2 italic">
                                  "{req.reason}"
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end gap-1">
                            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                              {t('Swap ID')}
                            </span>
                            <span className="text-xs font-mono font-semibold text-gray-700 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                              #{swapId ?? '—'}
                            </span>
                            {req.created_at && (
                              <span className="text-[10px] text-gray-400 mt-1">
                                {new Date(req.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Team Scheduled */}
          <div className="w-full lg:w-[350px] bg-white rounded-2xl p-5 border border-gray-100 shadow-sm shrink-0 flex flex-col max-h-[calc(100vh-140px)]">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-4 shrink-0">
              <FiUsers className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-bold">{t('Team Scheduled')}</h2>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto custom-vertical-scroll pr-3 flex-1">
              {teamSchedule.length > 0 ? (
                teamSchedule.map((member: any, idx: number) => {
                  const employeeId =
                    member.employee_id ??
                    member.employee?.employee_id ??
                    member.user?.employee_id;
                  const coworker = coworkers.find(
                    (person: any) =>
                      employeeId != null &&
                      String(person.employee_id) === String(employeeId),
                  );
                  const hasName = Boolean(
                    getRecordName(member) ??
                    getRecordName(member.employee) ??
                    getRecordName(member.user) ??
                    getRecordName(coworker),
                  );
                  const name =
                    getRecordName(member) ??
                    getRecordName(member.employee) ??
                    getRecordName(member.user) ??
                    getRecordName(coworker) ??
                    t('Name unavailable');
                  const profileImage =
                    member.profile_image ??
                    member.employee?.profile_image ??
                    member.user?.profile_image ??
                    coworker?.profile_image;
                  return (
                    <div
                      key={member._id || member.employee_shift_id || member.shift_id || idx}
                      className="flex items-center justify-between border border-gray-100 rounded-xl p-3 shadow-sm bg-white shrink-0"
                    >
                      <div className="flex items-center gap-3">
                        {profileImage ? (
                          <img
                            src={profileImage}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            aria-hidden="true"
                            className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-semibold"
                          >
                            {hasName ? name.charAt(0).toUpperCase() : '?'}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <FiClock className="w-3 h-3" /> {getScheduleTime(member)}
                          </p>
                        </div>
                      </div>
                      <span className="bg-[#fdf2f4] text-[#c9516b] px-3 py-1.5 rounded-full text-xs font-medium">
                        {getMeaningfulText(member.role, member.employee?.role, member.user?.role) ??
                          t('Role unavailable')}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-500 text-sm font-medium">{t('No team members scheduled.')}</div>
              )}
            </div>
          </div>
        </div>

        {/* MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-[560px] p-6 shadow-2xl relative">
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h2 className="text-[22px] font-bold text-black">{t('Request Shift Swap')}</h2>
                <button onClick={closeModal} className="text-gray-500 hover:text-gray-800 transition">
                  <FiX className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 shadow-sm">
                <p className="font-bold text-sm mb-4">{t('Your Shift')}</p>
                <div className="flex justify-between items-center">
                  <p className="text-gray-800 font-medium text-[15px]">
                    {selectedShiftToSwap?.start_at
                      ? `${new Date(selectedShiftToSwap.start_at).toLocaleDateString('en-US', { weekday: 'long' })} / ${formatTime(selectedShiftToSwap.start_at)} - ${formatTime(selectedShiftToSwap.end_at)}`
                      : '—'}
                  </p>
                  <span className="bg-[#fdf2f4] text-[#c9516b] px-4 py-1.5 rounded-full text-xs font-medium">
                    {selectedShiftToSwap?.role || t('Shift')}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  ID: {selectedShiftToSwap?.employee_shift_id ?? selectedShiftToSwap?.shift_id ?? selectedShiftToSwap?.id ?? '—'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('Swap With')}</label>
                  <div className="relative">
                    <select
                      value={selectedCoworker}
                      onChange={(e) => { setSelectedCoworker(e.target.value); setSelectedTargetShiftId(''); }}
                      className="w-full appearance-none border border-gray-300 rounded-lg py-2.5 px-3 text-sm text-gray-600 focus:outline-none focus:border-purple-500 bg-white"
                    >
                      <option value="">{t('Select Coworker')}</option>
                      {coworkers.map((c: any) => (
                        <option key={c.employee_id} value={c.employee_id}>
                          {c.full_name} (ID: {c.employee_id})
                        </option>
                      ))}
                    </select>
                    <FiChevronDown className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('Their Shift')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedTargetShiftId}
                      onChange={(e) => setSelectedTargetShiftId(e.target.value)}
                      disabled={!selectedCoworker || isFetchingCoworkerShifts}
                      className="w-full appearance-none border border-gray-300 rounded-lg py-2.5 px-3 text-sm text-gray-600 focus:outline-none focus:border-purple-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="">
                        {isFetchingCoworkerShifts ? t('Loading…') : selectedCoworker ? t('Select their shift') : t('Select coworker first')}
                      </option>
                      {coworkerShifts.map((s: any, i: number) => {
                        const id = s.employee_shift_id ?? s.shift_id ?? s.id ?? i;
                        return (
                          <option key={id} value={id}>
                            {new Date(s.start_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {formatTime(s.start_at)}-{formatTime(s.end_at)} (ID: {id})
                          </option>
                        );
                      })}
                    </select>
                    <FiChevronDown className="w-4 h-4 absolute right-3 top-3 text-gray-400 pointer-events-none" />
                  </div>
                  {selectedCoworker && !isFetchingCoworkerShifts && coworkerShifts.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">{t('This coworker has no available shifts. Pick another coworker.')}</p>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('Reason')}</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('e.g. Medical appointment on Friday')}
                  className="w-full border border-gray-300 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleRequestSwap}
                  disabled={isRequesting || !selectedTargetShiftId}
                  className="bg-gradient-to-r from-[#b12a68] to-[#7a1c7d] text-white font-medium py-2.5 px-10 rounded-lg shadow-md hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRequesting ? t('Requesting...') : t('Request Swap')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}