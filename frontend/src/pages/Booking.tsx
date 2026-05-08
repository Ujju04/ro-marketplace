import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../context/AuthContext";
import { Button, Input, Textarea, Card } from "../components/ui";
import { Wrench, MapPin, Navigation, Loader2, CheckCircle } from "lucide-react";
import api from "../lib/api";

const SERVICE_TYPES = [
  { value: "repair", label: "🔧 Repair", desc: "Fix existing RO issue" },
  { value: "installation", label: "💧 Installation", desc: "New RO system setup" },
  { value: "amc", label: "📋 AMC Service", desc: "Annual maintenance" },
  { value: "inspection", label: "🔍 Inspection", desc: "General checkup" },
];

const SYMPTOMS = [
  "No water output", "Water tastes bad", "Water smells bad",
  "Slow water flow", "Water leaking", "Making noise",
  "Yellow water", "High TDS", "Tank not filling", "UV not working"
];

export default function Booking() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [form, setForm] = useState({
    serviceType: "repair",
    bookingType: "instant",
    address: "",
    city: "",
    pincode: "",
    landmark: "",
    description: "",
    scheduledAt: "",
    lat: "",
    lng: "",
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
  };

  const toggleSymptom = (s: string) =>
    setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // ── Live GPS Location ─────────────────────────────────────────────────────
  const fetchLiveLocation = () => {
    if (!navigator.geolocation) { setError("Geolocation is not supported by your browser"); return; }
    setGpsLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          // Reverse geocode using OpenStreetMap Nominatim (free, no API key needed)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const addr = data.address || {};

          // Build readable address from components
          const parts = [
            addr.house_number,
            addr.road || addr.pedestrian || addr.footway,
            addr.suburb || addr.neighbourhood || addr.quarter,
          ].filter(Boolean).join(", ");

          const city =
            addr.city || addr.town || addr.village || addr.county || addr.state_district || "";

          const pincode = addr.postcode || "";

          setForm(f => ({
            ...f,
            address: parts || data.display_name?.split(",").slice(0, 3).join(",") || "",
            city,
            pincode,
            lat: latitude.toString(),
            lng: longitude.toString(),
          }));
        } catch {
          // Fallback: just store coordinates
          setForm(f => ({
            ...f,
            address: `Near ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            lat: latitude.toString(),
            lng: longitude.toString(),
          }));
        } finally { setGpsLoading(false); }
      },
      (err) => {
        setGpsLoading(false);
        const msgs: Record<number, string> = {
          1: "Location access denied. Please allow location in browser settings.",
          2: "Could not detect location. Please enter manually.",
          3: "Location request timed out. Please try again.",
        };
        setError(msgs[err.code] || "Could not get location");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) { setLocation("/auth"); return; }
    if (!form.city) { setError("City is required. Use 'Use my location' or enter manually."); return; }
    if (!form.address) { setError("Address is required."); return; }

    const fullAddress = [form.address, form.landmark, form.pincode].filter(Boolean).join(", ");

    setError(""); setLoading(true);
    try {
      const res = await api.post("/bookings", {
        serviceType: form.serviceType,
        bookingType: form.bookingType,
        address: fullAddress,
        city: form.city,
        description: form.description,
        symptoms: selectedSymptoms.join(", "),
        lat: form.lat || null,
        lng: form.lng || null,
        scheduledAt: form.bookingType === "scheduled" ? form.scheduledAt : null,
      });
      setSuccess(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || "Booking failed. Please try again.");
    } finally { setLoading(false); }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Booking Confirmed!</h2>
        <p className="text-slate-500 mb-6">Booking #{success.id} · A technician will accept your request shortly.</p>
        <div className="card p-5 text-left mb-6 space-y-2">
          {[
            ["Service", success.serviceType],
            ["Type", success.bookingType],
            ["Location", success.address + ", " + success.city],
            ["Service Charge", "₹" + success.serviceCharge],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
              <span className="text-slate-500">{k}</span>
              <span className="font-medium capitalize">{v}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => setSuccess(null)} variant="outline">Book Another</Button>
          <Button onClick={() => setLocation("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
          <Wrench className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Book a Service</h1>
          <p className="text-slate-500 text-sm">Get a certified technician at your door</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Service Type */}
        <Card>
          <h3 className="font-semibold text-slate-900 mb-4">Select Service</h3>
          <div className="grid grid-cols-2 gap-3">
            {SERVICE_TYPES.map(s => (
              <button type="button" key={s.value}
                onClick={() => setForm(f => ({ ...f, serviceType: s.value }))}
                className={`text-left p-4 rounded-xl border-2 transition-all ${form.serviceType === s.value ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"}`}>
                <p className="font-semibold text-sm">{s.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* When */}
        <Card>
          <h3 className="font-semibold text-slate-900 mb-4">When do you need it?</h3>
          <div className="grid grid-cols-2 gap-3">
            {[{ value: "instant", label: "⚡ Instant", desc: "Within 60 minutes" }, { value: "scheduled", label: "📅 Scheduled", desc: "Pick date & time" }].map(t => (
              <button type="button" key={t.value}
                onClick={() => setForm(f => ({ ...f, bookingType: t.value }))}
                className={`text-left p-4 rounded-xl border-2 transition-all ${form.bookingType === t.value ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"}`}>
                <p className="font-semibold text-sm">{t.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t.desc}</p>
              </button>
            ))}
          </div>
          {form.bookingType === "scheduled" && (
            <div className="mt-4">
              <Input label="Pick Date & Time" type="datetime-local" value={form.scheduledAt} onChange={set("scheduledAt")} required />
            </div>
          )}
        </Card>

        {/* Symptoms */}
        {form.serviceType === "repair" && (
          <Card>
            <h3 className="font-semibold text-slate-900 mb-4">What's wrong? <span className="text-slate-400 font-normal text-sm">(optional)</span></h3>
            <div className="flex flex-wrap gap-2">
              {SYMPTOMS.map(s => (
                <button type="button" key={s} onClick={() => toggleSymptom(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedSymptoms.includes(s) ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-200 hover:border-primary/50"}`}>
                  {s}
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Location */}
        <Card>
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" /> Your Location
          </h3>

          {/* GPS Button */}
          <button
            type="button"
            onClick={fetchLiveLocation}
            disabled={gpsLoading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-primary/40 text-primary font-semibold text-sm hover:bg-primary/5 transition-all mb-4 disabled:opacity-60"
          >
            {gpsLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Detecting your location...</>
            ) : (
              <><Navigation className="w-4 h-4" /> Use My Current Location</>
            )}
          </button>

          {form.lat && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 mb-4">
              <CheckCircle className="w-3.5 h-3.5" /> Location detected — you can edit the fields below if needed
            </div>
          )}

          <div className="space-y-3">
            <Input label="City *" placeholder="Delhi, Meerut, Mumbai..." value={form.city} onChange={set("city")} required />
            <Textarea
              label="Street Address *"
              placeholder="House no., Street, Area / Colony..."
              value={form.address}
              onChange={set("address") as any}
              rows={2}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Landmark (optional)" placeholder="Near XYZ school" value={form.landmark} onChange={set("landmark")} />
              <Input label="Pincode (optional)" placeholder="110001" value={form.pincode} onChange={set("pincode")} />
            </div>
          </div>
        </Card>

        {/* Notes */}
        <Card>
          <Textarea
            label="Additional Notes (optional)"
            placeholder="Any specific details for the technician..."
            value={form.description}
            onChange={set("description") as any}
            rows={2}
          />
        </Card>

        {/* Price note */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
          🔧 <strong>Service charge: ₹199</strong> — Parts cost shown after on-site diagnosis. You approve before any replacement.
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{error}</div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {isAuthenticated ? "Confirm Booking" : "Sign In to Book"}
        </Button>
      </form>
    </div>
  );
}
