import { Link, useLocation } from "wouter";
import { useAuth } from "../context/AuthContext";
import { Droplets, Menu, X, Bot, ShoppingBag, Home, BookOpen, LogOut, Wrench, ClipboardList, Activity } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import api from "../lib/api";

export function Navbar() {
  const { isAuthenticated, role, user, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [amcPlan, setAmcPlan] = useState<string | null>(null);

  // Load AMC plan tag for customer
  useEffect(() => {
    if (isAuthenticated && role === "user") {
      api.get("/amc-plans/my-subscription").then(res => {
        if (res.data?.planName) setAmcPlan(res.data.planName);
      }).catch(() => {});
    }
  }, [isAuthenticated, role]);

  const userLinks = [
    { href: "/", label: "Home", icon: <Home className="w-4 h-4" /> },
    { href: "/booking", label: "Book Service", icon: <Wrench className="w-4 h-4" /> },
    { href: "/my-bookings", label: "My Bookings", icon: <ClipboardList className="w-4 h-4" /> },
    { href: "/products", label: "Products", icon: <ShoppingBag className="w-4 h-4" /> },
    { href: "/pricing", label: "Pricing", icon: <BookOpen className="w-4 h-4" /> },
    { href: "/amc", label: "AMC Plans", icon: <BookOpen className="w-4 h-4" /> },
    { href: "/ro-health", label: "RO Health", icon: <Activity className="w-4 h-4" /> },
    { href: "/chat", label: "AI Chat", icon: <Bot className="w-4 h-4" /> },
  ];

  const techLinks = [
    { href: "/technician", label: "Dashboard", icon: <Home className="w-4 h-4" /> },
    { href: "/technician/jobs", label: "Jobs", icon: <Wrench className="w-4 h-4" /> },
  ];

  const links = role === "technician" ? techLinks : userLinks;

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href={role === "technician" ? "/technician" : "/"}>
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Droplets className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-slate-900">AquaCare</span>
              {role === "technician" && <span className="badge badge-orange ml-1">Technician</span>}
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-0.5">
            {links.map((l) => (
              <Link key={l.href} href={l.href}>
                <a className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors", location === l.href ? "bg-primary/10 text-primary" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100")}>
                  {l.icon}{l.label}
                </a>
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-sm font-semibold text-slate-800">{user?.name}</span>
                  {amcPlan && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">
                      ✓ AMC {amcPlan}
                    </span>
                  )}
                </div>
                <button onClick={logout} className="btn-ghost flex items-center gap-1.5 text-sm">
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline">Logout</span>
                </button>
              </div>
            ) : (
              <Link href="/auth">
                <a className="bg-primary text-white hover:bg-primary-dark font-semibold text-sm px-4 py-2 rounded-xl transition-all">Sign In</a>
              </Link>
            )}
            <button className="md:hidden p-2 rounded-lg hover:bg-slate-100" onClick={() => setOpen(!open)}>
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden pb-4 border-t border-slate-100 pt-2">
            {isAuthenticated && amcPlan && (
              <div className="mx-3 mb-2 px-3 py-1.5 bg-emerald-50 rounded-lg text-xs text-emerald-700 font-semibold">
                ✓ Active AMC Plan: {amcPlan}
              </div>
            )}
            {links.map((l) => (
              <Link key={l.href} href={l.href}>
                <a onClick={() => setOpen(false)} className={cn("flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium mb-0.5 transition-colors", location === l.href ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100")}>
                  {l.icon}{l.label}
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}