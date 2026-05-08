import { Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Navbar } from "./components/Navbar";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import Booking from "./pages/Booking";
import MyBookings from "./pages/MyBookings";
import { Products, Pricing, AmcPlans } from "./pages/ProductsPricingAmc";
import TechnicianDashboard from "./pages/technician/Dashboard";
import RoHealth from "./pages/RoHealth";

const queryClient = new QueryClient();

function ProtectedTech({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, role, isLoading } = useAuth();
  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!isAuthenticated || role !== "technician") return <Redirect to="/auth" />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/auth" component={Auth} />
        <Route path="/chat" component={Chat} />
        <Route path="/booking" component={Booking} />
        <Route path="/my-bookings" component={MyBookings} />
        <Route path="/products" component={Products} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/amc" component={AmcPlans} />
        <Route path="/ro-health" component={RoHealth} />
        <Route path="/technician">
          <ProtectedTech><TechnicianDashboard /></ProtectedTech>
        </Route>
        <Route path="/technician/jobs">
          <ProtectedTech><TechnicianDashboard /></ProtectedTech>
        </Route>
        <Route>
          <div className="flex items-center justify-center min-h-[50vh] text-slate-500 text-center">
            <div><p className="text-6xl mb-4">404</p><p className="text-xl font-semibold mb-2">Page not found</p><a href="/" className="text-primary underline">Go home</a></div>
          </div>
        </Route>
      </Switch>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </QueryClientProvider>
  );
}
