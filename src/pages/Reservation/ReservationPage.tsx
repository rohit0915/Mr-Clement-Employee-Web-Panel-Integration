import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // ✅ Added i18n
import toast from 'react-hot-toast';
import {
  useGetReservationsQuery,
  useGetEmployeeReservationSlotsQuery,
  useCreateEmployeeReservationMutation,
  useUpdateReservationMutation,
  useDeleteReservationMutation,
} from '../../redux/api/reservationApi';
import {
  useGetAllFloorsQuery,
  useGetFloorWithTablesQuery,
} from '../../redux/api/quickOrderSlice';
import type {
  CreateReservationPayload,
  UpdateReservationPayload,
  Reservation,
} from '../../types/reservation';
import type { Floor, FloorWithTablesResponse, Table } from '../../types/order';

const toastStyle = { borderRadius: '10px', background: '#333', color: '#fff' };
const RESERVATION_WINDOW_DAYS = 9;
const PHONE_DIGIT_COUNT = 10;
const GUEST_NAME_MAX_LENGTH = 100;
const NOTES_MAX_LENGTH = 500;

type NewReservationDraft = CreateReservationPayload & {
  reservation_time: string;
  reservation_end_time: string;
};

const getTimeInMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const getSlotDurationMinutes = (startTime: string, endTime: string): number => {
  const start = getTimeInMinutes(startTime);
  let end = getTimeInMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return end - start;
};

const parseTimeRange = (value: string): [string, string] | null => {
  const match =
    /^(0[1-9]|1[0-2]):([0-5]\d) (AM|PM) - (0[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/.exec(value);
  if (!match) return null;

  const to24HourTime = (hour: string, minute: string, period: string) => {
    const hours = (Number(hour) % 12) + (period === 'PM' ? 12 : 0);
    return `${String(hours).padStart(2, '0')}:${minute}`;
  };

  return [
    to24HourTime(match[1], match[2], match[3]),
    to24HourTime(match[4], match[5], match[6]),
  ];
};

const normalizePhone = (value: string): string =>
  value.replace(/\D/g, '').slice(0, PHONE_DIGIT_COUNT);

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getReservationDateBounds = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastBookableDay = new Date(today);
  lastBookableDay.setDate(lastBookableDay.getDate() + RESERVATION_WINDOW_DAYS);
  return {
    min: toLocalDateString(today),
    max: toLocalDateString(lastBookableDay),
  };
};

const isReservationDateAllowed = (value: string): boolean => {
  const { min, max } = getReservationDateBounds();
  const parsedDate = new Date(`${value}T00:00:00`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(parsedDate.getTime()) &&
    toLocalDateString(parsedDate) === value &&
    value >= min &&
    value <= max
  );
};

const getDateInputValue = (value: string): string => {
  const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1];
  if (dateOnly) return dateOnly;
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? '' : toLocalDateString(parsedDate);
};

const useReservationTableOptions = (floorId: number) => {
  const floorsQuery = useGetAllFloorsQuery();
  const tablesQuery = useGetFloorWithTablesQuery(
    { floorId: String(floorId), status: 'All' },
    { skip: !floorId },
  );
  const response = tablesQuery.currentData as
    | (FloorWithTablesResponse & { data?: FloorWithTablesResponse | Table[] })
    | undefined;
  const nestedData = response?.data;
  const tables = Array.isArray(response?.tables)
    ? response.tables
    : Array.isArray(nestedData)
      ? nestedData
      : nestedData && !Array.isArray(nestedData) && Array.isArray(nestedData.tables)
        ? nestedData.tables
        : [];

  return {
    floors: floorsQuery.data?.data ?? [],
    tables,
    isLoading: floorsQuery.isLoading || tablesQuery.isFetching,
    isError: floorsQuery.isError || tablesQuery.isError,
  };
};

const getTableLabel = (table: Table): string =>
  table['Table-name'] || table.Title || `Table ${table.Table_id}`;

const getTableCapacity = (table: Table): number =>
  table.Capacity ?? table['Seating-Persons_Count'] ?? 4;

// ---------------------------------------------------------------------------
// Create Modal
// ---------------------------------------------------------------------------
const NewReservationModal = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateReservationPayload) => Promise<boolean>;
  isSubmitting: boolean;
}) => {
  const { t } = useTranslation(); // ✅ Added i18n hook
  const [floorId, setFloorId] = useState(0);
  const [isReviewing, setIsReviewing] = useState(false);
  const { floors, tables, isLoading: isLoadingTables, isError: isTableLoadError } =
    useReservationTableOptions(floorId);

  const [formData, setFormData] = useState<NewReservationDraft>({
    Reservations_online: false,
    Customer_id: 25,
    slots: '',
    slots_time: '',
    occasion: '',
    title: 'Mohammed Al-Farsi',
    customer_mobile: '',
    Floor: 0,
    Capacity_count: 4,
    people_count: 4,
    PaymentStatus: 'UnPaid',
    Table_id: 0,
    Date_time: '',
    reservation_time: '',
    reservation_end_time: '',
    duration_minutes: 0,
    Notes: 'Allergies: nuts',
    Status: true,
  });
  const {
    currentData: generatedSlotsData,
    isFetching: isLoadingGeneratedSlots,
    isError: isGeneratedSlotsError,
  } = useGetEmployeeReservationSlotsQuery(Number(formData.Table_id), {
    skip: !formData.Table_id,
  });

  useEffect(() => {
    if (floors.length && !floors.some((floor: Floor) => floor.Floor_id === floorId)) {
      setFloorId(floors[0].Floor_id);
      setFormData((previous) => ({
        ...previous,
        Floor: floors[0].Floor_id,
        Table_id: 0,
      }));
    }
  }, [floors, floorId]);

  useEffect(() => {
    if (!floorId || isLoadingTables) return;
    const currentTable = tables.find((table: Table) => table.Table_id === formData.Table_id);
    if (currentTable) return;
    const firstTable = tables[0];
    setFormData((previous) => ({
      ...previous,
      Floor: floorId,
      Table_id: firstTable?.Table_id ?? 0,
      Capacity_count: firstTable ? getTableCapacity(firstTable) : previous.Capacity_count,
    }));
  }, [floorId, formData.Table_id, isLoadingTables, tables]);

  const selectedFormTable = tables.find(
    (table: Table) => table.Table_id === Number(formData.Table_id),
  );
  const availableSlotsForDate =
    generatedSlotsData?.generated_slots
      .find((day) => day.date === formData.Date_time)
      ?.slots.filter(
        (slot) =>
          slot.available &&
          slot.tables.some(
            (table) => table.table_id === Number(formData.Table_id) && table.available,
          ),
      ) ?? [];
  const exceedsTableCapacity =
    selectedFormTable != null &&
    Number(formData.people_count) > getTableCapacity(selectedFormTable);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const numericFields = [
      'Customer_id',
      'Floor',
      'Capacity_count',
      'people_count',
      'Table_id',
      'duration_minutes',
    ];
    if (name === 'Floor') {
      setFloorId(Number(value));
      setFormData((prev) => ({
        ...prev,
        Floor: Number(value),
        Table_id: 0,
        Date_time: '',
        slots: '',
        slots_time: '',
        reservation_time: '',
        reservation_end_time: '',
      }));
      return;
    }
    if (name === 'Table_id') {
      const selectedTable = tables.find((table: Table) => table.Table_id === Number(value));
      setFormData((prev) => ({
        ...prev,
        Table_id: Number(value),
        Floor: selectedTable?.Floor_id ?? floorId,
        Capacity_count: selectedTable ? getTableCapacity(selectedTable) : prev.Capacity_count,
        Date_time: '',
        slots: '',
        slots_time: '',
        reservation_time: '',
        reservation_end_time: '',
      }));
      return;
    }
    if (name === 'Date_time') {
      setFormData((prev) => ({
        ...prev,
        Date_time: value,
        slots: '',
        slots_time: '',
        reservation_time: '',
        reservation_end_time: '',
      }));
      return;
    }
    if (name === 'generated_slot') {
      const selectedSlot = availableSlotsForDate[Number(value)];
      const timeRange = selectedSlot ? parseTimeRange(selectedSlot.slots_time) : null;
      if (!selectedSlot || !timeRange) {
        toast.error(t('Select a valid generated reservation slot.'));
        return;
      }
      setFormData((prev) => ({
        ...prev,
        slots: selectedSlot.slot_type,
        slots_time: selectedSlot.slots_time,
        reservation_time: timeRange[0],
        reservation_end_time: timeRange[1],
        duration_minutes:
          generatedSlotsData?.slot_duration ??
          getSlotDurationMinutes(timeRange[0], timeRange[1]),
      }));
      return;
    }
    if (name === 'customer_mobile') {
      setFormData((prev) => ({ ...prev, customer_mobile: normalizePhone(value) }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: numericFields.includes(name) ? Number(value) : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const guestName = formData.title.trim();
    if (guestName.length < 2 || guestName.length > GUEST_NAME_MAX_LENGTH) {
      toast.error(t('Guest name must be between 2 and 100 characters.'));
      return;
    }
    if (!/^\d{10}$/.test(formData.customer_mobile ?? '')) {
      toast.error(t('Enter a 10-digit contact number.'));
      return;
    }
    if (!isReservationDateAllowed(formData.Date_time)) {
      toast.error(t('Select a reservation date within the next 10 days.'));
      return;
    }
    const selectedGeneratedSlot = availableSlotsForDate.find(
      (slot) =>
        slot.slots_time === formData.slots_time &&
        slot.slot_type === formData.slots,
    );
    if (!selectedGeneratedSlot) {
      toast.error(t('Select an available slot generated for this table and date.'));
      return;
    }
    if (!Number.isInteger(Number(formData.Table_id)) || Number(formData.Table_id) < 1) {
      toast.error(t('Select a valid table.'));
      return;
    }
    const selectedTable = tables.find((table: Table) => table.Table_id === Number(formData.Table_id));
    if (!selectedTable || selectedTable.Floor_id !== floorId) {
      toast.error(t('Select a table from the selected floor.'));
      return;
    }
    if (!Number.isInteger(Number(formData.people_count)) || Number(formData.people_count) < 1) {
      toast.error(t('Party size must be at least 1.'));
      return;
    }
    if (Number(formData.people_count) > getTableCapacity(selectedTable)) {
      toast.error(t('Selected table has {{capacity}} seats. Choose a table with more seats or reduce party size.', {
        capacity: getTableCapacity(selectedTable),
      }));
      return;
    }

    setFormData((previous) => ({
      ...previous,
      title: guestName,
      Floor: selectedTable.Floor_id,
      Capacity_count: getTableCapacity(selectedTable),
      Table_id: selectedTable.Table_id,
      people_count: Number(formData.people_count),
      duration_minutes: generatedSlotsData?.slot_duration ?? formData.duration_minutes,
      Date_time: formData.Date_time,
    }));
    setIsReviewing(true);
  };

  const handleConfirmReservation = async () => {
    const selectedTable = tables.find((table: Table) => table.Table_id === Number(formData.Table_id));
    if (!selectedTable || selectedTable.Floor_id !== floorId) {
      setIsReviewing(false);
      toast.error(t('Select a table from the selected floor.'));
      return;
    }
    const timeRange = parseTimeRange(formData.slots_time);
    if (!timeRange) {
      setIsReviewing(false);
      toast.error(t('Select an available slot generated for this table and date.'));
      return;
    }

    const {
      reservation_time: _reservationTime,
      reservation_end_time: _reservationEndTime,
      ...payloadDraft
    } = formData;
    const created = await onSubmit({
      ...payloadDraft,
      customer_mobile: formData.customer_mobile,
      Floor: selectedTable.Floor_id,
      Capacity_count: getTableCapacity(selectedTable),
      Table_id: selectedTable.Table_id,
      people_count: Number(formData.people_count),
      duration_minutes: generatedSlotsData?.slot_duration ?? formData.duration_minutes,
      Date_time: formData.Date_time,
    });
    if (created) {
      setIsReviewing(false);
      setFormData({
        Reservations_online: false,
        Customer_id: 25,
        slots: '',
        slots_time: '',
        occasion: '',
        title: 'Mohammed Al-Farsi',
        customer_mobile: '',
        Floor: floorId,
        Capacity_count: 4,
        people_count: 4,
        PaymentStatus: 'UnPaid',
        Table_id: 0,
        Date_time: '',
        reservation_time: '',
        reservation_end_time: '',
        duration_minutes: 0,
        Notes: 'Allergies: nuts',
        Status: true,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto border border-gray-100">
        <div className="p-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            {isReviewing ? t('Review Reservation') : t('New Reservation')}
          </h2>
          {isReviewing ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">{t('Confirm these reservation details before saving.')}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-gray-500">{t('Guest Name')}</dt><dd className="font-medium">{formData.title}</dd>
                <dt className="text-gray-500">{t('Phone')}</dt><dd className="font-medium">{formData.customer_mobile}</dd>
                <dt className="text-gray-500">{t('Reservation date')}</dt><dd className="font-medium">{formData.Date_time}</dd>
                <dt className="text-gray-500">{t('Time')}</dt><dd className="font-medium">{formData.slots_time}</dd>
                <dt className="text-gray-500">{t('Estimated Duration')}</dt><dd className="font-medium">{formData.duration_minutes} {t('minutes')}</dd>
                <dt className="text-gray-500">{t('Party Size')}</dt><dd className="font-medium">{formData.people_count}</dd>
                <dt className="text-gray-500">{t('Floor')}</dt><dd className="font-medium">{floors.find((floor: Floor) => floor.Floor_id === formData.Floor)?.Floor_Name ?? formData.Floor}</dd>
                <dt className="text-gray-500">{t('Assign Table')}</dt><dd className="font-medium">{selectedFormTable ? getTableLabel(selectedFormTable) : formData.Table_id}</dd>
                <dt className="text-gray-500">{t('Notes')}</dt><dd className="font-medium">{formData.Notes || '—'}</dd>
              </dl>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewing(false)}
                  className="flex-1 border border-purple-300 text-purple-700 bg-white py-2.5 rounded-md font-medium text-sm hover:bg-purple-50"
                >
                  {t('Back to edit')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsReviewing(false)}
                  className="flex-1 border border-gray-300 text-gray-700 bg-white py-2.5 rounded-md font-medium text-sm hover:bg-gray-50"
                >
                  {t('Cancel review')}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReservation}
                  disabled={isSubmitting}
                  className="flex-1 bg-[linear-gradient(180deg,#6A1B9A_0%,#D32F2F_100%)] text-white py-2.5 rounded-md font-medium text-sm disabled:opacity-50"
                >
                  {isSubmitting ? t('Confirming...') : t('Confirm Reservation')}
                </button>
              </div>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-reservation-guest-name" className="block text-[11px] text-gray-600 mb-1">{t('Guest Name')}</label>
                <input
                  id="new-reservation-guest-name"
                  type="text"
                  name="title"
                  required
                  minLength={2}
                  maxLength={GUEST_NAME_MAX_LENGTH}
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
                {exceedsTableCapacity && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {t('Selected table has {{capacity}} seats. Choose a table with more seats or reduce party size.', {
                      capacity: getTableCapacity(selectedFormTable),
                    })}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="new-reservation-phone" className="block text-[11px] text-gray-600 mb-1">{t('Phone')}</label>
                <input
                  id="new-reservation-phone"
                  type="tel"
                  name="customer_mobile"
                  value={formData.customer_mobile ?? ''}
                  placeholder={t('10-digit phone number')}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  required
                  maxLength={PHONE_DIGIT_COUNT}
                  pattern="\d{10}"
                  aria-describedby="new-reservation-phone-help"
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
                <p id="new-reservation-phone-help" className="sr-only">{t('Enter a 10-digit contact number.')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label htmlFor="new-reservation-occasion" className="block text-[11px] text-gray-600 mb-1">{t('Occasion')}</label>
                <input
                  id="new-reservation-occasion"
                  type="text"
                  name="occasion"
                  value={formData.occasion ?? ''}
                  placeholder={t('Birthday, Business, VIP...')}
                  maxLength={100}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-reservation-date-time" className="block text-[11px] text-gray-600 mb-1">{t('Reservation date')}</label>
                <input
                  id="new-reservation-date-time"
                  type="date"
                  name="Date_time"
                  value={formData.Date_time}
                  required
                  min={getReservationDateBounds().min}
                  max={getReservationDateBounds().max}
                  onChange={handleChange}
                  aria-describedby="new-reservation-date-time-help"
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
                <p id="new-reservation-date-time-help" className="sr-only">{t('Select a reservation date within the next 10 days.')}</p>
              </div>
              <div>
                <label htmlFor="new-reservation-time" className="block text-[11px] text-gray-600 mb-1">{t('Generated reservation slot')}</label>
                <select
                  id="new-reservation-time"
                  name="generated_slot"
                  value={String(availableSlotsForDate.findIndex(
                    (slot) => slot.slots_time === formData.slots_time &&
                      slot.slot_type === formData.slots,
                  ))}
                  onChange={handleChange}
                  required
                  disabled={
                    !formData.Table_id ||
                    !formData.Date_time ||
                    isLoadingGeneratedSlots ||
                    isGeneratedSlotsError ||
                    availableSlotsForDate.length === 0
                  }
                  aria-describedby="new-reservation-slot-help"
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white disabled:bg-gray-50"
                >
                  <option value="-1">
                    {isLoadingGeneratedSlots
                      ? t('Loading available slots...')
                      : !formData.Table_id
                        ? t('Select a table first')
                        : !formData.Date_time
                          ? t('Select a reservation date first')
                          : t('Select an available slot')}
                  </option>
                  {availableSlotsForDate.map((slot, index) => (
                    <option key={`${slot.slot_type}-${slot.slots_time}`} value={index}>
                      {slot.slots_time} ({t(slot.slot_type)})
                    </option>
                  ))}
                </select>
                <p id="new-reservation-slot-help" className="mt-1 text-[10px] text-gray-500">
                  {isGeneratedSlotsError
                    ? t('Could not load generated slots for this table.')
                    : !isLoadingGeneratedSlots && formData.Date_time && !availableSlotsForDate.length
                      ? t('No available generated slots for this table and date.')
                      : formData.slots_time}
                </p>
              </div>
              <div>
                <label htmlFor="new-reservation-party-size" className="block text-[11px] text-gray-600 mb-1">{t('Party Size')}</label>
                <input
                  id="new-reservation-party-size"
                  type="number"
                  name="people_count"
                  min={1}
                  max={selectedFormTable ? getTableCapacity(selectedFormTable) : undefined}
                  required
                  step={1}
                  value={formData.people_count}
                  aria-invalid={exceedsTableCapacity}
                  aria-describedby={exceedsTableCapacity ? 'new-reservation-party-size-error' : undefined}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
                {exceedsTableCapacity && (
                  <p id="new-reservation-party-size-error" role="alert" className="mt-1 text-xs text-red-600">
                    {t('Selected table has {{capacity}} seats. Choose a table with more seats or reduce party size.', {
                      capacity: getTableCapacity(selectedFormTable),
                    })}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-reservation-floor" className="block text-[11px] text-gray-600 mb-1">{t('Floor')}</label>
                <select
                  id="new-reservation-floor"
                  name="Floor"
                  value={floorId || ''}
                  onChange={handleChange}
                  required
                  disabled={isLoadingTables || floors.length === 0}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white disabled:bg-gray-50"
                >
                  <option value="">{t('Select Floor')}</option>
                  {floors.map((floor: Floor) => (
                    <option key={floor.Floor_id} value={floor.Floor_id}>{floor.Floor_Name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new-reservation-table" className="block text-[11px] text-gray-600 mb-1">{t('Assign Table')}</label>
                <select
                  id="new-reservation-table"
                  name="Table_id"
                  value={formData.Table_id}
                  onChange={handleChange}
                  required
                  disabled={isLoadingTables || tables.length === 0 || !floorId}
                  aria-invalid={isTableLoadError || (!isLoadingTables && floorId > 0 && tables.length === 0)}
                  aria-describedby={
                    isTableLoadError
                      ? 'new-reservation-table-error'
                      : !isLoadingTables && floorId > 0 && tables.length === 0
                        ? 'new-reservation-table-empty'
                        : undefined
                  }
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 bg-white disabled:bg-gray-50"
                >
                  <option value={0}>{isLoadingTables ? t('Loading...') : t('Select a table')}</option>
                  {tables.map((table: Table) => (
                    <option key={table.Table_id} value={table.Table_id}>
                      {getTableLabel(table)} · {t('Capacity')}: {getTableCapacity(table)}
                    </option>
                  ))}
                </select>
                {isTableLoadError && <p id="new-reservation-table-error" role="alert" className="mt-1 text-xs text-red-600">{t('Could not load tables for this floor.')}</p>}
                {!isLoadingTables && !isTableLoadError && floorId > 0 && tables.length === 0 && (
                  <p id="new-reservation-table-empty" className="mt-1 text-xs text-gray-500">{t('No tables are configured for this floor.')}</p>
                )}
              </div>
              <div className="col-span-2">
                <label htmlFor="new-reservation-notes" className="block text-[11px] text-gray-600 mb-1">{t('Notes')}</label>
                <input
                  id="new-reservation-notes"
                  type="text"
                  name="Notes"
                  maxLength={NOTES_MAX_LENGTH}
                  value={formData.Notes}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-purple-300 text-purple-700 bg-white py-2.5 rounded-md font-medium text-sm hover:bg-purple-50 transition-colors"
              >
                {t('Cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isLoadingTables || isTableLoadError || !formData.Table_id}
                className="flex-1 bg-[linear-gradient(180deg,#6A1B9A_0%,#D32F2F_100%)] text-white py-2.5 rounded-md font-medium text-sm shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? t('Confirming...') : t('Confirm Reservation')}
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Edit Modal
// ---------------------------------------------------------------------------
const EditReservationModal = ({
  reservation,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  reservation: Reservation | null;
  onClose: () => void;
  onSubmit: (data: UpdateReservationPayload) => void;
  isSubmitting: boolean;
}) => {
  const { t } = useTranslation(); // ✅ Added i18n hook

  const [formData, setFormData] = useState<UpdateReservationPayload>({
    id: 0,
    people_count: 1,
    Table_id: 0,
    PaymentStatus: 'UnPaid',
    Notes: '',
  });

  useEffect(() => {
    if (reservation) {
      setFormData({
        id: reservation.Reservations_id,
        people_count: reservation.people_count,
        Table_id: reservation.Table_id,
        PaymentStatus: reservation.PaymentStatus,
        Notes: reservation.Notes ?? '',
      });
    }
  }, [reservation]);

  if (!reservation) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'people_count' || name === 'Table_id' ? Number(value) : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto border border-gray-100">
        <div className="p-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            {t('Edit Reservation')} #{reservation.Reservations_id}
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label htmlFor="edit-reservation-guest-name" className="block text-[11px] text-gray-600 mb-1">{t('Guest Name')}</label>
              <input
                id="edit-reservation-guest-name"
                type="text"
                value={reservation.title ?? ''}
                disabled
                className="w-full border border-gray-200 bg-gray-50 rounded-md p-2 text-sm text-gray-500 cursor-not-allowed"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-reservation-party-size" className="block text-[11px] text-gray-600 mb-1">{t('Party Size')}</label>
                <input
                  id="edit-reservation-party-size"
                  type="number"
                  name="people_count"
                  min={1}
                  value={formData.people_count}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>
              <div>
                <label htmlFor="edit-reservation-table" className="block text-[11px] text-gray-600 mb-1">{t('Assign Table')}</label>
                <select
                  id="edit-reservation-table"
                  name="Table_id"
                  value={formData.Table_id}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((t_item) => (
                    <option key={t_item} value={t_item}>
                      {t('Table')} {t_item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-reservation-payment-status" className="block text-[11px] text-gray-600 mb-1">{t('Payment Status')}</label>
                <select
                  id="edit-reservation-payment-status"
                  name="PaymentStatus"
                  value={formData.PaymentStatus}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                >
                  <option value="UnPaid">{t('UnPaid')}</option>
                  <option value="Paid">{t('Paid')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="edit-reservation-notes" className="block text-[11px] text-gray-600 mb-1">{t('Notes')}</label>
                <input
                  id="edit-reservation-notes"
                  type="text"
                  name="Notes"
                  value={formData.Notes}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-purple-300 text-purple-700 bg-white py-2.5 rounded-md font-medium text-sm hover:bg-purple-50 transition-colors"
              >
                {t('Cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-[linear-gradient(180deg,#6A1B9A_0%,#D32F2F_100%)] text-white py-2.5 rounded-md font-medium text-sm shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? t('Saving...') : t('Save Changes')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------
const DeleteConfirmModal = ({
  reservation,
  onClose,
  onConfirm,
  isDeleting,
}: {
  reservation: Reservation | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) => {
  const { t } = useTranslation(); // ✅ Added i18n hook

  if (!reservation) return null;
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-2">{t('Delete Reservation?')}</h2>
        <p className="text-sm text-gray-500 mb-6">
          {t('This will permanently delete reservation')}{' '}
          <span className="font-medium text-gray-700">
            #{reservation.Reservations_id} — {reservation.title}
          </span>
          . {t('This action cannot be undone.')}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 bg-white py-2.5 rounded-md font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            {t('Cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 bg-red-600 text-white py-2.5 rounded-md font-medium text-sm shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? t('Deleting...') : t('Delete')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function ReservationPage() {
  const { t } = useTranslation(); // ✅ Added i18n hook

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [deletingReservation, setDeletingReservation] = useState<Reservation | null>(null);

  const [selectedForInline, setSelectedForInline] = useState<Reservation | null>(null);
  const [inlineForm, setInlineForm] = useState({
    title: '',
    customer_mobile: '',
    people_count: 1,
    Date_time: '',
    slots: '',
    slots_time: '',
    Floor: 0,
    Table_id: 1,
    Capacity_count: 4,
    Notes: '',
    PaymentStatus: 'UnPaid' as 'Paid' | 'UnPaid',
  });
  const {
    floors: reservationFloors,
    tables: inlineTables,
    isLoading: isLoadingInlineTables,
    isError: isInlineTableLoadError,
  } = useReservationTableOptions(inlineForm.Floor);
  const {
    currentData: inlineGeneratedSlotsData,
    isFetching: isLoadingInlineGeneratedSlots,
    isError: isInlineGeneratedSlotsError,
  } = useGetEmployeeReservationSlotsQuery(Number(inlineForm.Table_id), {
    skip: !inlineForm.Table_id || Boolean(selectedForInline),
  });

  const { data: reservations = [], isLoading } = useGetReservationsQuery();
  const [createEmployeeReservation, { isLoading: isCreating }] =
    useCreateEmployeeReservationMutation();
  const [updateReservation, { isLoading: isUpdating }] = useUpdateReservationMutation();
  const [deleteReservation, { isLoading: isDeleting }] = useDeleteReservationMutation();
  const selectedInlineTable = inlineTables.find(
    (table: Table) => table.Table_id === Number(inlineForm.Table_id),
  );
  const inlineAvailableSlotsForDate =
    inlineGeneratedSlotsData?.generated_slots
      .find((day) => day.date === getDateInputValue(inlineForm.Date_time))
      ?.slots.filter(
        (slot) =>
          slot.available &&
          slot.tables.some(
            (table) => table.table_id === Number(inlineForm.Table_id) && table.available,
          ),
      ) ?? [];
  const inlineExceedsTableCapacity =
    !selectedForInline &&
    selectedInlineTable != null &&
    Number(inlineForm.people_count) > getTableCapacity(selectedInlineTable);

  useEffect(() => {
    if (selectedForInline || !reservationFloors.length) return;
    if (reservationFloors.some((floor: Floor) => floor.Floor_id === inlineForm.Floor)) return;
    setInlineForm((previous) => ({
      ...previous,
      Floor: reservationFloors[0].Floor_id,
      Table_id: 0,
      Date_time: '',
      slots: '',
      slots_time: '',
    }));
  }, [inlineForm.Floor, reservationFloors, selectedForInline]);

  useEffect(() => {
    if (selectedForInline || !inlineForm.Floor || isLoadingInlineTables) return;
    const currentTable = inlineTables.find((table: Table) => table.Table_id === inlineForm.Table_id);
    if (currentTable) return;
    const firstTable = inlineTables[0];
    setInlineForm((previous) => ({
      ...previous,
      Table_id: firstTable?.Table_id ?? 0,
      Capacity_count: firstTable ? getTableCapacity(firstTable) : previous.Capacity_count,
      Date_time: '',
      slots: '',
      slots_time: '',
    }));
  }, [
    inlineForm.Floor,
    inlineForm.Table_id,
    inlineTables,
    isLoadingInlineTables,
    selectedForInline,
  ]);

  useEffect(() => {
    if (selectedForInline) {
      setInlineForm({
        title: selectedForInline.title ?? '',
        customer_mobile: selectedForInline.customer_mobile ?? '',
        people_count: selectedForInline.people_count,
        Date_time: selectedForInline.Date_time,
        slots: selectedForInline.slots ?? '',
        slots_time: selectedForInline.slots_time ?? '',
        Floor: selectedForInline.Floor,
        Table_id: selectedForInline.Table_id,
        Capacity_count: selectedForInline.Capacity_count,
        Notes: selectedForInline.Notes ?? '',
        PaymentStatus: selectedForInline.PaymentStatus as 'Paid' | 'UnPaid',
      });
    }
  }, [selectedForInline]);

  const resetInline = () => {
    setSelectedForInline(null);
    setInlineForm({
      title: '',
      customer_mobile: '',
      people_count: 1,
      Date_time: '',
      slots: '',
      slots_time: '',
      Floor: reservationFloors[0]?.Floor_id ?? 0,
      Table_id: 0,
      Capacity_count: 4,
      Notes: '',
      PaymentStatus: 'UnPaid',
    });
  };

  const handleCreateReservation = async (data: CreateReservationPayload): Promise<boolean> => {
    const timeRange = parseTimeRange(data.slots_time);
    if (!timeRange) {
      toast.error(t('Enter the reservation time in this format: 07:00 PM - 08:00 PM.'), {
        style: toastStyle,
      });
      return false;
    }

    try {
      await createEmployeeReservation({
        guest_name: data.title,
        guest_phone: data.customer_mobile,
        date_time: `${getDateInputValue(data.Date_time)}T${timeRange[0]}:00+05:30`,
        slots: data.slots,
        slots_time: data.slots_time,
        party_size: data.people_count,
        floor_id: data.Floor,
        table_id: data.Table_id,
        duration_minutes: data.duration_minutes,
        occasion: data.occasion,
        notes: data.Notes,
      }).unwrap();
      setIsModalOpen(false);
      toast.success(t('Reservation created successfully!'), { style: toastStyle });
      return true;
    } catch (error: any) {
      toast.error(error?.data?.error || error?.data?.message || t('Failed to create reservation.'), {
        style: toastStyle,
      });
      return false;
    }
  };

  const handleUpdateReservation = async (data: UpdateReservationPayload) => {
    try {
      await updateReservation(data).unwrap();
      setEditingReservation(null);
      resetInline();
      toast.success(t('Reservation updated successfully!'), { style: toastStyle });
    } catch (error: any) {
      toast.error(error?.data?.message || t('Failed to update reservation.'), {
        style: toastStyle,
      });
    }
  };

  const handleDeleteReservation = async () => {
    if (!deletingReservation) return;
    try {
      await deleteReservation(deletingReservation.Reservations_id).unwrap();
      if (selectedForInline?._id === deletingReservation._id) resetInline();
      setDeletingReservation(null);
      toast.success(t('Reservation deleted successfully!'), { style: toastStyle });
    } catch (error: any) {
      toast.error(error?.data?.message || t('Failed to delete reservation.'), {
        style: toastStyle,
      });
    }
  };

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedForInline) {
      handleUpdateReservation({
        id: selectedForInline.Reservations_id,
        people_count: Number(inlineForm.people_count),
        Table_id: Number(inlineForm.Table_id),
        PaymentStatus: inlineForm.PaymentStatus,
        Notes: inlineForm.Notes,
      });
    } else {
      const guestName = inlineForm.title.trim();
      if (guestName.length < 2 || guestName.length > GUEST_NAME_MAX_LENGTH) {
        toast.error(t('Guest name must be between 2 and 100 characters.'), {
          style: toastStyle,
        });
        return;
      }
      if (!/^\d{10}$/.test(inlineForm.customer_mobile)) {
        toast.error(t('Enter a 10-digit contact number.'), { style: toastStyle });
        return;
      }
      if (!isReservationDateAllowed(inlineForm.Date_time)) {
        toast.error(t('Select a reservation date within the next 10 days.'), {
          style: toastStyle,
        });
        return;
      }
      const selectedGeneratedSlot = inlineAvailableSlotsForDate.find(
        (slot) =>
          slot.slots_time === inlineForm.slots_time &&
          slot.slot_type === inlineForm.slots,
      );
      if (!selectedGeneratedSlot) {
        toast.error(t('Select an available slot generated for this table and date.'), {
          style: toastStyle,
        });
        return;
      }
      const selectedSlotTimeRange = parseTimeRange(selectedGeneratedSlot.slots_time);
      if (!selectedSlotTimeRange) {
        toast.error(t('The generated slot has an invalid time range.'), { style: toastStyle });
        return;
      }
      const selectedTable = inlineTables.find(
        (table: Table) => table.Table_id === Number(inlineForm.Table_id),
      );
      if (!selectedTable || selectedTable.Floor_id !== inlineForm.Floor) {
        toast.error(t('Select a table from the selected floor.'), {
          style: toastStyle,
        });
        return;
      }
      if (!Number.isInteger(Number(inlineForm.people_count)) || Number(inlineForm.people_count) < 1) {
        toast.error(t('Party size must be at least 1.'), { style: toastStyle });
        return;
      }
      if (Number(inlineForm.people_count) > getTableCapacity(selectedTable)) {
        toast.error(t('Selected table has {{capacity}} seats. Choose a table with more seats or reduce party size.', {
          capacity: getTableCapacity(selectedTable),
        }), {
          style: toastStyle,
        });
        return;
      }

      const payload: CreateReservationPayload = {
        Reservations_online: false,
        Customer_id: 25,
        slots: selectedGeneratedSlot.slot_type,
        slots_time: selectedGeneratedSlot.slots_time,
        duration_minutes:
          inlineGeneratedSlotsData?.slot_duration ??
          getSlotDurationMinutes(selectedSlotTimeRange[0], selectedSlotTimeRange[1]),
        title: guestName,
        customer_mobile: inlineForm.customer_mobile,
        Floor: selectedTable.Floor_id,
        Capacity_count: getTableCapacity(selectedTable),
        people_count: Number(inlineForm.people_count) || 1,
        PaymentStatus: inlineForm.PaymentStatus,
        Table_id: selectedTable.Table_id,
        Date_time: inlineForm.Date_time,
        Notes: inlineForm.Notes,
        Status: true,
      };
      handleCreateReservation(payload);
    }
  };

  const isInlineSubmitting = selectedForInline ? isUpdating : isCreating;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Confirmed':
        return <span className="text-xs px-2 py-1 rounded-md border border-green-200 bg-green-50 text-green-700 font-medium">{t('Confirmed')}</span>;
      case 'Tomorrow':
        return <span className="text-xs px-2 py-1 rounded-md border border-blue-200 bg-blue-50 text-blue-700 font-medium">{t('Tomorrow')}</span>;
      default:
        return <span className="text-xs px-2 py-1 rounded-md border border-orange-200 bg-orange-50 text-orange-700 font-medium">{t('Upcoming')}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-white p-8 font-sans text-gray-800 relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-black tracking-tight">{t('Reservations')}</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[linear-gradient(180deg,#6A1B9A_0%,#D32F2F_100%)] text-white px-5 py-2 rounded-md text-sm font-medium shadow-sm hover:opacity-90 transition-opacity"
        >
          + {t('New Reservation')}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Left Column */}
        <div className="flex-1 flex flex-col gap-8">
          
          {/* Reservation Queue */}
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
              {t('Reservation Queue')}
            </h2>
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm animate-pulse">
                    <div className="flex justify-between items-start mb-2">
                      <div className="h-5 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-6 bg-gray-200 rounded w-20"></div>
                    </div>
                    <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                  </div>
                ))
              ) : reservations.length === 0 ? (
                <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-400">
                  {t('No reservations yet. Create one to get started.')}
                </div>
              ) : (
                reservations.map((res, index) => {
                  const isSelected = selectedForInline?._id === res._id;
                  const mockStatus = index === 0 ? 'Upcoming' : index === 1 ? 'Upcoming' : index === 2 ? 'Tomorrow' : 'Confirmed';
                  
                  return (
                    <div
                      key={res._id}
                      className={`rounded-lg p-4 bg-white shadow-sm relative shrink-0 transition-colors ${
                        isSelected
                          ? 'border-2 border-purple-500'
                          : 'border border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-gray-900 text-sm">
                          {res.title || res.customer_name || t('Guest')} - {res.people_count} {t('guests')}
                        </h3>
                        {getStatusBadge(mockStatus)}
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(res.Date_time).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}{' '}
                        - {t('Table')} {res.Table_id} {res.Notes ? `- ${res.Notes}` : ''}
                      </p>

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setEditingReservation(res)}
                          className="text-xs px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          {t('Edit')}
                        </button>
                        <button
                          onClick={() => setDeletingReservation(res)}
                          className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                        >
                          {t('Delete')}
                        </button>
                        <button
                          onClick={() => (isSelected ? resetInline() : setSelectedForInline(res))}
                          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ml-auto ${
                            isSelected
                              ? 'border-gray-300 text-gray-600 bg-gray-100 hover:bg-gray-200'
                              : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                          }`}
                        >
                          {isSelected ? t('Deselect') : t('Quick Edit')}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Inline Form */}
          <section className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                {selectedForInline
                  ? `${t('Edit Reservation')} #${selectedForInline.Reservations_id}`
                  : t('New Reservation')}
              </h2>
              {selectedForInline && (
                <button
                  type="button"
                  onClick={resetInline}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  {t('Cancel edit')}
                </button>
              )}
            </div>

            <form onSubmit={handleInlineSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="inline-reservation-guest-name" className="block text-[11px] font-medium text-gray-600 mb-1">{t('Guest name')}</label>
                  <input
                    id="inline-reservation-guest-name"
                    type="text"
                    value={inlineForm.title}
                    onChange={(e) => setInlineForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder={t('Mohammed Al-Farsi')}
                    required={!selectedForInline}
                    minLength={2}
                    maxLength={GUEST_NAME_MAX_LENGTH}
                    disabled={!!selectedForInline}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label htmlFor="inline-reservation-phone" className="block text-[11px] font-medium text-gray-600 mb-1">{t('Phone')}</label>
                  <input
                    id="inline-reservation-phone"
                    type="tel"
                    value={inlineForm.customer_mobile}
                    onChange={(e) => setInlineForm((p) => ({
                      ...p,
                      customer_mobile: normalizePhone(e.target.value),
                    }))}
                    placeholder={t('10-digit phone number')}
                    inputMode="numeric"
                    autoComplete="tel-national"
                    required={!selectedForInline}
                    maxLength={PHONE_DIGIT_COUNT}
                    pattern="\d{10}"
                    disabled={!!selectedForInline}
                    aria-describedby="inline-reservation-phone-help"
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  />
                  <p id="inline-reservation-phone-help" className="sr-only">{t('Enter a 10-digit contact number.')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="inline-reservation-occasion" className="block text-[11px] font-medium text-gray-600 mb-1">{t('Occasion')}</label>
                  <input
                    id="inline-reservation-occasion"
                    type="text"
                    placeholder={t('Birthday, Business, VIP...')}
                    maxLength={100}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label htmlFor="inline-reservation-duration" className="block text-[11px] font-medium text-gray-600 mb-1">{t('Estimated Duration')}</label>
                  <input
                    id="inline-reservation-duration"
                    type="text"
                    placeholder={t('__hr __min')}
                    maxLength={20}
                    aria-describedby="inline-reservation-duration-help"
                    className="w-full border border-gray-300 rounded-md p-2 text-sm text-gray-400 focus:outline-none focus:border-purple-500"
                  />
                  <p id="inline-reservation-duration-help" className="sr-only">{t('Enter duration in hours and minutes.')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="inline-reservation-date-time" className="block text-[11px] font-medium text-gray-600 mb-1">{t('Reservation date')}</label>
                  <input
                    id="inline-reservation-date-time"
                    type="date"
                    value={getDateInputValue(inlineForm.Date_time)}
                    min={getReservationDateBounds().min}
                    max={getReservationDateBounds().max}
                    required={!selectedForInline}
                    onChange={(e) => setInlineForm((p) => ({
                      ...p,
                      Date_time: e.target.value,
                      slots: '',
                      slots_time: '',
                    }))}
                    disabled={!!selectedForInline}
                    aria-describedby="inline-reservation-date-time-help"
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  />
                  <p id="inline-reservation-date-time-help" className="sr-only">{t('Select a reservation date within the next 10 days.')}</p>
                </div>
                <div>
                  <label htmlFor="inline-reservation-party-size" className="block text-[11px] font-medium text-gray-600 mb-1">{t('Party Size')}</label>
                  <input
                    id="inline-reservation-party-size"
                    type="number"
                    min={1}
                    max={selectedInlineTable ? getTableCapacity(selectedInlineTable) : undefined}
                    required={!selectedForInline}
                    step={1}
                    value={inlineForm.people_count}
                    aria-invalid={inlineExceedsTableCapacity}
                    aria-describedby={inlineExceedsTableCapacity ? 'inline-reservation-party-size-error' : undefined}
                    onChange={(e) => setInlineForm((p) => ({ ...p, people_count: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500"
                  />
                  {inlineExceedsTableCapacity && (
                    <p id="inline-reservation-party-size-error" role="alert" className="mt-1 text-xs text-red-600">
                      {t('Selected table has {{capacity}} seats. Choose a table with more seats or reduce party size.', {
                        capacity: getTableCapacity(selectedInlineTable),
                      })}
                    </p>
                  )}
                </div>
              </div>

              {!selectedForInline && (
                <div>
                  <label htmlFor="inline-reservation-slot" className="block text-[11px] font-medium text-gray-600 mb-1">
                    {t('Generated reservation slot')}
                  </label>
                  <select
                    id="inline-reservation-slot"
                    value={String(inlineAvailableSlotsForDate.findIndex(
                      (slot) => slot.slots_time === inlineForm.slots_time &&
                        slot.slot_type === inlineForm.slots,
                    ))}
                    onChange={(e) => {
                      const slot = inlineAvailableSlotsForDate[Number(e.target.value)];
                      if (!slot) return;
                      setInlineForm((previous) => ({
                        ...previous,
                        slots: slot.slot_type,
                        slots_time: slot.slots_time,
                      }));
                    }}
                    required={!selectedForInline}
                    disabled={
                      !inlineForm.Table_id ||
                      !inlineForm.Date_time ||
                      isLoadingInlineGeneratedSlots ||
                      isInlineGeneratedSlotsError ||
                      inlineAvailableSlotsForDate.length === 0
                    }
                    aria-describedby="inline-reservation-slot-help"
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 bg-white disabled:bg-gray-50"
                  >
                    <option value="-1">
                      {isLoadingInlineGeneratedSlots
                        ? t('Loading available slots...')
                        : !inlineForm.Table_id
                          ? t('Select a table first')
                          : !inlineForm.Date_time
                            ? t('Select a reservation date first')
                            : t('Select an available slot')}
                    </option>
                    {inlineAvailableSlotsForDate.map((slot, index) => (
                      <option key={`${slot.slot_type}-${slot.slots_time}`} value={index}>
                        {slot.slots_time} ({t(slot.slot_type)})
                      </option>
                    ))}
                  </select>
                  <p id="inline-reservation-slot-help" className="mt-1 text-[10px] text-gray-500">
                    {isInlineGeneratedSlotsError
                      ? t('Could not load generated slots for this table.')
                      : !isLoadingInlineGeneratedSlots && inlineForm.Date_time && !inlineAvailableSlotsForDate.length
                        ? t('No available generated slots for this table and date.')
                        : inlineForm.slots_time}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="inline-reservation-floor" className="block text-[11px] font-medium text-gray-600 mb-1">{t('Floor')}</label>
                  <select
                    id="inline-reservation-floor"
                    value={inlineForm.Floor || ''}
                    required={!selectedForInline}
                    onChange={(e) => setInlineForm((previous) => ({
                      ...previous,
                      Floor: Number(e.target.value),
                      Table_id: 0,
                      Date_time: '',
                      slots: '',
                      slots_time: '',
                    }))}
                    disabled={!!selectedForInline || isLoadingInlineTables || reservationFloors.length === 0}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 bg-white disabled:bg-gray-50"
                  >
                    <option value="">{t('Select Floor')}</option>
                    {reservationFloors.map((floor: Floor) => (
                      <option key={floor.Floor_id} value={floor.Floor_id}>{floor.Floor_Name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="inline-reservation-table" className="block text-[11px] font-medium text-gray-600 mb-1">{t('Assign Table')}</label>
                  <select
                    id="inline-reservation-table"
                    value={inlineForm.Table_id}
                    required={!selectedForInline}
                    onChange={(e) => {
                      const selectedTable = inlineTables.find(
                        (table: Table) => table.Table_id === Number(e.target.value),
                      );
                      setInlineForm((previous) => ({
                        ...previous,
                        Table_id: Number(e.target.value),
                        Capacity_count: selectedTable
                          ? getTableCapacity(selectedTable)
                          : previous.Capacity_count,
                        Date_time: '',
                        slots: '',
                        slots_time: '',
                      }));
                    }}
                    disabled={isLoadingInlineTables || inlineTables.length === 0 || !inlineForm.Floor}
                    aria-invalid={isInlineTableLoadError || (!isLoadingInlineTables && inlineForm.Floor > 0 && inlineTables.length === 0)}
                    aria-describedby={
                      isInlineTableLoadError
                        ? 'inline-reservation-table-error'
                        : !isLoadingInlineTables && inlineForm.Floor > 0 && inlineTables.length === 0
                          ? 'inline-reservation-table-empty'
                          : undefined
                    }
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500 bg-white disabled:bg-gray-50"
                  >
                    <option value={0}>{isLoadingInlineTables ? t('Loading...') : t('Select a table')}</option>
                    {inlineTables.map((table: Table) => (
                      <option key={table.Table_id} value={table.Table_id}>
                        {getTableLabel(table)} · {t('Capacity')}: {getTableCapacity(table)}
                      </option>
                    ))}
                  </select>
                  {isInlineTableLoadError && <p id="inline-reservation-table-error" role="alert" className="mt-1 text-xs text-red-600">{t('Could not load tables for this floor.')}</p>}
                  {!isLoadingInlineTables && !isInlineTableLoadError && inlineForm.Floor > 0 && inlineTables.length === 0 && (
                    <p id="inline-reservation-table-empty" className="mt-1 text-xs text-gray-500">{t('No tables are configured for this floor.')}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="inline-reservation-notes" className="block text-[11px] font-medium text-gray-600 mb-1">{t('Notes')}</label>
                  <input
                    id="inline-reservation-notes"
                    type="text"
                    value={inlineForm.Notes}
                    onChange={(e) => setInlineForm((p) => ({ ...p, Notes: e.target.value }))}
                    maxLength={NOTES_MAX_LENGTH}
                    placeholder={t('Allergies: nuts')}
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  isInlineSubmitting ||
                  (!selectedForInline &&
                    (isLoadingInlineTables || isInlineTableLoadError || !inlineForm.Table_id))
                }
                className="mt-4 w-full bg-[linear-gradient(180deg,#6A1B9A_0%,#D32F2F_100%)] text-white py-3 rounded-md font-semibold text-sm shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isInlineSubmitting ? t('Confirming...') : t('Confirm Reservation')}
              </button>
            </form>
          </section>
        </div>

        {/* Right Column - Floor Map */}
        <div className="lg:w-[45%] xl:w-[50%]">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">
            {t('Floor Map - Reservation View')}
          </h2>

          <div className="grid grid-cols-4 gap-4">
            {/* T1 */}
            <div className="bg-[#EDE9FE] border-[1.5px] border-[#D8B4FE] rounded-2xl p-2 flex flex-col items-center justify-center w-full aspect-[137/85]">
              <span className="font-bold text-gray-800 text-sm">T1</span>
              <span className="text-[10px] text-[#9333EA] font-medium mt-1">{t('Occupied')}</span>
            </div>

            {/* T2 */}
            <div className="bg-[#ECFDF5] border-[1.5px] border-[#86EFAC] rounded-2xl p-2 flex flex-col items-center justify-center w-full aspect-[137/85]">
              <span className="font-bold text-gray-800 text-sm">T2</span>
              <span className="text-[10px] text-[#16A34A] font-medium mt-1">{t('Free')}</span>
            </div>

            {/* T3 */}
            <div className="bg-[#EDE9FE] border-[1.5px] border-[#D8B4FE] rounded-2xl p-2 flex flex-col items-center justify-center w-full aspect-[137/85]">
              <span className="font-bold text-gray-800 text-sm">T3</span>
              <span className="text-[10px] text-[#9333EA] font-medium mt-1">{t('Occupied')}</span>
            </div>

            {/* T4 */}
            <div className="bg-[#DDEDFF] border-[1.5px] border-[#93C5FD] rounded-2xl p-2 flex flex-col items-center justify-center w-full aspect-[137/85]">
              <span className="font-bold text-gray-800 text-sm">T4</span>
              <span className="text-[10px] text-[#2563EB] font-medium mt-1">{t('Reserved')}</span>
              <span className="text-[10px] text-[#2563EB]">7:30 PM</span>
            </div>

            {/* T5 */}
            <div className="bg-[#EDE9FE] border-[1.5px] border-[#D8B4FE] rounded-2xl p-2 flex flex-col items-center justify-center w-full aspect-[137/85]">
              <span className="font-bold text-gray-800 text-sm">T5</span>
              <span className="text-[10px] text-[#9333EA] font-medium mt-1">{t('Occupied')}</span>
            </div>

            {/* T6 */}
            <div className="bg-[#ECFDF5] border-[1.5px] border-[#86EFAC] rounded-2xl p-2 flex flex-col items-center justify-center w-full aspect-[137/85]">
              <span className="font-bold text-gray-800 text-sm">T6</span>
              <span className="text-[10px] text-[#16A34A] font-medium mt-1">{t('Free')}</span>
            </div>

            {/* T7 */}
            <div className="bg-[#ECFDF5] border-[1.5px] border-[#86EFAC] rounded-2xl p-2 flex flex-col items-center justify-center w-full aspect-[137/85]">
              <span className="font-bold text-gray-800 text-sm">T7</span>
              <span className="text-[10px] text-[#16A34A] font-medium mt-1">{t('Free')}</span>
            </div>

            {/* T8 */}
            <div className="bg-[#DDEDFF] border-[1.5px] border-[#93C5FD] rounded-2xl p-2 flex flex-col items-center justify-center w-full aspect-[137/85]">
              <span className="font-bold text-gray-800 text-sm">T8</span>
              <span className="text-[10px] text-[#2563EB] font-medium mt-1">{t('Reserved')}</span>
              <span className="text-[10px] text-[#2563EB]">8:30 PM</span>
            </div>

            {/* T9 */}
            <div className="bg-[#ECFDF5] border-[1.5px] border-[#86EFAC] rounded-2xl p-2 flex flex-col items-center justify-center w-full aspect-[137/85]">
              <span className="font-bold text-gray-800 text-sm">T9</span>
              <span className="text-[10px] text-[#16A34A] font-medium mt-1">{t('Free')}</span>
            </div>

            {/* T10 */}
            <div className="bg-[#EDE9FE] border-[1.5px] border-[#D8B4FE] rounded-2xl p-2 flex flex-col items-center justify-center w-full aspect-[137/85]">
              <span className="font-bold text-gray-800 text-sm">T10</span>
              <span className="text-[10px] text-[#9333EA] font-medium mt-1">{t('Occupied')}</span>
            </div>

            {/* T11 */}
            <div className="bg-[#DDEDFF] border-[1.5px] border-[#93C5FD] rounded-2xl p-2 flex flex-col items-center justify-center w-full aspect-[137/85]">
              <span className="font-bold text-gray-800 text-sm">T11</span>
              <span className="text-[10px] text-[#2563EB] font-medium mt-1">{t('Reserved')}</span>
              <span className="text-[10px] text-[#2563EB]">10:30 PM</span>
            </div>

            {/* T12 */}
            <div className="bg-[#EDE9FE] border-[1.5px] border-[#D8B4FE] rounded-2xl p-2 flex flex-col items-center justify-center w-full aspect-[137/85]">
              <span className="font-bold text-gray-800 text-sm">T12</span>
              <span className="text-[10px] text-[#9333EA] font-medium mt-1">{t('Occupied')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <NewReservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateReservation}
        isSubmitting={isCreating}
      />
      <EditReservationModal
        reservation={editingReservation}
        onClose={() => setEditingReservation(null)}
        onSubmit={handleUpdateReservation}
        isSubmitting={isUpdating}
      />
      <DeleteConfirmModal
        reservation={deletingReservation}
        onClose={() => setDeletingReservation(null)}
        onConfirm={handleDeleteReservation}
        isDeleting={isDeleting}
      />
    </div>
  );
}