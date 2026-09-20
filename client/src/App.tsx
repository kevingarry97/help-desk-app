import { Navigate, Route, Routes } from "react-router";

import AdminRoute from "@/components/AdminRoute";
import AppLayout from "@/components/AppLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoginPage from "@/pages/LoginPage";
import HomePage from "@/pages/HomePage";
import TicketDetailSheet from "@/components/tickets/TicketDetailSheet";
import TicketsPage from "@/pages/TicketsPage";
import UsersPage from "@/pages/UsersPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/tickets" element={<TicketsPage />}>
            <Route path=":id" element={<TicketDetailSheet />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
