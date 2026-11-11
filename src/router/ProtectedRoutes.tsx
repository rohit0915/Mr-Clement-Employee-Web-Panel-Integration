import { Route, Routes, Navigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";

import Dashboard from "@/pages/Dashboard/Dashboard";
import Orders from "@/pages/Orders/Orders";
import Tables from "@/pages/Tables/Tables";
import Payments from "@/pages/Payments/Payments";
import Employees from "@/pages/Employees/Employees";
import Profile from "@/pages/Profile/Profile";
import OrderHistory from "@/pages/OrderHistory/OrderHistory";
import Settings from "@/pages/Setting/Settings";
import NotificationList from "@/pages/Notifications/Notifications";
import ContactSupport from "@/pages/Setting/ContactSupport";
import CreateSupportTicket from "@/pages/Setting/CreateSupportTicket";
import SupportTickets from "@/pages/Setting/SupportTickets";
import SupportTicketDetail from "@/pages/Setting/SupportTicketDetail";
import TeamChats from "@/pages/Chats/TeamChats";
import ClockInOut from "@/pages/Setting/ClockInOut";
import Sale from "@/pages/Sales/Sale";
import TrainingPage from "@/pages/Training/TrainingPage";
import AttendancePage from "@/pages/Attendance/AttendancePage";
import ReservationPage from "@/pages/Reservation/ReservationPage";
import WorkShift from "@/pages/shift/WorkShift";
import StripePaymentReturn from "@/pages/Payments/StripePaymentReturn";

export const ProtectedRoutes = () => (
  <Routes>
    <Route path="/payment/success" element={<StripePaymentReturn />} />
    <Route path="/payment/cancel" element={<StripePaymentReturn />} />
    <Route path="/" element={<AppLayout />}>
      {/* Default route → redirect to /orders */}
      <Route index element={<Navigate to="/orders" replace />} />

      {/* Orders is now the landing page */}
      <Route path="orders" element={<Orders />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="table" element={<Tables />} />
      <Route path="payments" element={<Payments />} />
      <Route path="employees" element={<Employees />} />
      <Route path="profile" element={<Profile />} />
      <Route path="order-history" element={<OrderHistory />} />
      <Route path="training" element={<TrainingPage />} />
      <Route path="settings" element={<Settings />} />
      <Route path="notifications" element={<NotificationList />} />
      <Route path="settings/contact-support" element={<ContactSupport />} />
      <Route path="settings/create-ticket" element={<CreateSupportTicket />} />
      <Route path="settings/tickets" element={<SupportTickets />} />
      <Route path="settings/clock-in-out" element={<ClockInOut />} />
      <Route path="settings/tickets/:id" element={<SupportTicketDetail />} />
      <Route path="team-chats" element={<TeamChats />} />
      <Route path="sales-performance" element={<Sale />} />
      <Route path="attendance" element={<AttendancePage />} />
      <Route path="reservations" element={<ReservationPage />} />
      <Route path="work-shifts" element={<WorkShift />} />
    </Route>

    {/* Any unmatched route → go to /orders */}
    <Route path="*" element={<Navigate to="/orders" replace />} />
  </Routes>
);