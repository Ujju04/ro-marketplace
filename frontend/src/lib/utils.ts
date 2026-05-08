import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function getStatusColor(status: string) {
  const map: Record<string, string> = {
    pending: "badge-orange",
    accepted: "badge-blue",
    in_progress: "badge-blue",
    completed: "badge-green",
    cancelled: "badge-red",
  };
  return map[status] || "badge-gray";
}

export function getSessionId() {
  let id = sessionStorage.getItem("chat_session_id");
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("chat_session_id", id);
  }
  return id;
}
