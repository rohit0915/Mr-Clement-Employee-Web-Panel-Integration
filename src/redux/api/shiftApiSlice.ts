import { apiSlice } from './apiSlice';

export const shiftApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getShiftDashboard: builder.query<any, void>({
      query: () => '/api/v1/employee/shifts/dashboard',
      providesTags: ['ShiftDashboard'],
    }),

    getCoworkerShifts: builder.query<any, number>({
      query: (employeeId) => `/api/v1/employee/shifts/schedule?employee_id=${employeeId}`,
    }),

    requestShiftSwap: builder.mutation<any, any>({
      query: (data) => ({
        url: '/api/v1/employee/shifts/swap',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['ShiftDashboard'],
    }),

    respondToShiftSwap: builder.mutation<any, { swapId: string; status: 'accepted' | 'rejected' }>({
  query: ({ swapId, status }) => ({
    url: `/api/v1/employee/shifts/swap/${swapId}/respond`,
    method: 'PATCH' as const, // ✅ typed as literal
    body: { status },
    headers: {
      'Content-Type': 'application/json',
    },
  }),
  invalidatesTags: ['ShiftDashboard'],
}),

    clockOut: builder.mutation<any, void>({
      query: () => ({
        url: '/api/v1/employee/attendance/clock-out',
        method: 'POST',
      }),
      invalidatesTags: ['ShiftDashboard', 'AttendanceDashboard', 'AttendanceHistory'],
    }),
  }),
});

export const {
  useGetShiftDashboardQuery,
  useGetCoworkerShiftsQuery,
  useRequestShiftSwapMutation,
  useRespondToShiftSwapMutation,
  useClockOutMutation,
} = shiftApiSlice;