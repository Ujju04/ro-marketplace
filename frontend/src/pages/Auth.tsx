import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../context/AuthContext";
import { Button, Input, Card } from "../components/ui";
import { Droplets, Eye, EyeOff, Phone } from "lucide-react";
import api from "../lib/api";

type Tab = "login" | "register" | "tech_login" | "tech_register";

export default function Auth() {
  const [tab, setTab] = useState<Tab>("login");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", city: "", experience: "" });
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    setError("");
  };

  const isRegister = tab === "register" || tab === "tech_register";
  const isTech = tab === "tech_login" || tab === "tech_register";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "login") {
        const res = await api.post("/auth/login", { email: form.email, password: form.password });
        login(res.data.token, "user", res.data.user);
        setLocation("/");
      } else if (tab === "register") {
        const res = await api.post("/auth/register", {
          name: form.name, email: form.email, phone: form.phone,
          password: form.password, city: form.city,
        });
        login(res.data.token, "user", res.data.user);
        setLocation("/");
      } else if (tab === "tech_login") {
        const res = await api.post("/auth/technician/login", { email: form.email, password: form.password });
        login(res.data.token, "technician", res.data.technician);
        setLocation("/technician");
      } else {
        const res = await api.post("/auth/technician/register", {
          name: form.name, email: form.email, phone: form.phone,
          password: form.password, city: form.city,
          experience: parseInt(form.experience) || 0,
        });
        login(res.data.token, "technician", res.data.technician);
        setLocation("/technician");
      }
    } catch (e: any) {
      setError(e.response?.data?.error || "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  const resetTab = (newTab: Tab) => { setTab(newTab); setError(""); };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Droplets className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome to AquaCare</h1>
          <p className="text-slate-500 text-sm mt-1">India's trusted RO service platform</p>
        </div>

        <Card>
          {/* Customer / Technician tabs */}
          <div className="grid grid-cols-2 gap-1 bg-slate-100 rounded-xl p-1 mb-6">
            <button
              onClick={() => resetTab("login")}
              className={`py-2 rounded-lg text-sm font-semibold transition-all ${!isTech ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              Customer
            </button>
            <button
              onClick={() => resetTab("tech_login")}
              className={`py-2 rounded-lg text-sm font-semibold transition-all ${isTech ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
            >
              Technician
            </button>
          </div>

          {/* Sign In / Register sub-tabs */}
          <div className="flex gap-4 mb-6 border-b border-slate-200">
            <button
              onClick={() => resetTab(isTech ? "tech_login" : "login")}
              className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${!isRegister ? "border-primary text-primary" : "border-transparent text-slate-500"}`}
            >
              Sign In
            </button>
            <button
              onClick={() => resetTab(isTech ? "tech_register" : "register")}
              className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${isRegister ? "border-primary text-primary" : "border-transparent text-slate-500"}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <Input
                label="Full Name"
                placeholder="Ujjwal Sharma"
                value={form.name}
                onChange={set("name")}
                required
              />
            )}

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={set("email")}
              required
            />

            {isRegister && (
              <Input
                label="Phone Number"
                type="tel"
                placeholder="9876543210"
                value={form.phone}
                onChange={set("phone")}
                required
                icon={<Phone className="w-4 h-4" />}
              />
            )}

            {isRegister && (
              <Input
                label="City"
                placeholder="Delhi, Meerut, Mumbai..."
                value={form.city}
                onChange={set("city")}
                required={isTech}
              />
            )}

            {tab === "tech_register" && (
              <Input
                label="Years of Experience"
                type="number"
                placeholder="3"
                value={form.experience}
                onChange={set("experience")}
              />
            )}

            <div className="relative">
              <Input
                label="Password"
                type={showPass ? "text" : "password"}
                placeholder="Min 6 characters"
                value={form.password}
                onChange={set("password")}
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-8 text-slate-400 hover:text-slate-600"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              {isRegister ? "Create Account" : "Sign In"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}