import React from "react";
import { cn } from "../lib/utils";
import { Loader2 } from "lucide-react";

// ── Button ────────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, children, className, disabled, ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-primary hover:bg-primary-dark text-white shadow-sm",
    outline: "border-2 border-primary text-primary hover:bg-primary hover:text-white",
    ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
    danger: "bg-red-500 hover:bg-red-600 text-white",
  };
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-5 py-2.5 text-sm", lg: "px-7 py-3 text-base" };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, className, ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
        <input className={cn("input", icon && "pl-10", error && "border-red-400 focus:border-red-400 focus:ring-red-200", className)} {...props} />
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card p-6", className)} {...props}>{children}</div>;
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, variant = "gray" }: { children: React.ReactNode; variant?: "blue" | "green" | "orange" | "red" | "gray" }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin text-primary", className)} />;
}

// ── Select ────────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className, ...props }: SelectProps) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <select className={cn("input bg-white", error && "border-red-400", className)} {...props}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── Textarea ──────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <textarea className={cn("input resize-none", error && "border-red-400", className)} {...props} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">{icon}</div>
      <h3 className="font-semibold text-slate-800 text-lg mb-1">{title}</h3>
      {description && <p className="text-slate-500 text-sm mb-4 max-w-xs">{description}</p>}
      {action}
    </div>
  );
}
