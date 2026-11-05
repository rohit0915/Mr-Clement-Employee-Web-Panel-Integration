// ---------------------------------------------------------------------------
// Legacy restaurant-side reservation model
// (used by /api/v1/restaurant/reservations/*)
// ---------------------------------------------------------------------------

export interface Reservation {
  _id: string;
  Reservations_online: boolean;
  Customer_id: number;
  slots: string;
  slots_time: string;
  title: string;
  Floor: number;
  Capacity_count: number;
  people_count: number;
  PaymentStatus: string;
  Table_id: number;
  Addone_Table_id?: number;
  Date_time: string;
  Notes: string;
  Status: boolean;
  Reservations_id: number;
  customer_name?: string;
  customer_mobile?: string;
  CreateAt: string;
  UpdatedAt: string;
}

export interface CreateReservationPayload {
  Reservations_online: boolean;
  Customer_id: number;
  slots: string;
  slots_time: string;
  duration_minutes?: number;
  occasion?: string;
  title: string;
  customer_mobile: string;
  Floor: number;
  Capacity_count: number;
  people_count: number;
  PaymentStatus: string;
  Table_id: number;
  Date_time: string;
  Notes: string;
  Status: boolean;
}

export interface UpdateReservationPayload {
  id: number;
  people_count?: number;
  Table_id?: number;
  PaymentStatus?: string;
  Notes?: string;
}

// ---------------------------------------------------------------------------
// Employee-side reservation model
// (used by /api/v1/employee/reservations/*)
// ---------------------------------------------------------------------------

/**
 * Payload accepted by POST /api/v1/employee/reservations.
 * Success (201) wraps `{ booking_id }` inside `data`.
 */
export interface CreateEmployeeReservationPayload {
  guest_name: string;
  guest_phone: string;
  slots_time: string;
  /** ISO 8601 with offset, e.g. "2026-10-25T19:30:00+05:30" */
  date_time: string;
  slots?: string;
  party_size: number;
  floor_id: number;
  table_id: number;
  duration_minutes?: number;
  occasion?: string;
  notes?: string;
}

/** Minimal response we rely on today; widen as the backend contract firms up. */
export interface EmployeeReservationResponse {
  booking_id: number | string;
  [key: string]: unknown;
}

/** Row returned by GET /api/v1/employee/reservations (paginated). */
export interface EmployeeReservation {
  booking_id: number | string;
  guest_name: string;
  guest_phone: string;
  date_time: string;
  party_size: number;
  floor_id: number;
  table_id: number;
  duration_minutes: number;
  notes?: string;
  status?: string;
  [key: string]: unknown;
}

export interface EmployeeReservationsQuery {
  page?: number;
  limit?: number;
}

export interface EmployeeReservationsPage {
  data: EmployeeReservation[];
  count?: number;
  page?: number;
  limit?: number;
}

/** Row returned by GET /api/v1/employee/reservations/floors. */
export interface ReservationFloorOption {
  Floor_id: number;
  Floor_Name: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Shared envelope
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  count?: number;
  data: T;
}

// ---------------------------------------------------------------------------
// Floor-map (availability) types — shape taken from real API sample
// ---------------------------------------------------------------------------

export interface FloorMapTableLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface FloorMapTable {
  _id: string;
  Table_id: number;
  Floor_id: number;

  /** Human labels from the backend. */
  "Table-name"?: string; // e.g. "Table 2"
  "Table-code"?: string; // e.g. "T-5-02"
  Title?: string;        // e.g. "T-02 - Ground Floor"

  Capacity?: number;
  "Seating-Persons_Count"?: number;

  /** Availability flags — gate selection on both. */
  available?: boolean;
  capacity_sufficient?: boolean;
  reservation_view_status?: string; // "Free" | ...
  table_status?: string;            // "Available" | ...
  dynamic_status?: string;

  /** Existing reservations occupying this table in the queried slot. */
  reservations?: Array<Record<string, unknown>>;
  reservation_version?: number;

  layout?: FloorMapTableLayout;
  image?: string | null;
  Details?: unknown;
  Emozi?: string;

  [key: string]: unknown;
}

export interface ReservationFloorMapResponse {
  tables: FloorMapTable[];
}

export interface EmployeeReservationGeneratedSlot {
  from: string;
  to: string;
  slot_type: string;
  slots_time: string;
  status: string;
  booked: boolean;
  full: boolean;
  available: boolean;
  booked_tables: number[];
  tables: Array<{
    table_id: number;
    title: string;
    capacity: number;
    booked: boolean;
    available: boolean;
  }>;
}

export interface EmployeeReservationSlotsDay {
  date: string;
  day: string;
  slots: EmployeeReservationGeneratedSlot[];
}

export interface EmployeeReservationSlotsData {
  working_days: string[];
  opening_time: string;
  closing_time: string;
  slot_duration: number;
  generated_slots: EmployeeReservationSlotsDay[];
}

export interface EmployeeReservationSlotsResponse {
  success: boolean;
  days: number;
  data: EmployeeReservationSlotsData;
}