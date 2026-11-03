/* eslint-disable @typescript-eslint/no-explicit-any */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  ServerPosOrder,
  ApiResponse,
  PosOrderCreateBody,
  PosOrderUpdateBody,
  SendToKitchenBody,
  UpdateOrderStatusBody,
  Floor,
  FloorWithTablesResponse,
  PaymentOptionsResponse,
} from '@/types/order';

export const quickOrderApi = createApi({
  reducerPath: 'quickOrderApi',
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'https://pos-backend-7xuw.onrender.com',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as any).auth?.token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: [
    'Order',
    'OrderList',
    'PaymentOptions',
    'Customer',
    'BarTabs',
    'TableStatus',
    'FloorTables',
  ],
  endpoints: (builder) => ({
    // --- CATEGORIES & ITEMS ---
    getAllItemTypes: builder.query<ApiResponse<any[]>, { type?: string } | void>({
      query: (arg) => {
        const type = (arg as any)?.type;
        return type
          ? `/api/v1/admin/items_types/getbyauth?type=${encodeURIComponent(type)}`
          : '/api/v1/admin/items_types/getbyauth';
      },
    }),

    getAllItems: builder.query<
      ApiResponse<any[]>,
      { type?: string; category_id?: string | number; search?: string } | void
    >({
      query: (arg) => {
        const params = new URLSearchParams();
        const a = (arg as any) || {};
        if (a.type) params.set('type', a.type);
        params.set('category_id', a.category_id ?? 'all');
        if (a.search) params.set('search', a.search);
        return `/api/v1/admin/items/list?${params.toString()}`;
      },
    }),

    getAllItemVariants: builder.query<ApiResponse<any[]>, void>({
      query: () => '/api/v1/restaurant/item_variants/getbyauth',
    }),

    getAllItemAddons: builder.query<ApiResponse<any[]>, void>({
      query: () => '/api/v1/restaurant/item_addons/getbyauth',
    }),

    getAllKitchens: builder.query<ApiResponse<any[]>, void>({
      query: () => '/api/v1/restaurant/kitchen/getbyauth',
    }),

    getAllFloors: builder.query<ApiResponse<Floor[]>, void>({
      query: () => '/api/v1/admin/floor/getbyauth',
      providesTags: ['FloorTables'],
    }),

    getAllTables: builder.query<ApiResponse<any[]>, void>({
      query: () => '/api/v1/admin/table/getbyauth',
      providesTags: ['TableStatus'],
    }),

    // ✅ UPDATED: Points to the new Admin endpoint provided in your curl
    getFloorWithTables: builder.query<
      FloorWithTablesResponse,
      { floorId: string; status?: "All" | "Served" | "Waiting" | "Reserved" }
    >({
      query: ({ floorId }) => 
        `/api/v1/admin/floor/getWithTables/${floorId}`,
      providesTags: (_r, _e, { floorId }) => [
        { type: "FloorTables" as const, id: floorId },
      ],
    }),

    getTableCurrentOrder: builder.query<ApiResponse<ServerPosOrder>, number>({
      query: (tableId) => `/api/v1/restaurant/pos_order/table/${tableId}/current-order`,
      providesTags: (_r, _e, tableId) => [{ type: 'Order', id: `table-${tableId}` }],
    }),

    getAllCustomers: builder.query<ApiResponse<any[]>, void>({
      query: () => '/api/v1/restaurant/customer/getbyauth',
      providesTags: ['Customer'],
    }),

    searchCustomer: builder.query<ApiResponse<any[]>, string>({
      query: (q) => `/api/v1/restaurant/customer/search?query=${encodeURIComponent(q)}`,
    }),

    createCustomer: builder.mutation<ApiResponse<any>, any>({
      query: (body) => ({
        url: '/api/v1/restaurant/customer/create',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Customer'],
    }),

    // --- PAYMENT OPTIONS ---
    getMyPaymentOptions: builder.query<PaymentOptionsResponse, void>({
      query: () => '/api/v1/restaurant/payment_options/auth/my-options',
      providesTags: ['PaymentOptions'],
    }),

    // --- POS ORDERS ---
    createOrder: builder.mutation<ApiResponse<ServerPosOrder>, PosOrderCreateBody>({
      query: (body) => ({
        url: '/api/v1/restaurant/pos_order/create',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['OrderList', 'TableStatus'],
    }),

    updateOrder: builder.mutation<ApiResponse<ServerPosOrder>, PosOrderUpdateBody>({
      query: ({ id, ...body }) => ({
        url: '/api/v1/restaurant/pos_order/update',
        method: 'PUT',
        body: { id, ...body },
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'Order', id: arg.id }, 'OrderList', 'TableStatus'],
    }),

    deleteOrderItem: builder.mutation<
      ApiResponse<any>,
      { orderId: number | string; itemId: number | string }
    >({
      query: ({ orderId, itemId }) => ({
        url: `/api/v1/restaurant/pos_order/delete-item/${orderId}/${itemId}`,
        method: 'PATCH',
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'Order', id: arg.orderId }, 'OrderList'],
    }),

    sendToKitchen: builder.mutation<ApiResponse<ServerPosOrder>, SendToKitchenBody>({
      query: (body) => ({
        url: '/api/v1/restaurant/pos_order/send-to-kitchen',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'Order', id: arg.id }, 'OrderList', 'TableStatus'],
    }),

    updateOrderItemStatus: builder.mutation<ApiResponse<ServerPosOrder>, any>({
      query: (body) => ({
        url: '/api/v1/restaurant/pos_order/update-item-status',
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'Order', id: arg.id }],
    }),

    updateOrderStatus: builder.mutation<ApiResponse<ServerPosOrder>, UpdateOrderStatusBody>({
      query: (body) => ({
        url: '/api/v1/restaurant/pos_order/update-status',
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'Order', id: arg.id }, 'OrderList', 'TableStatus'],
    }),

    createPayment: builder.mutation<any, { Payment_Options_id: number; Order_id: string | number; payment_method: string; paymentStatus: string }>({
      query: (body) => ({
        url: '/api/v1/restaurant/payment_by_restaurant/create-payment',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['OrderList', 'TableStatus'],
    }),

    getOrderById: builder.query<ApiResponse<ServerPosOrder>, number | string>({
      query: (id) => `/api/v1/restaurant/pos_order/getbyid/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Order', id }],
    }),

    getOrderPdfUrl: builder.query<any, number | string>({
      query: (id) => ({
        url: `/api/v1/restaurant/pos_order/getbyid/${id}/pdf`,
        responseHandler: (response) => response.blob(), 
      }),
    }),

    getAllOrders: builder.query<ApiResponse<ServerPosOrder[]>, { filter?: string } | void>({
      query: (arg) => {
        const filter = (arg as any)?.filter;
        return filter
          ? `/api/v1/restaurant/pos_order/getall?filter=${filter}`
          : '/api/v1/restaurant/pos_order/getall';
      },
      providesTags: ['OrderList'],
    }),

    // --- BAR TABS ---
    getAllBarTabs: builder.query<
      { success: boolean; count: number; data: any[] },
      { status?: string } | void
    >({
      query: (arg) => {
        const status = (arg as any)?.status || 'Open';
        return `/api/v1/restaurant/bar-tabs/getall?status=${encodeURIComponent(status)}`;
      },
      providesTags: ['BarTabs'],
    }),

    getBarTabById: builder.query<{ success: boolean; data: any }, number | string>({
      query: (id) => `/api/v1/restaurant/bar-tabs/getbyid/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'BarTabs', id }],
    }),

    createBarTab: builder.mutation<{ success: boolean; data: any }, any>({
      query: (body) => ({
        url: '/api/v1/restaurant/bar-tabs/create',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['BarTabs'],
    }),

    addBarTabItem: builder.mutation<{ success: boolean; data: any }, any>({
      query: ({ tabId, ...body }) => ({
        url: `/api/v1/restaurant/bar-tabs/add-item/${tabId}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'BarTabs', id: arg.tabId }, 'BarTabs'],
    }),

    closeBarTabWithPayment: builder.mutation<{ success: boolean; data: any }, any>({
      query: ({ tabId, ...body }) => ({
        url: `/api/v1/restaurant/bar-tabs/close/${tabId}/payment`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'BarTabs', id: arg.tabId }, 'BarTabs'],
    }),

    cancelOrder: builder.mutation<
      ApiResponse<ServerPosOrder>,
      { id: number | string; reason: string }
    >({
      query: (body) => ({
        url: '/api/v1/restaurant/pos_order/cancel',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: 'Order', id: arg.id },
        'OrderList',
        'TableStatus',
      ],
    }),
  }),
});

// ==========================================
// --- EXPORT HOOKS ---
// ==========================================
export const {
  useGetAllItemTypesQuery,
  useGetAllItemsQuery,
  useGetAllItemVariantsQuery,
  useGetAllItemAddonsQuery,
  useGetAllKitchensQuery,
  useGetAllFloorsQuery,
  useGetAllTablesQuery,
  useGetFloorWithTablesQuery,
  useGetTableCurrentOrderQuery,
  useGetAllCustomersQuery,
  useSearchCustomerQuery,
  useCreateCustomerMutation,
  useGetMyPaymentOptionsQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useDeleteOrderItemMutation,
  useSendToKitchenMutation,
  useUpdateOrderItemStatusMutation,
  useUpdateOrderStatusMutation,
  useCreatePaymentMutation,
  useGetOrderByIdQuery,
  useLazyGetOrderByIdQuery,
  useGetOrderPdfUrlQuery,
  useLazyGetOrderPdfUrlQuery, 
  useGetAllOrdersQuery,
  useGetAllBarTabsQuery,
  useGetBarTabByIdQuery,
  useCreateBarTabMutation,
  useAddBarTabItemMutation,
  useCloseBarTabWithPaymentMutation,
  useCancelOrderMutation,
} = quickOrderApi;