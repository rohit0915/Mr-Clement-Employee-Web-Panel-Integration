import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setCredentials } from '../slice/authSlice';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

interface LoginCredentials {
  email: string;
  password: string;
}

interface User {
  _id: string;
  Name: string;
  Employee_id: string;
  email: string;
  phone: string;
  gender: string;
  user_image: string;
  OnboardingDate: string;
  yearsWithus: number;
  isLoginPermission: boolean;
  Status: boolean;
  user_id: number;
}

interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

interface LoginEmployeeArgs {
  employee_login_code: string;
  password: string;
}

interface LoginEmployeeResponse {
  success: boolean;
  message: string;
  data: {
    requires_otp: boolean;
    challenge_id: string;
    employee_login_code: string;
    email: string;
    expires_at: string;
    expires_in_seconds: number;
  };
}

interface VerifyOtpArgs {
  challenge_id: string;
  otp: string;
}

interface VerifyOtpResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

interface ResendOtpArgs {
  employee_login_code: string;
  password: string;
}

interface ResendOtpResponse {
  success: boolean;
  message: string;
  data: LoginEmployeeResponse['data'];
}

interface ForgotPasswordArgs {
  email: string;
}

interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  data?: any;
}

interface LogoutResponse {
  success: boolean;
  message: string;
}

/* ---- Attendance / Dashboard Types ---- */

export interface EmployeePerformanceResponse {
  success: boolean;
  message: string;
  data: {
    employeeDetails: {
      Name: string;
      image: string | null;
      role: string;
      clockin: string | null;
      WorkedToday: number;
      MinsBreak: number;
      LeavesLeft: number;
    };
    AvgWorkingHrs: { day: string; serving: number; helping: number }[];
    totalTipsEarned: {
      totalTips: number;
      currency: string;
      avgTipMin: number;
      avgTipMax: number;
      period: string;
      percentage: number;
    };
    feedbacks: any[];
    overallFeedback: {
      lovedIt: number;
      good: number;
      average: number;
      bad: number;
      worst: number;
    };
    staffBehavior: string;
    waitingTime: string;
  };
}

export interface DashboardResponse {
  success: boolean;
  message: string;
  data: {
    TotalOrders: number;
    TotalSales: number;
    NewCustomers: number;
    RepeatCustomers: number;
    TopSellers: any[];
    StockAlerts: any[];
  };
}

export interface EmployeeSearchRecord {
  _id?: string;
  id?: string;
  user_id?: number;
  Name?: string;
  name?: string;
  full_name?: string;
  Employee_id?: string | number;
  employeeId?: string | number;
  employee_id_code?: string;
  email?: string;
  phone?: string;
  user_image?: string | null;
  profile_image?: string | null;
  image?: string | null;
  role?: string;
  Status?: boolean | string;
  status?: boolean | string;
  Responsibility_id?: { Responsibility_name?: string };
  Role_id?: { role_name?: string };
}

export interface EmployeeSearchResponse {
  success?: boolean;
  message?: string;
  count?: number;
  total?: number;
  data?:
    | EmployeeSearchRecord[]
    | {
        employees?: EmployeeSearchRecord[];
        results?: EmployeeSearchRecord[];
        users?: EmployeeSearchRecord[];
        items?: EmployeeSearchRecord[];
        count?: number;
        total?: number;
      };
}

/* ---- NEW: Shift Management Types ---- */

export interface ShiftData {
  current_shift: any | null;
  upcoming_shifts: any[];
  team_schedule: any[];
  incoming_swap_requests: any[];
  outgoing_swap_requests: any[];
  coworkers: any[];
}

export interface ShiftDashboardResponse {
  success: boolean;
  data: ShiftData;
}

export interface SwapRequestArgs {
  requester_shift_id: number;
  target_employee_id: number;
  target_shift_id?: number | null;
  reason: string;
}

export interface RespondSwapArgs {
  swapId: string;
  status: 'accepted' | 'rejected';
}

/* ------------------------------------------------------------------ */
/* Slice                                                              */
/* ------------------------------------------------------------------ */

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3006',
    prepareHeaders: (headers, { getState }) => {
      const state = getState() as { auth: { token: string | null } };
      const token = state.auth?.token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      headers.set('Content-Type', 'application/json');
      return headers;
    },
  }),
  // Added 'ShiftDashboard' to the tag types
  tagTypes: ['User', 'Employee', 'Dashboard', 'ShiftDashboard', 'Profile', 'WorkSummary', 'Notifications', 'SupportTickets', 'SupportReplies', 'Reservations', 'ShiftDashboard',
  'AttendanceDashboard',
  'AttendanceHistory',
  'LeaveRequests', 'CoworkerShifts','Waitlist'],
  endpoints: (builder) => ({
    /* -------- Generic login -------- */
    login: builder.mutation<LoginResponse, LoginCredentials>({
      query: (credentials) => ({
        url: '/api/v1/user/login',
        method: 'POST',
        body: credentials,
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            setCredentials({
              token: data.data.token,
              user: {
                ...data.data.user,
                id: data.data.user._id,
                name: data.data.user.Name,
              },
            }),
          );
        } catch (error) {
          console.error('Login failed:', error);
        }
      },
    }),

    /* -------- Employee login: step 1 -------- */
    loginEmployee: builder.mutation<LoginEmployeeResponse, LoginEmployeeArgs>({
      query: (body) => ({
        url: '/api/v1/user/login-employee',
        method: 'POST',
        body,
      }),
    }),

    /* -------- Employee login: step 2 -------- */
    verifyEmployeeOtp: builder.mutation<VerifyOtpResponse, VerifyOtpArgs>({
      query: (body) => ({
        url: '/api/v1/user/verify-employee-otp',
        method: 'POST',
        body,
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            setCredentials({
              token: data.data.token,
              user: {
                ...data.data.user,
                id: data.data.user._id,
                name: data.data.user.Name,
              },
            }),
          );
        } catch (error) {
          console.error('OTP verification failed:', error);
        }
      },
    }),

    /* -------- Employee login: resend OTP -------- */
    resendEmployeeOtp: builder.mutation<ResendOtpResponse, ResendOtpArgs>({
      query: (body) => ({
        url: '/api/v1/user/resend-employee-otp',
        method: 'POST',
        body,
      }),
    }),

    /* -------- Forgot password: send OTP -------- */
    forgetPasswordSendOtp: builder.mutation<
      ForgotPasswordResponse,
      ForgotPasswordArgs
    >({
      query: (body) => ({
        url: '/api/v1/user/forget-password/send-otp',
        method: 'POST',
        body,
      }),
    }),

    /* -------- Forgot password: resend OTP -------- */
    forgetPasswordResendOtp: builder.mutation<
      ForgotPasswordResponse,
      ForgotPasswordArgs
    >({
      query: (body) => ({
        url: '/api/v1/user/forget-password/resend-otp',
        method: 'POST',
        body,
      }),
    }),

    /* -------- Fetch profile -------- */
    fetchUserProfile: builder.query<User, void>({
      query: () => '/api/v1/user/profile',
    }),

    /* -------- Logout -------- */
    logoutUser: builder.mutation<LogoutResponse, void>({
      query: () => ({
        url: '/api/v1/user/logout',
        method: 'POST',
      }),
    }),

    /* ------------------------------------------------------------------ */
    /* Attendance & Dashboard Endpoints                                   */
    /* ------------------------------------------------------------------ */

    getEmployeePerformance: builder.query<EmployeePerformanceResponse, string | number>({
      query: (employeeId) => `/api/v1/restaurant/reports/employee-performance/${employeeId}`,
      providesTags: (result, error, id) => [{ type: 'Employee', id }],
    }),

    searchEmployees: builder.query<EmployeeSearchResponse | EmployeeSearchRecord[], { q: string; limit: number }>({
      query: ({ q, limit }) => ({
        url: '/api/v1/employee/search',
        params: { q, limit },
      }),
    }),

    getDashboardStats: builder.query<DashboardResponse, void>({
      query: () => '/api/v1/restaurant/reports/dashboard',
      providesTags: ['Dashboard'],
    }),

    getRestaurantDashboard: builder.query<any, { filter: string }>({
      query: ({ filter }) => `/api/v1/restaurant/reports/restaurant-dashboard?filter=${filter}`,
      providesTags: ['Dashboard'],
    }),

    /* ------------------------------------------------------------------ */
    /* NEW: Shift Management Endpoints                                    */
    /* ------------------------------------------------------------------ */

    getShiftDashboard: builder.query<ShiftDashboardResponse, void>({
      query: () => '/api/v1/employee/shifts/dashboard',
      providesTags: ['ShiftDashboard'],
    }),

    requestShiftSwap: builder.mutation<any, SwapRequestArgs>({
      query: (body) => ({
        url: '/api/v1/employee/shifts/swap',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['ShiftDashboard'],
    }),

    respondToShiftSwap: builder.mutation<any, RespondSwapArgs>({
      query: ({ swapId, status }) => ({
        url: `/api/v1/employee/shifts/swap/${swapId}/respond`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['ShiftDashboard'],
    }),
  }),
});

export const {
  useLoginMutation,
  useLoginEmployeeMutation,
  useVerifyEmployeeOtpMutation,
  useResendEmployeeOtpMutation,
  useForgetPasswordSendOtpMutation,
  useForgetPasswordResendOtpMutation,
  useFetchUserProfileQuery,
  useLogoutUserMutation,
  useGetEmployeePerformanceQuery,
  useSearchEmployeesQuery,
  useGetDashboardStatsQuery,
  useGetRestaurantDashboardQuery,
  // Shift Hooks
  useGetShiftDashboardQuery,
  useRequestShiftSwapMutation,
  useRespondToShiftSwapMutation,
} = apiSlice;