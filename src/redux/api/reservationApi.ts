import { apiSlice } from './apiSlice';
import type {
  Reservation,
  CreateReservationPayload,
  UpdateReservationPayload,
  ReservationFloorMapResponse,
  CreateEmployeeReservationPayload,
  EmployeeReservationResponse,
  EmployeeReservationsPage,
  EmployeeReservationsQuery,
  ReservationFloorOption,
  ApiResponse,
  FloorMapTable,
  EmployeeReservationSlotsData,
  EmployeeReservationSlotsResponse,
} from '../../types/reservation';

export const reservationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // ---- Legacy restaurant-side ----
    getReservations: builder.query<Reservation[], void>({
      query: () => '/api/v1/restaurant/reservations/getbyauth',
      transformResponse: (response: { data: Reservation[] }) => response.data,
      providesTags: ['Reservations'],
    }),

    createReservation: builder.mutation<Reservation, CreateReservationPayload>({
      query: (payload) => ({
        url: '/api/v1/restaurant/reservations/create',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['Reservations'],
    }),

    updateReservation: builder.mutation<Reservation, UpdateReservationPayload>({
      query: (payload) => ({
        url: '/api/v1/restaurant/reservations/update',
        method: 'PUT',
        body: payload,
      }),
      invalidatesTags: ['Reservations'],
    }),

    deleteReservation: builder.mutation<void, number>({
      query: (id) => ({
        url: `/api/v1/restaurant/reservations/delete/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Reservations'],
    }),

    // ---- Employee-side ----
    getEmployeeReservations: builder.query<
      EmployeeReservationsPage,
      EmployeeReservationsQuery | void
    >({
      query: (args) => ({
        url: '/api/v1/employee/reservations',
        params: {
          page: args?.page ?? 1,
          limit: args?.limit ?? 30,
        },
      }),
      providesTags: ['Reservations'],
    }),

    getReservationFloors: builder.query<ReservationFloorOption[], void>({
      query: () => '/api/v1/employee/reservations/floors',
      // Backend returns { success, data: FloorOption[] }.
      transformResponse: (
        response: ApiResponse<ReservationFloorOption[]> | ReservationFloorOption[]
      ): ReservationFloorOption[] =>
        Array.isArray(response) ? response : response?.data ?? [],
    }),

    getEmployeeReservationSlots: builder.query<EmployeeReservationSlotsData, number>({
      query: (tableId) => ({
        url: '/api/v1/employee/reservations/slots',
        params: { table_id: tableId },
      }),
      transformResponse: (response: EmployeeReservationSlotsResponse) => response.data,
    }),

    getReservationFloorMap: builder.query<
      ReservationFloorMapResponse,
      {
        floorId: number;
        dateTime: string; // ISO w/ offset
        durationMinutes: number;
        partySize: number;
      }
    >({
      query: ({ floorId, dateTime, durationMinutes, partySize }) => ({
        url: '/api/v1/employee/reservations/floor-map',
        params: {
          floor_id: floorId,
          date_time: dateTime,
          duration_minutes: durationMinutes,
          party_size: partySize,
        },
      }),
      // Backend returns { success: true, data: FloorMapTable[] }.
      // Normalize to { tables } so the component reads a stable shape.
      transformResponse: (
        response:
          | ApiResponse<FloorMapTable[]>
          | FloorMapTable[]
          | ReservationFloorMapResponse
      ): ReservationFloorMapResponse => {
        if (Array.isArray(response)) return { tables: response };
        if (
          response &&
          typeof response === 'object' &&
          Array.isArray((response as ReservationFloorMapResponse).tables)
        ) {
          return response as ReservationFloorMapResponse;
        }
        const data = (response as ApiResponse<FloorMapTable[]>)?.data;
        return { tables: Array.isArray(data) ? data : [] };
      },
      providesTags: ['Reservations'],
    }),

    createEmployeeReservation: builder.mutation<
      EmployeeReservationResponse,
      CreateEmployeeReservationPayload
    >({
      query: (payload) => ({
        url: '/api/v1/employee/reservations',
        method: 'POST',
        body: payload,
      }),
      // Documented 201 returns { success, data: { booking_id } };
      // tolerate a bare body too.
      transformResponse: (
        response:
          | ApiResponse<EmployeeReservationResponse>
          | EmployeeReservationResponse
      ) => {
        if (
          response &&
          typeof response === 'object' &&
          'data' in response &&
          (response as ApiResponse<EmployeeReservationResponse>).data
        ) {
          return (response as ApiResponse<EmployeeReservationResponse>).data;
        }
        return response as EmployeeReservationResponse;
      },
      invalidatesTags: ['Reservations'],
    }),
  }),
});

export const {
  useGetReservationsQuery,
  useCreateReservationMutation,
  useUpdateReservationMutation,
  useDeleteReservationMutation,
  useGetEmployeeReservationsQuery,
  useGetReservationFloorsQuery,
  useGetEmployeeReservationSlotsQuery,
  useGetReservationFloorMapQuery,
  useCreateEmployeeReservationMutation,
} = reservationApi;