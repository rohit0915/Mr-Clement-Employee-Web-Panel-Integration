import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next"; // ✅ Added i18n
import {
  useGetReservationFloorMapQuery,
  useCreateEmployeeReservationMutation,
} from "@/redux/api/reservationApi";
import type { FloorMapTable } from "@/types/reservation";
import toast from "react-hot-toast";

interface ReserveTableModalProps {
  open: boolean;
  onClose: () => void;
  floorId: number;
  floorName?: string;
}

const DURATION_OPTIONS = [60] as const;
const SLOT_START_HOUR = 9;
const RESERVATION_WINDOW_DAYS = 10;

const formatSlotTime = (minutesAfterMidnight: number): string => {
  const hour = Math.floor(minutesAfterMidnight / 60) % 24;
  const minutes = minutesAfterMidnight % 60;
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 || 12;
  return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
};

const getDateBounds = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastBookableDay = new Date(today);
  lastBookableDay.setDate(lastBookableDay.getDate() + RESERVATION_WINDOW_DAYS);
  const toDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  return { min: toDateString(today), max: toDateString(lastBookableDay) };
};

/** True only if the backend says the table is free AND big enough. */
const isTableSelectable = (t: FloorMapTable): boolean =>
  t.available !== false && t.capacity_sufficient !== false;

const tableLabel = (t: FloorMapTable): string =>
  (t["Table-name"] as string | undefined) ??
  (t["Table-code"] as string | undefined) ??
  `t-${String(t.Table_id).padStart(2, "0")}`;

const ReserveTableModal: React.FC<ReserveTableModalProps> = ({
  open,
  onClose,
  floorId,
  floorName,
}) => {
  const { t } = useTranslation(); // ✅ Added i18n hook

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateStr, setDateStr] = useState(""); // YYYY-MM-DD
  const [timeStr, setTimeStr] = useState(""); // HH:mm
  const [duration, setDuration] = useState<number>(60);
  const [partySize, setPartySize] = useState<number | "">("");
  const [selectedTable, setSelectedTable] = useState<FloorMapTable | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Full ISO with IST offset (+05:30) — sent as `date_time` to the backend.
  const dateTime = useMemo(() => {
    if (!dateStr || !timeStr) return "";
    return `${dateStr}T${timeStr}:00+05:30`;
  }, [dateStr, timeStr]);
  const slotsTime = useMemo(() => {
    if (!timeStr) return "";
    const [hour, minute] = timeStr.split(":").map(Number);
    const startMinutes = hour * 60 + minute;
    return `${formatSlotTime(startMinutes)} - ${formatSlotTime(startMinutes + duration)}`;
  }, [duration, timeStr]);

  const canQuery =
    open && Boolean(dateTime) && partySize !== "" && Boolean(floorId);

  const { data, isFetching } = useGetReservationFloorMapQuery(
    {
      floorId,
      dateTime,
      durationMinutes: duration,
      partySize: Number(partySize),
    },
    { skip: !canQuery }
  );

  const [createReservation, { isLoading: isCreating }] =
    useCreateEmployeeReservationMutation();

  const tables = data?.tables ?? [];

  // Reset selection when query params change.
  useEffect(() => {
    setSelectedTable(null);
  }, [dateTime, duration, partySize, floorId]);

  // Reset form on close.
  useEffect(() => {
    if (!open) {
      setName("");
      setPhone("");
      setDateStr("");
      setTimeStr("");
      setDuration(60);
      setPartySize("");
      setSelectedTable(null);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    setError(null);

    // Frontend validation
    if (name.trim().length < 2 || name.trim().length > 100)
      return setError(t("Guest name must be between 2 and 100 characters."));
    if (!/^\d{10}$/.test(phone))
      return setError(t("Enter a 10-digit contact number."));
    if (!dateTime) return setError(t("Pick a date and time."));
    if (!dateStr || dateStr < getDateBounds().min || dateStr > getDateBounds().max)
      return setError(t("Select a reservation date within the next 10 days."));
    const [selectedHour, selectedMinute] = timeStr.split(":").map(Number);
    if (selectedHour < SLOT_START_HOUR || selectedMinute !== 0)
      return setError(t("Select an hourly slot starting at 9:00 AM."));
    if (partySize === "" || !Number.isInteger(Number(partySize)) || Number(partySize) < 1)
      return setError(t("Party size must be at least 1."));
    if (!selectedTable) return setError(t("Select a table."));
    if (!isTableSelectable(selectedTable))
      return setError(t("That table is not available for this slot."));

    // Show loading toast while saving
    const loadingToast = toast.loading(t("Creating reservation..."));

    try {
      await createReservation({
        guest_name: name.trim(),
        guest_phone: phone,
        slots_time: slotsTime,
        date_time: dateTime,
        party_size: Number(partySize),
        floor_id: floorId,
        table_id: selectedTable.Table_id,
        duration_minutes: duration,
      }).unwrap();

      // Show success toast
      toast.success(t("Reservation created successfully!"), { id: loadingToast });
      onClose();
    } catch (e: any) {
      console.error("Failed to create reservation", e);
      
      const msg = e?.data?.message || e?.message || t("Failed to create reservation. Please try again.");
      
      // Show error toast
      toast.error(msg, { id: loadingToast });
      setError(msg);
    }
  };

  // Helper to translate table status sublabels
  const tableSublabel = (t_item: FloorMapTable): string => {
    if (!isTableSelectable(t_item)) {
      const status = t_item.reservation_view_status as string | undefined;
      if (status) return t(status);
      return t_item.capacity_sufficient === false ? t("Too small") : t("Unavailable");
    }
    const cap = t_item.Capacity ?? t_item["Seating-Persons_Count"];
    return cap != null ? `${t('Cap')} ${cap}` : "";
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl w-[900px] max-w-full shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800">
            {t('Reserve Table')}
            {floorName ? (
              <span className="text-gray-400 font-normal"> — {floorName}</span>
            ) : null}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('Close')}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          <h3 className="text-lg font-bold mb-4">{t('Customize Table')}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('Person Name')}
              required
              minLength={2}
              maxLength={100}
              className="bg-[#F9F5F9] px-4 py-3 rounded-lg text-sm outline-none w-full"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder={t('Contact No')}
              inputMode="numeric"
              autoComplete="tel-national"
              required
              maxLength={10}
              pattern="\d{10}"
              className="bg-[#F9F5F9] px-4 py-3 rounded-lg text-sm outline-none w-full"
            />
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              min={getDateBounds().min}
              max={getDateBounds().max}
              required
              className="bg-[#F9F5F9] px-4 py-3 rounded-lg text-sm outline-none w-full"
            />
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              min="09:00"
              step={60 * 60}
              required
              className="bg-[#F9F5F9] px-4 py-3 rounded-lg text-sm outline-none w-full"
            />
            <input
              type="number"
              min={1}
              step={1}
              value={partySize}
              onChange={(e) =>
                setPartySize(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              placeholder={t('No of person')}
              className="bg-[#F9F5F9] px-4 py-3 rounded-lg text-sm outline-none w-full"
            />
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="bg-[#F9F5F9] px-4 py-3 rounded-lg text-sm outline-none w-full text-gray-700"
              title={t("Reservation duration — saved with the booking")}
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} {t('minutes')}
                </option>
              ))}
            </select>
          </div>

          <h3 className="text-base font-bold mb-4">
            {t('Available tables for your inputs')}
          </h3>

          {!canQuery ? (
            <p className="text-sm text-gray-500">
              {t('Enter date, time, and party size to see available tables.')}
            </p>
          ) : isFetching ? (
            <p className="text-sm text-gray-500">{t('Checking availability…')}</p>
          ) : tables.length === 0 ? (
            <p className="text-sm text-gray-500">
              {t('No tables available for this slot. Try another time or party size.')}
            </p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {tables.map((t_item) => {
                const selectable = isTableSelectable(t_item);
                return (
                  <TableCard
                    key={t_item.Table_id}
                    label={tableLabel(t_item)}
                    sublabel={tableSublabel(t_item)}
                    selected={selectedTable?.Table_id === t_item.Table_id}
                    disabled={!selectable}
                    onClick={() => selectable && setSelectedTable(t_item)}
                  />
                );
              })}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 mt-4" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100"
          >
            {t('Cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isCreating}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-b from-[#6A1B9A] to-[#D32F2F] shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? t("Reserving…") : t("Confirm Reservation")}
          </button>
        </div>
      </div>
    </div>
  );
};

interface TableCardProps {
  label: string;
  sublabel?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

const TableCard: React.FC<TableCardProps> = ({
  label,
  sublabel,
  selected,
  disabled,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`relative flex flex-col items-center justify-center w-[120px] h-[90px] rounded-2xl border transition-all ${
      disabled
        ? "bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed"
        : selected
          ? "bg-purple-50 border-purple-400 ring-2 ring-purple-300"
          : "bg-[#FDF0F4] border-pink-100 hover:border-pink-300"
    }`}
  >
    <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
      <svg width="100" height="70" viewBox="0 0 120 90" fill="none">
        <rect x="20" y="10" width="80" height="50" rx="8" fill="#A579D1" />
        <rect x="5" y="20" width="10" height="30" rx="4" fill="#A579D1" />
        <rect x="105" y="20" width="10" height="30" rx="4" fill="#A579D1" />
        <rect x="30" y="65" width="60" height="10" rx="4" fill="#A579D1" />
      </svg>
    </div>
    <div className="z-10 w-10 h-10 rounded-full bg-gradient-to-r from-[#8E24AA] to-[#D32F2F] flex items-center justify-center text-white font-bold text-sm shadow-md">
      {label}
    </div>
    {sublabel && (
      <span className="z-10 mt-1 text-[10px] font-semibold text-gray-500">
        {sublabel}
      </span>
    )}
  </button>
);

export default ReserveTableModal;