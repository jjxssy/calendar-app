import { ProtectedRoute } from "@/components/auth/protected-route";
import { CalendarDashboardLoader } from "@/components/calendar-dashboard-loader";

export default function CalendarPage() {
  return (
    <ProtectedRoute>
      <CalendarDashboardLoader />
    </ProtectedRoute>
  );
}