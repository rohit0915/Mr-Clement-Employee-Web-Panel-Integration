/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import getCookie from '@/utils/getCookie';
import { removeCookie } from '@/utils/removeCookie';
import userIcon from '@/assets/employeeImage.png';
import {
  fetchEmployeeWorkSummary,
  type WorkSummaryData,
  getCurrentEmployeeProfile,
  updateCurrentEmployeeProfile,
  changePassword,
  getCurrentEmployeePerformance,
  getCurrentEmployeeSchedule,
  getCurrentEmployeeOrders,
  getCurrentEmployeeNotifications,
  markNotificationAsRead,
  clockInEmployee,
  clockOutEmployee,
} from '@/api/employeeApi';
import type { Order, OrderItem } from '@/types/order';
import * as orderApi from '@/api/orderApi';
import * as menuApi from '@/api/menuApi';
import {
  createSupportTicket,
  type CreateSupportTicketPayload,
  type SupportTicketResponse,
  getSupportTicketId,
  fetchSupportTickets,
  type SupportTicket,
} from '@/api/supportApi';

// ==========================================
// --- 1. USER & AUTH TYPES ---
// ==========================================
interface WorkDetails {
  onboardingDate: string;
  yearsWithUs: number;
  shiftTimings: string;
  totalLeaves: number;
  leavesLeft: number;
}

interface TodayProgress {
  remainingTime: string;
  workedTime: string;
}

interface WeeklySummary {
  [day: string]: { orders: number };
}

interface MonthlyData {
  totalPresent: number;
  leaves: number;
  leavesLeft: number;
  lateIn: number;
  earlyOut: number;
  workingHours: string;
}

interface WorkSummary {
  today: TodayProgress;
  weekly: WeeklySummary;
  customersHandled: { morning: number; noon: number; evening: number };
  totalOrdersServed: number;
  monthly: MonthlyData;
}

export interface UserProfile {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  profilePic: string;
  recoveryMail: string;
  status: string;
  role: string;
  department: string;
  responsibilities: string;
  joinDate: string;
  workDetails: WorkDetails;
  workSummary: WorkSummary;
}

interface Activity {
  date: string;
  text: string;
  ago: string;
}

interface UserStoreState {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  checkAuth: () => void;
  
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  workSummary: WorkSummaryData | null;
  
  fetchUserProfile: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  changeUserPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  fetchWorkSummary: () => Promise<void>;
  fetchUserPerformance: (period?: 'daily' | 'weekly' | 'monthly') => Promise<Record<string, unknown>>;
  fetchUserSchedule: (weekStart: string) => Promise<Record<string, unknown>>;
  fetchUserOrders: (params?: { status?: string; dateRange?: string; limit?: number }) => Promise<unknown>;
  fetchUserNotifications: () => Promise<unknown>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  
  isClockedIn: boolean;
  lastClockIn: string | null;
  lastClockOut: string | null;
  activities: Activity[];
  clockIn: () => Promise<void>;
  clockOut: () => Promise<void>;
  fetchActivities: () => Promise<void>;
}

interface OrderStoreState {
  orders: Order[];
  loading: boolean;
  error: string | null;
  fetchOrders: (params?: { status?: string; dateRange?: string }) => Promise<void>;
  createOrder: (order: Order) => Promise<void>;
  updateOrder: (orderId: string, updates: Partial<Order>) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
}

interface MenuStoreState {
  menuItems: OrderItem[];
  loading: boolean;
  error: string | null;
  fetchMenuItems: () => Promise<void>;
}

interface SupportTicketStoreState {
  email: string;
  businessName: string;
  subject: string;
  message: string;
  images: File[];
  ticketNumber: string | null;
  createdAt: string | null;
  loading: boolean;
  error: string | null;
  setField: (field: keyof SupportTicketStoreState, value: unknown) => void;
  setImages: (images: File[]) => void;
  fetchTicketId: () => Promise<void>;
  createTicket: () => Promise<void>;
  reset: () => void;
}

interface SupportTicketListStoreState {
  tickets: SupportTicket[];
  loading: boolean;
  error: string | null;
  filter: 'all' | 'ongoing' | 'resolved';
  period: 'week' | 'day' | 'month';
  search: string;
  fetchTickets: () => Promise<void>;
  setFilter: (filter: 'all' | 'ongoing' | 'resolved') => void;
  setPeriod: (period: 'week' | 'day' | 'month') => void;
  setSearch: (search: string) => void;
}

interface WalkthroughUIState {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}

// ==========================================
// --- 2. ORDER FLOW TYPES ---
// ==========================================
export interface CurrentOrder {
  orderId?: string;
  mongoId?: string;
  tableId: string | null;
  floor: string;
  persons: number;
  items: OrderItem[];
  serverSubTotal?: number;
  serverTax?: number;
  serverTotal?: number;
  orderStatus?: string;
  paymentStatus?: string;
}

// Add this right above your OrderFlowStoreState interface
export interface WaitlistDraft {
  persons: number;
  floorName: string;
  floorId: number | null;
}

export interface OrderFlowStoreState {
  currentOrder: CurrentOrder | null;
  pendingItem: OrderItem | null;
  pendingCustomizedItem: OrderItem | null;
  floor: string;
  persons: number;
  isInOrderFlow: boolean;
  selectedFloorId: number | null;
  waitlistDraft: WaitlistDraft | null; // <-- ADDED

  startOrder: (data: { tableId: string; floor: string; persons: number; floorId?: number }) => void;
  resetOrder: () => void;
  setCurrentOrderId: (orderId: string, mongoId?: string) => void;
  setServerTotals: (data: { subTotal: number; tax: number; total: number; orderStatus?: string; paymentStatus?: string }) => void;
  addItemToOrder: (item: OrderItem) => void;
  updateOrderItem: (itemId: string, updates: Partial<OrderItem>) => void;
  removeOrderItem: (itemId: string) => void;
  setPendingItem: (item: OrderItem | null) => void;
  clearPendingItem: () => void;
  setPendingCustomizedItem: (item: OrderItem | null) => void;
  clearPendingCustomizedItem: () => void;
  setFloor: (floor: string, floorId?: number) => void;
  setPersons: (persons: number) => void;
  setInOrderFlow: (isInOrderFlow: boolean) => void;
  hydrateFromServer: (serverData: any, floorName?: string) => void;
  
  // <-- ADDED THESE TWO ACTIONS
  setWaitlistDraft: (draft: WaitlistDraft | null) => void;
  clearWaitlistDraft: () => void;
}

const getOrderLineId = (item: OrderItem): string =>
  JSON.stringify([
    item.itemId,
    item.size ?? "",
    item.variantId ?? "",
    (item.addOns ?? []).map((addon) => [addon.id, addon.name, addon.price]),
  ]);

// ==========================================
// --- 3. USER STORE ---
// ==========================================
export const useUserStore = create<UserStoreState>((set, get) => ({
  isAuthenticated: false,
  login: () => set({ isAuthenticated: true }),
  logout: () => {
    removeCookie('authToken');
    set({ isAuthenticated: false, user: null, workSummary: null });
  },
  checkAuth: () => {
    const token = getCookie('authToken');
    set({ isAuthenticated: !!token });
  },
  
  user: null,
  loading: false,
  error: null,
  workSummary: null,
  
  fetchUserProfile: async () => {
    set({ loading: true, error: null });
    try {
      const profile = await getCurrentEmployeeProfile();
      const userProfile: UserProfile = {
        id: profile.id,
        employeeId: profile.employeeId,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        profilePic: profile.avatar || userIcon,
        recoveryMail: profile.email,
        status: 'Active',
        role: profile.role,
        department: profile.department,
        responsibilities: "Order's and Reservations",
        joinDate: profile.joinDate,
        workDetails: {
          onboardingDate: profile.joinDate,
          yearsWithUs: Math.floor((Date.now() - new Date(profile.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365)),
          shiftTimings: '9:00 AM - 6:00 PM',
          totalLeaves: 24,
          leavesLeft: 12,
        },
        workSummary: {
          today: { remainingTime: '2h 30m', workedTime: '5h 30m' },
          weekly: {
            Monday: { orders: 12 }, Tuesday: { orders: 15 }, Wednesday: { orders: 10 }, Thursday: { orders: 18 }, Friday: { orders: 20 }, Saturday: { orders: 22 }, Sunday: { orders: 8 },
          },
          customersHandled: { morning: 15, noon: 20, evening: 25 },
          totalOrdersServed: 60,
          monthly: { totalPresent: 22, leaves: 2, leavesLeft: 10, lateIn: 1, earlyOut: 0, workingHours: '160h' },
        },
      };
      set({ user: userProfile, loading: false });
    } catch (error: unknown) {
      set({ error: (error instanceof Error ? error.message : 'Failed to fetch user profile'), loading: false });
    }
  },
  
  updateUserProfile: async (updates) => {
    set({ loading: true, error: null });
    try {
      const result = await updateCurrentEmployeeProfile(updates);
      if (result.success && get().user) {
        set({ user: { ...get().user!, ...updates }, loading: false });
      }
    } catch (error: unknown) {
      set({ error: (error instanceof Error ? error.message : 'Failed to update profile'), loading: false });
    }
  },
  
  changeUserPassword: async () => {
    set({ loading: true, error: null });
    try {
      const result = await changePassword();
      set({ loading: false });
      return result;
    } catch (error: unknown) {
      set({ error: (error instanceof Error ? error.message : 'Failed to change password'), loading: false });
      throw error;
    }
  },
  
  fetchWorkSummary: async () => {
    try {
      const data = await fetchEmployeeWorkSummary('current');
      set({ workSummary: data });
    } catch (error: unknown) {
      set({ error: (error instanceof Error ? error.message : 'Failed to fetch work summary') });
    }
  },
  
  fetchUserPerformance: async () => {
    try { return await getCurrentEmployeePerformance(); } 
    catch (error: unknown) { set({ error: (error instanceof Error ? error.message : 'Failed to fetch performance') }); throw error; }
  },
  
  fetchUserSchedule: async (weekStart) => {
    try { return await getCurrentEmployeeSchedule(weekStart); } 
    catch (error: unknown) { set({ error: (error instanceof Error ? error.message : 'Failed to fetch schedule') }); throw error; }
  },
  
  fetchUserOrders: async () => {
    try { return await getCurrentEmployeeOrders(); } 
    catch (error: unknown) { set({ error: (error instanceof Error ? error.message : 'Failed to fetch user orders') }); throw error; }
  },
  
  fetchUserNotifications: async () => {
    try { return await getCurrentEmployeeNotifications(); } 
    catch (error: unknown) { set({ error: (error instanceof Error ? error.message : 'Failed to fetch notifications') }); throw error; }
  },
  
  markNotificationAsRead: async () => {
    try { await markNotificationAsRead(); } 
    catch (error: unknown) { set({ error: (error instanceof Error ? error.message : 'Failed to mark notification as read') }); throw error; }
  },
  
  isClockedIn: false,
  lastClockIn: null,
  lastClockOut: null,
  activities: [],
  clockIn: async () => {
    const { success, time } = await clockInEmployee();
    if (success) {
      set((state) => ({
        isClockedIn: true,
        lastClockIn: time,
        activities: [{ date: new Date(time).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }), text: 'Clocked in', ago: 'Just now' }, ...state.activities],
      }));
    }
  },
  clockOut: async () => {
    const { success, time } = await clockOutEmployee();
    if (success) {
      set((state) => ({
        isClockedIn: false,
        lastClockOut: time,
        activities: [{ date: new Date(time).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }), text: 'Clocked out', ago: 'Just now' }, ...state.activities],
      }));
    }
  },
  fetchActivities: async () => {
    set({
      activities: [
        { date: '14 Apr', text: 'Brian Griffin wants to collaborate', ago: '5 days ago' },
        { date: '14 Apr', text: 'Brian Griffin wants to collaborate', ago: '5 days ago' },
        { date: '14 Apr', text: 'Brian Griffin wants to collaborate', ago: '5 days ago' },
        { date: '14 Apr', text: 'Brian Griffin wants to collaborate', ago: '5 days ago' },
      ],
    });
  },
}));

export const useAuthStore = useUserStore;
export const useStore = useUserStore;

// ==========================================
// --- 4. LEGACY ORDER STORE ---
// ==========================================
export const useOrderStore = create<OrderStoreState>((set) => ({
  orders: [],
  loading: false,
  error: null,
  fetchOrders: async (params) => {
    set({ loading: true, error: null });
    try {
      const orders = await orderApi.fetchOrders(params);
      set({ orders, loading: false });
    } catch (error: unknown) {
      set({ error: (error instanceof Error ? error.message : 'Failed to fetch orders'), loading: false });
    }
  },
  createOrder: async (order) => {
    set({ loading: true, error: null });
    try {
      await orderApi.createOrder(order);
      set((state) => ({ orders: [...state.orders, order], loading: false }));
    } catch (error: unknown) {
      set({ error: (error instanceof Error ? error.message : 'Failed to create order'), loading: false });
    }
  },
  updateOrder: async (orderId, updates) => {
    set({ loading: true, error: null });
    try {
      await orderApi.updateOrder(orderId, updates);
      set((state) => ({
        orders: state.orders.map((order) => order.orderId === orderId ? { ...order, ...updates } : order),
        loading: false,
      }));
    } catch (error: unknown) {
      set({ error: (error instanceof Error ? error.message : 'Failed to update order'), loading: false });
    }
  },
  deleteOrder: async (orderId) => {
    set({ loading: true, error: null });
    try {
      await orderApi.deleteOrder(orderId);
      set((state) => ({
        orders: state.orders.filter((order) => order.orderId !== orderId),
        loading: false,
      }));
    } catch (error: unknown) {
      set({ error: (error instanceof Error ? error.message : 'Failed to delete order'), loading: false });
    }
  },
}));

// ==========================================
// --- 5. MENU STORE ---
// ==========================================
export const useMenuStore = create<MenuStoreState>((set) => ({
  menuItems: [],
  loading: false,
  error: null,
  fetchMenuItems: async () => {
    set({ loading: true, error: null });
    try {
      const menuItems = await menuApi.getMenuItems();
      set({ menuItems, loading: false });
    } catch (error: unknown) {
      set({ error: (error instanceof Error ? error.message : 'Failed to fetch menu items'), loading: false });
    }
  },
}));

// ==========================================
// --- 6. ORDER FLOW STORE (Main POS Flow) ---
// ==========================================
export const useOrderFlowStore = create<OrderFlowStoreState>()(
  persist(
    (set) => ({
      currentOrder: null,
      pendingItem: null,
      pendingCustomizedItem: null,
      floor: "F-01",
      persons: 1,
      isInOrderFlow: false,
      selectedFloorId: null,
      waitlistDraft: null, // <-- ADDED

      startOrder: ({ tableId, floor, persons, floorId }) => set((state) => {
        let items = state.currentOrder?.items || [];
        if (state.pendingCustomizedItem) {
          items = [...items, { ...state.pendingCustomizedItem, quantity: 1 }];
        }
        return {
          currentOrder: {
            orderId: state.currentOrder?.orderId,
            tableId,
            floor,
            persons,
            items,
          },
          selectedFloorId: floorId ?? state.selectedFloorId,
          pendingItem: null,
          pendingCustomizedItem: null,
          floor,
          persons,
          isInOrderFlow: true,
        };
      }),

      resetOrder: () => set({
        currentOrder: null,
        pendingItem: null,
        pendingCustomizedItem: null,
        floor: "F-01",
        persons: 1,
        isInOrderFlow: false,
      }),

      setCurrentOrderId: (orderId, mongoId) => set((state) => {
        if (!state.currentOrder) return {};
        return { currentOrder: { ...state.currentOrder, orderId, mongoId } };
      }),

      setServerTotals: (data) => set((state) => {
        if (!state.currentOrder) return {};
        return {
          currentOrder: {
            ...state.currentOrder,
            serverSubTotal: data.subTotal,
            serverTax: data.tax,
            serverTotal: data.total,
            orderStatus: data.orderStatus,
            paymentStatus: data.paymentStatus,
          },
        };
      }),

      addItemToOrder: (item) => set((state) => {
        const orderItem = { ...item, lineId: item.lineId ?? getOrderLineId(item) };
        if (!state.currentOrder) {
          return {
            currentOrder: {
              tableId: null,
              floor: "F-01",
              persons: 1,
              items: [{ ...orderItem, quantity: item.quantity || 1 }],
            },
          };
        }
        const existingIdx = state.currentOrder.items.findIndex(
          (i) => (i.lineId ?? getOrderLineId(i)) === orderItem.lineId
        );
        if (existingIdx >= 0) {
          const newItems = [...state.currentOrder.items];
          newItems[existingIdx].quantity += item.quantity || 1;
          return { currentOrder: { ...state.currentOrder, items: newItems } };
        }
        return {
          currentOrder: {
            ...state.currentOrder,
            items: [...state.currentOrder.items, { ...orderItem, quantity: item.quantity || 1 }],
          },
        };
      }),

      updateOrderItem: (itemId, updates) => set((state) => {
        if (!state.currentOrder) return {};
        return {
          currentOrder: {
            ...state.currentOrder,
            items: state.currentOrder.items.map((item) =>
              (item.lineId ?? item.itemId) === itemId ? { ...item, ...updates } : item
            ),
          },
        };
      }),

      removeOrderItem: (itemId) => set((state) => {
        if (!state.currentOrder) return {};
        return {
          currentOrder: {
            ...state.currentOrder,
            items: state.currentOrder.items.filter(
              (item) => (item.lineId ?? item.itemId) !== itemId
            ),
          },
        };
      }),

      setPendingItem: (item) => set({ pendingItem: item }),
      clearPendingItem: () => set({ pendingItem: null }),
      setPendingCustomizedItem: (item) => set({ pendingCustomizedItem: item }),
      clearPendingCustomizedItem: () => set({ pendingCustomizedItem: null }),

      setFloor: (floor, floorId) => set((state) => ({
        floor,
        selectedFloorId: floorId ?? state.selectedFloorId,
      })),

      setPersons: (persons) => set({ persons }),
      setInOrderFlow: (isInOrderFlow) => set({ isInOrderFlow }),
      
      // <-- ADDED ACTIONS
      setWaitlistDraft: (draft) => set({ waitlistDraft: draft }),
      clearWaitlistDraft: () => set({ waitlistDraft: null }),

      hydrateFromServer: (serverData, floorName = "F-01") => set(() => {
        const mappedItems = (serverData.items || []).map((si: any) => {
          const item: OrderItem = {
            itemId: String(si.item_id),
            name: si.Item?.item_name || si.item_name || `Item ${si.item_id}`,
            price: Number(si.Item?.prices || si.prices || 0) + Number(si.Addon?.prices || 0),
            quantity: Number(si.item_Quentry) || 1,
            size: si.item_size || si.Variant?.Variants || null,
            ...(si.item_Variants_id != null
              ? { variantId: Number(si.item_Variants_id) }
              : si.Variant?.item_Variants_id != null
                ? { variantId: Number(si.Variant.item_Variants_id) }
                : {}),
            notes: si.item_note || "",
            addOns: si.Addon ? [{ id: String(si.Addon.item_Addons_id), name: si.Addon.Addons, price: si.Addon.prices }] : [],
            serverItemId: si._id,
            serverItemStatus: si.item_status,
            preparationStation: "Kitchen",
          };
          return { ...item, lineId: getOrderLineId(item) };
        });

        return {
          currentOrder: {
            orderId: String(serverData.POS_Order_id),
            mongoId: serverData._id,
            tableId: serverData.Table_id != null ? String(serverData.Table_id) : null,
            floor: floorName,
            persons: 1,
            items: mappedItems,
            serverSubTotal: Number(serverData.SubTotal) || 0,
            serverTax: Number(serverData.Tax) || 0,
            serverTotal: Number(serverData.Total) || 0,
            orderStatus: serverData.Order_Status,
            paymentStatus: serverData.payment_status,
          },
          floor: floorName,
          persons: 1,
          isInOrderFlow: true,
        };
      }),
    }),
    {
      name: 'order-flow-store',
      partialize: (state) => ({
        currentOrder: state.currentOrder,
        floor: state.floor,
        persons: state.persons,
        selectedFloorId: state.selectedFloorId,
        waitlistDraft: state.waitlistDraft, // <-- ADDED
      }),
    }
  )
);

// ==========================================
// --- 7. SUPPORT TICKET STORES ---
// ==========================================
export const useSupportTicketStore = create<SupportTicketStoreState>((set, get) => ({
  email: '',
  businessName: '',
  subject: '',
  message: '',
  images: [],
  ticketNumber: null,
  createdAt: null,
  loading: false,
  error: null,
  setField: (field, value) => set({ [field]: value }),
  setImages: (images) => set({ images }),
  fetchTicketId: async () => {
    set({ loading: true });
    try {
      const ticketId = await getSupportTicketId();
      set({ ticketNumber: ticketId, loading: false });
    } catch (error) {
      console.error(error);
      set({ error: 'Failed to fetch ticket ID', loading: false });
    }
  },
  createTicket: async () => {
    set({ loading: true, error: null });
    try {
      const { email, businessName, subject, message, images } = get();
      const payload: CreateSupportTicketPayload = { email, businessName, subject, message, images };
      const res: SupportTicketResponse = await createSupportTicket(payload);
      set({ ticketNumber: res.ticketNumber, createdAt: res.createdAt, loading: false });
    } catch (error: unknown) {
      if (typeof error === 'object' && error && 'message' in error) {
        set({ error: (error as { message: string }).message || 'Failed to create ticket', loading: false });
      } else {
        set({ error: 'Failed to create ticket', loading: false });
      }
    }
  },
  reset: () => set({
    email: '', businessName: '', subject: '', message: '', images: [], ticketNumber: null, createdAt: null, loading: false, error: null
  }),
}));

export const useSupportTicketListStore = create<SupportTicketListStoreState>((set, get) => ({
  tickets: [],
  loading: false,
  error: null,
  filter: 'all',
  period: 'week',
  search: '',
  fetchTickets: async () => {
    set({ loading: true, error: null });
    try {
      const { filter, period } = get();
      const tickets = await fetchSupportTickets(filter, period);
      set({ tickets, loading: false });
    } catch (error: unknown) {
      console.error(error);
      set({ error: 'Failed to fetch tickets', loading: false });
    }
  },
  setFilter: (filter) => set({ filter }),
  setPeriod: (period) => set({ period }),
  setSearch: (search) => set({ search }),
}));
export interface WaitlistDraft {
  persons: number;
  floorName: string;
  floorId: number | null;
}
// ==========================================
// --- 8. WALKTHROUGH UI STORE ---
// ==========================================
export const useWalkthroughUIStore = create<WalkthroughUIState>((set) => ({
  selectedCategory: 'all',
  setSelectedCategory: (category) => set({ selectedCategory: category }),
}));