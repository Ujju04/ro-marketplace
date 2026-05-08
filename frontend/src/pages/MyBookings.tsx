import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { Link } from "wouter";
import { Card, Button, Spinner } from "../components/ui";
import { MapPin, Navigation, Phone, FileText, XCircle, RefreshCw, ChevronDown, ChevronUp, CheckCircle, Clock, Wrench, Star } from "lucide-react";
import { formatDate } from "../lib/utils";
import api from "../lib/api";
import { useBookingSocket } from "../lib/useBookingSocket";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; bg: string }> = {
  pending:     { label: "Pending", color: "text-orange-600", bg: "bg-orange-50 border-orange-200", icon: <Clock className="w-4 h-4 text-orange-500" /> },
  accepted:    { label: "Technician Assigned", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", icon: <Navigation className="w-4 h-4 text-blue-500" /> },
  in_progress: { label: "On the Way / In Progress", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: <Wrench className="w-4 h-4 text-blue-600 animate-pulse" /> },
  completed:   { label: "Completed", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", icon: <CheckCircle className="w-4 h-4 text-emerald-500" /> },
  cancelled:   { label: "Cancelled", color: "text-slate-500", bg: "bg-slate-50 border-slate-200", icon: <XCircle className="w-4 h-4 text-slate-400" /> },
};

export default function MyBookings() {
  const { isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadBookings = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get("/bookings");
      setBookings(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadBookings();
    else setLoading(false);
  }, [isAuthenticated, loadBookings]);

  // Find the single active booking (accepted or in_progress) to subscribe to
  const activeBooking = bookings.find(b => ["accepted", "in_progress"].includes(b.status)) ?? null;

  // Real-time updates via WebSocket — replaces the 20-second setInterval poll
  useBookingSocket(activeBooking?.id ?? null, {
    onStatus: ({ status }) => {
      setBookings(prev => prev.map(b =>
        b.id === activeBooking?.id ? { ...b, status } : b
      ));
    },
    onLocation: ({ lat, lng }) => {
      setBookings(prev => prev.map(b =>
        b.id === activeBooking?.id ? { ...b, techLat: lat, techLng: lng } : b
      ));
    },
  });

  const cancelBooking = async (id: number) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    setCancelling(id);
    try {
      await api.post(`/bookings/${id}/cancel`);
      await loadBookings(true);
    } catch (e: any) { alert(e.response?.data?.error || "Could not cancel"); }
    finally { setCancelling(null); }
  };

  if (!isAuthenticated) return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <h2 className="text-xl font-bold text-slate-900 mb-3">Sign in to view your bookings</h2>
      <Link href="/auth"><Button>Sign In</Button></Link>
    </div>
  );

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-8 h-8" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Bookings</h1>
          <p className="text-slate-500 text-sm">Track and manage your service requests</p>
        </div>
        <button onClick={() => loadBookings(true)} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-16">
          <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-700 mb-2">No bookings yet</h3>
          <p className="text-slate-500 text-sm mb-6">Book your first RO service now</p>
          <Link href="/booking"><Button>Book a Service</Button></Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(booking => {
            const sc = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;
            const isActive = ["accepted", "in_progress"].includes(booking.status);
            const canCancel = ["pending", "accepted"].includes(booking.status);
            return (
              <Card key={booking.id} className={`overflow-hidden border-2 ${isActive ? "border-blue-300" : "border-slate-200"} p-0`}>
                {/* Status bar */}
                <div className={`px-4 py-2.5 ${sc.bg} border-b flex items-center gap-2`}>
                  {sc.icon}
                  <span className={`text-sm font-semibold ${sc.color}`}>{sc.label}</span>
                  {isActive && <span className="ml-auto text-xs text-blue-500 animate-pulse">● Live</span>}
                </div>

                {/* Main row */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900">Booking #{booking.id}</span>
                        <span className="badge badge-gray capitalize text-xs">{booking.serviceType}</span>
                        <span className="badge badge-blue capitalize text-xs">{booking.bookingType}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-slate-600 mb-1">
                        <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="truncate">{booking.address}, {booking.city}</span>
                      </div>
                      <p className="text-xs text-slate-400">{formatDate(booking.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {booking.finalAmount && <span className="text-primary font-bold text-sm">₹{booking.finalAmount}</span>}
                      <button onClick={() => setExpanded(expanded === booking.id ? null : booking.id)} className="p-1 hover:bg-slate-100 rounded-lg">
                        {expanded === booking.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Technician info */}
                  {booking.techName && (
                    <div className="mt-3 flex items-center gap-3 bg-blue-50 rounded-xl px-3 py-2.5">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
                        {booking.techName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{booking.techName}</p>
                        {booking.techRating && <p className="text-xs text-slate-500">⭐ {parseFloat(booking.techRating).toFixed(1)} rating</p>}
                      </div>
                      {booking.techPhone && (
                        <a href={`tel:${booking.techPhone}`} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                          <Phone className="w-3.5 h-3.5" /> Call
                        </a>
                      )}
                    </div>
                  )}

                  {/* Live location map (when active) */}
                  {isActive && booking.techLat && booking.techLng && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                        <Navigation className="w-3.5 h-3.5 animate-pulse" /> Live Technician Location
                      </p>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${booking.techLat},${booking.techLng}`}
                        target="_blank" rel="noopener noreferrer"
                        className="block rounded-xl overflow-hidden border border-blue-200 hover:border-primary transition-colors"
                      >
                        <img
                          src={`https://maps.googleapis.com/maps/api/staticmap?center=${booking.techLat},${booking.techLng}&zoom=14&size=600x200&markers=color:blue%7C${booking.techLat},${booking.techLng}&key=YOUR_GOOGLE_MAPS_KEY`}
                          alt="Technician location"
                          className="w-full h-36 object-cover bg-blue-100"
                          onError={(e) => {
                            // Fallback to OpenStreetMap iframe if no Google Maps key
                            const parent = (e.target as HTMLElement).parentElement!;
                            parent.innerHTML = `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(booking.techLng)-0.01},${parseFloat(booking.techLat)-0.01},${parseFloat(booking.techLng)+0.01},${parseFloat(booking.techLat)+0.01}&layer=mapnik&marker=${booking.techLat},${booking.techLng}" style="width:100%;height:144px;border:none;" />`;
                          }}
                        />
                        <div className="bg-blue-50 px-3 py-2 text-xs text-blue-700 font-medium flex items-center gap-1">
                          <Navigation className="w-3 h-3" /> Tap to open in Google Maps
                        </div>
                      </a>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-3">
                    {canCancel && (
                      <Button size="sm" variant="danger" onClick={() => cancelBooking(booking.id)} loading={cancelling === booking.id} className="text-xs">
                        <XCircle className="w-3.5 h-3.5" /> Cancel
                      </Button>
                    )}
                    {booking.status === "completed" && (
                      <ReviewButton bookingId={booking.id} />
                    )}
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === booking.id && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-3">
                    {booking.symptoms && <p className="text-sm text-slate-600">🔧 <strong>Reported issue:</strong> {booking.symptoms}</p>}
                    {booking.description && <p className="text-sm text-slate-600">📝 {booking.description}</p>}
                    {booking.notes && <p className="text-sm text-slate-600 bg-yellow-50 rounded-lg px-3 py-2 border border-yellow-200">💬 <strong>Technician notes:</strong> {booking.notes}</p>}
                    {booking.estimatedCost && <p className="text-sm text-slate-600">📊 Initial estimate: ₹{booking.estimatedCost}</p>}

                    {/* Detailed bill */}
                    {booking.status === "completed" && booking.finalAmount && (
                      <ServiceBill bookingId={booking.id} />
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Review Button + Form ──────────────────────────────────────────────────────
function ReviewButton({ bookingId }: { bookingId: number }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [existingRating, setExistingRating] = useState<number | null>(null);

  useEffect(() => {
    api.get(`/reviews/booking/${bookingId}`).then(res => {
      if (res.data.reviewed) setExistingRating(res.data.review.rating);
    }).catch(() => {});
  }, [bookingId]);

  const submit = async () => {
    if (!rating) return;
    setLoading(true);
    try {
      await api.post("/reviews", { bookingId, rating, comment });
      setDone(true);
      setExistingRating(rating);
    } catch (e: any) { alert(e.response?.data?.error || "Failed to submit review"); }
    finally { setLoading(false); }
  };

  if (existingRating) {
    return (
      <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`w-3.5 h-3.5 ${i < existingRating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
        ))}
        <span className="ml-1 text-slate-500">Reviewed</span>
      </div>
    );
  }

  if (done) return <p className="text-xs text-emerald-600 font-medium">⭐ Thanks for your review!</p>;

  return (
    <div>
      <Button size="sm" variant="outline" onClick={() => setOpen(!open)} className="text-xs">
        <Star className="w-3.5 h-3.5" /> Rate Service
      </Button>
      {open && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">How was your experience?</p>
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map(star => (
              <button key={star} onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)} onClick={() => setRating(star)}>
                <Star className={`w-7 h-7 transition-colors ${star <= (hover || rating) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
              </button>
            ))}
            {rating > 0 && <span className="ml-2 text-sm text-slate-600 self-center">{["", "Very Bad", "Bad", "OK", "Good", "Excellent!"][rating]}</span>}
          </div>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Share your experience (optional)..." rows={2} className="input resize-none text-sm mb-3" />
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={submit} loading={loading} disabled={!rating}>Submit Review</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detailed service bill component ──────────────────────────────────────────
function ServiceBill({ bookingId }: { bookingId: number }) {
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (bill) { setOpen(!open); return; }
    setLoading(true);
    try {
      const res = await api.get(`/bookings/${bookingId}`);
      setBill(res.data);
      setOpen(true);
    } catch {} finally { setLoading(false); }
  };

  return (
    <div>
      <button onClick={load} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
        <FileText className="w-4 h-4" /> {loading ? "Loading bill..." : open ? "Hide Service Bill" : "View Service Bill"}
      </button>
      {open && bill && (
        <div className="mt-3 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
            <span className="font-bold text-sm">Service Bill — #{bill.id}</span>
            <span className="text-xs text-slate-400">{formatDate(bill.updatedAt)}</span>
          </div>
          <div className="p-4">
            {bill.partsUsed?.length > 0 ? (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Parts Replaced</p>
                {bill.partsUsed.map((p: any) => (
                  <div key={p.id} className="flex justify-between text-sm py-1.5 border-b border-slate-100">
                    <div>
                      <span className="font-medium text-slate-800">{p.partName}</span>
                      {p.quantity > 1 && <span className="text-slate-500 ml-1">× {p.quantity}</span>}
                    </div>
                    <span className="font-medium text-slate-900">₹{p.totalPrice}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 mb-3 italic">No parts replaced — service only visit</p>
            )}
            <div className="flex justify-between text-sm py-1.5 border-b border-slate-100">
              <span className="text-slate-600">Service Charge</span>
              <span className="font-medium">₹{bill.serviceCharge}</span>
            </div>
            <div className="flex justify-between font-bold text-base mt-2 text-slate-900">
              <span>Total Paid</span>
              <span className="text-primary">₹{bill.finalAmount}</span>
            </div>
            {bill.notes && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                💬 {bill.notes}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5" /> 30-day warranty on all replaced parts
            </div>
            {(bill.tdsBefore || bill.tdsAfter) && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                <p className="text-xs font-semibold text-blue-800 mb-2">💧 TDS Reading (Technician Verified)</p>
                <div className="flex items-center gap-3">
                  {bill.tdsBefore && (
                    <div className="text-center">
                      <p className="text-xs text-slate-500">Before</p>
                      <p className="text-base font-bold text-red-500">{bill.tdsBefore} ppm</p>
                    </div>
                  )}
                  {bill.tdsBefore && bill.tdsAfter && (
                    <div className="text-slate-400 text-lg">→</div>
                  )}
                  {bill.tdsAfter && (
                    <div className="text-center">
                      <p className="text-xs text-slate-500">After</p>
                      <p className="text-base font-bold text-emerald-600">{bill.tdsAfter} ppm</p>
                    </div>
                  )}
                  {bill.tdsBefore && bill.tdsAfter && (
                    <div className="ml-auto bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">
                      -{bill.tdsBefore - bill.tdsAfter} ppm ✅
                    </div>
                  )}
                </div>
                {bill.tdsAfter && bill.tdsAfter <= 150 && (
                  <p className="text-xs text-emerald-600 mt-1.5">✅ Output TDS is now in the safe range (50–150 ppm)</p>
                )}
                {bill.tdsAfter && bill.tdsAfter > 150 && (
                  <p className="text-xs text-orange-600 mt-1.5">⚠️ TDS still above safe range — membrane may need follow-up</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}